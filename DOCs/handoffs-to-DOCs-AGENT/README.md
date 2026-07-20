# Handoff to the DOCs agent

Point-in-time **feeds** (source material) copied from the PNut-Term-TS repo on
**2026-07-20** as input for external manual generation. These are *not* deliverables — see
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

## Currency

All three feeds were current as of PNut-Term-TS **v0.10.3** (2026-07-20). The user guide was
substantially corrected in the pre-1.0 documentation audit immediately before this snapshot;
re-pull if the repo has advanced.
