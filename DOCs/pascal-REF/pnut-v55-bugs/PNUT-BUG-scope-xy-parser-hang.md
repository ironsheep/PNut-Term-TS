# PNut v55 — bug report: a bare number in a `SCOPE_XY` create message hangs the parser

**Severity:** high — PNut locks up (infinite loop), no error, no diagnostic. Requires killing the app.
**Affects:** PNut v55 (Windows). **`SCOPE_XY` only** — the other eight display windows are not exposed.
**Not affected:** pnut-term-ts (its port does not share the defect).
**Found by:** the P2 Knowledge Base team, while verifying DEBUG-window documentation against the tool.

---

## Minimal reproduction

```spin2
CON  _clkfreq = 100_000_000

PUB main()
  debug(`SCOPE_XY W 128 'A')     ' <-- the 128 follows no keyword
  repeat
```

**Observed:** PNut hangs. The `W` window never opens. No error message. All further DEBUG output stops;
the app must be killed. (The P2 itself keeps running — this is a host-side parser hang, not a chip fault.)

**Expected:** either the stray number is ignored / ends the config parse (as every other window does), or a
diagnostic is emitted.

**Why this matters more than it looks:** the trigger is a **plausible typo**, not a contrived input. A user who
meant

```spin2
  debug(`SCOPE_XY W SIZE 128 'A')
```

and dropped the `SIZE` keyword gets a hung tool with no clue why. There is nothing about the failure that points
back at the omission.

---

## Mechanism

`SCOPE_XY_Configure` (`DebugDisplayUnit.pas`, ~1394-1435) loops:

```pascal
while not NextEnd do
begin
  if NextKey then
    case val of ... end
  else if NextStr then
    ...
end;
```

An `ele_num` element matches **neither** branch. `ptr` is therefore never advanced, `NextEnd` never becomes
true, and the loop spins forever.

## Blast radius — we checked all nine display windows

| configure loop | windows | exposed? |
|---|---|---|
| `while NextKey do` | SCOPE, FFT, SPECTRO, PLOT, TERM, BITMAP, MIDI | **No** — a non-key element ends the loop cleanly |
| `while not NextEnd do` **+ `if NextNum then Break;`** | **LOGIC** | **No** — explicitly guarded |
| `while not NextEnd do` — **no number guard** | **SCOPE_XY** | 🔴 **Yes — hangs** |

`LOGIC` and `SCOPE_XY` are the only two windows that accept **channel-label strings on the create line**, so they
are the only two that cannot use `while NextKey do` — they must run to end-of-message and dispatch on *key or
string*. `LOGIC_Configure` guards the third case explicitly:

```pascal
while not NextEnd do
begin
  if NextNum then Break;   // number not allowed
  if NextKey then
  ...
```

**`SCOPE_XY_Configure` is missing exactly that line.**

## Suggested fix

Add LOGIC's guard to `SCOPE_XY_Configure`:

```pascal
while not NextEnd do
begin
  if NextNum then Break;   // number not allowed   <-- add
  if NextKey then
  ...
```

This makes `SCOPE_XY` behave like `LOGIC` (a stray number ends the config parse) rather than hanging.

## How it was verified

Test program `conflict-testO-scopexy-parser-hang.spin2`, run on real P2 hardware.

The instrument is a **TERM heartbeat**, because a screenshot cannot answer this question — a hung tool writes no
file, and *"no file"* is indistinguishable from *"the window never opened"*. The heartbeat separates **hung**
from **absent**:

- A **known-good** `SCOPE_XY` is created and captured **first**, proving `SCOPE_XY` works in the session (so a
  later failure cannot be blamed on the window type).
- The heartbeat then prints `pre 1 … pre 5`.
- The suspect line executes.
- If the parser survives, the heartbeat prints `post 1 … post 20`.

| tool | result |
|---|---|
| **PNut v55** | 🔴 **HANGS** — frozen at `pre 5`; the window never opens |
| **pnut-term-ts** | ✅ no hang — printed `post 1…20`; the window was even created, at its default 256×256 canvas (the stray number ends its parse rather than hanging it) |

---

*Reported by the P2 Knowledge Base project (github.com/ironsheep/P2-Knowledge-Base). We found this while
verifying the DEBUG Window Manual against the tool; the documentation fix and this report were produced together.*

---
---

# Root-cause analysis — confirmed against the v55 source

*Appended by the PNut-Term-TS project after tracing this in `DebugDisplayUnit.pas` (v55). Line numbers are v55.*

**Status: CONFIRMED.** The reported mechanism is exactly right, the suggested fix is exactly right, and we
extended the audit to prove SCOPE_XY is the **only** exposed site. Details below so Chip can apply the
one-line fix with confidence.

## 1. Why `ptr` never advances — the proof

Everything turns on the element readers (L4109-4139). They are the *only* things that move `ptr`:

```pascal
function TDebugDisplayForm.NextEnd: boolean;
begin
  Result := P2.DebugDisplayType[ptr] = ele_end;        // <-- TESTS ptr. Never advances it.
end;

function TDebugDisplayForm.NextElement(Element: integer): boolean;
begin
  if P2.DebugDisplayType[ptr] = Element then
  begin
    val := P2.DebugDisplayValue[ptr];
    Inc(ptr);                                          // <-- advances ONLY on a type match
    Result := True;
  end
  else
    Result := False;                                   // <-- no match => ptr unchanged
end;
```

So a parse loop is safe **iff every element type it can encounter is consumed by some branch.** Any type
that falls through every branch leaves `ptr` frozen, and `while not NextEnd` spins forever.

`SCOPE_XY_Configure` (L1386-1435) has branches for exactly two types:

```pascal
while not NextEnd do
begin
  if NextKey then          // ele_key  -> consumed
  case val of
    ...
  end
  else if NextStr then     // ele_str  -> consumed
  begin
    ...
  end;
end;                       // ele_num  -> falls through BOTH. ptr frozen. Infinite loop.
```

An `ele_num` matches neither. `ptr` is never incremented, `NextEnd` is never true. **Hang confirmed.**

## 2. This is an omission, not a design choice — Chip already uses the guard idiom in six places

The defensive line the reporter identified is not a one-off in LOGIC. It appears **six times** in v55,
always for exactly this purpose — consume-or-break the element type the loop cannot handle:

| line | routine | guard |
|---|---|---|
| 943 | `LOGIC_Configure` | `if NextNum then Break;   // number not allowed` |
| 1040 | `LOGIC_Update` | `if NextStr then Break;   // string not allowed` |
| 1451 | `SCOPE_XY_Update` | `if NextStr then Break;   // string not allowed` |
| 1798 | `SPECTRO_Update` | `if NextStr then Break;   // string not allowed` |
| 2422 | `BITMAP_Update` | `if NextStr then Break;   // string not allowed` |
| 2594 | `MIDI_Update` | `if NextStr then Break;   // string not allowed` |

Note the third row: **`SCOPE_XY_Update` is guarded. `SCOPE_XY_Configure` is not.** The same window, the
same author, the same idiom — applied to the update loop and missed on the configure loop. That is the
whole bug.

## 3. Blast radius — we audited all 18 parse loops, not just the 9 the report covers

The original report checked the nine `*_Configure` loops. We also checked the nine `*_Update` loops,
because they are the same loop shape and could hide the same hole. For each we asked the single decisive
question: *does every element type advance `ptr`?*

| loop | shape | `ele_key` | `ele_num` | `ele_str` | verdict |
|---|---|---|---|---|---|
| `LOGIC_Configure` (941) | `while not NextEnd` | case | **Break** (943) | consumed | safe |
| `SCOPE_Configure` (1161) | `while NextKey` | case | *ends loop* | *ends loop* | safe |
| **`SCOPE_XY_Configure` (1394)** | `while not NextEnd` | case | 🔴 **falls through** | consumed | 🔴 **HANGS** |
| `FFT_Configure` (1565) | `while NextKey` | case | *ends loop* | *ends loop* | safe |
| `SPECTRO_Configure` (1735) | `while NextKey` | case | *ends loop* | *ends loop* | safe |
| `PLOT_Configure` (1882) | `while NextKey` | case | *ends loop* | *ends loop* | safe |
| `TERM_Configure` (2193) | `while NextKey` | case | *ends loop* | *ends loop* | safe |
| `BITMAP_Configure` (2379) | `while NextKey` | case | *ends loop* | *ends loop* | safe |
| `MIDI_Configure` (2506) | `while NextKey` | case | *ends loop* | *ends loop* | safe |
| `LOGIC_Update` (1038) | `while not NextEnd` | case | `while NextNum` | **Break** (1040) | safe |
| `SCOPE_Update` (1215) | `while not NextEnd` | case | `while NextNum` | consumed | safe |
| `SCOPE_XY_Update` (1449) | `while not NextEnd` | case | `while NextNum` | **Break** (1451) | safe |
| `FFT_Update` (1626) | `while not NextEnd` | case | `while NextNum` | consumed | safe |
| `SPECTRO_Update` (1796) | `while not NextEnd` | case | `while NextNum` | **Break** (1798) | safe |
| `PLOT_Update` (1926) | `while NextKey` | case | *ends loop* | *ends loop* | safe |
| `TERM_Update` (2228) | `while not NextEnd` | case | `if NextNum` (2258) | `if NextStr` (2307) | safe |
| `BITMAP_Update` (2420) | `while not NextEnd` | case | consumed | **Break** (2422) | safe |
| `MIDI_Update` (2594) | `while not NextEnd` | case | `while NextNum` | **Break** (2594) | safe |

A `while NextKey do` loop is inherently safe: a non-key element simply fails the loop condition and ends
the parse cleanly, without advancing `ptr` — which is fine, because nothing reads `ptr` afterwards.

**Result: `SCOPE_XY_Configure` is the single hole in the entire file.** The report's conclusion holds under
the wider audit.

## 4. The fix — one line, and it is the reporter's

```pascal
procedure TDebugDisplayForm.SCOPE_XY_Configure;
begin
  // Set unique defaults
  vRange := $7FFFFFFF;
  vRate := 1;
  vDotSize := 6;
  vTextSize := FontSize;
  // Process any parameters
  while not NextEnd do
  begin
    if NextNum then Break;   // number not allowed          <-- ADD THIS LINE (L1396)
    if NextKey then
    case val of
      key_title:
        KeyTitle;
      ...
```

This makes `SCOPE_XY_Configure` structurally identical to `LOGIC_Configure`, the other
channel-label-accepting window: a stray number ends the config parse instead of hanging the tool.

### Two things we checked so you don't have to

- **It does not disturb the `if/else` chain.** The new statement is a complete `if` before the existing
  `if NextKey ... else if NextStr ...`, so the else-binding is unchanged.
- **It does not break `key_size`'s `Continue`.** `SIZE` with a missing number does
  `Continue` (L1404), which jumps to the top of the loop and now hits `if NextNum then Break` first. The
  next element there is by construction *not* a number (that is why `NextNum` failed inside `key_size`), so
  the guard falls through and the element is handled normally. Behaviour is unchanged for every input that
  did not previously hang.

`Break` leaves `ptr` pointing just past the offending number, and nothing downstream of `SCOPE_XY_Configure`
reads `ptr` — same as `LOGIC_Configure` today.

### Optional: a diagnostic instead of silence

`Break` matches LOGIC and is the minimal, consistent fix. But note that under it, the reporter's typo
(`SCOPE_XY W 128 'A'` for `SCOPE_XY W SIZE 128 'A'`) still fails *silently* — the window opens at the
default 256x256 and the `'A'` channel label is dropped, with no hint that the `SIZE` keyword was missed.
If a diagnostic is ever wanted for malformed create lines, this is the natural place for it — but that is
a separate enhancement, and the hang should be fixed on its own regardless.
