import { build } from 'esbuild';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'skills', 'resume-tailoring', 'scripts', 'generate-resume.cjs');
const entry = path.join(root, 'skills', 'resume-tailoring', 'scripts', 'src', 'generate-resume.mjs');
// The wrapper supports a dependency-free CommonJS executable without changing source ESM imports.
const result = await build({
  stdin: { contents: `import { main } from ${JSON.stringify(entry)}; main().then(code => { process.exitCode = code; }, error => { console.error(error); process.exitCode = 1; });`, resolveDir: root, sourcefile: 'cli-entry.mjs' },
  bundle: true, platform: 'node', target: 'node22', format: 'cjs',
  write: false, minify: true, legalComments: 'inline',
  define: { 'import.meta.url': 'undefined' },
  logLevel: 'warning',
});
const bundled = result.outputFiles[0].text;
const require = createRequire(import.meta.url);
const notices = ['Bundled JavaScript licenses for the resume generator.\nProject attribution: see the repository MIT LICENSE.\n'];
const seen = new Set();
async function licenseTree(name, from = root) {
  const req = createRequire(path.join(from, 'package.json'));
  let pkgPath;
  try { pkgPath = req.resolve(`${name}/package.json`); }
  catch (error) {
    if (error.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') throw error;
    let dir = path.dirname(req.resolve(name));
    while (path.dirname(dir) !== dir) {
      try {
        const candidate = path.join(dir, 'package.json');
        const pkg = JSON.parse(await readFile(candidate, 'utf8'));
        if (pkg.name === name) { pkgPath = candidate; break; }
      } catch (readError) { if (readError.code !== 'ENOENT') throw readError; }
      dir = path.dirname(dir);
    }
    if (!pkgPath) throw new Error(`Cannot locate license metadata for ${name}`);
  }
  if (seen.has(pkgPath)) return;
  seen.add(pkgPath);
  const dir = path.dirname(pkgPath);
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
  let license;
  for (const filename of (await readdir(dir)).filter(file => /^licen[sc]e(?:[.-].*)?$/i.test(file)).sort()) {
    try { license = await readFile(path.join(dir, filename), 'utf8'); break; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (!license) {
    const readme = await readFile(path.join(dir, 'README.md'), 'utf8');
    const heading = /^#{1,6}\s+LICENSE\b/im.exec(readme);
    if (heading) license = readme.slice(heading.index);
  }
  if (!license) throw new Error(`Missing bundled license text for ${name}`);
  notices.push(`\n--- ${pkg.name}@${pkg.version} (${pkg.license}) ---\n${license.replace(/\r\n/g, '\n')}`);
  for (const dependency of Object.keys(pkg.dependencies ?? {}).sort()) await licenseTree(dependency, dir);
}
const pkg = require('../package.json');
for (const dependency of Object.keys(pkg.dependencies).sort()) await licenseTree(dependency);
const files = [[output, bundled], [path.join(root, 'skills', 'resume-tailoring', 'THIRD-PARTY-NOTICES.txt'), notices.join('\n')]];
for (const [file, content] of files) {
  if (process.argv.includes('--check')) {
    if (await readFile(file, 'utf8') !== content) throw new Error(`Stale generated asset: ${file}. Run npm run build.`);
  } else await writeFile(file, content);
}
