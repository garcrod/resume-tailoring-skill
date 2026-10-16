import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skill = path.join(root, 'skills', 'resume-tailoring');
const text = file => readFile(path.join(skill, file), 'utf8');
const contract = JSON.parse(await readFile(new URL('fixtures/workflow-contract.json', import.meta.url), 'utf8'));

test('matching and branching logic are identical to the pre-migration references', async () => {
  for (const [file, hash] of Object.entries({
    'matching-strategies.md': '10fb27c23b685577fbbb5bbb4d2c7dc1e65bfd2eb2e1d7646fbecdb426a5ff76',
    'branching-questions.md': '8344cf6ca81c89c087323fd7b920d5f981d7da43196a1f1c56eb8fe707a033ed',
  })) {
    assert.equal(createHash('sha256').update((await text(file)).replace(/\r\n/g, '\n').trim()).digest('hex'), hash);
  }
});

test('all original phases, checkpoints, scoring and batch features remain', async () => {
  const single = await text('SKILL.md');
  const batch = await text('multi-job-workflow.md');
  let previous = -1;
  for (const phase of contract.singleJobPhases) {
    const index = single.indexOf(phase, previous + 1);
    assert.ok(index > previous, `Phase order: ${phase}`);
    previous = index;
  }
  for (const checkpoint of contract.checkpoints) assert.ok(single.includes(checkpoint), checkpoint);
  assert.ok(single.includes('Overall = (Direct × 0.4) + (Transfer × 0.3) + (Adjacent × 0.2) + (Impact × 0.1)'));
  for (const feature of contract.batchFeatures) assert.ok(batch.includes(feature), feature);
  assert.match(single, /Company name and dates MUST be exact/);
  assert.match(single, /NEVER fabricate/);
  assert.match(single, /Source: \{resume_name\}/);
  assert.match(batch, /For each job in batch \(job.status == "pending"\)/);
  assert.match(batch, /Don't re-ask questions already answered/);
});

test('Copilot manifest and skill metadata are valid and self-contained', async () => {
  const manifest = JSON.parse(await readFile(path.join(root, 'plugin.json'), 'utf8'));
  assert.equal(manifest.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
  assert.equal(manifest.name, 'resume-tailoring');
  assert.match(manifest.repository, /garcrod\/resume-tailoring-skill$/);
  assert.deepEqual(Object.keys(manifest).sort(), ['$schema', 'author', 'description', 'keywords', 'license', 'name', 'repository', 'version'].sort());
  assert.match(await text('SKILL.md'), /^---\r?\nname: resume-tailoring\r?\ndescription: .+\r?\n---/);
  for (const file of ['research-prompts.md', 'matching-strategies.md', 'branching-questions.md', 'multi-job-workflow.md', 'scripts/generate-resume.cjs', 'THIRD-PARTY-NOTICES.txt']) {
    assert.ok((await stat(path.join(skill, file))).size > 0, file);
  }
  for (const file of await readdir(skill, { recursive: true })) {
    if (!file.endsWith('.md')) continue;
    const content = await text(file);
    assert.doesNotMatch(content, /document-skills:|WebSearch|WebFetch|Use (Glob|Read) tool|superpowers:/);
    for (const match of content.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)) {
      if (/^[a-z]+:/i.test(match[1])) continue;
      const target = path.resolve(path.dirname(path.join(skill, file)), match[1]);
      assert.ok(target.startsWith(`${skill}${path.sep}`), `${file}: escaping resource`);
      assert.ok((await stat(target)).isFile(), `${file}: missing ${match[1]}`);
    }
  }
});
