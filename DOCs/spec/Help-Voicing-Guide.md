# Help Voicing Guide

*The voice and conventions for `DOCs/APP-HELP.md` — the in-app Help shown on `F1`.*

This guide defines **how** in-app Help is written. The **authoritative source of
truth for content** (settings, options, defaults, behavior) is `DOCs/USER-GUIDE.md`;
when Help and the User Guide disagree, the User Guide wins and Help is corrected to
match. Verify settings/option values against the running app
(`src/classes/preferencesDialog.ts`, the menu in `src/classes/mainWindow.ts`) before
publishing.

> **Slot note:** this is the `HELP_VOICING_GUIDE` referenced by
> `.claude/skill-conventions.md`. Its companion `MANUAL_VOICING_GUIDE`
> (`DOCs/spec/Manual-Voicing-Guide.md`) is not yet authored.

---

## Audience & purpose

The reader is a Propeller 2 developer who already knows P2/Spin2 and just wants to
operate **this app**: connect, download, watch `debug()` output, and configure it.
Help is **task-oriented reference** they reach for in the moment — not a tutorial, not
a feature brochure, not a development status report.

## Voice in one paragraph

Speak directly to the user in the second person ("you"), present tense, active voice.
Be calm, precise, and brief. State what something does and how to use it, then stop.
Assume competence — explain the app, not the P2. Mirror the tone already set in
`DOCs/USER-GUIDE.md`; Help is its shorter, more operational sibling.

## Do

- **Second person, present tense, active voice.** "Open Preferences with `Ctrl+,`."
- **Lead with the action or the fact.** "Drag a display window and its title bar shows
  the live `x, y` position."
- **Name things concretely** — real menu paths (**Edit → Preferences…**), real
  shortcuts (`Ctrl+,`, `Cmd+,` on macOS), real file names (`.p2rec`), real settings.
- **Use tables for options/settings**: Setting · Options · Default. Keep columns terse.
- **Use a blockquote `>` for a caveat or platform note**, sparingly.
- **Cross-reference instead of duplicating.** Point to `DOCs/USER-GUIDE.md`,
  `DOCs/DEBUGGER-USER-MANUAL.md`, `DOCs/QUICK-START.md`, or the official P2 `debug()`
  reference rather than restating them.
- **Describe behavior the user can observe** — indicators, colors, what a window shows.

## Don't

- **No development status.** Never write "Fully Implemented", "✅", "🔴 NOT ready",
  "infrastructure fixes applied", "(if implemented)", "Status:", or any badge/note that
  reads like a sprint tracker. If a feature ships, document it plainly; if it doesn't
  ship, omit it. Help describes the product, not its construction.
- **No marketing.** Drop "comprehensive", "powerful", "intelligent", "seamless",
  "blazing", and exclamation-point enthusiasm. One factual sentence beats three
  adjectives.
- **No invented detail.** Don't document a setting, shortcut, or window that isn't in
  the app. When unsure, verify against source or the User Guide — never guess.
- **No internal architecture** unless the user acts on it. "Zero-copy
  SharedArrayBuffer worker pipeline" is implementation trivia; "handles full-rate
  2 Mbps capture without loss" is a user-facing fact.
- **No stale version/contact data.** Keep the version stamp current; use the real
  GitHub org (`github.com/ironsheep/PNut-Term-TS`).

## Terminology (use these exact terms)

| Use | Not |
|-----|-----|
| Propeller 2, P2 | the chip, the Prop |
| `debug()` output / the debug stream | debug messages (loosely) |
| debug window | visualization, viewer |
| PropPlug / USB serial adapter | dongle, cable |
| COG | cog, core (when naming the P2 unit) |
| download to RAM / to flash | flash it, upload |
| single-step debugger | the debugger window (when meaning the PASM2 stepper) |

## Formatting conventions

- Title: `# PNut-Term-TS Application Help`. Sentence-case section headings.
- Shortcuts as inline code: `Ctrl+,`. Give the Windows/Linux form and note the macOS
  `Cmd` substitution once, globally, rather than per row.
- `debug()` directives and window-type keywords in code font: `TERM`, `` `logic ``.
- End with a single version/date stamp line; keep it in sync with the app version.
- Prefer short sections with a clear heading the in-app TOC can target.

## Worked example

**Off-voice (old Help):**
> ### 7. FFT Analyzer Window
> **Status**: ✅ **Fully Implemented** (*noise floor display issue*)
> **Note**: Infrastructure fixes applied for window creation and routing

**On-voice:**
> **FFT** — frequency-spectrum display. Opens automatically from a `` `fft `` display
> directive and updates as the P2 streams bins. See the P2 `debug()` reference for the
> directive syntax.
