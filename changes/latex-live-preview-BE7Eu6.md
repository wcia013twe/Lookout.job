# Live LaTeX preview in VS Code

- Recommend LaTeX Workshop and use Tectonic with SyncTeX and the internal PDF viewer. LaTeX files auto-save after one second; disk changes trigger compilation and PDF refresh. The compiler searches `docs/figures/` for the existing paper figure. Generated output stays in ignored `.latex-build/` folders.
- Setup: install Tectonic (`brew install tectonic` on macOS), open a `.tex` file, then run **LaTeX Workshop: View LaTeX PDF file** to open the preview alongside the source.
- Validation: Tectonic compiled the existing paper with SyncTeX using the figure search path; settings JSON parsed; `npm run validate:data` passed. Locked root/frontend dependencies installed.
- Limits: editor preview interaction not verified. The existing paper references a missing `references.bib`; compilation emits bibliography warnings. The paper remains unchanged and untracked in shared main. No application, backend, MCP or demo behavior changes.
