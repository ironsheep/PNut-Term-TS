/** @format */

/**
 * RateCycle draw-throttle helper — [9win §5] (task #7)
 *
 * Faithful port of Pascal TDebugDisplayForm.RateCycle (DebugDisplayUnit.pas:3079-3088):
 *   Inc(vRateCount); if vRateCount = vRate then (vRateCount := 0; True) else False.
 * Used by LOGIC and SCOPE to draw only every vRate-th sample-set (matching the
 * already-throttled FFT/SPECTRO/BITMAP/SCOPE_XY windows).
 */
import { RateCycle } from '../src/classes/shared/rateCycle';

describe('RateCycle [9win §5]', () => {
  it('RATE 1 draws on every sample-set', () => {
    const rc = new RateCycle();
    for (let i = 0; i < 5; i++) {
      expect(rc.cycle(1)).toBe(true);
    }
  });

  it('RATE 4 draws on every 4th set, skipping the first three', () => {
    const rc = new RateCycle();
    const results = [1, 2, 3, 4, 5, 6, 7, 8].map(() => rc.cycle(4));
    expect(results).toEqual([false, false, false, true, false, false, false, true]);
  });

  it('counter resets to 0 after each draw (vRateCount := 0)', () => {
    const rc = new RateCycle();
    rc.cycle(3); // 1
    rc.cycle(3); // 2
    expect(rc.value).toBe(2);
    expect(rc.cycle(3)).toBe(true); // 3 -> draw, reset
    expect(rc.value).toBe(0);
  });

  it('RATE 0 never auto-draws (window updates only via explicit UPDATE)', () => {
    const rc = new RateCycle();
    for (let i = 0; i < 50; i++) {
      expect(rc.cycle(0)).toBe(false);
    }
  });

  it('CLEAR resets the counter so the cadence restarts (vRateCount := 0)', () => {
    const rc = new RateCycle();
    rc.cycle(4); // 1
    rc.cycle(4); // 2
    expect(rc.value).toBe(2);
    rc.reset(); // CLEAR
    expect(rc.value).toBe(0);
    // Cadence restarts: next draw is again on the 4th set.
    expect([rc.cycle(4), rc.cycle(4), rc.cycle(4), rc.cycle(4)]).toEqual([false, false, false, true]);
  });

  it('reset(rate - 1) primes the first set to draw immediately (FFT/SPECTRO init)', () => {
    const rc = new RateCycle();
    rc.reset(4 - 1); // FFT/SPECTRO: vRateCount := vRate - 1
    expect(rc.cycle(4)).toBe(true); // first set draws right away
    expect(rc.cycle(4)).toBe(false);
  });
});
