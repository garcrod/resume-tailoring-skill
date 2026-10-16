import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { generate } from '../skills/resume-tailoring/scripts/src/generate-resume.mjs';
import { findOffice } from '../skills/resume-tailoring/scripts/src/convert.mjs';

let executable;
let unavailable;
try { executable = await findOffice(process.env.LIBREOFFICE_PATH); }
catch (error) { unavailable = error.message; }

test('real LibreOffice preserves approved text and one/two-page layout', {
  skip: unavailable && process.env.REQUIRE_PDF_TESTS !== '1' ? unavailable : false,
}, async t => {
  assert.ok(executable, unavailable);
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const dir = await mkdtemp(path.join(os.tmpdir(), 'resume-pdf-integration-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const fixture = new URL('fixtures/resume.json', import.meta.url);
  const original = JSON.parse(await readFile(fixture, 'utf8'));
  for (const pages of [1, 2]) {
    const model = structuredClone(original);
    model.format.preferredPages = pages;
    if (pages === 2) {
      model.sections.at(-1).blocks.push({ type: 'pageBreak' });
      model.sections.push({
        heading: 'Additional Projects',
        blocks: [{ type: 'paragraph', runs: [{ text: 'Second page approved project details.' }] }],
      });
    }
    const result = await generate({ input: fileURLToPath(fixture), outDir: path.join(dir, String(pages)), pdf: true, executable, timeoutMs: 120000 }, model);
    assert.equal(result.exitCode, 0, result.errors.join('\n'));
    assert.equal(result.pageCount, pages);
    const pdf = await getDocument({ data: new Uint8Array(await readFile(result.outputs.pdf.path)), useSystemFonts: true }).promise;
    try {
      let text = '';
      for (let page = 1; page <= pdf.numPages; page++) {
        text += (await (await pdf.getPage(page)).getTextContent()).items.map(item => item.str).join(' ') + ' ';
      }
      let previous = -1;
      const expected = [model.name, ...model.contact.map(runs => runs.map(run => run.text).join('')),
        ...model.sections.flatMap(section => [section.heading, ...section.blocks.filter(block => block.runs).map(block => block.runs.map(run => run.text).join(''))])];
      for (const content of expected) {
        const index = text.indexOf(content, previous + 1);
        assert.ok(index > previous, `Missing or out-of-order PDF text: ${content}\n${text}`);
        previous = index;
      }
      const annotations = await (await pdf.getPage(1)).getAnnotations();
      assert.ok(annotations.some(item => item.url === 'mailto:alex@example.test'));
      if (process.env.RESUME_TEST_ARTIFACTS) {
        const { createCanvas } = await import('@napi-rs/canvas');
        const output = path.resolve(process.env.RESUME_TEST_ARTIFACTS);
        await mkdir(output, { recursive: true });
        await writeFile(path.join(output, `resume-${pages}-page.pdf`), await readFile(result.outputs.pdf.path));
        await writeFile(path.join(output, `resume-${pages}-page.docx`), await readFile(result.outputs.docx.path));
        for (let number = 1; number <= pdf.numPages; number++) {
          const page = await pdf.getPage(number);
          const viewport = page.getViewport({ scale: 1.25 });
          const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          await writeFile(path.join(output, `resume-${pages}-page-${number}.png`), canvas.toBuffer('image/png'));
        }
      }
    } finally {
      await pdf.destroy();
    }
  }
});
