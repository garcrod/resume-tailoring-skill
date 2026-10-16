import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, ['--test', 'tests/pdf.integration.test.mjs'], {
  stdio: 'inherit', env: { ...process.env, REQUIRE_PDF_TESTS: '1' },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
