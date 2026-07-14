# Handoff — REF self-consistency cleanup (matrix + 9 theory-of-operations)

**To:** the pnut-term-ts / REF-authoring agent (the one that produced `DEBUG-WINDOW-DIRECTIVE-MATRIX.md`
and `theory-of-operations/*_Theory_of_Operations.md` from `DebugDisplayUnit.pas`).
**From:** Debug-Window manual — systematic v55 ↔ REF reconciliation, 2026-07-14.
**Evidence:** `engineering/document-production/manuals/p2-debug-window-manual/audit/v55-vs-REF-systematic-2026-07-13.md`
**Ask:** re-ground the REF against the **raw Pascal** and remove its internal contradictions.

---

## Why this pass exists — read this first, it defines the whole job

A directive-by-directive diff of the **Spin2 v55 language reference** against the REF found ~30 defects.
**Every one of them is the REF's *prose / directive tables / worked examples* contradicting the *Pascal the REF
itself quotes*, in the same document.**

That is the shape of the job. Each of your documents has two layers:

- **Layer 1 — quoted Pascal.** Transcribed source. Authoritative.
- **Layer 2 — prose, "Default" columns, directive tables, examples.** Your annotations *about* the code.

**The defects are all in Layer 2.** You are not being asked to re-derive the implementation — you got the
implementation substantially right. You are being asked to make the write-up agree with the code you already
quoted, and to remove the places where Layer 2 asserts things Layer 1 never said.

### Rules

1. **Go to the RAW `DebugDisplayUnit.pas`. Never re-read the REF markdown to settle a question** — that is
   circular and cannot catch its own misread. The raw `.pas` is **not in our repo**; use your copy.
2. **Widen your source scope.** Several defects exist because the REF read *only* `DebugDisplayUnit.pas` and then
   made claims about the whole system. Where a question is about dispatch or lifecycle, also read
   `DebugUnit.pas`, `GlobalUnit.pas`, `EditorUnit.pas` (see §4).
3. **Quote the procedure + line for every change you make.**
4. **The Pascal tells you what the tool *computes*. It does not always tell you what the user *sees*.**
   Anti-aliasing, pixel-centering and gamma sit between a geometric parameter and a rendered pixel. Where the
   question is "what appears on screen," the answer is a **measurement**, not a shift constant. See §0.

---

## §0. 🔴 DO NOT REVERSE — settled on real silicon. Empirical outranks both docs.

These are **CONFIRMED** entries in the empirical ledger
(`engineering/ingestion/external-sources/hardware-verification/P2-EMPIRICAL-FINDINGS.md`). A previous fan-out
tried to reverse two of them with very persuasive Pascal-derived reasoning. **Do not.** If your reading of the
`.pas` appears to contradict one of these, that is a **finding to report**, not a correction to apply.

| Ledger | Settled fact | The tempting-but-wrong reversal |
|---|---|---|
| **EF-027** | LOGIC `LINESIZE` default **3**, accepted to **32** (17px at 32, no clamp at 7) | v55's "1_to_7 / default 1" — **v55 is loose here; the REF is right.** Keep it. |
| **EF-027** | LOGIC `SAMPLES` max **2047** (2048 clamps) | v55's "2048". REF right. |
| **EF-027** | LOGIC `SPACING` min **1** (`SPACING 1` accepted) | v55's "2_to_32". REF right. |
| **EF-027** | **`LINESIZE 3` renders 3px — 1:1, whole pixels** | ⚠️ **The `shl 6` ⇒ "half-pixels" derivation.** It is arithmetically tidy and it is **wrong about rendered output** — the AA envelope widens small radii. Do **not** restore "half-pixel" wording for `LINESIZE`. |
| **EF-031** | PLOT `TEXTSTYLE`: horiz `%10`=**right** / `%11`=**left**; vert `%10`=**top** / `%11`=**bottom** (ink measured against a guide line, two OSes) | The matrix §7.3 L610 and PLOT ToO §8.2 invert **both** axes; §8.4 inverts horizontal only. **Fix the REF to the ledger.** |
| **EF-020** | PLOT default coordinates are **bottom-left / Y-UP** | PLOT ToO §6.1/§17.4 prose says top-left/Y-down — contradicting `PLOT_GetXY`, which the same section quotes. |
| **EF-032** | PLOT `POLAR` θ=0 points **EAST**, increasing θ is **CCW** | SCOPE_XY ToO says its polar θ=0 is "straight up" — different window, so possibly both true. **Confirm from source; flag if they really differ.** |
| **EF-003** | A SCOPE channel-def **on the create line prevents the window from being created** (not "opens empty") | SCOPE ToO §6.5/§15 examples put channel-defs on the create line. Those examples are broken. |
| *(numerically reproduced)* | `ALT` = **full within-byte reversal** (`0x01 → 0x80`), not a stage-1 adjacent swap | The three `vPackShift <= 1 / <= 2 / <= 4` guards are **cumulative**, and all three fire for 1-bit. |
| *(v55 + code)* | Packing is **unsigned by default**; `SIGNED` is a **runtime flag** | Not a per-mode table constant. See D-1. |
| *(uncontested)* | TERM default text colour = **orange** `$FF7F00` (`DefaultTermColors[0]`) | An earlier "lime" hold was an EF-025 misread. Dropped. |

**Open hardware-hold — do NOT assert a unit:** `DOTSIZE`'s **rendered** width has never been measured. Since the
shift-constant derivation demonstrably fails to predict rendered width for `LINESIZE`, it cannot be trusted for
`DOTSIZE`. State the geometry (`shl 7`/`shl 6`) as *code fact* and leave the user-facing unit marked
**NEEDS-HARDWARE**.

---

## §1. Layer-2 vs Layer-1 contradictions — the REF's prose vs the Pascal it quotes

Fix Layer 2 to agree with Layer 1. Cite the line you're conforming to.

### PLOT ToO
| # | Location | Prose says | The quoted Pascal says |
|---|---|---|---|
| P-1 | §6.1 + §17.4 (L576-584, L622-623, L2931-2934) | "origin top-left", "Y increases downward (default)" | `PLOT_GetXY`: default `vDirY=False` → `y := vHeight-1-vOffsetY-vPixelY` ⇒ **Y-UP, bottom-left**. Confirmed by EF-020 **and** v55 L1291 ("if ydir is 0, the Y axis points up"). |
| P-2 | §5.2 config table (L521) | default `SIZE` = **512 × 512** | `SetDefaults` ⇒ **256 × 256**; the doc's own Directive-Reference (L379) says 256. Also re-seed the 512×512 examples at L1713, L2142. |
| P-3 | §8.2 (L1260-1290) + §8.4 (L1417-1426) | TEXTSTYLE justify labels | → **EF-031** (§0). §8.4 is *also* self-inconsistent with §8.2 on the vertical axis. **When you fix this, report VERBATIM whether the Pascal `case` statements carry Chip's own `//Left-aligned`-style comments, or whether those comments were added by the REF.** That distinction matters to us. |
| P-4 | §10.4 ASCII diagrams (L1944-1956) | sprite orientation codes **4 and 5 are swapped**; code 4 labelled "Rotate 90° CCW" | §10.3 and the §10.4 formula table are correct: code 4 (`X=y-1, Y=x-1`) is a **diagonal transpose**; code 5 is the 90° CCW. |

### LOGIC ToO
| # | Location | Prose says | The quoted Pascal says |
|---|---|---|---|
| L-1 | Directive table L333, L474; walkthroughs L2765, L2809 | packing **"Default: LONGS_1BIT"** | **Unsourced** — see §2. Its own §6.4 (L627-631) says `val = 0` ⇒ unpacked, 1 sample/long, mask `$FFFFFFFF`. |
| L-2 | §6.5 bullets + example (L649-658) | ALT "swaps adjacent bits: 0↔1, 2↔3…" | Three **cumulative** guards (L639-641) ⇒ **full within-byte reversal**. The example shows only stage 1. |
| L-3 | §4.3 + §9.5 (3 spots) | trigger-offset edge mapping | inverted vs the code. |

### SCOPE ToO
| # | Location | Prose says | The quoted Pascal says |
|---|---|---|---|
| S-1 | Directive table L365, L505 | packing **"Default: LONGS_1BIT"** | see §2 — unpacked. |
| S-2 | §4.3 | trigger-offset edge mapping | inverted. |
| S-3 | §6.5, §15 examples | channel-defs **on the create line** | **EF-003**: that prevents window creation. Rewrite the examples to the separate-message pattern. |
| S-4 | L375 | "further channel defs are **ignored**" | the code it quotes 180 lines later (L549-561): `if vIndex <> Channels then Inc(vIndex); vLabel[vIndex-1] := …` ⇒ the 9th def **overwrites channel 8**. |
| S-5 | TRIGGER offset default | v55 says "**width** / 2" | code: `vTriggerOffset := vSamples div 2`, clamped `0..vSamples-1` ⇒ a **sample index**, not pixels. Confirm and state which. |

### SCOPE_XY ToO
| # | Location | Prose says | The quoted Pascal says |
|---|---|---|---|
| X-1 | §4a L301, L430 | `SIZE` default "**256 (→ 512 px)**" | its own L2160/L2226: `vWidth = 256` ⇒ the directive's **argument** default is **radius 128**. (v55 L1179 agrees: "128".) The stored pixel width was mistaken for the argument. |
| X-2 | §4a L311 | packing **"Default: LONGS_1BIT"** | its own L2094/L2163/L2229: `SetPack(0, False, False)` ⇒ **unpacked**. |
| X-3 | §4a L305, L282, L434 | `DOTSIZE` "diameter in pixels" | L1759: `shl 6`. ⚠️ **Do not "fix" this to half-pixels** — see §0. Mark the rendered unit NEEDS-HARDWARE. |
| X-4 | L658 | "Persistent Mode — Activation: `SAMPLES 0` (**default**)" | L190-192: effective default is a **256-sample fading trail**, not persistent. |
| X-5 | L2166 | a **third, different** SIZE clamp ("32-2048 radius → 64-4096") | vs L314 ("clamp applied to `val*2`: 16..1024 → 32..2048"). Pick the one the code supports. |
| X-6 | L2110 | "From POS command **or cascade**" | **stale** — cascade was ratified away (display windows do not cascade). |
| X-7 | §4a | omits **`CLOSE`** and **`SAVE WINDOW`** | see §3/§4. |

### FFT ToO
| # | Location | Prose says | The quoted Pascal says |
|---|---|---|---|
| F-1 | L107, L153, L522 | `MAG` = "**right-shift divisor**"; example "divide FFT output by 8" | `FFTpower := Hypot / ($800 shl FFTexp shr FFTmag)` (L1006) — raising MAG **shrinks the divisor** ⇒ it is a **GAIN ×2ⁿ**. Its own L1640-1642 says "multiply by 2ⁿ". v55 L1219 says "magnification factor (2ⁿ)". **This one is shipping wrong in `fft.yaml` — highest priority.** |
| F-2 | L134, L1168, L1363 | `DOTSIZE` = "**radius**" | its own §8.2 L1118: "face value = **diameter**". |
| F-3 | L1293-1305 | "Update with Configuration" example passes `samples`/`rate` in an **update** message | its own `FFT_Update` listing (L483-496) accepts only `CLEAR`/`SAVE`/`PC_KEY`/`PC_MOUSE`. v55's FFT Feeding table agrees. **The example is fabricated — delete or rewrite.** |
| F-4 | §13.1 (L1884-1929) | a `NewPack`/`UnPack`/`PackDef` with a `SignExtend()` call, a "bit 16 = sign-extend flag", and "ALT: 2 nums per pack" | **All three are fabricated.** Contradicted by SCOPE_XY ToO L1857-1895 (the verified listing) and by v55 L1401-1404. |
| F-5 | §8.3 (L1172-1180) | a nested-loop `SmoothDot` "edge anti-aliasing" pseudo-code | SCOPE_XY ToO L1763-1771: `SmoothDot` is a **one-liner delegating to `SmoothLine`** — "there is no inline loop in SmoothDot itself." **Fabricated.** |
| F-6 | L1514-1524 | `RateCycle` uses `>=` | SCOPE_XY ToO L1638-1648 shows `=`. One is a mis-transcription — settle it. |
| F-7 | tables | **`TITLE` and `POS` defaults are absent entirely** from the FFT tables | add them (`<name> - FFT`; host origin, no cascade). |

### SPECTRO ToO
| # | Location | Prose says | The quoted Pascal says |
|---|---|---|---|
| SP-1 | §11.1/§11.2 (L1220-1249) | LONGS modes: `sign=1` / "Sign Extend: **Yes**" | `UnPack` gates on the **runtime** `vPackSignx` flag. All modes are **unsigned by default**; the `1 shl 16` is inert padding (LOGIC ToO L580-582 says so explicitly). v55 gives a separate "Final Values **if SIGNED**" column for **every** mode incl. WORDS/BYTES. |
| SP-2 | §11.3 (L1269-1278) | worked example: LONGS_4BIT signed, `$1` → "sign-extend → `$FFFFFFF1` (−15)" | MSB is clear ⇒ **no** sign-extension; and v55's signed range for LONGS_4BIT is **−8..7**, so −15 is impossible. Fix the example. |
| SP-3 | §1.1 (L41-43) | "Horizontal axis = frequency; Vertical = time" | at the **default** `vTrace = $F` (bit 2 set) there is **no W/H swap** ⇒ **time-X / freq-Y**. Its own §16.1 (L1574-1575) states it correctly. v55's own example caption (L1250) confirms. §1.1 is describing traces 0-3, not the default. |
| SP-4 | §4.2 (L401) | `HIDEXY` = "Hide **axis labels**" | it suppresses the on-screen **measurement cursor**; SPECTRO draws no axis labels (the doc says so at L1321-1323). |
| SP-5 | L240, L393 | `DEPTH` default "varies by trace" | its own L1315-1318: `vWidth = 256`. v55 L1233 says **256** plainly. |

### TERM ToO
| # | Location | Prose says | The quoted Pascal says |
|---|---|---|---|
| T-1 | §15.2 / L1340 | "**Unsupported** control codes: **0-7**, 11-12, 14-31" | its own §5.2/§9 (L483-497, L788-833) and the quoted case statement: **0-7 are the core acting codes** (clear/home/set-col/set-row/select-pair 0..3). Only **11, 12 and 14-31** are inert. |
| T-2 | L1119-1122, L1163-1165, L1182-1184 | examples feed the display **type** (`` debug(`TERM "Hello") ``) and use **double-quoted** strings | v55 requires **instantiate-then-feed-by-instance-name**, and strings are **single-quoted** (double quotes are silently ignored — per our own quoting briefing). **These examples do not work.** Rewrite. |
| T-3 | L219 | default colour pairs listed with "**LIME**" | `LIME` is a `clXxx` **palette constant name**, not a DEBUG colour keyword (the keyword is `GREEN`). Keep the value, fix the name, and note the two colour systems are distinct. |
| T-4 | L1322 vs **BITMAP ToO L1845** | TERM: "ANSI escape sequences **not supported**" | BITMAP ToO claims TERM **has** ANSI colour codes. Cross-window contradiction — TERM is right. |

### BITMAP ToO
| # | Location | Prose says | The quoted Pascal says |
|---|---|---|---|
| B-1 | §6.2 (L613) | "Default palette: **grayscale** (0=black, 255=white)" | its own L1513/L1755: `vLut[]` is **zero-init BLACK `$000000`** until `LUTCOLORS`. (Ratified; v55's "default colors 0..7" is wrong.) |
| B-2 | L164, L571-591 | colour-mode enum **order** swaps the **HSV8** and **RGBI8** families | the **matrix** (L60-61, L458-459) matches **v55 L1353-1372**. The matrix order is right; the ToO's is a transcription error. **Matters — the ids are consumed as ranges.** |
| B-3 | §8.2 (L559-563) + ASCII (L908-920) | SPARSE = "square grid **border** with a square inner fill" | its own quoted `SmoothShape` (L543-551) passes `xro=vDotSize, yro=vDotSizeY` to the inner shape ⇒ **a ROUND dot** over a square `vSparse` cell. v55 L1329 says "large **round** pixels". |
| B-4 | L163 | SPARSE directive row | **missing the `DOTSIZE >= 4` gate** (ratified real — below 4, SPARSE self-disables). Add it. |
| B-5 | L21 (exec summary) | "extensive drawing primitives **inherited from the PLOT display**" | its own L1127/L1766: BITMAP has **no** LINE/CIRCLE/TEXT. The summary would lead an author to document primitives that don't exist. |

### MIDI ToO
| # | Location | Prose says | The quoted Pascal says |
|---|---|---|---|
| M-1 | §1 (L48) | "velocity → **key colour intensity**" | its own L1650-1664: the on-colour is flat; velocity scales a second `RoundRect` up from the key bottom ⇒ **velocity sets FILL HEIGHT**. |
| M-2 | §15.1/§15.4 (L1342, L1391) | velocity-0 note-on "**not** treated as note-off"; "may not render correctly" | its own quoted code: state 2 does `MidiVelocity[n] := val` (=0), and `MIDI_DrawKey` colours a key only `if MidiVelocity[i] > 0` ⇒ **a velocity-0 note-on renders the key OFF.** The warning is a false limitation. |
| M-3 | §2.3 (L135, L137) vs §11.1 (L1047-1053) | "60 = Middle C = **C4**", "21 = A0" | vs "note 60 → **C5**", "21 → A1". Pick one octave convention. |

### Matrix (`DEBUG-WINDOW-DIRECTIVE-MATRIX.md`)
| # | Location | Issue |
|---|---|---|
| MX-1 | §7.3 L610 | PLOT `TEXTSTYLE` justify labels — **invert to EF-031** (§0). |
| MX-2 | §6 L333-335 | **"`CLOSE` has no live handler in the display windows"** — see §4. Scope-limited claim stated as system fact. |
| MX-3 | §2/§3/§7.3 | **`CLOSE` has no row anywhere.** v55 lists it in **all nine** Feeding tables. Add it (pending §4). |
| MX-4 | §7.3 L636 | BITMAP `SPARSE` — missing the **`DOTSIZE >= 4`** gate. |
| MX-5 | §7.3 L561 | SCOPE_XY `POLAR`: "−1/0 ⇒ `$100000000`" **drops the sign** for −1 (should be **−`$100000000`** = clockwise). Both the ToO and the Pascal have the sign. |
| MX-6 | §7.3 L570, L582, L585 | Missing defaults: FFT `RATE` (= `vSamples`), SPECTRO `DEPTH` (= 256), SPECTRO `RATE` (= `samples ÷ 8`). |
| MX-7 | §7.0 (`SetDefaults`, 2880-2917) | The transcription has **no packing entry** — which is *why* "default LONGS_1BIT" is unsourced. **State the packing default explicitly** once you've confirmed it (§2). |
| MX-8 | §3 L140 | The update-phase row implies **TERM accepts a `COLOR` keyword**. It does not — `TERM_Update` has `key_black..key_gray` and `key_backcolor` only. (That row is shared with PLOT, which *does* have `COLOR`.) |
| MX-9 | L622 | TERM default colour pairs given as "ORANGE/BLACK ×2, LIME/BLACK ×2" — they are **four inverse-video pairs**: `0=ORANGE/BLACK, 1=BLACK/ORANGE, 2=GREEN/BLACK, 3=BLACK/GREEN` (v55 L1306). Also see T-3 on the LIME/GREEN naming. |

---

## §2. Unsourced assertion — the packing default (**highest priority: it is shipping wrong**)

Three ToOs carry **"Default: LONGS_1BIT"** in their directive tables (LOGIC L333/L474, SCOPE L365/L505,
SCOPE_XY L311). We can find **no quoted Pascal line anywhere in the REF that supports it**:

- the matrix's `SetDefaults` transcription (2880-2917) has **no packing row at all**;
- SCOPE_XY ToO L2083 quotes the init as **`SetPack(0, False, False)`**;
- the REF's own `SetPack` transcription says `val = 0` ⇒ shift 32, count 1, mask `$FFFFFFFF` ⇒ **one 32-bit
  sample per long, unpacked**;
- LOGIC ToO §6.4 (L627-631) says exactly that, three sections after its own table says the opposite.

**Silicon agrees:** `ch06-logic-spi-bus.spin2` declares no pack mode, feeds one plain long per `debug()`, and
renders a coherent three-channel SPI trace. Under a `LONGS_1BIT` default that long would explode into 32 one-bit
samples.

**Action:** confirm the initialization from the raw `.pas` for **every** window, then correct all three tables and
state the default in matrix §7.0. **This claim has leaked into `scope.yaml` and `scope_xy.yaml`** — they ship
*"(12 modes; default LONGS_1BIT)"* to every agent reading our knowledge base.

---

## §3. Coverage gaps — real directives missing from the REF entirely

- **`CLOSE`** — in **all nine** v55 Feeding tables; in **no** REF directive table. (Gated on §4.)
- **`SAVE {WINDOW}`** — several ToOs reduce it to `SAVE {filename}`, losing the whole-window-vs-display-area
  distinction. The matrix has it; the ToOs don't.
- **BITMAP `SAVE`** without `WINDOW` saves the bitmap at **1× scale** (un-dotsized) — v55 L1347, REF silent.
- **BITMAP SPARSE `DOTSIZE >= 4` gate** — ratified real, absent from both the matrix and the ToO directive rows.

---

## §4. Claims made outside your evidence scope — widen the read

The matrix says: *"`CLOSE` has no live handler in the display windows (only PLOT has a `_Close` for cleanup)."*

That conclusion was drawn from `CLOSE` being **absent from the nine `_Update` case statements** — **of one file.**
But v55 documents `CLOSE` as "Close the window" in **all nine** Feeding tables (L1140, 1170, 1195, 1223, 1247,
1295, 1318, 1348, 1393), and `DEBUG_END_SESSION` (which closes all windows) only makes sense as the global
counterpart of a working per-window `CLOSE`.

**Absence within a bounded read is not absence in the system.** `CLOSE` is almost certainly dispatched one layer
up, where the parser frees the form — which a `DebugDisplayUnit.pas`-only sweep can never see.

**Action:** read `DebugUnit.pas` / `GlobalUnit.pas` (`P2ParseDebugString`, `UpdateDisplay`, the
`DebugDisplayEna` bit) and settle where `key_close` is handled. Then either add `CLOSE` to every directive table,
or tell us plainly that it is dead — **with the dispatch path quoted either way.** As written, the matrix reads as
"CLOSE is a no-op," and that would be a shipped error.

---

## §5. Open questions only the raw `.pas` can settle

Return a verdict + quoted code for each:

1. **`CLOSE` dispatch path** (§4). *Blocking — it affects all nine chapters.*
2. **Packing default** — confirm `SetPack(0)` at init, per window (§2). *Blocking — YAMLs are shipping wrong.*
3. **`KeyValWithin`** — does an out-of-range value **assign-and-clamp**, or **reject without assigning**? (The
   manual says BITMAP `SET` out-of-range is "ignored"; the matrix says "clamped." Both cannot be right.)
4. **`KeySave`** — is SCOPE `SAVE`'s filename **required or optional**? Is there a `WINDOW` modifier in the
   grammar?
5. **SCOPE_XY `SAMPLES`/`RATE` max** — v55 says **512** in three separate places; your clamp quote says
   `XY_Sets` = **2048**. Documented limit vs accepted clamp, or is one wrong?
6. **BITMAP feed-phase `RATE -1`** — v55 L1342 says it sets the rate to the bitmap size. Your transcription puts
   the `-1` substitution **only at the end of `BITMAP_Configure`**, with a plain `KeyVal(vRate)` in the update
   handler and an **equality** test in `RateCycle` ⇒ `vRate = -1` would **never fire** and the display would
   freeze. Which is it?
7. **SCOPE_XY `POLAR` θ=0** — your doc says "straight up"; **EF-032** measured **PLOT**'s polar θ=0 as **EAST**.
   Different windows — genuinely different, or a REF error?
8. **TERM max size** — v55's overview (L1113) says **300 × 200** characters; its own `SIZE` row (L1304) and your
   `term_colmax/_rowmax` both say **256**. Confirm 256.
9. **LOGIC trigger match form** — v55 says `(data & mask) = match`; you quote `((t xor match) and mask) = 0`.
   These differ when `match` has bits outside `mask`. Confirm the code form.
10. **PLOT `TEXTSTYLE` case statements** — quote them **verbatim, including any comments**, and tell us whether
    the `//Left-aligned`-style comments are **Chip's** or **yours** (P-3).

---

## §6. What to return

For each item: **location fixed · the Pascal line you conformed it to (proc + line + quoted code) · one-line
rationale.** For §5: **verdict + quoted code**, or **NEEDS-HARDWARE** if the code cannot settle it.

Then we re-run the systematic v55 ↔ REF diff against your cleaned REF, and project the survivors forward into the
manual, the examples and the YAMLs.
