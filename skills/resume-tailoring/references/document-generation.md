# Local document generation

The generator only renders approved content. Copilot still performs research,
tailoring, discovery, scoring, checkpoint approvals, the analytical report, and
approval-gated library updates. It needs Node.js 22 or newer, but no npm install,
personal document skill, Microsoft Word, or cloud converter.

If Node is unavailable, disclose the missing prerequisite. Use Copilot's file
editing tools to write Markdown directly from the same approved content and
write the report, retaining the original Markdown-only fallback. Do not claim
DOCX/PDF success or silently install anything.

## Approved presentation model

Save `_resume_document.json` in the user's output directory, never in this skill.
The schema is [resume-document.schema.json](resume-document.schema.json).
Every text run is literal approved content, not executable code or Markdown.
Use separate blocks for lines/paragraphs; do not put newlines in runs.

```json
{
  "name": "Alex Example",
  "company": "Example Labs",
  "role": "Engineer",
  "contact": [
    [{ "text": "alex@example.test", "link": "mailto:alex@example.test" }]
  ],
  "format": {
    "paper": "A4",
    "font": "Calibri",
    "bodyPt": 11,
    "headingPt": 12,
    "marginInches": 0.75,
    "preferredPages": 2
  },
  "sections": [
    {
      "heading": "Professional Experience",
      "blocks": [
        { "type": "heading", "runs": [{ "text": "Software Engineer" }] },
        { "type": "paragraph", "keepWithNext": true,
          "runs": [{ "text": "Example Labs | 2022-2025", "bold": true }] },
        { "type": "bullet", "runs": [{ "text": "Built the approved project." }] }
      ]
    }
  ]
}
```

Sections preserve their supplied order. Add any approved skills, summary,
education, projects, or other sections using the same blocks. Blocks support
`paragraph`, `heading`, `bullet`, or a standalone `{ "type": "pageBreak" }`.
Text blocks also support `pageBreakBefore` and `keepWithNext`; runs support
`bold`, `italic`, and http/https/mailto/tel `link`. These generic structures retain
role names, companies, dates, and optional sections without a fixed resume template.

Defaults are A4, Calibri 11pt body/12pt headings, and 0.75-inch margins. Explicitly
set the user's paper/font preferences. Font substitution is possible when a font
is missing; install the requested font or agree on an alternative (for example
Liberation Sans) before final rendering. The renderer warns but never silently
changes requested fonts or promises identical pagination across systems.

## Invocation

Resolve `SKILL_BASE` from this loaded skill, and use native path separators.

PowerShell:

```powershell
node "$skillBase\scripts\generate-resume.cjs" `
  --input "$outputDir\_resume_document.json" --out-dir "$outputDir" --pdf
```

On macOS/Linux pass the equivalent native paths to the same Node script.
Omit `--pdf` unless requested. Filename defaults to
`{Name}_{Company}_{Role}_Resume`, with unsafe filename characters replaced by
underscores; `--basename` can supply an explicit safe basename. Outputs are
`.md`, `.docx`, and optionally `.pdf`. Copilot writes `_Report.md` separately.
Derive the report basename from the actual returned Markdown path, including
any filename sanitization, rather than guessing it from unsanitized names.
The internal model is not a resume-library input or a fourth delivered resume.

Existing files are protected. Use a new output directory/basename or obtain
explicit user approval for `--overwrite`. Before revisions, ensure any old PDF
is identified as stale if not regenerated.

## PDF and status

Install LibreOffice locally. Discovery checks PATH and standard install locations
on Windows/macOS/Linux. Use `--libreoffice "<absolute executable path>"` for
nonstandard locations. No automatic download or installation occurs.
`--timeout-ms` defaults to 120000 and must be a positive integer.
Conversion uses a separate temporary profile and output directory; successful
existing files and the user's running office session are not repurposed.

Read JSON stdout even on nonzero exits. `outputs` contains `markdown`, `docx`,
and `pdf`, with `status: created|failed|not_requested`; only `created` has a current
output `path`. Failures include actionable `error` details and `errors`.
`pageCount` is measured from the exported PDF; no PDF means no measured count.
Inspect rendered pages for overflow/readability. Do not equate valid XML or
selectable text with a visually acceptable resume.

Exit codes: 0 = requested formats created; 1 = generation failure or partial
output; 2 = invalid options/model, file collision, or preflight failure;
3 = files created but actual PDF page count exceeds `preferredPages`.
Code 3 requires the existing user choice about pruning versus accepting length,
not automatic rewriting. Scores and coverage never change in the renderer.

If DOCX fails, retain Markdown and write the analytical report with the error.
If PDF fails, retain MD/DOCX and write the report with the error. Never show a
missing format as generated. Add the report's actual status when storing batch
`generated_outputs`; `files_generated` is true only for all requested formats
plus the report. A degraded job may finish transparently while other jobs continue.
Library changes always require the original final approval.
