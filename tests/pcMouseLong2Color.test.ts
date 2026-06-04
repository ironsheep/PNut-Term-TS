/**
 * PC_MOUSE LONG2 pixel colour — [9win §2] (task #4)
 *
 * Pascal SendMousePos returns the on-screen canvas pixel under the cursor in the
 * second long for every on-window case (DebugDisplayUnit.pas:3553-3554):
 *   c := Canvas.Pixels[p.x, p.y];
 *   c := c and $0000FF shl 16 or c and $00FF00 or c and $FF0000 shr 16;   // -> $00RRGGBB
 * and the off-window sentinel $FFFFFFFF (:3549).
 *
 * The base getPixelColorAt samples the committed (displayed) canvas via the
 * window's getCanvasId() hook and returns $00RRGGBB. getImageData already yields
 * channels in R,G,B order, so no byte swap is required in the renderer.
 */
import { DebugWindowBase } from '../src/classes/debugWindowBase';
import { TLongTransmission } from '../src/classes/shared/tLongTransmission';

const proto = DebugWindowBase.prototype as any;

/**
 * Drive getPixelColorAt off the prototype with a fake debugWindow whose
 * executeJavaScript resolves to `rendererReturn` (the value the injected JS would
 * produce). Captures the JS source so we can assert it targets the right canvas.
 */
function makeCtx(opts: {
  rendererReturn?: number | unknown;
  reject?: boolean;
  noWindow?: boolean;
  canvasId?: string;
}) {
  const captured: { js?: string } = {};
  const ctx: any = {
    getCanvasId: () => opts.canvasId ?? 'test-canvas',
    logMessageBase: () => {},
    debugWindow: opts.noWindow
      ? null
      : {
          webContents: {
            executeJavaScript: (js: string) => {
              captured.js = js;
              return opts.reject
                ? Promise.reject(new Error('renderer gone'))
                : Promise.resolve(opts.rendererReturn);
            }
          }
        }
  };
  return { ctx, captured };
}

const sample = (ctx: any, x = 5, y = 7): Promise<number> => proto.getPixelColorAt.call(ctx, x, y);

describe('PC_MOUSE LONG2 pixel colour [9win §2]', () => {
  it('returns the renderer-sampled $00RRGGBB value unchanged when already in range', async () => {
    const { ctx } = makeCtx({ rendererReturn: 0xff8800 });
    expect(await sample(ctx)).toBe(0xff8800);
  });

  it('masks the result to 24 bits ($00RRGGBB — never alpha-tainted)', async () => {
    // A stray high byte (e.g. alpha) must be stripped: $FF345678 -> $00345678.
    const { ctx } = makeCtx({ rendererReturn: 0xff345678 });
    expect(await sample(ctx)).toBe(0x345678);
  });

  it('reads pure red / green / blue back as $00RRGGBB', async () => {
    expect(await sample(makeCtx({ rendererReturn: 0xff0000 }).ctx)).toBe(0xff0000);
    expect(await sample(makeCtx({ rendererReturn: 0x00ff00 }).ctx)).toBe(0x00ff00);
    expect(await sample(makeCtx({ rendererReturn: 0x0000ff }).ctx)).toBe(0x0000ff);
  });

  it('samples the canvas exposed by getCanvasId()', async () => {
    const { ctx, captured } = makeCtx({ rendererReturn: 0, canvasId: 'midi-canvas-3' });
    await sample(ctx);
    expect(captured.js).toContain('"midi-canvas-3"');
    expect(captured.js).toContain('getImageData');
  });

  it('maps the cursor CSS coordinate to the backing store before sampling', async () => {
    // The injected JS scales x,y by canvas.width/rect.width — assert the formula
    // is present so a CSS-stretched (dotSize) canvas samples the right source px.
    const { ctx, captured } = makeCtx({ rendererReturn: 0 });
    await sample(ctx, 40, 20);
    expect(captured.js).toContain('c.width  / rect.width');
    expect(captured.js).toContain('c.height / rect.height');
  });

  it('returns black (0) when the window is gone', async () => {
    const { ctx } = makeCtx({ noWindow: true });
    expect(await sample(ctx)).toBe(0x000000);
  });

  it('returns black (0) and does not throw when the renderer read fails', async () => {
    const { ctx } = makeCtx({ reject: true });
    expect(await sample(ctx)).toBe(0x000000);
  });

  it('falls back to black when the renderer yields a non-number', async () => {
    const { ctx } = makeCtx({ rendererReturn: undefined });
    expect(await sample(ctx)).toBe(0x000000);
  });

  describe('off-window sentinel', () => {
    it('LONG2 is $FFFFFFFF off-window (Pascal :3549)', () => {
      const txProto = TLongTransmission.prototype as any;
      const oob = txProto.createOutOfBoundsMouseData.call({});
      expect(oob.color >>> 0).toBe(0xffffffff);
    });
  });
});
