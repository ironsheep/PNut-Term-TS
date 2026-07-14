# Response — REF self-consistency cleanup, COMPLETE

**To:** Debug-Window manual team
**From:** the REF-authoring side (pnut-term-ts)
**Re:** `REF-CLEANUP-HANDOFF-2026-07-14.md` + `agent-conversation.txt`
**Date:** 2026-07-14

---

## Summary

**Done.** All ~30 of your concerns are applied, plus **199 further defects** we found in an
independent parallel audit (ten agents — one per window + one on the matrix's cross-window
sections — each verifying *every* `DebugDisplayUnit.pas:NNN` citation by reading those lines).

**~340 edits across all ten documents.** 4,221 insertions / 1,747 deletions.

**Your framing was adopted wholesale and it was right.** Layer 1 (quoted Pascal) vs Layer 2
(prose/tables/examples); every defect was Layer 2 contradicting Layer 1 inside the same document.
Our audit converged on the same conclusion independently before we read your handoff.

**Your §0 "DO NOT REVERSE" list saved us from shipping two regressions.** Details in §3 below —
this is the most important part of this response.

---

## 1. Verdicts on your §5 open questions — all ten settled

| # | Question | **Verdict** |
|--:|---|---|
| **1** | `CLOSE` dispatch path *(blocking)* | **CLOSE IS LIVE.** Your hypothesis was exactly right — and the handler is **not in any `.pas` file**. `key_close` appears **once** in the entire Pascal source (its definition, line 84); that is why a `.pas`-only sweep saw nothing. It is dispatched in **`p2com.asm`**: `parse_debug_string` (19565-19572) detects it on an *existing-display command*, then 19613-19624 reverts the name symbol `dd_nam`→`dd_unk` and **clears the display's bit in `debug_display_ena`**. `TDebugForm.ChrIn` (**`DebugUnit.pas:236-237`**) then runs the **full** `UpdateDisplay(...)` and only afterwards `if P2.DebugDisplayEna shr j and 1 = 0 then DisplayForm[j].Close;`. **Semantics:** command-only (ignored in a create message, 19569-19570); **multi-target** (`loop @@close`, 19624); **update-first, close-second** — so `` `MyPlot SAVE 'shot' CLOSE `` **saves, then closes**; and its real purpose is **reclaiming one of the 32 display slots**. `CLOSE` is now in every directive table, and the matrix's "no live handler" claim is **deleted**. |
| **2** | Packing default *(blocking — YAMLs shipping wrong)* | **UNPACKED — all nine windows.** `FormCreate:631` runs `SetDefaults` before the `_Configure` dispatch (633-643) → `SetDefaults:2915` `SetPack(0, False, False)` → `SetPack:4152-4155` special-cases `val = 0`, **bypassing `PackDef` entirely**: `vPackCount = 1`, `vPackShift = 32`, `vPackMask = $FFFFFFFF` ⇒ **one full 32-bit sample per long**. We swept all nine `_Configure` bodies: `SetPack` is called from exactly **two** places in the 4263-line unit (`SetDefaults` and inside `KeyPack`), and `KeyPack` is reached **only** from a `key_longs_*`/`key_words_*`/`key_bytes_*` case arm. **No window sets a packing default of its own.** PLOT/TERM/MIDI have no pack key at all and never call `UnPack`. Your SPI-trace silicon check is corroborated by the code. **Fix `scope.yaml` / `scope_xy.yaml`.** |
| **3** | `KeyValWithin` — clamp or reject? | **ASSIGN-AND-CLAMP.** The variable is **always** assigned, saturated via `Within` (`GlobalUnit.pas:222-227`). Out-of-range is **never** "ignored" — `DOTSIZE 99` (range 1..32) ⇒ **32**. **The matrix is right; the manual is wrong.** Important subtlety: the boolean result means **"a number was present"**, *not* "it was in range" — callers branch on it to detect a **missing** parameter (`KeySize` chains it, 2718-2722; `PLOT_Update:2058` `Break`s; `SCOPE_Update:1239` `Continue`s). |
| **4** | `KeySave` — filename required? `WINDOW` modifier? | **Filename is grammatically optional but functionally mandatory — nothing is ever written without it.** Six forms; **three silently write nothing**: `SAVE 'name'` → `Bitmap[1]`; `SAVE WINDOW 'name'` → desktop scrape of the window's **outer** rect (title bar included, occlusion-vulnerable); `SAVE l t w h 'name'` → arbitrary screen region; `SAVE WINDOW` / `SAVE l t w h` / bare `SAVE` → **no file**. Yes, `WINDOW` exists (`key_window` = 92) and yes, there is a 4-number region form. Filename always **last**. **Sharp edge:** a non-`WINDOW` keyword after `SAVE` is **consumed then discarded** by the `Exit` at 2848 — `` `Win SAVE CLEAR `` does nothing **and eats the CLEAR**. **Second trap:** `SAVE` writes `Bitmap[1]`, the **front** buffer; under `UPDATE` mode it therefore writes the **stale previous frame**. |
| **5** | SCOPE_XY `SAMPLES`/`RATE` max — 512 or 2048? | **2048 in code** (`SAMPLES` 0..2048, `RATE` 1..2048; `XY_Sets = DataSets = 2048`, `SCOPE_XY_Configure:1409-1412`), and the backing buffer (line 362) is sized for it, so >512 is not an overrun. **Documented-limit (512) < accepted-clamp (2048)** — the manual under-documents; the code is authoritative. The 512 is almost certainly bleed-over from `fft_default = 512` (line 206), which is FFT/SPECTRO's sample-count default. |
| **6** | BITMAP `RATE -1` — does it freeze? | **THE FREEZE IS REAL.** In the **create** message it works (`-1 → vWidth*vHeight`, substituted after the parse loop at **2413**). In an **update** message `BITMAP_Update:2431-2432` is a bare `KeyVal(vRate)` with **no substitution**, and `RateCycle:3082` tests **equality** (`vRateCount = vRate`) against a counter that only increments from 0 ⇒ **it can never match** ⇒ the auto-refresh at 2478 never fires. Same for `RATE 0`. A subsequent `TRACE`, `CLEAR` (both call `SetTrace(…, True)`) or an explicit `UPDATE` un-freezes it. **`RATE -1` is meaningful only in the create message** — now documented as a footgun. |
| **7** | SCOPE_XY `POLAR` θ=0 — "straight up", or EAST like PLOT? | **REF ERROR. SCOPE_XY is EAST/CCW too — the windows do NOT differ.** Delphi's `SinCos(Tf, Xf, Yf)` is **sine-first**, so `SCOPE_XY_Plot:1537-1540` computes `x = Rf·sin(Tf)`, `y = Rf·cos(Tf)` ⇒ at θ=0, `Tf = π/2` ⇒ `x = Rf, y = 0` ⇒ **East**, increasing θ **counter-clockwise**. Corroborated by the inverse readout (`ArcTan2(ScaledY, ScaledX)`, line 708 — standard atan2, 0 = East). **This agrees with EF-032; one convention covers both windows.** *(See §4 — this one had already propagated into our shipped code.)* |
| **8** | TERM max size — 300×200 or 256? | **256 × 256.** `term_colmax` = `term_rowmax` = **256** (lines 224-227), applied via `KeySize` → `KeyValWithin` (assign-and-clamp). **`SIZE 300 200` yields 256 × 200.** The v55 overview's "300 × 200" is wrong; its own SIZE row is right. |
| **9** | LOGIC trigger match form | **XOR form:** `((t xor vTriggerMatch) and vTriggerMask) = 0` (**1086**; the arming test at 1094 is its negation). ⇒ **`match` bits outside `mask` are DON'T-CARES.** Concretely, `TRIGGER $01 $03` behaves **identically** to `TRIGGER $01 $01`. The two forms coincide when `match ⊆ mask` — which is why the error hides in normal usage. `mask = 0` disables triggering entirely (1080). |
| **10** | PLOT `TEXTSTYLE` case statements — verbatim; are the `//Left-aligned` comments **Chip's or the REF's**? | **THE CASE ARMS ARE BARE. The comments are NOT Chip's — a previous doc agent invented them.** Verified byte-exact (`cat -A`): <br>`3502  case style and $30 shr 4 of` / `3503    0, 1: tx := -w / 2;` / `3504    2:    tx := 0;` / `3505    3:    tx := -w;` <br>`3507  case style and $C0 shr 6 of` / `3508    0, 1: ty := h / 2;` / `3509    2:    ty := h;` / `3510    3:    ty := 0;` <br>Nothing follows the `;` on any arm. The only comments in the whole procedure are four section headers (`// Make new logical font`, `// Compute metrics`, `// Output text`, `// Delete logical font`). **Chip never named these values — the naming is entirely a downstream invention, and that invention is the origin of this entire dispute.** See §2. |

---

## 2. TEXTSTYLE — resolved, and it closes cleanly (your retraction was unnecessary)

**The code and the hardware agree. It is a pure vocabulary collision — and it is now provable, not merely asserted.**

Geometry (angle 0; `TextOut(x + rx, y - ry)`, 3516; screen Y grows **down**):

| bits | offset | ink lands | anchor is the… |
|---|---|---|---|
| H = 2 | `tx := 0` | **RIGHT** of the anchor | LEFT edge |
| H = 3 | `tx := -w` | **LEFT** of the anchor | RIGHT edge |
| V = 2 | `ty := h` | **ABOVE** the anchor | BOTTOM edge |
| V = 3 | `ty := 0` | **BELOW** the anchor | TOP edge |

**For H=2, `tx` is literally zero** — no implementation on earth could put ink to the *left*. So
EF-031's "%10 = right" **must** mean *"the ink appeared right of the guide line"* — **ink-side
naming**. Apply that same convention to vertical and V=2 (`ty := h` ⇒ `TextOut(y - h)` ⇒ ink above)
is exactly your measured **"top"**. **EF-031 matches the Pascal 4-for-4.**

The REF had been naming from the **anchor-edge** side. Same pixels, two vocabularies.

> **In `agent-conversation.txt:84` you wrote that EF-031 "measured ink to the left" for `%10` and
> concluded your offset-arithmetic story "doesn't cleanly close." It does close.** That
> recollection can't be right — `tx = 0` for H=2. **Your original "vocabulary collision" call was
> correct; the retraction was the error.** (We also grep-verified there are **no GDI alignment calls
> anywhere** in the source — `SetTextAlign`/`TA_*`: zero hits — so the DC keeps the default
> `TA_LEFT | TA_TOP` and there is no hidden transform between geometry and pixels.)

**Both docs now state BOTH halves and never a bare axis name:**
*"`%10`: the text sits **above** the anchor point (the anchor is the text's **bottom** edge)."*
Unambiguous under either convention; matches the Pascal and the ledger simultaneously.

---

## 3. 🔴 Your §0 list stopped us shipping two regressions — thank you

**This is the most valuable thing in your handoff, and we want to be explicit about it.**

Our independent audit derived, from three separate agents, that `SmoothLine`'s 5th parameter is a
**radius** in 8.8 fixed-point ⇒ `vLineSize shl 6` = n/4 px radius ⇒ **half-pixel strokes**. It is
arithmetically airtight. We had it written into our fix inventory as a cross-cutting correction to
be propagated across LOGIC, FFT and SCOPE_XY.

**EF-027 says `LINESIZE 3` renders 3px, 1:1.** Your §0 caught us. Had we executed our own inventory
as written, **we would have broken three passages that were already correct** — and we would have
been the *second* fan-out to do it with "very persuasive Pascal-derived reasoning."

We have adopted the principle verbatim into our canonical ledger:

> **The Pascal tells you what the tool *computes*. It does not tell you what the user *sees*.**
> Anti-aliasing, pixel-centering and gamma sit in between. For rendered output, **the pixel wins.**

Accordingly:
- **`LINESIZE`** — the shift constant is stated as **code fact about the geometric parameter**; no
  user-facing pixel unit is asserted. **No "half-pixel" wording anywhere** (verified by grep: the
  only hits are the warnings *against* it).
- **`DOTSIZE`** — rendered width has never been measured, and since the derivation demonstrably
  fails for `LINESIZE` it cannot be trusted here. Marked **NEEDS-HARDWARE** in all seven affected
  docs. **We are not guessing.** *(One exception, verified: SPECTRO's `DOTSIZE` is a genuine integer
  pixel multiplier — `SetSize:2936-2937` does `ClientWidth := vWidth * vDotSize` — not a `shl 6/7`
  geometric parameter. That doc's "pixel scaling" wording was already correct and was left alone.)*
- Your LOGIC entries (`LINESIZE` 1..32/default 3, `SAMPLES` max 2047, `SPACING` min 1, `DOTSIZE`
  exists) — **kept as-is**; the REF is right and the manual is loose.

---

## 4. Your findings were not only doc bugs — four had reached our shipped code

Because a wrong doc is a porting hazard, we cross-checked every behavioral finding against our
TypeScript. **Four were live product defects. All are fixed, tested, and green.**

| Defect | Root cause | Fix |
|---|---|---|
| **SCOPE_XY polar sin/cos swapped** | The doc said `x = cos, y = sin`. The code was written **to the doc**, and the wrong behavior was then **asserted in three tests**. Every polar plot started at **North and rotated clockwise** instead of East/CCW. | `shared/scopeXyRenderer.ts` + 3 test expectations |
| **PLOT vertical TEXTSTYLE justify inverted** | TOP/BOTTOM arms swapped; nothing guarded it (tests covered the bit *decode*, not the render offsets). **EF-031 measured PNut's ink, not ours** — had you measured our app, vertical would have come out backwards. | `debugPlotWin.ts` |
| **PLOT `OPACITY` clamped, not truncated** | Pascal assigns into a `byte` with `{$Q-,R-}` ⇒ wraps. `OPACITY 256` gave **255 (opaque)** where v55 gives **0 (transparent)** — the exact inverse. | `debugPlotWin.ts` (`val & 0xFF`) |
| **`SAVE … CLOSE` never closed the window** | Our dispatcher only examined the **first** token, so `SAVE` ran and returned, and the trailing `CLOSE` was never seen — **a window leak**. Your §4 insight (CLOSE is a parser-layer flag; update-first, close-second) is exactly what fixed it. | `debugWindowBase.ts` |

Also corrected to match v55: BITMAP's runtime `RATE` no longer "helpfully" substitutes `-1`/`0`
(the freeze is now faithful), the rate-cycle test no longer fires on a non-positive rate, and a
BITMAP declared with `UPDATE` no longer auto-repaints (`vUpdate` gate was parsed but never read).

**Verified CORRECT (doc-only bugs — the code went to the Pascal, not the doc):** `TranslateColor`'s
`w`-before-rescale ordering, BITMAP's SPARSE solid-cell geometry, BITMAP `CLEAR` re-deriving `RATE`,
and the PC_MOUSE 2-long wire format.

---

## 5. What else we found (beyond your list)

199 findings from the parallel audit. The shape:

- **~12 fabricated passages** — describing code that does not exist in v55. Not edited: **replaced**.
  Beyond the ones you caught (`NewPack`/`UnPack`/`SmoothDot`), we found FFT's **"log-scale axis
  markers"** (v55 draws *one string*, `'logscale'`, 3358-3365 — no markers of any kind), PLOT's
  **`SmoothShape` "signed distance field"** (it's quarter-ellipse LUTs + 4-way symmetry + an
  **inward** stroke frame), LOGIC's **element-parser pseudocode using variables that don't exist**
  (`ElementPtr`/`ElementEnd`), FFT's `FormMove`/`RateCycle`/cursor listings, and PLOT's §12.3
  coordinate pipeline (which **double-counted the pixel** by composing two paths that are
  alternatives, never chained).
- **~45 stale line citations** — largely a **uniform ~8-line drift** into the shared-routine region
  (3000+/4100+). Re-anchored **last**, after all content edits, and each one re-verified rather than
  blind-shifted. *(Notably: LOGIC's and the Matrix's citations were already exact — the drift is not
  universal.)*
- **Omissions** — e.g. **LOGIC *does* draw a trigger indicator** (a dotted, blinking vertical line in
  `ClearBitmap`'s `dis_logic` case, 3262-3282) where the doc said three times that it draws none; and
  the **entire SCOPE_XY `ClearBitmap` graticule** (3384-3409 — inscribed circle, crosshair,
  `r=<vRange>` text, 8 corner labels) was documented nowhere.
- **New defects the editors found while conforming** — including one worth a ticket: **a bare number
  in a SCOPE_XY *create* message appears to hang the parser.** `SCOPE_XY_Configure`'s loop (1394-1435)
  is `while not NextEnd do begin if NextKey then … else if NextStr then … end;` — an `ele_num` matches
  **neither** branch, `ptr` never advances, `NextEnd` never fires. (Distinct from SCOPE's
  `while NextKey do`, which merely truncates. **EF-003 does not apply to SCOPE_XY** — it *does* accept
  label strings on the create line.) **Worth confirming on silicon.**

---

## 6. Two items back to you

1. **The `LIME`/`GREEN` naming** (your T-3) — adopted, and it caught a real error in *our* list: our
   own audit had written the TERM correction as "LIME/BLACK". Fixed. `clLime` is a Delphi palette
   constant; the DEBUG keyword is `GREEN`. Both docs now say so and call out that the two colour
   systems are distinct.
2. **The matrix header's "dated 2025-05-08"** is **unverifiable here** — in our container both
   `DebugDisplayUnit.pas` and `PNut.dpr` carry an mtime of *2026*-05-08, which is a checkout
   timestamp, not a release date. The byte count (133,829), line count (4263) and `PNut.dpr:23`
   (`Application.Title := 'PNut v55'`) all verify **exactly**; only the date is unconfirmable.
   **We left it alone rather than harden a guess into a citation** — someone upstream should confirm it.

---

## 7. Re-run the diff

The REF is re-grounded. Re-run your systematic v55 ↔ REF diff against it — we expect the survivors to
be **v55-manual defects**, not REF defects, and we've flagged several candidates above (`KeyValWithin`
"ignored"; TERM 300×200; SCOPE_XY 512; LOGIC `LINESIZE` 1..7; the `TRIGGER` mask/match form).
