# Copilot CLI runtime contract

Resolve supporting references and `scripts\generate-resume.cjs` from this skill's
loaded base directory, not the current working directory. Treat installed assets
as read-only. All resume content, state, models, reports, and outputs belong in
the user's workspace or explicitly chosen library.

Use available Copilot file discovery/read/edit tools. Respect access approvals
for external directories. Use the question tool for checkpoints when available;
otherwise ask conversationally and stop for an answer. Never assume approval.
Only explicitly selected batch EXPRESS mode skips its documented per-job
research/template/mapping checkpoints; final review and permanent library
updates still require approval.

Use available web search and page-fetch tools for company/role research. Tool
names vary by host. Search public company/role terms, not personal resume text
or contact information. Save source URLs and distinguish evidence from inference.
Do not bypass logins, scrape private profiles, or claim inaccessible pages were
read. If tools, pages, or sources are unavailable, disclose what is missing,
offer user-provided context, and use the existing JD-only fallback.

Scan the chosen library's resume Markdown files, not every Markdown document
recursively. Exclude `_Report.md`, state/summary/discovery files, research,
templates, content mappings, and internal JSON. Ask when a file's role is
ambiguous. Keep source resumes and exact companies/dates traceable.

Resume batch state from `references\schemas\batch-state-schema.md` and job state
from `references\schemas\job-schema.md`. Save after every major milestone and
approval. Persist profile/template/mapping/discovery artifacts so a new session
can restore the last approved phase without relying on conversation memory.
Existing state without new output fields remains readable: inspect files and
recover approvals from saved artifacts, asking only when an approval is unknown.

Use `document-generation.md` for local document output. No additional document
skill, custom agent, MCP service, or privileged tool configuration is required.
The renderer does not make tailoring decisions or generate the analytical report.
