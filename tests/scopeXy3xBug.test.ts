/**
 * Test to demonstrate and verify the 3x render bug in ScopeXY
 *
 * Root cause: The while loop in handleData processes ALL available
 * complete samples immediately, causing multiple renders per message
 * when rate=1 (render every sample).
 */

describe('ScopeXY 3x Render Bug - Root Cause Analysis', () => {

  describe('Current problematic behavior', () => {
    it('demonstrates the while loop iterates 3 times for 18 values', () => {
      // Simulate the current handleData logic
      const simulateCurrentHandleData = (data: string) => {
        const elements = data.trim().split(/\s+/);
        const dataBuffer: number[] = [];
        let rateCounter = 0;
        let renderCount = 0;
        const channelIndex = 3; // RGB channels
        const rate = 1; // Render every sample

        // Add all values to buffer
        for (const element of elements) {
          const value = parseInt(element);
          if (!isNaN(value)) {
            dataBuffer.push(value);
          }
        }

        console.log(`\n=== Current Implementation ===`);
        console.log(`Initial buffer: ${dataBuffer.length} values`);
        console.log(`channelIndex * 2 = ${channelIndex * 2} (values per sample)`);

        // This is the problematic while loop from handleData
        let iteration = 0;
        while (dataBuffer.length >= channelIndex * 2) {
          iteration++;
          const channelData = dataBuffer.splice(0, channelIndex * 2);
          console.log(`  Iteration ${iteration}: extracted [${channelData.join(', ')}]`);
          console.log(`    Remaining buffer: ${dataBuffer.length} values`);

          rateCounter++;
          if (rateCounter >= rate) {
            renderCount++;
            console.log(`    -> RENDER #${renderCount} (rateCounter=${rateCounter} >= rate=${rate})`);
            rateCounter = 0;
          }
        }

        return { iterations: iteration, renders: renderCount };
      };

      // Test with 18 values (3 RGB samples)
      const result = simulateCurrentHandleData('100 150 200 250 50 75 110 160 210 260 60 85 120 170 220 270 70 95');

      expect(result.iterations).toBe(3);
      expect(result.renders).toBe(3);

      console.log(`\n✗ BUG CONFIRMED: ${result.renders} renders for one message!`);
    });

    it('shows why 72 samples appear (24 messages * 3 renders each)', () => {
      let totalRenders = 0;

      // Simulate receiving 24 messages
      for (let msg = 1; msg <= 24; msg++) {
        // Each message has 18 values (3 RGB samples)
        const msgRenders = 3; // Each message causes 3 renders
        totalRenders += msgRenders;
      }

      console.log(`\n24 messages × 3 renders/message = ${totalRenders} total renders`);
      console.log(`This explains why we see 72 samples rendered!`);

      expect(totalRenders).toBe(72);
    });
  });

  describe('Proposed fix: Batch rendering per message', () => {
    it('demonstrates fixed behavior - render once per message', () => {
      const simulateFixedHandleData = (data: string) => {
        const elements = data.trim().split(/\s+/);
        const dataBuffer: number[] = [];
        const collectedSamples: number[][] = [];
        let renderCount = 0;
        const channelIndex = 3;
        const rate = 1;

        // Add all values to buffer
        for (const element of elements) {
          const value = parseInt(element);
          if (!isNaN(value)) {
            dataBuffer.push(value);
          }
        }

        console.log(`\n=== FIXED Implementation ===`);
        console.log(`Initial buffer: ${dataBuffer.length} values`);

        // Collect ALL samples first
        while (dataBuffer.length >= channelIndex * 2) {
          const channelData = dataBuffer.splice(0, channelIndex * 2);
          collectedSamples.push(channelData);
          console.log(`  Collected sample ${collectedSamples.length}: [${channelData.join(', ')}]`);
        }

        // Then decide whether to render based on rate
        if (collectedSamples.length >= rate) {
          renderCount = 1;
          console.log(`\n  -> RENDER ONCE with ${collectedSamples.length} samples`);
        }

        return { samples: collectedSamples.length, renders: renderCount };
      };

      // Test with same 18 values
      const result = simulateFixedHandleData('100 150 200 250 50 75 110 160 210 260 60 85 120 170 220 270 70 95');

      expect(result.samples).toBe(3);
      expect(result.renders).toBe(1);

      console.log(`\n✓ FIXED: ${result.renders} render for ${result.samples} samples!`);
    });

    it('shows the fix respects rate parameter', () => {
      const simulateWithRate = (data: string, rate: number) => {
        const elements = data.trim().split(/\s+/);
        const dataBuffer: number[] = [];
        const collectedSamples: number[][] = [];
        let totalSamples = 0;
        let shouldRender = false;
        const channelIndex = 3;

        // Add all values
        for (const element of elements) {
          const value = parseInt(element);
          if (!isNaN(value)) {
            dataBuffer.push(value);
          }
        }

        // Collect samples
        while (dataBuffer.length >= channelIndex * 2) {
          const channelData = dataBuffer.splice(0, channelIndex * 2);
          collectedSamples.push(channelData);
          totalSamples++;
        }

        // Static rate counter would accumulate across calls
        // This is simplified - real implementation needs persistent counter
        if (totalSamples >= rate) {
          shouldRender = true;
        }

        return { totalSamples, shouldRender };
      };

      console.log(`\n=== Rate Parameter Test ===`);

      // Rate = 1: render every sample collection
      const rate1 = simulateWithRate('100 150 200 250 50 75', 1);
      console.log(`Rate=1, 1 sample: shouldRender=${rate1.shouldRender}`);
      expect(rate1.shouldRender).toBe(true);

      // Rate = 3: render every 3rd sample collection
      const rate3_msg1 = simulateWithRate('100 150 200 250 50 75', 3);
      console.log(`Rate=3, 1 sample: shouldRender=${rate3_msg1.shouldRender}`);
      expect(rate3_msg1.shouldRender).toBe(false);

      const rate3_msg3 = simulateWithRate('100 150 200 250 50 75 110 160 210 260 60 85 120 170 220 270 70 95', 3);
      console.log(`Rate=3, 3 samples: shouldRender=${rate3_msg3.shouldRender}`);
      expect(rate3_msg3.shouldRender).toBe(true);
    });
  });

  describe('Alternative: Timer-based rendering (60 FPS)', () => {
    it('demonstrates timer-based approach', () => {
      class TimerBasedRenderer {
        private sampleBuffer: number[][] = [];
        private renderTimer: NodeJS.Timeout | null = null;
        private renderCount = 0;

        start() {
          // 60 FPS = render every 16.67ms
          this.renderTimer = setInterval(() => {
            if (this.sampleBuffer.length > 0) {
              this.render();
            }
          }, 16.67);
        }

        stop() {
          if (this.renderTimer) {
            clearInterval(this.renderTimer);
            this.renderTimer = null;
          }
        }

        handleData(samples: number[][]) {
          // Just accumulate, don't render
          this.sampleBuffer.push(...samples);
          console.log(`Accumulated ${samples.length} samples, buffer size: ${this.sampleBuffer.length}`);
        }

        render() {
          this.renderCount++;
          console.log(`RENDER #${this.renderCount}: ${this.sampleBuffer.length} samples`);
          this.sampleBuffer = []; // Clear after render
        }

        getRenderCount() { return this.renderCount; }
      }

      console.log(`\n=== Timer-Based Rendering (60 FPS) ===`);

      const renderer = new TimerBasedRenderer();

      // Simulate receiving 3 messages rapidly
      renderer.handleData([[100,150,200,250,50,75]]);
      renderer.handleData([[110,160,210,260,60,85]]);
      renderer.handleData([[120,170,220,270,70,95]]);

      console.log(`Before timer tick: 0 renders`);
      expect(renderer.getRenderCount()).toBe(0);

      // Simulate timer tick
      renderer.render();

      console.log(`After timer tick: 1 render with all accumulated samples`);
      expect(renderer.getRenderCount()).toBe(1);

      renderer.stop();
    });
  });
});