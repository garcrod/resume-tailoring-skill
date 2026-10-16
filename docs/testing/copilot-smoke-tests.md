# Copilot smoke tests and evidence

Automated assertions and manual workflow evaluation are different. A passing
renderer test is not evidence that a conversational tailoring session preserved
every approval or that its claims were factually justified.

## Automated commands

Run `npm ci`, `npm run build:check`, and `npm test`.
Tests use synthetic approved content from `tests/fixtures/resume.json`.
Contract tests fingerprint the original matching/discovery references and check
the original phase sequence, weighted formula, checkpoints, and batch features.
DOCX tests examine XML and literal text. Conversion tests exercise failures,
isolated profiles, timeout handling, and preserved existing files.

The real LibreOffice integration tests extract text, verify reading order and a
hyperlink, and measure fixed one/two-page fixtures using Liberation Sans.
Missing LibreOffice is an explicit local skip; `REQUIRE_PDF_TESTS=1` makes it a
failure. The CI matrix requires this on Windows, macOS, and Linux, Node 22/24.
Generated documents still need visual inspection for clipping and page quality.

## Discovery checks

Run `copilot --plugin-dir .` from the checkout, then `/skills info resume-tailoring`.
For independent standalone validation, copy the entire skill folder to a clean
project's `.github/skills/resume-tailoring` and start Copilot there. Use a separate
configuration/session so existing installed skills do not mask missing assets.
Do not overwrite the user's personal installed skill.

Confirm the loaded path and inspect the resource list. A plugin and standalone
copy should not both be enabled in the same session. Changing source files does
not update a cached install: use a fresh development mount.

## Manual workflow scenarios

Use `tests/fixtures/workflow-contract.json` and synthetic resume/JD data. For each
scenario record actual actions, artifact paths, approvals, and any limitations.
Do not mark these as passed merely because headings exist in instructions.

1. Single job: library scan excludes reports, research names sources or discloses
   JD-only fallback, template/mapping approval blocks progression, skipped
   discovery is respected, final library decision is honored.
2. Truthfulness: exact dates/companies remain; title reframing is justified;
   source provenance and before/after reframing remain visible; unresolved gaps
   are not inflated to meet example coverage values.
3. Batch: opt in, initialize once, deduplicate a shared gap, branch dynamically
   from answers, retain job relevance and per-experience integration choices.
4. Modes: interactive remains default; expressly chosen express mode skips only
   per-job checkpoints. Final review and library approval still happen.
5. Pause/resume: save after approved template for job 2, start a new session,
   reload state/artifacts and continue matching without changing completed job 1.
6. Incremental/revision/removal: add a new job and discover only new gaps;
   regenerate affected formats after revision; archive a removed job, do not
   delete it; preserve approved prior discoveries.
7. Selective update: approve one resume, reject another, revise a third; add only
   approved current artifacts to the library and never ingest models/reports.
8. Degradation: unavailable research -> disclosed JD-only; failed DOCX -> MD and
   report; failed PDF -> MD/DOCX and report; unrelated jobs continue and statuses
   remain accurate.
9. Length: export a deliberately overlong approved model; show measured page count
   and ask pruning/acceptance rather than dropping content or shrinking fonts.

## Validation record

Locally exercised on Windows with Copilot CLI `1.0.99-2`, Node `22.23.3` and
`24.22.0`, and LibreOffice `26.8.1.1`:

- Both Node versions: 19 tests passed, none failed or skipped, with
  `REQUIRE_PDF_TESTS=1`, `TEST_COPILOT=1`, and `LIBREOFFICE_PATH` pointing to a
  session-local LibreOffice extraction. No system-wide office installation was
  needed.
- Executed `npm run build`, `npm run build:check`, and `git diff --check`.
- Verified Copilot discovery for an ephemeral native plugin mount and an
  independent copied project skill using isolated configuration; no model calls
  or personal installed-skill changes were required.
- Verified local-path plugin installation in isolated configuration. This CLI
  accepts it but warns that direct repository/path installs are deprecated in
  favor of future marketplace-only installation.
- Extracted PDF text in order, checked the email hyperlink, and measured one and
  two pages from the real converter. Rendered and visually inspected all three
  fixture pages: readable text, proper bullets, consistent margins, no clipping,
  and the explicit second-page section in the expected position.
- Confirmed `npm run test:pdf` returns failure, not a skip, when its explicitly
  configured LibreOffice executable is missing.
- Confirmed clean dependency installation on Windows with the npm host OS
  override corrected for the local environment (`npm ci --os=win32
  --ignore-scripts --no-fund --no-audit`). A pre-existing npm `os=linux` setting
  had selected the wrong native test binaries; no global configuration was changed.

The CI matrix is configured, not claimed executed on macOS/Linux. Full live
conversational scenarios above have not been run end to end; they require
reviewed interactive sessions and are not replaced by structural contract tests.
Document rendering and preserved instruction contracts do not certify the
factual accuracy of a future tailored resume.
