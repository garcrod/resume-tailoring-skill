import { readFile, mkdir, mkdtemp, writeFile, copyFile, rename, rm, lstat, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { validateModel, renderMarkdown, renderDocx } from './render.mjs';
import { convertPdf } from './convert.mjs';

const help = `Generate a resume from an approved JSON presentation model.
Usage: node generate-resume.cjs --input MODEL.json --out-dir DIRECTORY
       [--basename Name_Company_Role_Resume] [--pdf] [--overwrite]
       [--libreoffice EXECUTABLE] [--timeout-ms 120000]
Requires Node >=22. PDF additionally requires LibreOffice.
JSON result on stdout; errors/warnings on stderr.
Exit 0: requested formats created; 1: generation failure/partial output;
     2: invalid input/options/collision; 3: rendered page limit exceeded.
The analytical report must be written separately by Copilot.`;

function options(args) {
  const result = { pdf: false, overwrite: false, timeoutMs: 120000 };
  const values = new Map([['--input', 'input'], ['--out-dir', 'outDir'], ['--basename', 'basename'], ['--libreoffice', 'executable'], ['--timeout-ms', 'timeoutMs']]);
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (seen.has(arg)) throw new Error(`Duplicate option: ${arg}`);
    seen.add(arg);
    if (arg === '--pdf' || arg === '--overwrite') result[arg.slice(2)] = true;
    else if (values.has(arg)) {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Missing value for ${arg}`);
      result[values.get(arg)] = args[++i];
    } else throw new Error(`Unknown option: ${arg}`);
  }
  if (!result.input || !result.outDir) throw new Error('--input and --out-dir are required.');
  result.timeoutMs = Number(result.timeoutMs);
  if (!Number.isSafeInteger(result.timeoutMs) || result.timeoutMs < 1 || result.timeoutMs > 2147483647) throw new Error('--timeout-ms must be a positive integer <=2147483647.');
  if (result.executable && !result.pdf) throw new Error('--libreoffice requires --pdf.');
  return result;
}

export function basenameFor(model, explicit) {
  const value = explicit ?? `${model.name}_${model.company}_${model.role}_Resume`.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/\s+/g, '_');
  if (!value || value === '.' || value === '..' || /[<>:"/\\|?*\u0000-\u001f]/.test(value) || /[ .]$/.test(value) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value) || Buffer.byteLength(value) > 180) {
    throw new Error('Unsafe output basename: use a plain filename without separators, reserved names, trailing dots/spaces, or more than 180 UTF-8 bytes.');
  }
  return value;
}

async function exists(file) {
  try { await lstat(file); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

async function publish(file, data, overwrite) {
  const temp = await mkdtemp(path.join(path.dirname(file), '.resume-stage-'));
  try {
    const staged = path.join(temp, 'output');
    await writeFile(staged, data);
    if (overwrite) {
      if (await exists(file) && !(await lstat(file)).isFile()) throw new Error(`Refusing to replace a symlink or non-file: ${file}`);
      await rename(staged, file);
    } else {
      await copyFile(staged, file, constants.COPYFILE_EXCL);
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

export async function generate(config, model, { docx = renderDocx, pdf = convertPdf } = {}) {
  validateModel(model);
  const basename = basenameFor(model, config.basename);
  const dir = path.resolve(config.outDir);
  const inputPath = await realpath(path.resolve(config.input));
  const samePath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
  const targets = {
    markdown: path.join(dir, `${basename}.md`),
    docx: path.join(dir, `${basename}.docx`),
    pdf: path.join(dir, `${basename}.pdf`),
  };
  for (const [format, file] of Object.entries(targets)) {
    if (format === 'pdf' && !config.pdf) continue;
    if (samePath(inputPath, file)) throw new Error(`Input cannot also be an output: ${file}`);
    if (await exists(file)) {
      if (samePath(inputPath, await realpath(file))) throw new Error(`Input cannot also be an output: ${file}`);
      if (!config.overwrite) throw new Error(`Output already exists: ${file}. Use a new basename/directory or explicitly approve --overwrite.`);
      if (!(await lstat(file)).isFile()) throw new Error(`Refusing to replace a symlink or non-file: ${file}`);
    }
  }
  await mkdir(dir, { recursive: true });
  const result = {
    outputs: { markdown: { status: 'failed' }, docx: { status: 'failed' }, pdf: { status: config.pdf ? 'failed' : 'not_requested' } },
    warnings: [`Ensure font "${model.format?.font ?? 'Calibri'}" is installed. Font substitution can change pagination; inspect rendered output.`],
    errors: [],
  };
  if (!config.pdf && await exists(targets.pdf)) result.warnings.push('An older PDF exists at this basename and was not regenerated. It must not be presented as matching this resume.');
  async function attempt(format, action) {
    try {
      const data = await action();
      await publish(targets[format], data, config.overwrite);
      result.outputs[format] = { status: 'created', path: targets[format] };
      return true;
    } catch (error) {
      result.outputs[format] = { status: 'failed', error: error.message };
      result.errors.push(`${format}: ${error.message}`);
      return false;
    }
  }
  await attempt('markdown', () => renderMarkdown(model));
  const docxOk = await attempt('docx', () => docx(model));
  if (config.pdf) {
    if (docxOk) {
      await attempt('pdf', async () => {
        const rendered = await pdf(targets.docx, { executable: config.executable, timeoutMs: config.timeoutMs });
        result.pageCount = rendered.pages;
        return rendered.data;
      });
    } else {
      result.outputs.pdf.error = 'PDF not attempted because DOCX generation failed.';
      result.errors.push(`pdf: ${result.outputs.pdf.error}`);
    }
  }
  result.exitCode = result.errors.length ? 1 : 0;
  if (result.pageCount && model.format?.preferredPages && result.pageCount > model.format.preferredPages) {
    result.warnings.push(`Resume is ${result.pageCount} pages; preferred maximum is ${model.format.preferredPages}. Ask the user whether to prune content or accept the length.`);
    if (!result.exitCode) result.exitCode = 3;
  }
  return result;
}

export async function main(args = process.argv.slice(2)) {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log(help);
    return 0;
  }
  try {
    const config = options(args);
    const model = JSON.parse((await readFile(path.resolve(config.input), 'utf8')).replace(/^\uFEFF/, ''));
    const result = await generate(config, model);
    console.log(JSON.stringify(result, null, 2));
    for (const message of [...result.warnings, ...result.errors]) console.error(message);
    return result.exitCode;
  } catch (error) {
    console.error(error.message);
    console.log(JSON.stringify({ exitCode: 2, errors: [error.message] }));
    return 2;
  }
}
