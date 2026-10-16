# Resume Tailoring - Copilot plugin information

**Name:** `resume-tailoring`
**Category:** Productivity / Career Development
**License:** MIT
**Repository:** https://github.com/garcrod/resume-tailoring-skill
**Original author:** Varun Ramesh

Truth-preserving resume tailoring for GitHub Copilot CLI: company/role research,
branching experience discovery, confidence-scored matching, shared batch discovery,
approval checkpoints, and local multi-format documents.

Install directly; marketplace approval is not required:

```powershell
copilot plugin install garcrod/resume-tailoring-skill
```

Invoke: `Use /resume-tailoring for this role and job description: ...`.
Requires an existing Markdown resume library. Node.js 22+ runs the bundled
MD/DOCX generator; LibreOffice is required only for requested PDF export.
Web research depends on available tools and otherwise falls back to disclosed
JD-only analysis.

No marketplace publication is claimed. A future catalog may reference the root
plugin manifest; see [distribution guidance](SUBMISSION_GUIDE.md).
For actual setup, troubleshooting, privacy, and validation coverage, use
[README.md](README.md).

Document generation/conversion is local, not all AI processing. Resume content
given to Copilot and optional web queries follow the relevant service policies.
No additional resume-upload or cloud-conversion service is introduced.
