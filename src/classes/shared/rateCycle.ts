/** @format */

/**
 * RateCycle — shared draw-throttle helper. [9win §5]
 *
 * Faithful port of Pascal TDebugDisplayForm.RateCycle (DebugDisplayUnit.pas:3079-3088):
 *
 *   function RateCycle: boolean;
 *   begin
 *     Inc(vRateCount);
 *     if vRateCount = vRate then begin vRateCount := 0; Result := True; end
 *     else Result := False;
 *   end;
 *
 * A window calls cycle(rate) once per drawable sample-set (after its trigger/holdoff
 * gate). It returns true only every `rate`-th call, so the window draws every Nth set
 * instead of on every sample. The counter lives in this instance (one per window =
 * one vRateCount). The rate is passed per call so it always reflects the current
 * RATE directive value with no separate sync step.
 *
 * Per-window CLEAR/init semantics (see Pascal):
 *  - LOGIC / SCOPE / SCOPE_XY: vRateCount := 0       -> reset() / reset(0)
 *  - FFT / SPECTRO:            vRateCount := vRate-1  -> reset(rate - 1)
 *
 * Edge cases (Pascal-identical):
 *  - rate >= 1: draws every `rate`-th set.
 *  - rate <= 0: the incrementing counter never equals `rate`, so it NEVER auto-draws
 *    (the window only updates via an explicit UPDATE). Pascal RATE 0 behaves the same.
 */
export class RateCycle {
  private count: number = 0;

  /**
   * Advance the cycle by one sample-set. Returns true on the `rate`-th call (and
   * resets the counter), false otherwise. Mirrors Pascal's `Inc; if =rate then 0,true`.
   */
  public cycle(rate: number): boolean {
    this.count++;
    if (this.count === rate) {
      this.count = 0;
      return true;
    }
    return false;
  }

  /**
   * Reset the counter. Default 0 (LOGIC/SCOPE/SCOPE_XY CLEAR + init). Pass `rate - 1`
   * for FFT/SPECTRO, whose Pascal init/CLEAR sets vRateCount := vRate-1 so the first
   * full set draws immediately.
   */
  public reset(count: number = 0): void {
    this.count = count;
  }

  /** Current counter value (vRateCount) — exposed for diagnostics/tests. */
  public get value(): number {
    return this.count;
  }
}
