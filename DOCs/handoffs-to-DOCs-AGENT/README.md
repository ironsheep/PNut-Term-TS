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

### 1a. `SINGLE-STEP-DEBUGGER-FEED.md`
- **Source:** `DOCs/manual-source/SINGLE-STEP-DEBUGGER-MANUAL-SOURCE.md`
- **Mine this for:** the **complete behavioral detail of the single-step (PASM2) debugger** —
  every keyboard command, every click region with its left- and right-click behavior, the
  mouse-wheel step tables, the hover-hint coverage, the break-condition button grammar and
  its four per-button exceptions, the GO state machine, and a region-by-region description
  of the display. This is the document that answers *what can the user actually do in this
  window*, and it pairs with feed 1, which answers *where on screen is it*.
- **Currency note:** the whole input surface was re-derived from
  `src/classes/debugger/renderer/DebuggerInteraction.ts` on 2026-09-07 and checked region by
  region, so the input tables are code-accurate as of v1.0.6.
- **Two things in it a manual author should not silently smooth over:** the Ctrl+letter
  combinations reach hub-navigation commands rather than their letter commands (Ctrl+D is
  *not* the DEBUG toggle), and one modifier-state divergence from PNut is deliberate and
  documented in place. Both are real user-facing behavior, not implementation trivia.
- **Authority:** where this feed and Part A of `DOCs/SSDB-INPUT-PARITY-AUDIT-2026-08-12.md`
  disagree, **Part A is corrected first**, and the correction then flows to this feed and to
  the test plan. Do not patch one alone.

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
| 1. `SingleStep-Debugger-Interactive-Test-Plan.md` | **2026-09-08** | **v1.0.7** (plan at v2, incl. Phase D; PNut column of the two-build run complete, PNut-term-ts column still open) |
| 1a. `SINGLE-STEP-DEBUGGER-FEED.md` | **2026-09-08** | **v1.0.7** (input surface code-verified; carries the hint-bar correction) |
| 2. `User-Guide-FEED.md` | **2026-09-09** | **v1.0.7** |
| 3. `LOGGING-STANDARDS-FEED.md` | **2026-09-09** | **v1.0.7** |
| 4. `WINDOW-LAYOUT-FEED.md` | 2026-07-21 | v0.10.8 snapshot — still code-accurate at v1.0.7: `src/utils/windowPlacer.ts` has not changed since |

**Every feed in this table is current as of 2026-09-09.** Feeds 2 and 3 had been stale for
seven releases; see below for what a manual author must un-learn from the previous copies.

The user guide was substantially corrected in the pre-1.0 documentation audit immediately before
the first snapshot; re-pull if the repo has advanced. **Feeds 2 and 3 carry the content as
shipped in v1.0.0, the first public release** — their v0.11.12 snapshot was re-stamped at the
release with no content change.

### What changed in the 2026-09-09 re-snapshot (feeds 2 and 3)

Both feeds had been sitting at their **v1.0.0** snapshot while the repo moved to v1.0.7, and
neither carried a snapshot banner — which is why the drift was invisible in the directory
listing. Both now carry one, and both are byte-identical to canonical apart from that banner.

**Three things in the previous copies were not merely incomplete but WRONG**, and a manual
written from them would have taught each one:

- **The baud option was renamed, and one rate became two (v1.0.3).** The old feed documented
  a single `--debugbaud` "debug baud" that the user should not normally need to set. There
  are now two rates, set independently: **`--baud`** carries `debug()` output *and* terminal
  traffic (one rate, because it is one serial connection), and **`--downloadbaud`** is used
  only while loading a program into the P2. `--debugbaud` still works as an alias, but it is
  not the name to teach — the rate was never only about `debug()` output. The download rate
  is now a user-facing value with its own preference and its own range (9600–2000000), and
  the guide gained the *lower it if downloads fail* advice that goes with it, which is the
  single most likely reason a reader will go looking for this section.
- **Exit code 0 changed meaning (v1.0.4/v1.0.5).** It used to assert "clean exit — all SAVEs
  and logs flushed", i.e. that shutdown went well. It now asserts that **the captured log is
  complete** — a promise about the data, not about the teardown. Code 125's description
  widened to match ("the shutdown drain ran long, **or output was lost while writing**"), and
  code 1 now also covers a device that stopped responding mid-run. This matters to any reader
  scripting the tool: the old wording invited treating 0 as "it exited tidily", which is
  exactly the reading the change was made to kill.
- **Logging's *System advice* bucket gained an explicit event-vs-mechanism rule (feed 3,
  2026-08-14).** The bucket is named for the *event*, and that had been read as licence to log
  every step implementing it: one DTR reset is one narrative line, but the several individual
  DTR/RTS line transitions that perform it were each being printed, putting a column of bare
  `DTR: true` / `DTR: false` in front of every ordinary user of a release build. Those
  transitions — and handle lifecycle, and reopen steps — are **serial-channel diagnostics**,
  emitted only under `--diag-serial`. Errors stay live regardless. The feed now carries the
  test for the distinction: *would a reader trying to find out what their run did care about
  this line, or does it only make sense to someone debugging the transport itself?*

Nothing else in feed 2 changed materially — the *Naming a display* rules, the operating-mode
material and exit code 4 were already present in the v1.0.0 copy and carry over unchanged.

### What changed in the 2026-07-27 re-snapshot (feeds 2 and 3)

The **Debug Logger window became a viewer over the log, rather than the owner of it** (v0.11.5–
v0.11.7). This is a user-visible behavior change and the manual must reflect it:

- **New menu entry — Window > Show Log / Hide Log**, in the app's in-window menu bar (which is
  the menu on every platform, macOS included). Previously there was no way to reopen the Debug
  Logger window once closed.
- **Closing the window no longer stops logging.** The log file keeps receiving every line and
  records when the window was closed and reopened; reopening attaches to the **same** file (no
  new session) and repaints the recent history. The same holds for a COG window and its per-COG
  log. Sessions are ended by session events only — P2 reset, download start, shutdown.
- **New on-screen message under a fast stream:**
  `⋯ N line(s) not shown — display fell behind; the log file has every line ⋯`. This is
  presentation-only shedding; it is never written to the log file, and the file is always
  complete. Worth an explicit line in the manual, because a reader who sees it will otherwise
  assume data loss.
- **New: display NAMING rules** (v0.11.10). A display's name is its only address on the wire, so
  it may not be a display type or a directive keyword — `trace` is illegal, `spin2` is fine
  (the reserved list is the DEBUG-display table, *not* Spin2's keywords). Names are
  case-insensitive, must start with a letter/underscore, and are truncated at 30 characters.
  PNut discards such a display statement **silently**; we report it and stop the run with exit
  code 4. Feed 2 gains a *Naming a display* section under Debug Windows plus a troubleshooting
  entry, and exit code 4 was added to the exit-code table (it had been missing entirely). The
  full rule and its Pascal derivation is `DOCs/pascal-REF/DEBUG-DISPLAY-NAME-RULES.md` — worth
  pulling into the manual as a reference table.
- Feed 2 gains a **Debug Logger** section (Part 2, §10 — the guide previously had none, which is
  why the TOC numbering shifted); feed 3 gains **principle 8** — *a log's life is the session's
  life, never a window's; durability is never gated on display.*


### What changed in the 2026-09-07 re-snapshot (feeds 1 and 1a)

**Feed 1** was re-snapshotted from canonical. The previous copy carried a banner saying it
was *already behind* — it predated the v1.0.1 input-parity sprint and was missing the Test 4
step-8 amendment and the whole of **Phase D (D1–D11)**, the input-command certification. It
now matches canonical.

**Feed 1a is new.** The debugger manual source had never been part of this handoff, even
though it is the document that describes the debugger's user interface. The input sections
were re-verified against the code before snapshotting, and the following were **corrected**
— a manual written from the previous revision would have been wrong on each:

- **Right-click was documented as doing nothing** in ten regions (PC, REG/LUT strip, SFR
  values, stack values, pointers, register watch, hub hex, hub ASCII, hub heat-map). It is
  not ignored — in every one of those it performs the same action as a left-click. Only the
  buttons, the disassembly box, the event names and the smart-pin box are button-sensitive.
- **"Right-click toggles a condition without affecting others"** was wrong for the break
  panel: a right-click also clears DEBUG, and DEBUG, INIT, EVENT and ADDR each depart from
  the general grammar. The four exceptions are now stated.
- **`R` was documented as clearing "register and LUT delta watch lists."** There is no LUT
  watch list; `R` clears the register-delta list only.
- **The Display Regions section had never received the v1.0.1 corrections** and contradicted
  the corrected tables earlier in the same document — it still said clicking an SFR routed
  by register name rather than by the value-and-row rule, that clicking an event name merely
  *selected* the event rather than arming the break, and that only a right-click reset the
  smart-pin list. All three now match the code.
- **The GO button** was documented as a three-state control that "stops execution" while
  running. It is a state machine evaluated before the mouse button is read, and the
  free-running case requests an asynchronous COGBRK rather than stopping anything.
- **Added:** Tab capture and the six captured-but-inert keys; Alt/Cmd being ignored
  entirely; hub-mode wheel wrapping where cog-mode clamps; the wheel doing nothing outside
  the two panels that handle it; macOS right-click delivery (Ctrl+click, trackpad tap, and
  the whole-gesture latch) and macOS Shift+wheel arriving on the horizontal axis; the
  hover-hint coverage including which regions deliberately show *no* hint; and the GO
  press-flash.
