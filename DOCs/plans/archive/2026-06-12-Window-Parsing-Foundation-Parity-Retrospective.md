# Retrospective — Window Parsing Foundation Parity (0.9.47)

**Sprint:** Window Parsing Foundation Parity
**Closeout:** `DOCs/plans/archive/CLOSEOUT-2026-06-12-WINDOW-PARSING-FOUNDATION-PARITY.md`
**Build:** 0.9.47 (tagged 2026-06-12; package builds for HW test 2026-06-13)
**Date:** 2026-06-12

Captures *what was learned*, not what shipped (closeout owns that).

## Discovered perspectives

- "9 windows already complete" hid an entire **orthogonal axis**: directive
  *coverage* parity (the prior sprint) is not the same as *parsing-robustness*
  parity (numeric formats, clamp bounds, color centralization, accept/reject).
  The newly-generated second example set was the signal that exposed it.
- **Audit subagents systematically over-report parity findings.** ~10 "high-severity
  crashes" were properly guarded on real-source read (MIDI `i+2`, BITMAP
  `while/if (i+1<length)`); agents even assumed directives that don't exist (the
  phantom PLOT `LUTCOLORS`). Confirmed repeatable bias across every window, not a
  one-off.
- **Never-reject parity (OQ-1) is a stronger constraint than "minimal surgical
  change."** It actively *requires deletion* — invented non-Pascal directives
  (BITMAP runtime DOTSIZE/SPARSE) had to be removed, not preserved. Parity beats
  the final-release "preserve working code" instinct. ([[feedback_parity-sprint-nothing-out-of-scope]])
- The two color paths (KeyColor directive-name vs. pixel color-MODE) are an
  ongoing trip-hazard — easy to "centralize" a color-MODE site that should stay on
  ColorTranslator. Worth its own doc section (now in WINDOW-PARSING-PARITY.md §2).

## Process insights

- **A pre-built reference template (TERM, `b08e50d`) was the load-bearing asset** —
  every window followed it; per-window design cost dropped to verify-and-apply.
- **"Verify every cited site vs real code + Pascal before editing" repeatedly
  prevented blind fixes.** This gate is the discipline that neutralizes the
  audit-agent over-reporting above. It is non-negotiable for fan-out-audit sprints.
- **Front-loading the shared foundation (#34) paid back across 8 windows** — right
  sequencing (foundation → dependents).
- The **no-skip gate (#35) is now a durable asset**, not just a task: it caught
  registry drift and forces suite honesty going forward.
- Sequential-runner friction: ~12 min, buffers output to file only at the END.
  Per-window full-suite runs are costly; `npm test -- <file>` during dev is the loop.

## Quality and efficiency observations

- **Faster than expected:** "centralization-only" windows (PLOT, SCOPE) went quick
  once the shared helpers existed.
- **Slower than expected:** SCOPE_XY (C2-heavy — raw `parseInt` throughout) and the
  §7 gate (each drift file needed a standalone run to classify; 2 proved
  environment-dependent only after running them).
- The §7 plan snapshot drifted vs. reality on multiple axes (predicted 158
  registered + 3 excluded; landed **155 + 5**) — the registry "lies by omission."

## Downstream impact

- **Enables:** an authoritative in-repo parsing target (`WINDOW-PARSING-PARITY.md`)
  for future windows/regens; centralized `parseKeyColor`/`clampInt` = one place to
  fix parsing bugs; a no-skip gate that keeps the suite honest.
- **Does not destabilize:** the parsing layer is deterministic, unit-tested, and
  HW-independent — no new hardware dependency introduced.
- **Open verification:** parsing parity is **unit-verified, not yet HW-validated**
  end-to-end against the new example set on real hardware. That is exactly what the
  0.9.47 build (tagged tonight) is for — HW test 2026-06-13.

## Methodology lessons (candidate triage)

Triaged against `feedback_skill_evolution_candidates.md`. **No central-skill edits
made tonight** (Stephen wrapping up; matches the standing "record only" disposition).
Recommended verdicts below for Stephen's confirmation next session:

- **Candidate 5** (confirm which code is LIVE) — **REVALIDATED** (SCOPE's dead
  commented-out `Number()` SIZE block; agents auditing surfaces that aren't live).
  Recommend: **keep**, recurrence growing.
- **Candidate 6** (verify vs live rendering) — not exercised (parsing is
  non-visual). Recommend: **keep**, unchanged.
- **Candidate 7** (sweep tests for old behavior before the suite when removing a
  directive/field/method) — **REVALIDATED** by the invented-BITMAP-directive
  removal (`732618a`). Recommend: **keep**, strengthen toward promotion.
- **Candidate 8** (re-enumerate coverage empirically; the registry lies) —
  **REVALIDATED HARDEST** this sprint (§7 158+3 prediction → 155+5 reality;
  workerExtraction/memoryLeakDetection env-dependent). Now thrice-seen. Recommend:
  **promotion candidate** — run the generality gate next session.
- **NEW Candidate 9** (added to buffer) — "Treat fan-out audit output as
  *hypotheses requiring per-site source+spec verification*, never as a work list;
  subagent audits over-report (phantom cases, inflated severity, guarded sites
  flagged as crashes)." Distinct from 5/6 (which code / live rendering); this is
  about reporting **inflation** of fan-out audits generally. Recurred every window.

**Verdict:** this sprint produced **real, repeated process learning worth acting
on** — primarily Candidate 8 (promote) and new Candidate 9 (the audit-as-hypothesis
discipline). Not a no-delta clean execution.
