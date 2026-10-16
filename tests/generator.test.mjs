import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, cp, readdir, chmod, lstat, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { unzipSync, strFromU8 } from 'fflate';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { validateModel, renderMarkdown, renderDocx } from '../skills/resume-tailoring/scripts/src/render.mjs';
import { generate, basenameFor } from '../skills/resume-tailoring/scripts/src/generate-resume.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = path.join(root, 'tests', 'fixtures', 'resume.json');
const model = JSON.parse(await readFile(fixture, 'utf8'));
const bundle = path.join(root, 'skills', 'resume-tailoring', 'scripts', 'generate-resume.cjs');

async function workspace(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'resume-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

function wordText(xml) {
  const parsed = new XMLParser({ preserveOrder: true, ignoreAttributes: false, trimValues: false, parseTagValue: false }).parse(xml);
  const values = [];
  function visit(nodes) {
    for (const node of nodes) for (const [key, value] of Object.entries(node)) {
      if (key === 'w:t') values.push(value.map(item => item['#text'] ?? '').join(''));
      else if (Array.isArray(value)) visit(value);
    }
  }
  visit(parsed);
  return values;
}

test('approved text, sections, bullets, links, paper and margins survive DOCX rendering', async () => {
  validateModel(model);
  const zip = unzipSync(await renderDocx(model));
  for (const [name, data] of Object.entries(zip)) {
    if (name.endsWith('.xml') || name.endsWith('.rels')) assert.equal(XMLValidator.validate(strFromU8(data)), true, name);
  }
  const document = strFromU8(zip['word/document.xml']);
  const expected = [model.name, ...model.contact.flatMap(runs => runs.map(run => run.text)),
    ...model.sections.flatMap(section => [section.heading, ...section.blocks.flatMap(block => (block.runs ?? []).map(run => run.text))])];
  assert.deepEqual(wordText(document), expected);
  assert.equal((document.match(/<w:numPr>/g) ?? []).length, 2);
  assert.match(document, /w:w="11906" w:h="16838"/);
  assert.match(document, /w:top="1080"/);
  assert.match(strFromU8(zip['word/numbering.xml']), /w:val="bullet"/);
  assert.match(strFromU8(zip['word/_rels/document.xml.rels']), /mailto:alex@example.test/);
  assert.match(renderMarkdown(model), /\[Portfolio\]\(<https:\/\/example.test\/alex>\)/);
  assert.match(renderMarkdown(model), /- Built CI\/CD tools for 3 synthetic projects\./);
});

test('arbitrary section order, rich text, Unicode, page controls and Letter paper', async () => {
  const input = structuredClone(model);
  input.name = 'Alex \u00c9xample';
  input.sections.reverse();
  input.sections[0].blocks.push({ type: 'pageBreak' }, { type: 'paragraph', pageBreakBefore: true, runs: [{ text: 'A & B < C [literal]*', bold: true, italic: true }] });
  input.format.paper = 'Letter';
  validateModel(input);
  const document = strFromU8(unzipSync(await renderDocx(input))['word/document.xml']);
  assert.match(document, /w:w="12240" w:h="15840"/);
  assert.match(document, /<w:br w:type="page"/);
  assert.match(document, /w:pageBreakBefore/);
  assert.ok(document.indexOf('Education') < document.indexOf('Professional Experience'));
  assert.ok(wordText(document).includes('A & B < C [literal]*'));
  assert.match(renderMarkdown(input), /A & B \\< C \\\[literal\\\]\\\*/);
});

test('invalid models and unsafe basenames fail explicitly', () => {
  for (const input of [{}, { ...model, surprise: true }, { ...model, sections: [] }, { ...model, format: { marginInches: 0.1 } }, { ...model, format: { bodyPt: 10.25 } }, { ...model, name: 'Invalid\u0000text' }, { ...model, name: 'Invalid\ud800text' }]) {
    assert.throws(() => validateModel(input), /Invalid approved resume model/);
  }
  const input = structuredClone(model);
  input.contact[0][0].link = 'javascript:alert(1)';
  assert.throws(() => validateModel(input), /Invalid approved resume model/);
  for (const name of ['..', '../escape', 'folder\\escape', 'CON', 'NUL.txt', 'trailing.', 'name ', 'x'.repeat(181)]) {
    assert.throws(() => basenameFor(model, name), /Unsafe output basename/);
  }
  assert.equal(basenameFor(model), 'Alex_Example_Example_Labs_Software_Engineer_Resume');
});

test('literal text cannot turn paragraphs into unintended Markdown lists', () => {
  const input = structuredClone(model);
  input.sections[0].blocks = [
    { type: 'paragraph', runs: [{ text: '- literal minus' }] },
    { type: 'paragraph', runs: [{ text: '+ literal plus' }] },
    { type: 'paragraph', runs: [{ text: '1. literal number' }] },
  ];
  const markdown = renderMarkdown(input);
  assert.ok(markdown.includes('\\- literal minus'));
  assert.ok(markdown.includes('\\+ literal plus'));
  assert.ok(markdown.includes('1\\. literal number'));
});

test('creates default outputs and refuses collisions without modifying files', async t => {
  const dir = await workspace(t);
  const config = { input: fixture, outDir: dir, basename: 'Resume' };
  const result = await generate(config, model);
  assert.equal(result.exitCode, 0);
  assert.equal(result.outputs.pdf.status, 'not_requested');
  const before = await readFile(path.join(dir, 'Resume.docx'));
  await assert.rejects(generate(config, model), /Output already exists/);
  assert.deepEqual(await readFile(path.join(dir, 'Resume.docx')), before);
  assert.deepEqual((await readdir(dir)).sort(), ['Resume.docx', 'Resume.md']);
  assert.equal((await generate({ ...config, overwrite: true }, model)).exitCode, 0);
});

test('symlink outputs and input/output aliases are rejected', async t => {
  const dir = await workspace(t);
  const input = path.join(dir, 'Resume.md');
  await writeFile(input, 'original');
  await assert.rejects(generate({ input, outDir: dir, basename: 'Resume', overwrite: true }, model), /Input cannot also be an output/);
  if (process.platform === 'win32') {
    await assert.rejects(generate({ input: input.toUpperCase(), outDir: dir, basename: 'Resume', overwrite: true }, model), /Input cannot also be an output/);
  }
  if (process.platform !== 'win32') {
    await symlink(input, path.join(dir, 'Resume.docx'));
    await assert.rejects(generate({ input: fixture, outDir: dir, basename: 'Resume', overwrite: true }, model), /symlink or non-file/);
  }
});

test('DOCX/PDF failure preserves Markdown and existing user files with truthful statuses', async t => {
  const dir = await workspace(t);
  const config = { input: fixture, outDir: dir, basename: 'Resume', pdf: true, overwrite: true };
  await writeFile(path.join(dir, 'Resume.pdf'), 'prior user PDF');
  const failedDocx = await generate(config, model, { docx: async () => { throw new Error('synthetic DOCX failure'); } });
  assert.equal(failedDocx.exitCode, 1);
  assert.equal(failedDocx.outputs.markdown.status, 'created');
  assert.equal(failedDocx.outputs.docx.status, 'failed');
  assert.match(failedDocx.outputs.pdf.error, /DOCX generation failed/);
  assert.equal(await readFile(path.join(dir, 'Resume.pdf'), 'utf8'), 'prior user PDF');
  const failedPdf = await generate(config, model, { pdf: async () => { throw new Error('synthetic PDF failure'); } });
  assert.equal(failedPdf.outputs.docx.status, 'created');
  assert.equal(failedPdf.outputs.pdf.status, 'failed');
  assert.equal(failedPdf.exitCode, 1);
  assert.equal(await readFile(path.join(dir, 'Resume.pdf'), 'utf8'), 'prior user PDF');
});

test('actual page count triggers user length decision without altering content', async t => {
  const dir = await workspace(t);
  const result = await generate({ input: fixture, outDir: dir, pdf: true }, model, {
    pdf: async () => ({ data: Buffer.from('%PDF-test'), pages: 2 }),
  });
  assert.equal(result.exitCode, 3);
  assert.equal(result.pageCount, 2);
  assert.equal(result.outputs.pdf.status, 'created');
  assert.match(result.warnings.join(' '), /Ask the user/);
  assert.equal(await readFile(result.outputs.markdown.path, 'utf8'), renderMarkdown(model));
});

test('standalone read-only skill runs outside checkout without node_modules', async t => {
  const dir = await workspace(t);
  const installed = path.join(dir, 'installed skill');
  await cp(path.join(root, 'skills', 'resume-tailoring'), installed, { recursive: true });
  const cli = path.join(installed, 'scripts', 'generate-resume.cjs');
  await chmod(cli, 0o444);
  const before = (await lstat(cli)).mtimeMs;
  const input = path.join(dir, 'approved r\u00e9sum\u00e9.json');
  await writeFile(input, JSON.stringify(model));
  const run = spawnSync(process.execPath, [cli, '--input', input, '--out-dir', path.join(dir, 'output with spaces')], { cwd: dir, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(run.stdout).outputs.docx.status, 'created');
  assert.equal((await lstat(cli)).mtimeMs, before);
  await chmod(cli, 0o644);
});

test('CLI help, invalid arguments, malformed JSON and missing converter give actionable exit codes', async t => {
  const dir = await workspace(t);
  assert.equal(spawnSync(process.execPath, [bundle, '--help'], { encoding: 'utf8' }).status, 0);
  for (const args of [[], ['--bad'], ['--input'], ['--input', fixture, '--out-dir', dir, '--timeout-ms', 'NaN']]) {
    const run = spawnSync(process.execPath, [bundle, ...args], { encoding: 'utf8' });
    assert.equal(run.status, 2, run.stderr);
    assert.ok(JSON.parse(run.stdout).errors.length > 0);
  }
  const invalid = path.join(dir, 'invalid.json');
  await writeFile(invalid, '{');
  assert.equal(spawnSync(process.execPath, [bundle, '--input', invalid, '--out-dir', dir], { encoding: 'utf8' }).status, 2);
  const run = spawnSync(process.execPath, [bundle, '--input', fixture, '--out-dir', dir, '--pdf', '--libreoffice', path.join(dir, 'missing.exe')], { encoding: 'utf8' });
  assert.equal(run.status, 1, run.stderr);
  const status = JSON.parse(run.stdout);
  assert.equal(status.outputs.markdown.status, 'created');
  assert.equal(status.outputs.docx.status, 'created');
  assert.equal(status.outputs.pdf.status, 'failed');
});
