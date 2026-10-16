import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import { convertPdf, findOffice, officeCandidates, runOffice } from '../skills/resume-tailoring/scripts/src/convert.mjs';

test('executable discovery honors override and platform locations', async () => {
  assert.equal(await findOffice(process.execPath), process.execPath);
  await assert.rejects(findOffice(path.join(os.tmpdir(), 'nonexistent-resume-office-executable')), /not found/);
  assert.ok(officeCandidates('win32', { PATH: '' }).some(file => file.includes('LibreOffice')));
  assert.ok(officeCandidates('darwin', { PATH: '' }).includes('/Applications/LibreOffice.app/Contents/MacOS/soffice'));
  assert.ok(officeCandidates('linux', { PATH: '/custom/bin' }).includes(path.join('/custom/bin', 'soffice')));
});

test('headless arguments isolate a fresh profile, preserve paths, inspect PDF and clean up', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'resume-convert-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const input = path.join(dir, 'r\u00e9sum\u00e9 & data.docx');
  await writeFile(input, 'synthetic input');
  let temp;
  let profile;
  const run = async (exe, args, timeout) => {
    assert.equal(exe, process.execPath);
    assert.equal(timeout, 1234);
    assert.ok(args.includes('--headless'));
    assert.ok(args.includes('pdf:writer_pdf_Export'));
    assert.equal(args.at(-1), input);
    profile = fileURLToPath(args[0].slice('-env:UserInstallation='.length));
    temp = args[args.indexOf('--outdir') + 1];
    assert.equal(path.dirname(profile), temp);
    const pdf = await PDFDocument.create();
    pdf.addPage();
    pdf.addPage();
    await writeFile(path.join(temp, 'r\u00e9sum\u00e9 & data.pdf'), await pdf.save());
  };
  const result = await convertPdf(input, { executable: process.execPath, timeoutMs: 1234, run });
  assert.equal(result.pages, 2);
  await assert.rejects(access(temp));
  assert.equal(await readFile(input, 'utf8'), 'synthetic input');
  let secondProfile;
  await assert.rejects(convertPdf(input, { executable: process.execPath, run: async (_, args) => { secondProfile = args[0]; } }), /produced no PDF/);
  assert.notEqual(secondProfile, `-env:UserInstallation=${profile}`);
});

test('missing, empty, invalid and stale PDF cannot be reported as success', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'resume-convert-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const input = path.join(dir, 'Resume.docx');
  await writeFile(path.join(dir, 'Resume.pdf'), '%PDF-stale');
  await assert.rejects(convertPdf(input, { executable: process.execPath, run: async () => {} }), /produced no PDF/);
  for (const content of ['', 'not PDF', '%PDF-malformed']) {
    await assert.rejects(convertPdf(input, {
      executable: process.execPath,
      run: async (_, args) => writeFile(path.join(args[args.indexOf('--outdir') + 1], 'Resume.pdf'), content),
    }));
  }
  assert.equal(await readFile(path.join(dir, 'Resume.pdf'), 'utf8'), '%PDF-stale');
});

test('process runner surfaces launch failure, nonzero exits, and bounded timeout', async () => {
  await assert.rejects(runOffice('missing-resume-executable', [], 5000), /Cannot start LibreOffice/);
  await assert.rejects(runOffice(process.execPath, ['-e', 'console.error("synthetic failure");process.exit(7)'], 5000), /status 7.*synthetic failure/s);
  await assert.rejects(runOffice(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], 200), /timed out/);
  assert.match(await runOffice(process.execPath, ['-e', 'console.log("ok")'], 5000), /ok/);
});
