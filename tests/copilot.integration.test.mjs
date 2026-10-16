import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, cp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('Copilot CLI discovers native plugin and independent standalone skill', {
  skip: process.env.TEST_COPILOT !== '1' ? 'Set TEST_COPILOT=1 to test the installed Copilot CLI without model calls.' : false,
}, async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'resume-copilot-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const env = { ...process.env, COPILOT_HOME: path.join(dir, 'copilot-home') };
  await mkdir(env.COPILOT_HOME);
  const project = path.join(dir, 'project');
  await mkdir(project);
  function list(args, source) {
    const run = spawnSync('copilot', [...args, 'skill', 'list', '--json'], { cwd: project, env, encoding: 'utf8', timeout: 30000 });
    assert.equal(run.status, 0, run.error?.message ?? run.stderr);
    const skill = JSON.parse(run.stdout).find(item => item.name === 'resume-tailoring');
    assert.ok(skill, run.stdout);
    assert.equal(skill.source, source);
    assert.equal(skill.enabled, true);
    return skill;
  }
  const plugin = list(['--plugin-dir', root], 'plugin');
  assert.equal(path.resolve(plugin.path), path.join(root, 'skills', 'resume-tailoring'));
  const target = path.join(project, '.github', 'skills', 'resume-tailoring');
  await cp(path.join(root, 'skills', 'resume-tailoring'), target, { recursive: true });
  const standalone = list([], 'project');
  assert.equal(path.resolve(standalone.path), target);
});
