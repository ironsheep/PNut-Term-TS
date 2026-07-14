# Canonical fact ledger — v55 adjudicated truth

**Every fix in the REF cleanup conforms to THIS file.** Do not re-derive these; do not "improve" them.
Each entry is settled against raw `/pascal-source/P2_PNut_Public/DebugDisplayUnit.pas` (+ `DebugUnit.pas`,
`GlobalUnit.pas`, `p2com.asm` where noted), and several are additionally confirmed on silicon.

## The trust chain — READ FIRST

> **Pascal = what the tool computes. Hardware = what the reader sees. The REF = somebody's reading of the Pascal.**
>
> - REF prose vs the Pascal the REF itself quotes → **the code wins.**
> - Code vs silicon on *rendered output* → **the pixel wins.** Anti-aliasing, pixel-centering and
>   gamma sit between a geometric parameter and a rendered pixel.
> - **Never settle a question by re-reading the REF.** That is circular. Go to the `.pas`.

---

## 🔴 §0 — DO NOT REVERSE. Settled on silicon. If your Pascal reading contradicts these, REPORT IT, don't "fix" it.

| ID | Settled fact | The tempting-but-wrong reversal |
|---|---|---|
| **F0-1** | LOGIC `LINESIZE`: default **3**, accepted to **32**. | v55 manual's "1..7 / default 1". The manual is loose; the REF is right. |
| **F0-2** | LOGIC `SAMPLES` max **2047**; `SPACING` min **1**. | v55 manual's "2048" / "2..32". REF right. |
| **F0-3** | **`LINESIZE 3` renders 3px — 1:1, whole pixels.** (EF-027) | ⚠️ **The `shl 6` ⇒ "half-pixel" derivation.** It is arithmetically tidy and **wrong about rendered output** — the AA envelope widens small radii. **NEVER restore half-pixel wording.** |
| **F0-4** | **`DOTSIZE` rendered width has NEVER been measured.** | Since the shift-constant derivation demonstrably fails for `LINESIZE`, it cannot be trusted for `DOTSIZE`. State `shl 7`/`shl 6` as **code fact** about the geometric parameter; mark the user-facing pixel unit **NEEDS-HARDWARE**. Do **not** assert "radius" or "diameter" in user-facing terms. |

---

## §1 — Packing (settled exhaustively; **was shipping wrong in `scope.yaml` / `scope_xy.yaml`**)

**F1-1 — The default packing mode is UNPACKED, for ALL NINE windows.**
Chain of proof: `FormCreate:631` runs `SetDefaults` before the `_Configure` dispatch (633-643) →
`SetDefaults:2915` calls `SetPack(0, False, False)` → `SetPack:4152-4155` special-cases `val = 0`,
**bypassing the `PackDef` table**: `vPackCount = 1`, `vPackShift = 32`, `vPackMask = $FFFFFFFF`.
⇒ **one full 32-bit sample per transmitted long.**

`SetPack` is called from exactly **two** places in the whole 4263-line unit: `SetDefaults:2915` and
`KeyPack:2831`. `KeyPack` is reached **only** from a `key_longs_*`/`key_words_*`/`key_bytes_*` case
arm. **No window sets a packing default of its own** (verified across all nine `// Set unique defaults`
blocks). PLOT / TERM / MIDI have **no pack key at all** and never call `UnPack` — packing is inert for them.

*Silicon corroboration:* `ch06-logic-spi-bus.spin2` declares no pack mode and renders a coherent
3-channel SPI trace — impossible under a `LONGS_1BIT` default (which would explode one long into 32
one-bit samples, mask `$1`).

> **`LONGS_1BIT` IS NOT THE DEFAULT ANYWHERE.** It is one of twelve opt-in keys.

**F1-2 — Packing is fixed at window creation.** The pack keys appear only in `_Configure` loops,
never in `_Update`. It cannot be changed mid-stream.

**F1-3 — `PackDef` (140-152) has NO per-mode sign flag.** Every entry encodes `0 shl 16`. The
`shl 16` field is always 0 and is never read (`SetPack` reads only bits 0-15). **Sign-extension is a
runtime flag**, set only by a trailing `SIGNED` keyword. There is no "LONGS_* are signed" rule.

**F1-4 — `ALT` / `SIGNED` are trailing modifier keywords** parsed by `KeyPack` (2817-2832): up to two
of them, either order, after the packing keyword.

**F1-5 — `ALT` = FULL WITHIN-BYTE BIT REVERSAL for 1-bit modes.** `NewPack` (4158-4164) applies three
**cumulative** guards (`vPackShift <= 1`, `<= 2`, `<= 4`). At shift 1 **all three fire** ⇒ each byte's
8 bits are reversed (`0x01 → 0x80`). It is *not* a stage-1 adjacent-bit swap. For `*_2BIT` only the
pair+nibble swaps apply; for `*_4BIT` only the nibble swap; for 8/16-bit modes `ALT` is a no-op.

**F1-6 — `NewPack` does NOT read the element stream.** It begins `Result := val;` — it reuses the
value already latched by the enclosing `while NextNum do`. It consumes nothing and advances nothing.

**F1-7 — `UnPack` (4166-4171) yields the LOW sub-field first**, then shifts. Sign-extension is
conditional on `vPackSignx` **and** the sub-sample's own top bit.

---

## §2 — Parameter parsing

**F2-1 — `KeyValWithin` = ASSIGN-AND-CLAMP.** The variable is **always** assigned, saturated to
[bottom, top] via `Within` (`GlobalUnit.pas:222-227`). Out-of-range is **never** "ignored".
`DOTSIZE 99` (range 1..32) ⇒ `32`. `SET 9999` on a 256-wide bitmap ⇒ `255`.

**F2-2 — the boolean result of `KeyVal`/`KeyValWithin` means "a number was present", NOT "it was in
range."** Range never affects the result. Callers branch on it to detect a **missing** parameter:
`KeySize` (2718-2722) chains it; `LOGIC_Configure:978` defaults on absence; `PLOT_Update:2058` `Break`s;
`SCOPE_Update:1239` `Continue`s.

**F2-3 — `OPACITY` is NOT clamped** (PLOT, 1944-1945): a bare `vOpacity := val` into a `byte` with
range checks off (`{$Q-,R-}`) ⇒ the value **truncates mod 256**. `OPACITY 256` ⇒ **0 (fully
transparent)**. `OPACITY -1` ⇒ 255. Contrast `SPRITE`'s genuinely clamped `KeyValWithin(t6, 0, 255)` (2109).

**F2-4 — Configure phase is KEY-ONLY** (`while NextKey do`). A non-key element (a string, a number)
**terminates the configure parse** and the rest of the create message is silently dropped. An
update-only directive (`TRIGGER`, `POLAR`, a channel-def string) in the create message therefore
truncates the configuration. **EF-003 measured the consequence for SCOPE: the window is not created
at all.** Say that, not "opens empty".

**F2-5 — element array layout:** `[0]` = `ele_dis` (display type), `[1]` = `ele_nam` (window name),
directives start at `ptr := 2` (`FormCreate:625-632`). `KeyPos` reads **exactly two** numbers
(left, top) — never four. One terminating `ele_end`.

**F2-6 — `ele_key` carries ANY `key_*` id, 0-92** — named colour (0-9), colour mode (10-28), packed
format (29-40), functional keyword (41-92). Not just 41-92. Keyword constants span lines **76-127**.

---

## §3 — `CLOSE` is LIVE (this reverses a prior "no live handler" claim)

**F3-1 — `CLOSE` (`key_close` = 49) is a real, working directive, dispatched at the PARSER layer.**
It appears in **no** `XXX_Update` case statement — deliberately, and that absence is *not* evidence of
deadness. A `.pas`-only sweep cannot see the handler because it lives in **`p2com.asm`**.

Dispatch path:
1. `parse_debug_string` (p2com.asm:19565-19572) detects CLOSE on an **existing-display command** and
   sets a flag.
2. p2com.asm:19613-19624 reverts the name symbol `dd_nam`→`dd_unk` and **clears that display's bit in
   `debug_display_ena`** (= Pascal `P2.DebugDisplayEna`, `GlobalUnit.pas:123`).
3. `TDebugForm.ChrIn` (`DebugUnit.pas:236-237`) then runs the **full** `UpdateDisplay(...)` and only
   afterwards: `if P2.DebugDisplayEna shr j and 1 = 0 then DisplayForm[j].Close;`

**F3-2 — semantics:**
- **Command-only.** Ignored in a *new-display declaration* (p2com.asm:19569-19570).
- **Multi-target.** `` `Plot1 Plot2 CLOSE `` closes **all** named targets (`loop @@close`, 19624).
- **Update-first, close-second.** The rest of the message **executes**, then the window closes.
  `` `MyPlot SAVE 'shot' CLOSE `` **saves, then closes.**
- **Purpose: reclaims one of the 32 display slots** — the id and the name become reusable.
- It is the per-window counterpart of the global `DEBUG_END_SESSION` teardown
  (`TDebugForm.CloseDisplays`, `DebugUnit.pas:125-134`).

> **Add `CLOSE` to every directive table** (v55 lists it in all nine Feeding tables). Delete the
> "no live handler / only PLOT has `_Close`" claim from Matrix §6.

---

## §4 — `SAVE` grammar (`KeySave`, 2839-2866)

**F4-1 — six forms; three of them silently write NOTHING:**

| Form | Writes |
|---|---|
| `SAVE 'name'` | `Bitmap[1]` (the **front/display** buffer) → `name.bmp` |
| `SAVE WINDOW 'name'` | desktop **scrape** of the window's *outer* rect — **includes title bar/borders**, vulnerable to occlusion |
| `SAVE left top width height 'name'` | desktop scrape of an arbitrary screen region |
| `SAVE WINDOW` | capture to memory, **no file** |
| `SAVE l t w h` | capture to memory, **no file** |
| `SAVE` (bare) | `Exit` — **nothing at all** |

The filename always comes **last**. Extension `.bmp` is appended.

**F4-2 — sharp edge:** a non-`WINDOW` keyword after `SAVE` is **consumed and then discarded** by the
`Exit` at 2848. `` `Win SAVE CLEAR `` does nothing **and eats the CLEAR**.

**F4-3 — `SAVE` writes `Bitmap[1]`, the front buffer.** In `UPDATE` (manual) mode, drawing accumulates
in `Bitmap[0]` and only reaches `Bitmap[1]` on an explicit `UPDATE`. **A `SAVE` before that `UPDATE`
writes the STALE previous frame.**

**F4-4 — BITMAP `SAVE 'name'` writes the bitmap at 1× LOGICAL scale — UN-dotsized.** `DOTSIZE`
magnification is a display-time `StretchDraw` (`BitmapToCanvas:3526-3527`) that **never touches
`Bitmap[1]`**. Same for PLOT and SPECTRO (which can never set `vSparse`, so they always take the
logical-size branch).
**Sole exception:** SPARSE **with `DOTSIZE >= 4` on both axes**, where `SetSize:2938-2943` allocates
the bitmaps at **physical** size. To capture the magnified on-screen appearance you must use
`SAVE WINDOW 'name'`.

---

## §5 — Rendering / geometry

**F5-1 — bitmaps are `pf24bit`: 3 bytes/pixel, BGR, NO alpha** (`FormCreate:596-599`; corroborated by
`PlotPixel:3440-3443` writing a 3-byte stride). Every "32-bit / 4 bytes / RGBA / BGRA" claim is wrong,
**and every memory figure derived from it is wrong.**

**F5-2 — `SmoothDot` (3839-3842) is a ONE-LINE wrapper**: `SmoothLine(x, y, x, y, radius, color, opacity)`.
There is no distance-field loop, no per-pixel AA rasterizer inside it. All dot rendering comes from
`SmoothLine` (3844-3984).

**F5-3 — `SmoothShape` (3590-3743) uses NO signed-distance field.** It uses quarter-ellipse lookup
tables + 4-way symmetric plotting + gamma blending. `solid := (thick = 0) or (2·thick >= xs) or
(2·thick >= ys)`; `rectangle := (xro = 0) or (yro = 0)`. The stroke is an **inward** frame — it does
not straddle the boundary by ±t/2.

**F5-4 — `TranslateColor` (3090-3173) IS on every window's path**, via `KeyColor:2780`. A **numeric**
colour is interpreted through the **current `vColorMode`** — *not* as literal RGB24 (RGB24 is merely
the default, `SetDefaults:2889`). "There is no `TranslateColor` in PLOT/MIDI" is false.

**F5-5 — `TranslateColor` computes the white flag `w` BEFORE rescaling `p`** — 3122 *then* 3123
(LUMA/RGBI); 3153 *then* 3154 (HSV). Reversing the order inverts the `…X` modes' white/black polarity.

**F5-6 — named colours BLACK and WHITE take NO brightness nibble** (`KeyColor:2764-2768` — fixed
literals). The optional 0-15 nibble (default 8) applies only to `ORANGE`..`GRAY`.
*Trap:* `BLACK 8` leaves the `8` in the stream for the next `KeyColor` to eat as a numeric colour.

**F5-7 — `LIME` is a Delphi `clXxx` PALETTE CONSTANT, not a DEBUG colour keyword.** The keyword is
**`GREEN`**. Keep the value; fix the name. The two colour systems are distinct — say so.

---

## §6 — TEXTSTYLE (settled; the fight was a vocabulary collision)

**F6-1 — the Pascal case arms are BARE.** `AngleTextOut` (3502-3511) carries **no** `//Left-aligned`-style
comments. Verified byte-exact. **Chip never named the justify values — every such name in the REF was
invented downstream.** That invention is the entire origin of the dispute.

**F6-2 — the geometry (angle 0; `TextOut(x + rx, y - ry)`, 3516; screen Y grows DOWN):**

| bits | offset | ink lands | anchor is the… |
|---|---|---|---|
| H = 0/1 | `tx := -w/2` | centred | centre |
| **H = 2** | `tx := 0` | **RIGHT of the anchor** | LEFT edge |
| **H = 3** | `tx := -w` | **LEFT of the anchor** | RIGHT edge |
| V = 0/1 | `ty := h/2` | centred | middle |
| **V = 2** | `ty := h` | **ABOVE the anchor** | BOTTOM edge |
| **V = 3** | `ty := 0` | **BELOW the anchor** | TOP edge |

**F6-3 — code and hardware AGREE.** EF-031 names these from the **ink side** ("%10 = right/top" = the
ink appeared right of / above the guide line). The REF named them from the **anchor-edge** side. Same
pixels, two vocabularies. (No implementation could put ink *left* for H=2 — `tx` is literally 0.)
There are **no GDI alignment calls anywhere** in the source (`SetTextAlign`/`TA_*`: zero hits), so the
DC keeps the default `TA_LEFT | TA_TOP` and `TextOut(X,Y)` places the cell's left/top at `(X,Y)`.

> **MANDATORY WORDING — state BOTH halves, never a bare axis name:**
> *"`%10`: the text sits **above** the anchor point (the anchor is the text's **bottom** edge)."*
> Unambiguous under either convention; matches both the Pascal and EF-031.

**F6-4 — the style bitfield:** bits 0-1 = 4-level **weight** (`weight[style and 3]` = 100/400/700/900,
3485/3494); bit 2 = italic; bit 3 = underline. **There is no strikeout bit.** Bits 4-5 = H-justify,
bits 6-7 = V-justify. `$02` is **BOLD** (700), not "normal" — normal (400) is `$01` = `DefaultTextStyle`.

---

## §7 — Per-window facts that bite

**F7-1 — PLOT default coordinates are BOTTOM-LEFT / Y-UP.** `PLOT_GetXY` (2157-2166): default
`vDirY = False` ⇒ `y := vHeight-1-vOffsetY-vPixelY`. (EF-020 confirms; v55 L1291 agrees.) Prose saying
"top-left, Y increases downward" contradicts the very code it quotes.

**F7-2 — PLOT default `SIZE` is 256×256** (`SetDefaults:2884-2885`), not 512×512. `PLOT_Configure`
never overrides it.

**F7-3 — sprite orientation: code 4 is a DIAGONAL TRANSPOSE, code 5 is the 90° CCW rotation.** (2128-2129.)
The ASCII grids for 4 and 5 are swapped in the REF.

**F7-4 — SCOPE: a 9th channel def OVERWRITES channel 8** — not "ignored". `vIndex` saturates
(`if vIndex <> Channels then Inc(vIndex)`, 1219-1220) but the write still lands.

**F7-5 — SCOPE channel-def parameter ORDER is positional:** `'label' {count/AUTO} low high tall base grid color`.
A numeric colour requires every preceding positional to be supplied. A bare number after the label is
the **low** bound (SCOPE) / the **count** (LOGIC) — never a colour.

**F7-6 — LOGIC trigger uses the XOR form:** `((data XOR match) AND mask) = 0` (1086). ⇒ **`match` bits
outside `mask` are DON'T-CARES.** `TRIGGER $01 $03` behaves identically to `TRIGGER $01 $01`.
`mask = 0` disables triggering entirely (1080).

**F7-7 — LOGIC DOES draw a trigger indicator** — a **dotted, blinking vertical line** in
`ClearBitmap`'s `dis_logic` case (3262-3282), *not* in `LOGIC_Draw`. Colours alternate (`vToggle`)
each draw. `CLEAR` (1054) and `SetSize` (2969) clear `vTriggered` precisely to suppress it.
The REF says three times that LOGIC draws none. It is wrong.

**F7-8 — LOGIC `vSpacing` is the HORIZONTAL sample pitch** (`vWidth := vSamples * vSpacing`, 1029);
vertical pitch is `ChrHeight`. Line thickness is **`vLineSize`**, not `vDotSize`.

**F7-9 — SCOPE_XY / PLOT polar: θ=0 points EAST, increasing θ is COUNTER-CLOCKWISE.** Delphi's
`SinCos(Tf, Xf, Yf)` is **sine-first** ⇒ `x = Rf·sin(Tf)`, `y = Rf·cos(Tf)` (1537-1540). The two
windows do **not** differ (this answers the doc team's Q7 — their SCOPE_XY "straight up" is a REF
error). Corroborated by the inverse readout (`ArcTan2(ScaledY, ScaledX)`, 708) and by **EF-032**.
*The Cartesian LOGSCALE path (1519-1523) looks different but is mathematically equivalent — Pascal's
deliberate double swap cancels. Do NOT "fix" it.*

**F7-10 — SCOPE_XY `SIZE`:** the directive's **argument** is a radius; the stored `vWidth` is the
diameter. Default `vWidth = 256` ⇒ argument default **128**. Clamp is applied to `val * 2` ⇒ 32..2048 px.
`vHeight := vWidth` (1405) — there is no `scope_xy_hmin`/`_hmax`.

**F7-11 — SCOPE_XY: persistent mode is NOT the default.** `vSamples` defaults to 256
(`SetDefaults:2886`) ⇒ a **fading 256-sample trail**. `SAMPLES 0` selects persistent.

**F7-12 — SCOPE_XY `SAMPLES`/`RATE` clamp is 0..2048 / 1..2048** (`XY_Sets = DataSets = 2048`), and the
backing buffer is sized for it. The v55 manual's "512" **under-documents** the code. (The 512 is likely
bleed-over from `fft_default = 512`.)

**F7-13 — SCOPE_XY `ClearBitmap` draws a full graticule** (3384-3409) — inscribed circle + full
crosshair in `vGridColor`, `r=<vRange>` text (+ ` logscale`), and up to 8 bold-italic trace labels in
the corners. **The REF documents none of it.**

**F7-14 — `SAMPLES n` truncates DOWN to a power of two** (FFT/SPECTRO: `Trunc(Log2(...))`).
`SAMPLES 1000` ⇒ **512**, not 1024. `SAMPLES 1024` ⇒ bins 0..511 (`FFTlast := vSamples div 2 - 1`).

**F7-15 — FFT `MAG` is a GAIN ×2ⁿ.** `FFTpower := Hypot(rx,ry) / ($800 shl FFTexp shr FFTmag)` (4248) —
raising `MAG` **shrinks the divisor**. It does not divide the output. **(Shipping wrong in `fft.yaml`.)**
`FFTpower[]` is a **magnitude** (`Hypot`), not a power (|X|²).

**F7-16 — FFT `logscale` draws ONE STRING, no markers.** `'logscale'` in `vGridColor` at the top-right
(3358-3365). The REF's "power-of-2 axis markers" are **fabricated** — no markers of any kind exist.

**F7-17 — FFT twiddle is `e^{+iθ}`** (4224-4225) — the conjugate of the textbook `e^{-2πik/N}`
convention. `Rev32` (4253-4260) reverses only the **low 12 bits** into the high 12 (mask `$FFF00000`).

**F7-18 — `RateCycle` (3079-3088) tests EQUALITY** (`vRateCount = vRate`), not `>=`. Consequence: a
**non-positive rate NEVER fires** — see F7-19.

**F7-19 — BITMAP `RATE -1` works in the CREATE message only.** The `-1 → vWidth*vHeight` substitution
lives at the tail of `BITMAP_Configure` (2413). `BITMAP_Update`'s handler is a bare `KeyVal(vRate)` with
**no** substitution ⇒ a runtime `RATE -1` (or `RATE 0`) leaves the rate non-positive, `RateCycle` can
never match, and **auto-refresh freezes** until a subsequent `TRACE` / `CLEAR` / explicit `UPDATE`
intervenes. Real v55 behavior; document it as a footgun.

**F7-20 — BITMAP `CLEAR` silently DISCARDS a user-set `RATE`.** `key_clear` (2443-2448) ends with
`SetTrace(vTrace, True)` — `ModifyRate = True` unconditionally ⇒ `vRate` is re-derived to `vWidth`
(patterns 0-3) or `vHeight` (4-7).

**F7-21 — BITMAP SPARSE requires a SPARSE colour AND `DOTSIZE >= 4` ON BOTH AXES.** `SetSize:2938`
gates on `(vSparse <> -1) and (vDotSize >= 4) and (vDotSizeY >= 4)`; otherwise `vSparse := -1` (2947) —
**sparse silently self-disables.** When active, the bitmaps are allocated at **physical** size (2940-2943).

**F7-22 — BITMAP SPARSE cell geometry:** the outer `SmoothShape` (`xro=yro=0`, `thick=0`) is a **SOLID
FILLED RECTANGLE** over the whole cell in the sparse colour — *not* a hollow frame. The inner call
draws the data pixel as a **round dot/ellipse at ~3/4 cell size** (radii clamped by `SmoothShape`).
The grid look is the residual sparse colour around the dot. **Every sparse pixel is plotted — there is
no "skip if value == sparse colour" rule.**

**F7-23 — BITMAP has NO drawing primitives.** No LINE, no CIRCLE, no TEXT. The claim that BITMAP
"inherits PLOT's drawing primitives" is false and is the root cause of the BITMAP ToO documenting
PLOT's `CIRCLE`/`TEXTSTYLE` encodings (both of which it then got wrong). **PLOT `CIRCLE` takes a
WIDTH/diameter** (2012, 2031: radii are `t3 shr 1`), not a radius.

**F7-24 — BITMAP colour-mode enum ORDER** (ids 10-28, load-bearing — consumed as ranges):
`LUT1 LUT2 LUT4 LUT8 LUMA8 LUMA8W LUMA8X HSV8 HSV8W HSV8X RGBI8 RGBI8W RGBI8X RGB8 HSV16 HSV16W HSV16X RGB16 RGB24`.
The **HSV8 family precedes RGBI8**, and RGB8 follows RGBI8X. **The Matrix has this right; the ToO
transposed them.**

**F7-25 — BITMAP: there is NO default LUT palette.** `vLut[]` is written **only** by `LUTCOLORS`
(2806-2815); as a zero-initialised field every entry is `$000000`. A LUT mode used without `LUTCOLORS`
renders **entirely black**, and the background (`vLut[0]`) is black too.

**F7-26 — SPECTRO default axis mapping.** Default `vTrace = $F` (bit 2 set) ⇒ **no W/H swap** ⇒
**time on X, frequency on Y**. The swap (1782-1787) applies to traces 0-3 only. `DEPTH` writes `vWidth`
(1751) and defaults to **256** (`SetDefaults:2884`).

**F7-27 — SPECTRO accepts only SIX colour modes** (`LUMA8/W/X` + `HSV16/W/X`, 1767) — not all 19 —
and clamps `DOTSIZE` to **1..16** (vs BITMAP's 1..256).

**F7-28 — `HIDEXY` suppresses the on-screen measurement-cursor readout** (`FormMouseMove:737`), not
axis labels. It does **not** affect `PC_MOUSE`.

**F7-29 — TERM control codes:** 0 = clear+home, 1 = home, 2 n = set column, 3 n = set row,
4-7 = select colour pair 0-3, 8 = BS, 9 = HT, 10 = LF, 13 = CR. **Only 11, 12 and 14-31 are inert**
(no case arm ⇒ silent no-op; never printed).

**F7-30 — TERM column wrap is LAZY.** `TERM_Chr` tests the wrap on entry of the *next* character
(2340), so `vCol` legitimately rests at `vCols`. An eager-wrap model emits an extra blank row.

**F7-31 — TERM default colour pairs are FOUR INVERSE-VIDEO PAIRS** (`DefaultTermColors`, 242):
`0 = ORANGE-on-BLACK`, `1 = BLACK-on-ORANGE`, `2 = GREEN-on-BLACK`, `3 = BLACK-on-GREEN`.
(Not "ORANGE/BLACK ×2, LIME/BLACK ×2". And the keyword is **GREEN** — see F5-7.)

**F7-32 — TERM max size is 256 × 256 characters** (`term_colmax`/`term_rowmax` = 256, 224-227).
`SIZE 300 200` ⇒ **256 × 200**. The v55 overview's "300 × 200" is wrong.

**F7-33 — TERM does NOT accept `COLOR` in the update phase.** `TERM_Update` has `key_black..key_gray`
and `key_backcolor` only. `COLOR` is **config-only** for TERM (2203). PLOT accepts both.

**F7-34 — TERM does not support ANSI escape sequences.** (The BITMAP ToO claims it does — that is a
cross-window contradiction; TERM is right.) Mouse *position* IS available via `PC_MOUSE`; what TERM
lacks is ANSI/xterm mouse-*reporting* sequences.

**F7-35 — MIDI velocity sets FILL HEIGHT, not colour intensity.** A second `RoundRect` in the **flat**
configured on-colour, with a velocity-scaled **top edge** (2673-2679). Hue/brightness never change.

**F7-36 — MIDI velocity-0 note-on renders the key OFF** — correct by construction (`MidiVelocity[n] := 0`
+ the `> 0` render test). It needs **no** special case. The "may not render correctly" warning is a
**false limitation**.

**F7-37 — MIDI `tweak`:** for a **white** key it positions only the label; for a **black** key it
positions the **key itself** (its left edge and width, 2553-2554), with the label at the key's centre.

**F7-38 — MIDI `RANGE first {last}`:** issuing `RANGE` forces `MidiKeyLast := MidiKeyFirst` (2517)
*before* the optional 2nd value. So **`RANGE 60` alone yields the range 60..60.** 108 is the default
only when `RANGE` is absent.

**F7-39 — sample buffers and sprite arrays are PER-WINDOW private instance fields**, declared inside
`TDebugDisplayForm`'s `private` section — not shared globals. A sprite defined in one window is
invisible to another.

**F7-40 — `vTwoPi` is `int64`** (315) — it must hold ±`$100000000`. `POLAR -1` ⇒ **negative**
`-$100000000` (reverses rotation); only `0` ⇒ `+$100000000`.

---

## §8 — Known-stale mechanics

**F8-1 — every REF citation into the shared-routine region (3000+/4100+) is stale by ~8 lines.**
Uniform offset. Re-anchor mechanically, **last** (after all content edits, which move text).

**F8-2 — `DebugDisplayType` is `array[...] of BYTE`** (`GlobalUnit.pas:126`); `DebugDisplayValue` is
`of integer` (127). `DebugDisplayLimit = 1100` (35).

**F8-3 — display windows do NOT cascade.** Any "POS or cascade" wording is stale.

**F8-4 — the font FACE is assigned once in `FormCreate:600`** (`Font.Name := FontName`);
`SetTextMetrics` (2919-2925) sets only the size.
