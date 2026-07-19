# PNut-Term-TS Documentation

Documentation for PNut-Term-TS, a cross-platform debug terminal for the Parallax
Propeller 2 microcontroller.

---

## 📛 Document taxonomy — read this before editing or citing any doc

Every `.md` file here belongs to exactly **one** of three classes. Confusing them is how
docs rot: two artifacts covering the same ground diverge, and the one nobody ships stops
being maintained. If you add a document, say which class it is in its header.

### Class 1 — Shipped in-app help (exactly one file)

| File | Notes |
|------|-------|
| **[APP-HELP.md](APP-HELP.md)** | **The only documentation file packaged with the application.** Opened by Help → Documentation / F1 via `documentationViewer.ts`. All three `scripts/create-*-package.sh` copy this file and no other. |

Consequences that bite people:
- **APP-HELP must be self-contained.** It must never point at another file in `DOCs/` —
  those paths do not exist in an installed application. Link to the project site instead.
- Anything a user needs at the keyboard, offline, has to be *in* this file.

### Class 2 — Externally published deliverables

Produced from Class 3 sources and published at the project site — **not** stored here as
the finished artifact:

- **Debug Window Manual** — the display windows, with imagery
- **Single-Step Debugger Manual** — the SSDB
- **Headed / Headless / AI-use guide** — operating modes and the agent workflow

### Class 3 — In-repo source & reference (input to Class 2, never shipped)

Accurate behavioral detail an author (human or agent) encodes into a Class 2 deliverable.
Optimized for **correctness, not polish**:

| Location | Covers |
|----------|--------|
| **[manual-source/](manual-source/)** | Source for external manuals. `SINGLE-STEP-DEBUGGER-MANUAL-SOURCE.md` (was `DEBUGGER-USER-MANUAL.md` — retasked, not a deliverable). |
| **[pascal-REF/theory-of-operations/](pascal-REF/theory-of-operations/)** | Per-window behavior derived from the Pascal original. |
| **[pascal-REF/](pascal-REF/)** | v55 canonical facts, directive matrix, SSDB theory of operations, interactive test plan. |
| **[project-specific/LOGGING-STANDARDS.md](project-specific/LOGGING-STANDARDS.md)** | **Authoritative logging spec** — what is logged, why, and how logs are consumed (including USB-log intent and the headed/headless split). Primary input to the AI-use guide. |
| **[project-specific/](project-specific/)** | Architecture, testing, technical debt, and other engineering references. |

> ⚠️ `DOCs/project-specific/` is **git-ignored**. Files there persist only if force-added
> (`git add -f`). Edits to a non-tracked file in that directory will be lost.

### Where the user-facing guides sit

**[USER-GUIDE.md](USER-GUIDE.md)** and **[QUICK-START.md](QUICK-START.md)** are user-facing
prose that is **not** shipped in packages today. Treat them as Class 3 (input) unless and
until they are published as Class 2 deliverables. They must not be cited from APP-HELP.

---

## User Documentation

- **[QUICK-START.md](QUICK-START.md)** — condensed first-run walkthrough
- **[USER-GUIDE.md](USER-GUIDE.md)** — full feature reference
- **[APP-HELP.md](APP-HELP.md)** — built-in application help (Class 1; the shipped file)
- **[PATH-SETUP-GUIDE.md](PATH-SETUP-GUIDE.md)** — putting the `pnut-term-ts` command on your PATH

## Technical Documentation

- **[IMPLEMENTATION_NOTES.md](IMPLEMENTATION_NOTES.md)** — implementation details and architecture
- **[WINDOW-PLACEMENT-ALGORITHM.md](WINDOW-PLACEMENT-ALGORITHM.md)** — debug-window positioning
- **[PROPPLUG_MANAGEMENT_THEORY_OF_OPERATIONS.md](PROPPLUG_MANAGEMENT_THEORY_OF_OPERATIONS.md)** — device management
- **[project-specific/](project-specific/)** — architecture, logging, testing, debt (git-ignored; see note above)

## Reference Materials

`pascal-REF/theory-of-operations/` holds per-window operational specifications derived from
the original Pascal implementation: BITMAP, FFT, LOGIC, MIDI, PLOT, SCOPE, SCOPE_XY,
SPECTRO, and TERM. The single-step debugger's mechanism is covered by
`pascal-REF/SingleStep-Debugger-Theory-of-Operations.md`.

The Pascal source itself (`/pascal-source/P2_PNut_Public/`, synced to **v55**) is the
definitive specification — where TypeScript behavior differs from Pascal, Pascal is correct.

## Additional Resources

- **images/** — icons, logos, visual assets
- **source/** — font notes, layout files
- **archive/** — superseded documentation, retained for reference
- **investigations/**, **plans/**, **project-sprints/** — engineering history

---

*Documentation is maintained alongside the codebase. Per-document version stamps reflect the
release they were last verified against; see `CHANGELOG.md` for the current build.*
