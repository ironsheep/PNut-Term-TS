# Handoff to the DOCs agent

Point-in-time **feeds** (source material) copied from the PNut-Term-TS repo — see
**Currency** below for the per-feed snapshot dates — as input for external manual
generation. These are *not* deliverables — see
the document taxonomy in `DOCs/README.md` (Class 3: in-repo source that feeds an externally
published manual). Filenames carry a `FEED` marker so they are never mistaken for the
finished manuals.

The **live source of truth stays in the PNut-Term-TS repo** at the paths below. If a feed
and the repo disagree, the repo wins. Re-snapshot from source rather than editing these
copies in place.

## Contents

### 1. `SingleStep-Debugger-Interactive-Test-Plan.md`
- **Source:** `DOCs/pascal-REF/SingleStep-Debugger-Interactive-Test-Plan.md`
- **Mine this for:** the **screen explanation and window layout** — the landmark map and the
  per-region descriptions of the single-step (PASM2) debugger window. That content is
  **directly portable** into the debugger manual.
- **Ignore for the manual:** the per-test procedures/status and the test programs. The tests
  were the vehicle for verifying the screen behavior on hardware (Tests 0–14, HW-confirmed on
  v0.9.97, parity-checked against `DebuggerUnit.pas` v55); the manual needs the *layout and
  what each region means*, not the test steps. **No test source code is needed** — do not
  pull `DOCs/pascal-REF/SingleStep-Debugger-Test-Programs/`.

### 2. `User-Guide-FEED.md`
- **Source:** `DOCs/USER-GUIDE.md` (renamed here: it is a *feed to* a new user guide, not the
  guide itself — the original name was a misnomer for this handoff).
- **Mine this for:** the **Operating Modes** material — the two primary uses, **headed**
  (Interactive GUI) and **headless**, plus the in-between modes (Command-Line Download, Headed
  Batch, IDE Integration) — and the surrounding feature/reference content.

### 3. `LOGGING-STANDARDS-FEED.md`
- **Source:** `DOCs/project-specific/LOGGING-STANDARDS.md` (lives in the git-ignored
  `project-specific/` tree; copied here so it travels with the handoff).
- **Mine this for:** how logging differs and is *consumed* across the two primary uses —
  headless/agent runs as a feedback loop vs interactive runs as regression evidence, the
  four content buckets, and the USB-log intent (runtime bytes, both directions headed,
  RX-only headless). **The whole document is applicable** to the new headed/headless manual.
- **Authoring note (from Stephen):** where logging content is directly relevant to a
  reader of the user guide, fold it into the user-guide content as additional material
  rather than leaving it as a separate spec — the standards doc is the authority, the guide
  is where the user meets the behavior. *(This merge is an authoring decision left to the
  DOCs agent; the repo has not pre-merged it.)*

### 4. `WINDOW-LAYOUT-FEED.md`
- **Source:** `src/utils/windowPlacer.ts` (live code, class `WindowPlacer`) + the narrative
  `DOCs/WINDOW-PLACEMENT-ALGORITHM.md`. This feed was **re-derived from the code** and is the
  code-accurate specification (it corrects a stale example in the narrative doc — 1920×1080 is a
  **3-column** grid, not 5).
- **Mine this for:** the **automatic window-placement algorithm** for debug/display windows —
  when it runs (only when a `DEBUG` display has **no `POS` clause**), the adaptive grid sizing
  (rows/columns vs display size), the dynamic **row height / column width** formulas, the fixed
  **Half-Moon Descending** fill order, the reserved cells (Main Window, Debug Logger), the
  grid-full cascade, margins/spacing constants, and the special Debugger and COG-grid strategies.
- **Answers directly:** default row height, order of placement within a row, total number of
  rows — the concrete parameters the prior handoff left unspecified.

## Currency

| Feed | Snapshot | Current as of |
|---|---|---|
| 1. `SingleStep-Debugger-Interactive-Test-Plan.md` | 2026-07-20 | v0.10.3 |
| 2. `User-Guide-FEED.md` | **2026-07-26** | **v0.11.8** |
| 3. `LOGGING-STANDARDS-FEED.md` | **2026-07-26** | **v0.11.8** |
| 4. `WINDOW-LAYOUT-FEED.md` | 2026-07-21 | v0.10.8 |

The user guide was substantially corrected in the pre-1.0 documentation audit immediately before
the first snapshot; re-pull if the repo has advanced.

### What changed in the 2026-07-26 re-snapshot (feeds 2 and 3)

The **Debug Logger window became a viewer over the log, rather than the owner of it** (v0.11.5–
v0.11.7). This is a user-visible behavior change and the manual must reflect it:

- **New menu entry — Window > Show Log / Hide Log** (a single **Show/Hide Log** toggle on the
  macOS menu). Previously there was no way to reopen the Debug Logger window once closed.
- **Closing the window no longer stops logging.** The log file keeps receiving every line and
  records when the window was closed and reopened; reopening attaches to the **same** file (no
  new session) and repaints the recent history. The same holds for a COG window and its per-COG
  log. Sessions are ended by session events only — P2 reset, download start, shutdown.
- **New on-screen message under a fast stream:**
  `⋯ N line(s) not shown — display fell behind; the log file has every line ⋯`. This is
  presentation-only shedding; it is never written to the log file, and the file is always
  complete. Worth an explicit line in the manual, because a reader who sees it will otherwise
  assume data loss.
- Feed 2 gains a **Debug Logger** section (Part 2, §10 — the guide previously had none, which is
  why the TOC numbering shifted); feed 3 gains **principle 8** — *a log's life is the session's
  life, never a window's; durability is never gated on display.*
