# Distributing the Copilot CLI plugin

The repository itself is an installable plugin. It does not require a marketplace
listing, registration service, or review submission to be usable.

1. Maintain root `plugin.json` and the complete `skills/resume-tailoring` directory.
2. Run `npm ci`, `npm run build`, `npm test`, and `npm run build:check`.
3. Review real DOCX/PDF samples and the manual workflow checks with synthetic data.
4. Verify discovery in a clean Copilot configuration or a `--plugin-dir` session.
5. Publish changes to this repository only through the normal maintainer process.
   Plugin users install with `copilot plugin install garcrod/resume-tailoring-skill`
   and update with `copilot plugin update resume-tailoring`.

For a marketplace listing, follow GitHub's
[marketplace authoring documentation](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-marketplace).
A catalog must reference the real plugin source. No catalog or public listing
is created by this migration, and no undocumented approval process is assumed.

Standalone distribution must include the entire skill folder, including the
generated script, references, schema, and third-party notices. Importing a single
`SKILL.md` is insufficient. Do not distribute `node_modules`, personal resumes,
real batch state, or temporary conversion artifacts.

Retain the original MIT attribution, distinguish this fork from
[Varun Ramesh's upstream](https://github.com/varunr89/resume-tailoring-skill),
and describe conversion as local without claiming Copilot AI inference is local.
See [README.md](README.md) for installation and privacy details.
