/** @format */

// tests/serialLogClassification.test.ts
//
// A release build was printing serial-channel internals at ordinary users:
//
//     DTR: false
//     DTR: true
//     RTS: false
//     * USBSer closing... (isOpen=true)
//
// Those went through logSystemEvent(), the "always live" bucket, on the strength of
// LOGGING-STANDARDS.md listing "DTR/RTS resets" as run narrative. But the narrative
// event is the `[DTR RESET]` marker mainWindow emits ONCE per reset; these are the
// individual line transitions that implement it, and one reset drives several. They
// belong to serial-channel diagnostics — `--diag-serial` — with the rest of the
// handshake mechanism.
//
// The rule these tests pin down: announce the EVENT always, the MECHANISM only on
// request, and errors always regardless. Getting this wrong is silent — nothing fails,
// the release is just noisy — so it needs a test rather than a review habit.

import { UsbSerial } from '../src/utils/usb.serial';

describe('serial log classification — event vs mechanism', () => {
  let live: string[]; // what reaches the user (forceLogMessage → stdout)
  let usb: any;

  /** A UsbSerial wired just far enough to exercise the line-control paths. */
  function makeSerial(serialDiagnostics: boolean): any {
    const instance: any = Object.create(UsbSerial.prototype);
    instance.context = {
      logger: { forceLogMessage: (m: string) => live.push(m) },
      runEnvironment: { serialDiagnostics }
    };
    instance._dtrValue = false;
    instance._rtsValue = false;
    instance._serialPort = {
      isOpen: true,
      path: '/dev/ttyUSB0',
      set: (_opts: any, cb: (err?: any) => void) => cb(undefined),
      drain: (cb: (err?: any) => void) => cb(undefined)
    };
    return instance;
  }

  beforeEach(() => {
    live = [];
    usb = makeSerial(false); // default: no --diag-serial
  });

  describe('without --diag-serial (the release default)', () => {
    // NORMAL — the reported symptom: a bare line-state column at the user.
    it('says nothing when DTR is driven', async () => {
      await usb.setDtr(true);
      await usb.setDtr(false);

      expect(live).toEqual([]);
    });

    // NORMAL — same for RTS, which clone adapters use instead.
    it('says nothing when RTS is driven', async () => {
      await usb.setRts(true);
      await usb.setRts(false);

      expect(live).toEqual([]);
    });

    // NORMAL — a full reset pulse is several transitions; none of them surface.
    it('stays silent across a whole reset pulse', async () => {
      await usb.setDtr(false);
      await usb.setDtr(true);
      await usb.setDtr(false);
      await usb.setRts(false);

      expect(live).toEqual([]);
    });
  });

  describe('with --diag-serial', () => {
    beforeEach(() => {
      usb = makeSerial(true);
    });

    // NORMAL — the detail is still reachable; it was silenced, not deleted.
    it('reports the line transitions on request', async () => {
      await usb.setDtr(true);
      await usb.setRts(false);

      expect(live).toContain('DTR: true');
      expect(live).toContain('RTS: false');
    });
  });

  describe('errors stay live regardless', () => {
    /** Same instance, but the driver rejects the line change. */
    function failingSerial(serialDiagnostics: boolean): any {
      const instance = makeSerial(serialDiagnostics);
      instance._serialPort.set = (_opts: any, cb: (err?: any) => void) =>
        cb({ name: 'PortError', message: 'device vanished' });
      return instance;
    }

    // ERROR — a DTR that would not assert explains a failed download. Announcing the
    // exception is exactly what silencing the norm is supposed to make visible.
    it('reports a DTR failure even without --diag-serial', async () => {
      const failing = failingSerial(false);

      await expect(failing.setDtr(true)).rejects.toBeDefined();
      expect(live.some((m) => m.startsWith('DTR: ERROR:'))).toBe(true);
      expect(live.some((m) => m.includes('device vanished'))).toBe(true);
    });

    // ERROR — and the same for RTS.
    it('reports an RTS failure even without --diag-serial', async () => {
      const failing = failingSerial(false);

      await expect(failing.setRts(true)).rejects.toBeDefined();
      expect(live.some((m) => m.startsWith('RTS: ERROR:'))).toBe(true);
    });

    // EDGE — a failed set must not record the value as applied.
    it('does not record a line value it failed to set', async () => {
      const failing = failingSerial(false);

      await expect(failing.setDtr(true)).rejects.toBeDefined();
      expect(failing._dtrValue).toBe(false);
    });
  });
});
