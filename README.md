# Resume Tailoring for GitHub Copilot CLI

Tailor resumes from your existing Markdown resume library without inventing
experience. The skill preserves the original research, branching interviews,
transparent matching, approval checkpoints, batch workflows, and library updates.
Local tooling produces Markdown, editable DOCX, and optional PDF.

## Requirements

- GitHub Copilot CLI with skills/plugins enabled and a Copilot account.
- An existing Markdown resume library, normally `resumes` in your workspace.
- Node.js 22 or newer for the bundled document generator.
- LibreOffice for **optional PDF export**. Word and additional document skills
  are not required.

Plugin and standalone discovery have been checked with Copilot CLI `1.0.99-2`;
older releases are not asserted compatible with the manifest format.

The document commands target Windows, macOS, and Linux. CI is configured for all three;
see [validation evidence and manual scenarios](docs/testing/copilot-smoke-tests.md)
for what has actually been exercised. Fonts and LibreOffice versions can change
pagination, so review rendered pages before submission.

## Install

### Plugin (recommended)

From a terminal:

```powershell
copilot plugin install garcrod/resume-tailoring-skill
copilot plugin list
```

Then in a new Copilot CLI session:

```text
/skills list
/skills info resume-tailoring
```

Direct repository/path installs work in the tested CLI release, but that release
warns they are deprecated in favor of marketplace installs in a future version.
No marketplace listing is claimed; see [distribution guidance](SUBMISSION_GUIDE.md).

For development, clone the repository and load it without installing or modifying
your user configuration:

```powershell
git clone https://github.com/garcrod/resume-tailoring-skill.git
Set-Location resume-tailoring-skill
copilot --plugin-dir .
```

### Standalone skill

Copy the **whole** `skills/resume-tailoring` directory into either your project's
`.github/skills` or your personal `$HOME/.copilot/skills` directory.
Do not copy only `SKILL.md`: references and the bundled generator are required.

PowerShell, from this checkout (personal installation):

```powershell
$dest = Join-Path $HOME '.copilot\skills\resume-tailoring'
if (Test-Path $dest) { throw "Destination exists: $dest. Review or back it up first." }
New-Item -ItemType Directory -Force (Split-Path $dest) | Out-Null
Copy-Item -Recurse '.\skills\resume-tailoring' $dest
```

For project installation, use `.github\skills\resume-tailoring` in the project
where you keep your resume workspace as the destination. On macOS/Linux use
the equivalent native paths and copy the complete directory.

Run `/skills reload`, then `/skills info resume-tailoring` in the session.
The root `skills` directory is a plugin component, not a default standalone
project discovery location.

Avoid installing the same skill through both methods. Importing a single
`SKILL.md` using `copilot skill add` does not include its supporting files;
directory registration is a different operation, not a full-package copy.

## Document dependencies

Install a supported Node.js LTS release from [nodejs.org](https://nodejs.org/).
Check `node --version`. End users do not need npm dependencies: the checked-in
generator includes its JavaScript dependencies and third-party license notices.
No files are written into installed plugin assets.

For PDF, install [LibreOffice](https://www.libreoffice.org/download/download-libreoffice/):

| System | Typical setup | Discovery |
|---|---|---|
| Windows | `winget install --id TheDocumentFoundation.LibreOffice --exact` | PATH or Program Files |
| macOS | `brew install --cask libreoffice` | PATH or Applications |
| Linux (Debian/Ubuntu) | `sudo apt-get install libreoffice-writer fonts-liberation` | PATH or standard binary locations |

These are manual setup examples, not automatic installation hooks. Other Linux
distributions use their own package managers. For nonstandard installs pass
`--libreoffice` with the executable's full path.

Install the font used by your resume or agree on an available alternative such
as Liberation Sans. Default styling remains Calibri 11pt body/12pt headings.
Paper size and margins are explicit; missing fonts may cause substitution.

## Use

Keep source resumes in a workspace separate from installed skill files:

```text
resume-workspace/
  resumes/
    Resume_General.md
    Resume_Previous_Role.md
```

Start Copilot in that workspace and prompt:

```text
Use /resume-tailoring to apply for Engineer at Example Labs.
My resume library is in the resumes directory. Here is the job description: ...
Create Markdown and DOCX; also export PDF.
```

If the library is outside the workspace, approve directory access when prompted
or add it with `/add-dir`. Use public company/role information for research;
private resumes need not be included in search queries.

For multiple jobs:

```text
Use /resume-tailoring for these three roles: ...
```

The skill offers opt-in batch mode, builds the library once, deduplicates gaps,
conducts shared discovery, then tailors each job sequentially. Interactive mode
is the default; express mode skips only per-job research/template/mapping
checkpoints after you choose it. Final review and library updates still require
your approval. To resume: `Resume batch <batch_id>`. Previously saved state and
phase artifacts, not session memory alone, determine where to continue.

## Workflow and unchanged tailoring logic

Single job: library initialization, company/role research, approved template,
optional experience discovery, approved content mapping, generation, final review,
then optional library update.

Matching remains direct 40%, transferable 30%, adjacent 20%, impact 10%.
Confidence bands remain direct 90-100%, transferable 75-89%, adjacent 60-74%;
below 60% invokes the original gap-handling options. These are transparent
workflow assessments, not statistical guarantees of hiring success.

Batch mode preserves shared gap analysis/discovery, per-job research, incremental
additions, selective review, revisions, archive-not-delete removal, pause/resume,
and user-controlled library enrichment. Small-batch guidance is not a new hard
limit. Cover-letter writing and LinkedIn profile optimization remain out of scope.

See [the skill](skills/resume-tailoring/SKILL.md),
[matching](skills/resume-tailoring/matching-strategies.md),
[discovery](skills/resume-tailoring/branching-questions.md), and
[batch workflow](skills/resume-tailoring/multi-job-workflow.md).

## Outputs and recovery

Normal delivered files are `{Name}_{Company}_{Role}_Resume.md`, `.docx`, and
`_Report.md`. PDF is opt-in. The report includes coverage, source provenance,
reframing/gaps, and interview-preparation recommendations.
Batch files remain under `resumes/batches/<batch_id>/job-<N>-<company>/`.
Internal presentation models/state are not source resumes.

The bundled generator renders MD/DOCX from one approved content model, then
exports that DOCX to PDF through LibreOffice. It never changes scores or
rewrites facts. It protects existing files unless replacement is explicitly
approved. PDF page count is measured; excessive length is returned to you for
the original pruning/acceptance decision.

On failure, Copilot explains what is missing and preserves successful artifacts:
missing LibreOffice does not prevent DOCX; failed DOCX does not discard Markdown.
No failed format is shown as generated. Library updates still require approval.
Unavailable web research falls back explicitly to JD-only analysis.

See [the document model and CLI](skills/resume-tailoring/references/document-generation.md)
for generator arguments, JSON statuses, error codes, page preferences, and
nonstandard LibreOffice paths.

## Update and remove

```powershell
copilot plugin update resume-tailoring
copilot plugin uninstall resume-tailoring
```

For standalone copies, back up local changes before replacing the entire skill
folder; reload afterward. Installed plugins may be cached; source-checkout edits
are not automatically reflected in a previously installed copy. Use a fresh
`--plugin-dir` session for local development.

## Development

```powershell
npm ci
npm run build
npm test
npm run build:check
```

The build bundles the renderer and dependency licenses into the skill directory.
Commit regenerated assets with source changes; no global npm install is needed.
`npm run build:check` rejects stale artifacts.

`npm test` includes packaging, unchanged matching/discovery fingerprints, workflow
contracts, DOCX XML/text, standalone execution, and conversion failures.
Real PDF integration is skipped locally if LibreOffice is missing; use
`REQUIRE_PDF_TESTS=1` to require it, and `LIBREOFFICE_PATH` for an explicit binary.
`npm run test:pdf` requires real LibreOffice and fails instead of skipping if it
is unavailable.
CI requires real PDF tests on every supported OS.
If native PDF-test dependencies fail to load, check that `npm config get os`
matches the host (or is unset), then perform a clean install. A forced Linux npm
configuration on Windows installs the wrong native packages; do not change
global settings just for this repository.
See [manual workflow checks](docs/testing/multi-job-test-checklist.md).

## Privacy and attribution

Document generation/conversion runs locally; the generator does not upload
resumes. Content provided to Copilot is processed according to your Copilot
service configuration and policies. Optional web research sends queries to its
configured service. Do not commit real resumes or personal data in test fixtures.

Originally created by Varun Ramesh:
[upstream](https://github.com/varunr89/resume-tailoring-skill).
This fork targets GitHub Copilot CLI. Historical design documents describe the
original Claude-era workflow, not current setup instructions.
Licensed under [MIT](LICENSE); bundled dependencies have their own
[notices](skills/resume-tailoring/THIRD-PARTY-NOTICES.txt).
Report issues at [this repository](https://github.com/garcrod/resume-tailoring-skill/issues).
