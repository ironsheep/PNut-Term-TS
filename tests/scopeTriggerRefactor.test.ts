/**
 * Test for SCOPE trigger evaluation after refactor
 * Uses actual sample data from logs to reproduce "never triggering" issue
 */

import { describe, it, expect } from '@jest/globals';

// Mock the trigger processor to trace calls
class MockTriggerProcessor {
  private armed = false;
  private fired = false;
  private holdoffCounter = 0;
  private previousSample: number | null = null;
  private armLevel = 0;
  private trigLevel = 0;
  private slope: 'positive' | 'negative' = 'positive';

  setTriggerLevels(armLevel: number, trigLevel: number, slope: 'positive' | 'negative') {
    this.armLevel = armLevel;
    this.trigLevel = trigLevel;
    this.slope = slope;
  }

  processSample(sample: number, options: { trigHoldoff: number }) {
    // Arm when sample is at or below arm level
    if (sample <= this.armLevel && !this.armed) {
      this.armed = true;
      this.fired = false;
    }

    // Check for trigger condition
    if (this.armed && this.previousSample !== null) {
      if (this.slope === 'positive') {
        // Positive slope: previous <= level AND current > level
        if (this.previousSample <= this.trigLevel && sample > this.trigLevel) {
          this.fired = true;
          this.holdoffCounter = options.trigHoldoff;
        }
      } else {
        // Negative slope: previous >= level AND current < level
        if (this.previousSample >= this.trigLevel && sample < this.trigLevel) {
          this.fired = true;
          this.holdoffCounter = options.trigHoldoff;
        }
      }
    }

    this.previousSample = sample;
  }

  getTriggerState() {
    return {
      armed: this.armed,
      fired: this.fired,
      holdoff: this.holdoffCounter
    };
  }

  resetTrigger() {
    this.armed = false;
    this.fired = false;
    this.holdoffCounter = 0;
    this.previousSample = null;
  }
}

describe('SCOPE Trigger After Refactor', () => {
  it('should trigger on positive slope crossing with actual log data', () => {
    const processor = new MockTriggerProcessor();

    // Configuration from logs
    const triggerConfig = {
      trigEnabled: true,
      trigChannel: 0,
      trigArmLevel: 0,
      trigLevel: 0,
      trigSlope: 'positive' as const,
      trigHoldoff: 2
    };

    // Actual samples from channel 0 in logs
    const channel0Samples = [
      0,    // Should arm (sample <= armLevel 0)
      31,   // Should trigger (armed, previous=0<=0, current=31>0)
      63,
      94,
      125
    ];

    processor.setTriggerLevels(
      triggerConfig.trigArmLevel,
      triggerConfig.trigLevel,
      triggerConfig.trigSlope
    );

    const results: Array<{ sample: number; armed: boolean; fired: boolean; holdoff: number }> = [];

    for (const sample of channel0Samples) {
      processor.processSample(sample, { trigHoldoff: triggerConfig.trigHoldoff });
      const state = processor.getTriggerState();
      results.push({ sample, ...state });
    }

    console.log('Trigger evaluation results:');
    results.forEach((r, i) => {
      console.log(`  Sample ${i}: value=${r.sample}, armed=${r.armed}, fired=${r.fired}, holdoff=${r.holdoff}`);
    });

    // Assertions
    expect(results[0].armed).toBe(true);  // Sample 0: arms at armLevel
    expect(results[0].fired).toBe(false); // Sample 0: no previous sample, can't trigger yet

    expect(results[1].armed).toBe(true);  // Sample 31: still armed
    expect(results[1].fired).toBe(true);  // Sample 31: should trigger (0->31 crosses 0 upward)
    expect(results[1].holdoff).toBe(2);   // Holdoff set to 2
  });

  it('should evaluate trigger with clamped samples not raw samples', () => {
    const processor = new MockTriggerProcessor();

    const triggerConfig = {
      trigArmLevel: 0,
      trigLevel: 500,
      trigSlope: 'positive' as const,
      trigHoldoff: 2
    };

    // Scenario: Raw sample is 1500, but channel max is 1000
    // After clamping: sample becomes 1000
    const rawSample = 1500;
    const channelMax = 1000;
    const clampedSample = Math.min(rawSample, channelMax);

    processor.setTriggerLevels(
      triggerConfig.trigArmLevel,
      triggerConfig.trigLevel,
      triggerConfig.trigSlope
    );

    // First arm with sample below arm level
    processor.processSample(0, { trigHoldoff: 2 });

    // OLD CODE BUG: Would evaluate on raw sample (1500 > 500 = trigger)
    // NEW CODE CORRECT: Evaluates on clamped sample (1000 > 500 = trigger, but consistently)
    processor.processSample(clampedSample, { trigHoldoff: 2 });

    const state = processor.getTriggerState();

    console.log(`Raw sample: ${rawSample}, Clamped: ${clampedSample}, Trigger level: ${triggerConfig.trigLevel}`);
    console.log(`Trigger state: armed=${state.armed}, fired=${state.fired}`);

    // With clamped sample (1000), trigger should fire since 1000 > 500
    expect(state.fired).toBe(true);
  });

  it('should not trigger when condition evaluates on else branch', () => {
    // This test checks if the refactored code is hitting the else branch
    // which always sets didScroll=true, bypassing trigger evaluation

    const triggerConfig = {
      trigEnabled: true,
      trigChannel: 0,
      nbrSamples: 2
    };

    // Check the condition: trigEnabled && trigChannel >= 0 && trigChannel < nbrSamples
    const conditionPasses =
      triggerConfig.trigEnabled &&
      triggerConfig.trigChannel >= 0 &&
      triggerConfig.trigChannel < triggerConfig.nbrSamples;

    console.log('Condition evaluation:');
    console.log(`  trigEnabled: ${triggerConfig.trigEnabled}`);
    console.log(`  trigChannel (${triggerConfig.trigChannel}) >= 0: ${triggerConfig.trigChannel >= 0}`);
    console.log(`  trigChannel (${triggerConfig.trigChannel}) < nbrSamples (${triggerConfig.nbrSamples}): ${triggerConfig.trigChannel < triggerConfig.nbrSamples}`);
    console.log(`  Overall condition: ${conditionPasses}`);

    expect(conditionPasses).toBe(true); // Condition should pass, so evaluateTrigger() should be called
  });

  it('should properly countdown holdoff without processor overwriting', () => {
    // This simulates the BUG: processor returns static holdoff value that overwrites our countdown

    class BuggyHoldoffSimulation {
      private holdoffCounter = 0;
      private triggerFired = false;

      // Simulate processor that always returns holdoff=2 when trigger is active
      getProcessorState() {
        return { fired: this.triggerFired, holdoff: 2 }; // Always returns 2!
      }

      processSampleOldWay(triggerFires: boolean) {
        const state = this.getProcessorState();
        this.triggerFired = state.fired || triggerFires;

        // BUG: Always overwrites from processor
        this.holdoffCounter = state.holdoff; // This resets it every time!

        if (this.holdoffCounter > 0) {
          this.holdoffCounter--;
        }

        const shouldUpdate = this.triggerFired && this.holdoffCounter === 0;
        return { shouldUpdate, holdoffCounter: this.holdoffCounter };
      }

      processSampleNewWay(triggerFires: boolean) {
        const wasFired = this.triggerFired;
        const state = this.getProcessorState();
        this.triggerFired = state.fired || triggerFires;

        // FIX: Only set holdoff when trigger FIRST fires
        if (!wasFired && this.triggerFired) {
          this.holdoffCounter = state.holdoff;
        }

        if (this.holdoffCounter > 0) {
          this.holdoffCounter--;
        }

        const shouldUpdate = this.triggerFired && this.holdoffCounter === 0;
        return { shouldUpdate, holdoffCounter: this.holdoffCounter };
      }
    }

    console.log('\n=== OLD WAY (BUGGY) ===');
    const oldSim = new BuggyHoldoffSimulation();
    const oldResults = [];
    oldResults.push(oldSim.processSampleOldWay(true));  // Sample 1: Trigger fires
    oldResults.push(oldSim.processSampleOldWay(false)); // Sample 2: Holdoff period
    oldResults.push(oldSim.processSampleOldWay(false)); // Sample 3: Should expire

    oldResults.forEach((r, i) => {
      console.log(`  Sample ${i + 1}: holdoff=${r.holdoffCounter}, shouldUpdate=${r.shouldUpdate}`);
    });

    console.log('\n=== NEW WAY (FIXED) ===');
    const newSim = new BuggyHoldoffSimulation();
    const newResults = [];
    newResults.push(newSim.processSampleNewWay(true));  // Sample 1: Trigger fires
    newResults.push(newSim.processSampleNewWay(false)); // Sample 2: Holdoff period
    newResults.push(newSim.processSampleNewWay(false)); // Sample 3: Should expire

    newResults.forEach((r, i) => {
      console.log(`  Sample ${i + 1}: holdoff=${r.holdoffCounter}, shouldUpdate=${r.shouldUpdate}`);
    });

    // OLD WAY: Holdoff never expires (always 1 or 2)
    expect(oldResults[0].holdoffCounter).toBe(1); // Sample 1: 2 -> decrement -> 1
    expect(oldResults[1].holdoffCounter).toBe(1); // Sample 2: OVERWRITTEN to 2 -> decrement -> 1 (BUG!)
    expect(oldResults[2].holdoffCounter).toBe(1); // Sample 3: Still 1 (never reaches 0!)

    expect(oldResults[0].shouldUpdate).toBe(false);
    expect(oldResults[1].shouldUpdate).toBe(false);
    expect(oldResults[2].shouldUpdate).toBe(false); // Never updates!

    // NEW WAY: Holdoff properly counts down
    expect(newResults[0].holdoffCounter).toBe(1); // Sample 1: 2 -> decrement -> 1
    expect(newResults[1].holdoffCounter).toBe(0); // Sample 2: 1 -> decrement -> 0 (FIXED!)
    expect(newResults[2].holdoffCounter).toBe(0); // Sample 3: 0 (stays 0)

    expect(newResults[0].shouldUpdate).toBe(false); // Sample 1: holdoff active (counter=1)
    expect(newResults[1].shouldUpdate).toBe(true);  // Sample 2: holdoff expired! (counter=0, WORKS!)
    expect(newResults[2].shouldUpdate).toBe(true);  // Sample 3: Still can update
  });
});
