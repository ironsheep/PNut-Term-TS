# PNut v55 — bug report: `SAVE WINDOW` captures the wrong rectangle

**Severity:** medium-high — `SAVE WINDOW` silently produces a **wrong or useless image**. No error is raised, and
the file *looks* plausible, so a user has no way to know the capture is bad.
**Affects:** PNut v55 (Windows), `SAVE WINDOW 'filename'` on DEBUG display windows.
**Not affected:** the plain `SAVE 'filename'` form (which writes the window's own buffer) is **correct** in every
case we exercised.
**Found by:** the P2 Knowledge Base team, verifying DEBUG-window documentation against the tool.

---

## Summary

`SAVE WINDOW 'name'` is supposed to write a `.bmp` of the **entire window**. In practice the capture rectangle is
both **too small** and **mis-positioned**:

- It **truncates the bottom of the window.**
- It is **offset**, so it can capture a *neighbouring* window, or nothing but desktop wallpaper.

The written file is always a valid `.bmp` of plausible dimensions, so the failure is **completely silent**.

## Evidence 1 — the rectangle is too short (partial capture)

A BITMAP window, `SIZE 8 8 DOTSIZE 8` (a 64×64 canvas), saved with `SAVE WINDOW`:

```
capture       :  70 x 93 px
actual window : ~50 px title bar + 64 px canvas  =  ~114 px tall
```

Row-band analysis of the captured file:

| rows | content |
|---|---|
| 0–50 | window title bar |
| 50–93 | canvas (green) — **and it just stops** |
| right edge | ~4 px of **desktop wallpaper** bleeding in |

The bottom **~21 rows of the canvas are missing**, and the horizontal offset lets desktop through on the right.

## Evidence 2 — the rectangle can miss the window entirely

In the same program, four other display windows (each at its own explicit `POS`, none overlapping) were saved with
`SAVE WINDOW`. **All four files contain nothing but desktop wallpaper.** Correct dimensions, valid `.bmp`, zero
window content.

## Evidence 3 — the rectangle can capture the *wrong window*

Two BITMAP windows, at explicit `POS 0 0` and `POS 300 0`. The second has `SPARSE $FF0000` (red background, green
dots); the first has no `SPARSE` (solid green).

- `SAVE WINDOW` of the **sparse** window returned a **solid green** image — i.e. the content of the **other**
  window.
- A plain `SAVE` of that same sparse window, moments later, correctly returned the red-background/green-dot
  pattern.

The capture rectangle had drifted onto its neighbour.

## Why this is worth fixing

`SAVE WINDOW` is the **only** way to capture a window *as the user sees it* — the plain `SAVE` form writes the
bitmap at 1× un-`DOTSIZE`d (per v55 L1347, which is correct). So for anything involving magnification — a BITMAP
heatmap, a `SPARSE` view — `SAVE WINDOW` is the documented tool, and it is the one that is broken.

Worse, it fails **silently and plausibly**. A user capturing a screenshot for a bug report or a datasheet gets a
file that looks fine at a glance and is wrong.

## Reproduction

`conflict-testQ-doc-claims-battery.spin2` and `conflict-testP-sparse-gate.spin2`, in
`campaigns/2026-07-debug-conflict-tests/` of the P2 Knowledge Base. Both create several BITMAP windows at explicit
`POS` values and save each one **both ways** (plain `SAVE` and `SAVE WINDOW`). The plain saves are all correct; the
`SAVE WINDOW` captures are truncated, empty, or of the wrong window.

## Suggested area to look at

The rectangle handed to the screen-capture call — it appears to use the **client** dimensions where it needs the
**outer/frame** rectangle (hence the missing title-bar-height at the bottom), and to be computing screen
coordinates that do not track where the window actually is.

---

*Reported by the P2 Knowledge Base project (github.com/ironsheep/P2-Knowledge-Base), alongside
`PNUT-BUG-scope-xy-parser-hang.md`. Both were found while verifying the DEBUG Window Manual against the tool.*

---
---

# Root-cause analysis — traced against the v55 source

*Appended by the PNut-Term-TS project after tracing this in `DebugDisplayUnit.pas` (v55). Line numbers are v55.*

## 0. First, a correction to our own report

The "Suggested area to look at" above guesses that the code uses the **client** rect where it needs the
**outer/frame** rect. **That guess is wrong — please disregard it.** The code already uses the outer frame
dimensions, correctly. Chip should not spend any time there.

The real flaw is one level down, and it is a single assumption.

## 1. The routine

`TDebugDisplayForm.KeySave`, L2839-2866:

```pascal
procedure TDebugDisplayForm.KeySave;
var
  l, t, w, h: integer;
begin
  if NextStr then Bitmap[1].SaveToFile(PChar(val) + '.bmp')     // plain SAVE - correct, untouched
  else
  begin
    if NextKey then
    begin
      if val <> key_window then Exit;
      l := Left;                       // <-- VCL form coords
      t := Top;
      w := Width;                      // <-- outer frame size (the report's guess was wrong: this IS right)
      h := Height;
    end
    else
    begin
      if not KeyVal(l) then Exit;      // explicit-rect form: SAVE <l> <t> <w> <h> 'name'
      if not KeyVal(t) then Exit;
      if not KeyVal(w) then Exit;
      if not KeyVal(h) then Exit;
    end;
    DesktopBitmap.Width := w;
    DesktopBitmap.Height := h;
    BitBlt(DesktopBitmap.Canvas.Handle, 0, 0, w, h, DesktopDC, l, t, SRCCOPY);   // <-- screen scrape
    if NextStr then DesktopBitmap.SaveToFile(PChar(val) + '.bmp');
  end;
end;
```

where (L618-619, in the form's create):

```pascal
DesktopBitmap := TBitmap.Create;
DesktopDC := GetWindowDC(GetDesktopWindow);      // held for the form's lifetime; released at L879
```

`Left/Top/Width/Height` are a VCL top-level form's screen position and outer size. `BitBlt` from a desktop
DC reads the **framebuffer**. So the routine rests on one assumption:

> **the process's window coordinates are the same coordinates as the screen's pixels.**

That assumption is false in PNut v55, and everything in the report follows from it.

## 2. Why it is false: PNut is a DPI-unaware process

**Verified from the shipped binary.** `PNut_v55.exe` contains **no application manifest** — zero
occurrences of the `urn:schemas-microsoft-com:asm.*` manifest schema, and `PNut.dpr` adds none. A Windows
process with no manifest is **DPI-unaware**.

On any display scaled above 100% — the factory default on essentially every modern laptop — Windows
therefore **virtualizes PNut's coordinate space**. The process is told it lives on a 96-DPI screen; Windows
scales its output up by the scale factor `s` when composing to the real framebuffer. Consequently:

- `Left/Top/Width/Height` are **logical** (virtualized) values.
- The desktop DC that `BitBlt` reads is the **physical** framebuffer.

The two coordinate spaces differ by `s`, and `KeySave` treats them as identical.

### The report's own measurements pin `s ≈ 1.25`

This is not a hypothesis we are asking you to take on faith — the numbers in Evidence 1 corroborate it
independently of the manifest finding.

The saved file is **70 x 93**. Those two numbers *are* `Width` and `Height` — the code writes them straight
into `DesktopBitmap`. So VCL believes the window is 70 x 93, and that decomposes exactly:

```
w = 70  =  64 client  +  3 + 3   border           (bsDialog, L555)
h = 93  =  64 client  +  3 + 3   border  +  ~23   caption
```

A ~23 px caption is the 96-DPI metric — i.e. **the app believes it is on an unscaled screen**, exactly as a
DPI-virtualized process would.

But the report *measured the window on screen* at **~114 px tall**. And:

```
93 x 1.25  =  116     (reported: ~114)
```

**The window the user sees is ~1.25x the window the app believes it has.** That is the definition of DPI
virtualization, and it is measured evidence, independent of the binary.

### Every symptom falls out of that one number

With `s = 1.25`, a window whose logical left edge is `L` physically sits at `1.25 x L`, while `BitBlt` reads
at `L`. The read rectangle is therefore **undersized by `s`** and **displaced toward the screen origin by
`0.25 x L`** — an error that grows with distance from the origin. Checking that against all three evidences:

| evidence | window | predicted | reported |
|---|---|---|---|
| **1** | at/near origin (`L ~ 0`) | offset ~0, so the top-left corner is captured, but only 70x93 of an 87x116 window: **right ~17 px and bottom ~23 px cut off** | "the bottom **~21 rows** of the canvas are missing" ✅ |
| **3** | `POS 300 0` | window physically at x=375, read at x=300 -> lands **75 px left of it**, inside the neighbour at `POS 0 0` (if that window is >=240 logical px wide) -> **captures the wrong window** | "returned a **solid green** image — the content of the **other** window" ✅ |
| **2** | four windows at spread-out `POS` | read rectangles displaced toward the origin land in the **gaps between** windows -> **bare desktop** | "all four files contain nothing but **desktop wallpaper**" ✅ |

Three qualitatively different failures, one scale factor. The `~21 rows` prediction lands within a pixel or
two of the measurement without being tuned.

### One datum that does not fit — worth a re-check

Evidence 1 notes *"~4 px of desktop wallpaper bleeding in on the **right**."* The mechanism predicts that
strip on the **left** edge: the read rectangle is displaced *toward the origin*, so it starts slightly left
of the true window (the base offset `P2.DebugDisplayLeft` added by `KeyPos` at L2714 is what makes it
nonzero even at `POS 0 0`). Could the reporter confirm which edge it actually is? It does not change the
fix, but if the strip is genuinely on the right, one of our assumptions about the sign of the offset is
off and we would want to know.

**The one-minute experiment that settles the whole mechanism:** set Windows display scaling to **100%** and
re-run the repro. If `SAVE WINDOW` captures correctly at 100% and misbehaves at 125%/150%, DPI
virtualization is confirmed as the cause.

## 3. A second, independent defect in the same routine

This one is real regardless of DPI, and is worth fixing in the same pass.

`BitBlt` from a desktop DC captures **whatever is composited on the screen at that rectangle** — not the
window. So `SAVE WINDOW` is also wrong whenever:

- **the window is occluded** — anything on top of it (the PNut editor, another debug window) is what gets
  saved;
- **the window has not been painted yet** — `KeySave` performs no `Update`/`Repaint` and does not wait for
  DWM composition. The form is shown at L644 immediately after `Configure`, so a `SAVE WINDOW` arriving in
  an early debug message can blit the screen *before the window has been drawn there* — capturing the
  wallpaper that is still showing;
- **the window is on a second monitor or partially off-screen** — `GetDesktopWindow`'s DC is bounded by the
  **primary** monitor, so `Left/Top` outside it (or negative) read nothing.

Note that the "not painted yet" path also produces wallpaper, which is a second route to Evidence 2. DPI
explains the data on its own, but this race exists independently and should not be left in place.

Minor, same routine:
- `DesktopDC` is acquired once per form (L619) and held for the form's whole lifetime. A screen DC held
  across display-mode, monitor or DPI changes can go stale; it should be acquired and released around the
  blit.
- If the filename is missing, the blit still runs and is silently discarded (L2864).
- `DesktopBitmap` never gets a `PixelFormat` (unlike `CursorMask`/`CursorColor`, which are set to `pf24bit`
  at L610-612), so the saved `.bmp` is device-dependent.

## 4. Suggested fix — stop screen-scraping; ask the window to draw itself

Patching the coordinates (e.g. scaling `l,t,w,h` by the monitor's DPI) would fix the framing but leave the
occlusion, paint-race and second-monitor failures untouched. `PrintWindow` fixes the entire class at once:
it renders the window **directly into the bitmap** via `WM_PRINT`/`WM_PRINTCLIENT`, so it uses **no screen
coordinates at all** and never reads the framebuffer.

- immune to DPI virtualization — nothing crosses between coordinate spaces
- immune to occlusion, and to the window not yet being on screen
- immune to multi-monitor origins and off-screen windows
- captures the full outer frame, title bar included

VCL's `TWinControl` implements `WM_PRINTCLIENT` (it routes to `PaintHandler` -> `OnPaint` -> the form's
existing `FormPaint`), so these forms render correctly under it.

```pascal
const
  PW_RENDERFULLCONTENT = $00000002;   // Win8.1+; required for DWM-composited content

procedure TDebugDisplayForm.KeySave;
var
  l, t, w, h: integer;
  r: TRect;
  dc: HDC;
begin
  if NextStr then Bitmap[1].SaveToFile(PChar(val) + '.bmp')      // plain SAVE - unchanged
  else
  begin
    if NextKey then
    begin
      if val <> key_window then Exit;
      // SAVE WINDOW: have the window render ITSELF into the bitmap.
      // No screen coordinates => no DPI mismatch, no occlusion, no paint race,
      // no multi-monitor origin problem.
      GetWindowRect(Handle, r);                                  // authoritative, never stale
      DesktopBitmap.PixelFormat := pf24bit;
      DesktopBitmap.Width  := r.Right - r.Left;
      DesktopBitmap.Height := r.Bottom - r.Top;
      Update;                                                    // flush any pending paint
      PrintWindow(Handle, DesktopBitmap.Canvas.Handle, PW_RENDERFULLCONTENT);
      if NextStr then DesktopBitmap.SaveToFile(PChar(val) + '.bmp');
      Exit;
    end;
    // Explicit-rectangle form: SAVE <l> <t> <w> <h> 'name' - this one really is a
    // screen scrape by definition, but take a FRESH DC and release it immediately.
    if not KeyVal(l) then Exit;
    if not KeyVal(t) then Exit;
    if not KeyVal(w) then Exit;
    if not KeyVal(h) then Exit;
    DesktopBitmap.PixelFormat := pf24bit;
    DesktopBitmap.Width := w;
    DesktopBitmap.Height := h;
    dc := GetDC(0);
    try
      BitBlt(DesktopBitmap.Canvas.Handle, 0, 0, w, h, dc, l, t, SRCCOPY);
    finally
      ReleaseDC(0, dc);
    end;
    if NextStr then DesktopBitmap.SaveToFile(PChar(val) + '.bmp');
  end;
end;
```

With this, the persistent `DesktopDC` field becomes dead and can be removed entirely (declaration L260,
acquisition L619, release L879).

### Does the chrome still get captured? (Yes — that is what the flags are doing)

The whole point of the `WINDOW` form is that it captures the window **as the user sees it**, title bar and
borders included. `PrintWindow` preserves that, by construction:

- Its flags are `PW_CLIENTONLY` (`$00000001`) and `PW_RENDERFULLCONTENT` (`$00000002`). The patch passes
  **only `PW_RENDERFULLCONTENT`** — `PW_CLIENTONLY` is deliberately **not** set, so the **non-client area
  (caption + borders) is rendered** along with the client area. The caption is painted by `DefWindowProc`
  in response to `WM_NCPAINT`, exactly as it is on screen.
- The bitmap is sized from **`GetWindowRect`** — the *outer* rect — not `ClientWidth/ClientHeight`, so there
  is room for the chrome. (This is also why the report's client-vs-outer guess was a red herring: the
  original code already had the outer size right; only the *coordinate space* was wrong.)
- `PW_RENDERFULLCONTENT` (Win8.1+) additionally forces DWM to render content that is composed rather than
  GDI-painted, which is what keeps the client area from coming back blank on modern Windows.

**Caveat that needs one look on real Windows.** DWM composites *some* caption effects at the **desktop**
level, outside the window's own rendering pass. So a `PrintWindow` capture can differ cosmetically from the
literal on-screen pixels:

| aspect | on screen | `PrintWindow` |
|---|---|---|
| title bar, caption text, close button | ✅ | ✅ rendered |
| borders / frame | ✅ | ✅ rendered |
| Win11 **rounded corners** | rounded | likely **square** (corner rounding is a DWM clip) |
| **drop shadow** | present | absent (it lies *outside* the window rect — and was never in the old capture either) |
| acrylic/mica tint on the caption | present | may render flat |

None of these lose information — they are cosmetic, and they trade against the current behaviour, which is
a *truncated, wrong-window, or wallpaper* image. But **verify on the target Windows build** that the caption
comes back painted rather than blank; a blank/black caption from `PrintWindow` is a known enough hazard on
some version/theme combinations to be worth one screenshot before shipping.

**If the caption does come back wrong**, the fallback is to keep the screen scrape but fix what actually
broke it: size and position the rect from `GetWindowRect` (not VCL's `Left/Top/Width/Height`), convert it
into physical coordinates for the blit, and `SetForegroundWindow` + `Update` the form before blitting so it
is neither occluded nor unpainted. That recovers pixel-exact chrome at the cost of reintroducing the
occlusion exposure — which is why `PrintWindow` is the recommended primary.

### What this does — and does not — do to `SAVE <l> <t> <w> <h> 'name'`

`PrintWindow` applies **only** to the `WINDOW` keyword path. The 4-number form is a scrape of an
**arbitrary screen region** — it may name any patch of desktop, including another application's window —
so there is no window handle to print, and it must remain a `BitBlt` from a screen DC.

**Behaviourally, the patch leaves it unchanged.** The only edits on that path are incidental hardening: a
fresh `GetDC(0)` / `ReleaseDC` pair instead of the DC cached for the form's lifetime, and an explicit
`pf24bit` on the bitmap. At 100% display scaling it is a byte-for-byte no-op.

**However — and this is not fixed by `PrintWindow` — the 4-number form is exposed to the same coordinate
space split**, by a different route:

- the numbers the user types are used as **physical framebuffer** coordinates (that is what a `BitBlt` from
  a desktop DC reads);
- but every other coordinate in the DEBUG language is **logical** — `KeyPos` (L2714) does
  `Left := val + P2.DebugDisplayLeft`, so `POS 300 0` is a *logical* position.

Under 125% scaling those two spaces disagree by 1.25x. A user who places a window at `POS 300 0` and then
writes `SAVE 300 0 400 400 'shot'` does **not** capture their window. Same root cause; `PrintWindow` simply
cannot reach it.

Two coherent ways to close that, for Chip to choose between:

1. **Scale the incoming rect** by the monitor's scale factor, so the whole DEBUG language shares one
   (logical) coordinate space and `SAVE`'s rect lines up with `POS`. Attractive because at 100% the factor
   is 1, making it a strict no-op — it only alters behaviour in the regime that is already broken. The
   catch is that it assumes the user reasons in `POS`-space rather than in physical screenshot-tool pixels;
   the source does not settle which was intended, so this is a **design call, not a defect fix**.
2. **Make PNut DPI-aware** (see below). Logical and physical collapse into a single space, and *both* SAVE
   forms become correct with no DPI arithmetic anywhere in the code.

We deliberately did **not** fold either into the patch above: the `PrintWindow` change is self-contained
and fixes the reported bug at any display scale with no ripple, and the 4-number form's coordinate space is
a separate question that option 2 subsumes entirely.

### Note on resolution

Under `PrintWindow`, a DPI-unaware PNut saves the window at its **logical** size (70x93 in Evidence 1)
rather than the crisper physical size the user sees (87x116). The image is **correct** — whole window,
right window, no wallpaper — just not upscaled. Making PNut fully DPI-aware (adding
`<dpiAware>true</dpiAware>` to an application manifest) would additionally recover the native resolution
and is the true root fix for the coordinate-space mismatch — but it changes how the **entire** UI is laid
out and sized, so it is a much larger commitment and should be considered separately. **The `PrintWindow`
change above fixes `SAVE WINDOW` on its own, at any display scale, with no ripple into the rest of the
tool.**
