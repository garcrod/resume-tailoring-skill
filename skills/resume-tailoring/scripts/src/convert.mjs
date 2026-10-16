import { access, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { PDFDocument } from 'pdf-lib';

async function executableExists(file) {
  try {
    await access(file, process.platform === 'win32' ? constants.F_OK : constants.X_OK);
    return (await stat(file)).isFile();
  } catch (error) {
    if (['ENOENT', 'ENOTDIR', 'EACCES'].includes(error.code)) return false;
    throw error;
  }
}

export function officeCandidates(platform = process.platform, env = process.env) {
  const names = platform === 'win32' ? ['soffice.com', 'soffice.exe'] : ['soffice', 'libreoffice'];
  const paths = (env.PATH ?? '').split(platform === 'win32' ? ';' : ':').filter(Boolean);
  const candidates = paths.flatMap(dir => names.map(name => path.join(dir, name)));
  if (platform === 'win32') {
    for (const root of [env.ProgramFiles, env['ProgramFiles(x86)'], 'C:\\Program Files', 'C:\\Program Files (x86)'].filter(Boolean)) {
      candidates.push(path.join(root, 'LibreOffice', 'program', 'soffice.com'), path.join(root, 'LibreOffice', 'program', 'soffice.exe'));
    }
  } else if (platform === 'darwin') {
    candidates.push('/Applications/LibreOffice.app/Contents/MacOS/soffice', path.join(env.HOME ?? os.homedir(), 'Applications/LibreOffice.app/Contents/MacOS/soffice'));
  } else {
    candidates.push('/usr/bin/soffice', '/usr/bin/libreoffice', '/usr/local/bin/soffice', '/opt/libreoffice/program/soffice');
  }
  return [...new Set(candidates)];
}

export async function findOffice(override) {
  if (override) {
    const resolved = path.resolve(override);
    if (!await executableExists(resolved)) throw new Error(`LibreOffice executable not found or not executable: ${resolved}`);
    return resolved;
  }
  for (const file of officeCandidates()) if (await executableExists(file)) return file;
  throw new Error('LibreOffice not found. Install LibreOffice for PDF export or pass --libreoffice with its executable path. MD/DOCX do not require LibreOffice.');
}

export function runOffice(executable, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      shell: false, windowsHide: true, detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    let timedOut = false;
    let launchError;
    let termination;
    const collect = chunk => { output = `${output}${chunk}`.slice(-16000); };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    const timer = setTimeout(() => {
      timedOut = true;
      if (!child.pid) return;
      if (process.platform === 'win32') {
        termination = new Promise(done => {
          const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
          killer.on('error', error => { launchError = new Error(`Cannot terminate LibreOffice process tree: ${error.message}`); child.kill('SIGKILL'); });
          killer.on('close', code => {
            if (code !== 0 && child.exitCode === null && child.signalCode === null) {
              launchError = new Error(`Cannot terminate LibreOffice process tree (taskkill status ${code}).`);
              child.kill('SIGKILL');
            }
            done();
          });
        });
      } else {
        try { process.kill(-child.pid, 'SIGKILL'); }
        catch (error) { if (error.code !== 'ESRCH') launchError = error; }
      }
    }, timeoutMs);
    child.on('error', error => { launchError = error; });
    child.on('close', async code => {
      clearTimeout(timer);
      await termination;
      if (launchError) reject(new Error(`Cannot start LibreOffice: ${launchError.message}`));
      else if (timedOut) reject(new Error(`LibreOffice timed out after ${timeoutMs} ms. ${output}`));
      else if (code !== 0) reject(new Error(`LibreOffice exited with status ${code}. ${output}`));
      else resolve(output);
    });
  });
}

export async function convertPdf(docxPath, { executable, timeoutMs = 120000, run = runOffice } = {}) {
  const office = await findOffice(executable);
  const temp = await mkdtemp(path.join(os.tmpdir(), 'resume-pdf-'));
  try {
    const args = [
      `-env:UserInstallation=${pathToFileURL(path.join(temp, 'profile')).href}`,
      '--headless', '--nologo', '--norestore',
      '--convert-to', 'pdf:writer_pdf_Export', '--outdir', temp, path.resolve(docxPath),
    ];
    await run(office, args, timeoutMs);
    const file = path.join(temp, `${path.basename(docxPath, path.extname(docxPath))}.pdf`);
    let data;
    try {
      data = await readFile(file);
    } catch (error) {
      if (error.code === 'ENOENT') throw new Error('LibreOffice reported success but produced no PDF.');
      throw error;
    }
    if (!data.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error('LibreOffice produced an empty or invalid PDF.');
    const pages = (await PDFDocument.load(data)).getPageCount();
    if (pages < 1) throw new Error('LibreOffice produced a PDF without pages.');
    return { data, pages };
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
