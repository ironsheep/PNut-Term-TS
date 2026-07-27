# Pilot brief — changelog voicing guide (pnut-term-ts)

**Issued** 2026-07-27 · **From** the skills side, via Stephen · **Status** pilot 1 of 3

You are the **first project** to work under a new central changelog voicing
guide. It is a draft. Your job is both to *use* it and to *find what is wrong
with it* — the second is worth as much as the first.

**The guide:** `DOCs/process/changelog-voicing.md` — read it before starting.

---

## Where you sit

| | |
|---|---|
| **Class** | **2 — Developer tool.** Your reader installs and runs pnut-term-ts. They do not link against it, so entries lead with flags, settings, commands, window behavior, or a short bold prose label — never a method name. Your install surface (packaging, platform support, binary dependencies) *is* user-visible and belongs in the changelog; see §5, class 2. |
| **Mode** | **Development**, until 1.0.0. §2 governs everything you write today. |
| **Coming** | You are the only pilot that crosses the **first-release boundary** (§3). |

---

## What you are asked to do

### 1. Read the guide and locate yourself

§0 first — the two axes. Then §1 (shared core) and §2 (development mode). Skim §4
so you know what changes at 1.0; do not apply it yet.

### 2. Work in development mode from now on

Every new `## v0.11.x` entry follows §2. The main change from what you do today
is **verbosity**, not content:

- Target **~40 words** per entry.
- Root cause stays — it is the point of a development log.
- The debugging *narrative* goes: what you tried first, the false starts, the
  sequence of hypotheses. One sentence of rationale, not a paragraph.
- Record **decisions and findings, not activity**. If an entry would not teach a
  future session something, it is a commit message, not a changelog entry.

§2.3 has a good/bad pair drawn from your own v0.11.11 entry — that entry is the
model, just shorter.

### 3. At 1.0.0 — run the transition (§3)

Fires while *preparing* the 1.0.0 release, before the tag, as part of the release
work. In order:

1. **Mine** the development log for the initial-release entry.
2. **Archive** it to `DOCs/history/CHANGELOG-0.x-development.md`, under version
   control.
3. **Head the archive** with the frozen/not-governed notice.
4. **Restart `CHANGELOG.md`** with the initial-release entry — a paragraph
   describing what the product *is*. No `### New Features`, no feature list, no
   development history. §3.1 has the rule and an example.
5. **Released mode (§4) applies** from the next release onward.

**Frozen means unchanged.** Do not reformat the archived headings, do not trim
its entries, do not apply the guide to it retroactively.

### 4. Author the class-2 overlay

`.claude/skills/build-wrapup/project-overlay.md`, recording:

- class: 2
- mode: development → released at 1.0.0
- the archive path
- any local constraint the guide does not cover — in particular, whether anything
  in your release workflow parses the `CHANGELOG.md` version heading. If it does,
  say so; the guide mandates `## vX.Y.Z (YYYY-MM-DD)` and a parser mismatch is a
  release-breaking surprise.

---

## What NOT to do

- **Do not edit `DOCs/process/changelog-voicing.md`.** It is a copy. Corrections
  go back to Stephen as feedback; a local edit is silently lost and defeats the
  pilot.
- **Do not flatten your existing changelog.** Your current entries are the best
  class-2 examples in the fleet — theme line, bold label, effect stated in the
  user's terms, the symptom named as the reader actually saw it (`{notSet}:`
  prefixes, `[SAVE-READBACK]` output). The guide is asking you to *trim* that
  voice, not replace it with something blander. If following the guide makes an
  entry worse, that is a finding — report it.
- **Do not retroactively rewrite the 0.x entries** to the new form. They are
  about to be archived as-is.

---

## What to report back

This is the deliverable Stephen needs most. As you go, collect:

1. **Rules that did not fit** — anything you had to work around, ignore, or
   interpret to get a sensible entry.
2. **Missing rules** — cases the guide is silent on where you had to invent an
   answer. Note what you chose.
3. **The verbosity budget** — is ~40 words right for a development entry? Too
   tight, too loose?
4. **Class-2 vocabulary** — does "lead with the flag/setting/command, else a bold
   prose label" hold across your real entries, or are there kinds it cannot
   express?
5. **The transition (§3)**, when you get there — was the five-step order right,
   and did the mining step produce a usable initial-release paragraph?

Report as findings, not as edits to the guide.

---

## Note on the examples

In §5 and §6 the class-2 examples are **invented** for shape — `--port`/
`--device`, the recording browser, the scope-window download stall. Only
`--diag-serial` is real, taken from your changelog. If any invented example reads
as plausible-but-wrong for this project, say so; a central guide teaching from a
fabricated example is worse than one teaching from a blander real one.
