# Window Auto-Layout Algorithm — FEED

**Purpose:** full specification of the automatic window-placement algorithm PNut-Term-TS uses
when it opens debug/display windows without an explicit position. Written for the DOCs agent to
fold into the user manual.

- **Repo source of truth:** `src/utils/windowPlacer.ts` (class `WindowPlacer`, singleton). The
  narrative internal doc is `DOCs/WINDOW-PLACEMENT-ALGORITHM.md`. Where this feed and that doc
  disagree, **this feed is the code-accurate one** — it was re-derived directly from
  `windowPlacer.ts` and corrects a stale example in the internal doc (see §9).
- **Currency:** PNut-Term-TS **v0.10.8** (2026-07-21).
- **Scope:** the *default* (grid) strategy — the general debug/display windows (Term, Bitmap,
  Plot, Scope, ScopeXY, FFT, Spectro, Logic, MIDI, Logger). The two special strategies
  (single-step **Debugger** windows; **COG** terminal grid) are specified in §7 for completeness.

---

## 0. When auto-layout runs at all (entry condition)

Auto-layout is a **fallback**. A debug display is positioned automatically **only when its
`DEBUG` display directive carries no `POS` clause**. If `POS x y` is present, the window is
placed at those coordinates (POS is an **absolute** screen position in this app) and is *not*
run through the placer. So:

- **`POS` present →** explicit absolute placement, auto-layout skipped.
- **`POS` absent →** the window asks `WindowPlacer.getNextPosition()` for a slot.

Everything below describes the `POS`-absent path.

---

## 1. Quick answers (the specifics requested)

| Question | Answer |
|---|---|
| **Total number of rows** | **Adaptive, from display height:** 2, 3, 4, or 5 rows. The common case (1080p/1440p height) is **3 rows**. See §3. |
| **Number of columns** | **Adaptive, from display width:** 3, 5, or 7 (always forced **odd** for a true center column). 1920-wide → 3; ≥2000-wide → 5; ultra-wide → up to 7. See §3. |
| **Default row height** | **Not a fixed pixel value — computed:** `rowHeight = round((workAreaHeight − 2×20) / ROWS)`. i.e. the usable work-area height minus a 20 px top+bottom margin, divided evenly by the row count. See §4. |
| **Default column width** | `colWidth = round((workAreaWidth − 2×20) / COLS)`. See §4. |
| **Order of placement (which cell fills next)** | The fixed **Half-Moon Descending** sequence — center-out, top-to-bottom, widening as it descends. Full 13-step order in §5. |
| **Order within a row** | Columns fill **center → left-center → right-center → far-left → far-right**, i.e. col **2 → 1 → 3 → 0 → 4** — but rows are interleaved, not filled one-at-a-time (§5). |
| **Reserved cells** | Bottom-center (`R2_C2`) = Main Window; bottom-right (`R2_C4`) = Debug Logger. Auto-placed debug windows never take these. |
| **After the grid is full** | Windows **cascade** from the top-left with a 30×30 px step (§6). |
| **Margins / spacing** | Outer margin **20 px**; inter-window safety margin **20 px** (10 px above + 10 px below each title bar). |

---

## 2. Coordinate frame

- All math is done in the **work area** of the chosen monitor — the monitor rectangle minus the
  OS taskbar/dock. `workArea = { x, y, width, height }`.
- Monitor selection: normally the **primary** monitor. (On macOS the placer prefers a monitor
  with positive origin coordinates to dodge a known macOS bug that yanks negatively-positioned
  windows onto another display; single-monitor placement only — no grid spanning.)
- `margin` (outer) default = **20 px**. `safetyMargin` (between windows) = **20 px**.

---

## 3. Grid dimensioning (how ROWS and COLS are chosen)

Computed by `calculateGridDimensions(workArea)` from the **work-area** width and height.

**Columns (from width):**

| Work-area width | Base columns |
|---|---|
| ≥ 3000 px | 5 |
| ≥ 2000 px | 5 |
| ≥ 1500 px | 3 |
| < 1500 px | 3 |

**Rows (from height):**

| Work-area height | Base rows |
|---|---|
| ≥ 2000 px | 4 |
| ≥ 1200 px | 3 |
| ≥ 800 px | 3 |
| < 800 px | 2 |

**Aspect-ratio adjustment** (`ratio = width / height`):
- `ratio > 2.0` (ultra-wide): **columns + 2**, capped at 7.
- `ratio < 1.3` (tall / portrait): **rows + 1**, capped at 5.

**Final rule:** columns are then forced **odd** (if even, +1) so there is always a single true
center column.

### Worked results for common displays

| Display (px) | ratio | COLS | ROWS | Grid |
|---|---|---|---|---|
| 1366 × 768 (small laptop) | 1.78 | 3 | 2 | **3 × 2** |
| **1920 × 1080** | 1.78 | **3** | 3 | **3 × 3** |
| 2560 × 1440 | 1.78 | 5 | 3 | **5 × 3** |
| 3840 × 2160 (4K) | 1.78 | 5 | 4 | **5 × 4** |
| 3440 × 1440 (ultra-wide) | 2.39 | 7 | 3 | **7 × 3** |
| 1080 × 1920 (portrait) | 0.56 | 3 | 4 | **3 × 4** |

> **Note for the manual:** 1920×1080 yields a **3-column** grid, *not* 5. The 5-column grid
> begins at 2000 px of work-area width. (Work-area width usually equals the display width, since
> the taskbar/dock reduces height, not width.)

---

## 4. Cell geometry and per-window coordinates

Given the chosen `COLS`, `ROWS` and `margin = 20`:

```
colWidth  = round((workArea.width  − margin*2) / COLS)
rowHeight = round((workArea.height − margin*2) / ROWS)
```

**Row height is therefore dynamic** — there is no fixed pixel default; it is the usable height
(display height minus taskbar minus the 20 px top+bottom margin) divided evenly among the rows.

*Example:* a 1920×1080 screen with a 40 px taskbar → work area 1920×1040 → 3 rows →
`rowHeight = round((1040 − 40) / 3) = 333 px`; 3 cols → `colWidth = round((1920 − 40) / 3) = 627 px`.

**Horizontal (X) — window centered in its column:**
```
cellCenterX = workArea.x + margin + col*colWidth + colWidth/2
x           = round(cellCenterX − windowWidth/2)
```

**Vertical (Y) — title bars aligned to the top of each row band:**
```
y = round(workArea.y + margin + row*rowHeight + (safetyMargin / 2))   // safetyMargin/2 = 10
```
This aligns every window's **title bar** to a consistent line per row (10 px into the row band),
regardless of differing window heights — the "descending" rows read as clean horizontal bands.

**Clamping:** the final x/y are clamped so the whole window stays inside the work area
(`x ∈ [workArea.x+margin, workArea.x+width−windowWidth−margin]`, similarly for y).

**Wide windows** (windowWidth > colWidth) get edge-aware alignment instead of pure centering:
- Column 0 or 1 (left side): treated as columns 0+1 joined, window **right-aligned** to the
  center-column edge.
- Column 3 or 4 (right side): columns 3+4 joined, window **left-aligned** to the center-column edge.
- Column 2 (center): centered.

---

## 5. Fill order — the Half-Moon Descending sequence

`findAvailableSlot()` walks a **fixed preferred order** and returns the first unoccupied cell.
The order starts at the top-center, expands symmetrically around the center column, then
descends row by row, widening as it goes. It skips the two reserved bottom cells.

**Exact order (first 13 auto-placed windows):**

| # | Cell | Row | Col | Position | Running balance (L·C·R) |
|---|---|---|---|---|---|
| 1 | `R0_C2` | 0 | 2 | top center | 0·1·0 |
| 2 | `R0_C1` | 0 | 1 | top left-center | 1·1·0 |
| 3 | `R0_C3` | 0 | 3 | top right-center | 1·1·1 |
| 4 | `R1_C2` | 1 | 2 | middle center | 1·2·1 |
| 5 | `R1_C1` | 1 | 1 | middle left-center | 2·2·1 |
| 6 | `R1_C3` | 1 | 3 | middle right-center | 2·2·2 |
| 7 | `R0_C0` | 0 | 0 | top far-left | 3·2·2 |
| 8 | `R0_C4` | 0 | 4 | top far-right | 3·2·3 |
| 9 | `R1_C0` | 1 | 0 | middle far-left | 4·2·3 |
| 10 | `R1_C4` | 1 | 4 | middle far-right | 4·2·4 |
| 11 | `R2_C1` | 2 | 1 | bottom left-center | (bottom row) |
| 12 | `R2_C3` | 2 | 3 | bottom right-center | |
| 13 | `R2_C0` | 2 | 0 | bottom far-left | |

**Reading of "order within a row":** the column preference is **center (2) → left-center (1) →
right-center (3) → far-left (0) → far-right (4)**. But rows are **interleaved**, not completed one
at a time: the algorithm fills the 3 inner columns of row 0, drops to row 0's counterpart in
row 1, widens row 0 to its outer columns, matches row 1, and only then moves to the bottom row.

**Row order:** top (row 0) → middle (row 1) → bottom (row 2), with the descent interleaved as above.

**Left/right symmetry:** cells are added to keep the arrangement balanced about the center column
(col 2). The layout is symmetric after windows **1, 3, 4, 6, 8, 10**.

**Reserved cells** `R2_C2` (Main Window) and `R2_C4` (Debug Logger) are absent from the order and
never auto-assigned.

> **Important limitation to document:** the fill order above is defined against the **canonical
> 5-column × 3-row** model (cells `R0…R2` × `C0…C4`). Cell **pixel** positions, however, use the
> **adaptive** COLS/ROWS from §3. On a narrower adaptive grid (e.g. the 3-column 1920×1080 case),
> the far columns (`C3`, `C4`) computed against 3 columns fall outside the work area and are
> **clamped to the right edge**, so those later windows can stack near the edge rather than tiling
> cleanly. Wide/tall monitors (≥2000 px → 5 columns) match the model exactly. This is current
> behavior, not a spec goal — flag it as a known constraint.

---

## 6. When the grid is full — cascade

After the 13 grid cells are occupied (`cascadeIfFull` defaults on):

- Start at the work-area top-left (`workArea.{x,y} + margin`).
- Each successive window steps **+30 px right, +30 px down** (`cascadeOffset = {30, 30}`).
- If the next step would push the window off the work area, the cascade **resets** to the
  top-left and continues.
- No hard cap on window count; newer windows sit on top (Z-order).

The ultimate fallback (cascade disabled) is dead-center of the monitor.

---

## 7. Special strategies (not the default grid)

### 7a. Single-step Debugger windows (`PlacementStrategy.DEBUGGER`)
Larger windows, larger margin (**40 px**):
- **1st window:** top-left, 40 px margin.
- **2nd window:** top-right (left+right pair, maximally separated).
- **3rd+:** cascade from top-left with a smaller **20×20 px** step; resets to top-left when it
  would run off-screen.

### 7b. COG terminal windows (`PlacementStrategy.COG_GRID`)
Eight COG text terminals in a fixed grid whose orientation adapts to width:
- **Work-area width ≥ 1920 px →** 2 rows × 4 columns (horizontal):
  `COG0 COG1 COG2 COG3` / `COG4 COG5 COG6 COG7`.
- **< 1920 px →** 4 rows × 2 columns (vertical): `COG0 COG4` / `COG1 COG5` / `COG2 COG6` / `COG3 COG7`.
- COG *N* → grid cell: 2×4 uses `row = ⌊N/4⌋, col = N mod 4`; 4×2 uses `row = N mod 4, col = ⌊N/4⌋`.
- **20 px** gaps between COG windows; the whole COG grid is centered horizontally.
- Terminal character size adapts to available width per cell: **80×24** (≥1640 px available → 820×442 window),
  **64×24** (≥1320 px → 660×442), else **48×24** (540×442).

---

## 8. Placement decision order (getNextPosition)

For each window request the placer tries, in order:

1. **Already tracked** (same window id) → return its current position unchanged.
2. **`DEBUGGER` strategy** → §7a.
3. **`COG_GRID` strategy** → §7b.
4. **Explicit `slot`** requested and free → use it.
5. **`preferredSlot` hint** (system windows: Main Window, Debug Logger) and free → use it.
6. **`findAvailableSlot()`** → next free cell in Half-Moon order (§5).
7. **Cascade** (§6) if the grid is full.
8. **Center of monitor** as the last resort.

Windows also register **move** and **closed** handlers: dragging a window re-detects its slot and
updates occupancy; closing frees the slot for reuse.

---

## 9. Collision handling for oversized cells

A window larger than its cell reserves neighbor cells so later windows don't land under it:
- **Width overflow** (`windowWidth > colWidth − 20`): reserves cells **left and right**
  (centered), one per extra `colWidth` needed.
- **Height overflow** (`windowHeight > rowHeight − 20`): reserves cells **below only** (keeps the
  row's title-bar alignment intact).

---

## 10. Fixed constants (for reference)

| Constant | Value | Meaning |
|---|---|---|
| `defaultMargin` | 20 px | outer margin, grid to work-area edge |
| `safetyMargin` | 20 px | inter-window spacing (10 px above + 10 px below a title bar) |
| `cascadeOffset` | 30 × 30 px | step for standard grid-full cascade |
| `debuggerCascadeOffset` | 20 × 20 px | step for 3rd+ debugger windows |
| debugger margin | 40 px | outer margin for debugger strategy |
| COG gaps | 20 × 20 px | spacing in the COG grid |
| reserved cells | `R2_C2`, `R2_C4` | Main Window, Debug Logger |
| max grid cells before cascade | 13 | 15 cells (5×3 model) − 2 reserved |
