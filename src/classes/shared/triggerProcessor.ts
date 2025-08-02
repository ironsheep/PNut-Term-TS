/** @format */

'use strict';

// src/classes/shared/triggerProcessor.ts

/**
 * Base class for trigger processing functionality
 * Handles common trigger states and holdoff management
 */
export abstract class TriggerProcessor {
  protected holdoffCounter: number = 0;
  protected triggerArmed: boolean = false;
  protected triggerFired: boolean = false;

  /**
   * Handle holdoff countdown
   * Returns true if holdoff is active (counter > 0)
   */
  handleHoldoff(): boolean {
    if (this.holdoffCounter > 0) {
      this.holdoffCounter--;
      return true; // Still in holdoff
    }
    return false; // Holdoff expired
  }

  /**
   * Update trigger state
   */
  updateTriggerState(armed: boolean, fired: boolean): void {
    this.triggerArmed = armed;
    this.triggerFired = fired;
  }

  /**
   * Reset trigger to initial state
   */
  resetTrigger(): void {
    this.triggerArmed = false;
    this.triggerFired = false;
    this.holdoffCounter = 0;
  }

  /**
   * Get current trigger state
   */
  getTriggerState(): { armed: boolean; fired: boolean; holdoff: number } {
    return {
      armed: this.triggerArmed,
      fired: this.triggerFired,
      holdoff: this.holdoffCounter
    };
  }

  /**
   * Set holdoff counter
   */
  setHoldoff(count: number): void {
    this.holdoffCounter = count;
  }

  /**
   * Abstract method to evaluate trigger condition
   * Must be implemented by derived classes
   */
  abstract evaluateTriggerCondition(sample: any, triggerSpec: any): boolean;
}

/**
 * Logic window trigger processor
 * Implements mask/match bit-pattern triggering
 */
export class LogicTriggerProcessor extends TriggerProcessor {
  /**
   * Evaluate if the sample matches the trigger pattern
   * @param sample - The numeric sample to test
   * @param triggerSpec - Contains trigMask and trigMatch values
   * @returns true if the sample matches the trigger pattern
   */
  evaluateTriggerCondition(sample: number, triggerSpec: { trigMask: number; trigMatch: number }): boolean {
    // Apply mask to sample and check if it matches the expected pattern
    const maskedSample = sample & triggerSpec.trigMask;
    return maskedSample === triggerSpec.trigMatch;
  }

  /**
   * Process a sample for trigger evaluation
   * Returns true if the display should be updated (no trigger or triggered)
   */
  processSample(sample: number, triggerSpec: { trigMask: number; trigMatch: number; trigHoldoff: number }): boolean {
    // If in holdoff, don't evaluate trigger
    if (this.handleHoldoff()) {
      return true; // Update display during holdoff
    }

    // If no trigger is configured (mask is 0), always update display
    if (triggerSpec.trigMask === 0) {
      return true;
    }

    // Evaluate trigger condition
    const triggerConditionMet = this.evaluateTriggerCondition(sample, triggerSpec);

    if (!this.triggerArmed && !this.triggerFired) {
      // Waiting for trigger
      if (triggerConditionMet) {
        // Trigger condition met - fire immediately
        this.updateTriggerState(false, true);
        this.setHoldoff(triggerSpec.trigHoldoff);
        return true; // Update display on trigger
      }
      return false; // Don't update display while waiting
    }

    if (this.triggerFired) {
      // Already triggered, waiting for holdoff
      return true; // Update display
    }

    return false; // Shouldn't reach here
  }
}

/**
 * Scope window trigger processor
 * Implements level-crossing triggering with arm/fire states
 */
export class ScopeTriggerProcessor extends TriggerProcessor {
  private previousSample: number | null = null;
  private armLevel: number = 0;
  private fireLevel: number = 0;
  private slope: 'positive' | 'negative' = 'positive';

  /**
   * Set trigger levels
   */
  setTriggerLevels(armLevel: number, fireLevel: number, slope: 'positive' | 'negative' = 'positive'): void {
    this.armLevel = armLevel;
    this.fireLevel = fireLevel;
    this.slope = slope;
  }

  /**
   * Get current trigger levels
   */
  getTriggerLevels(): { armLevel: number; fireLevel: number; slope: string } {
    return {
      armLevel: this.armLevel,
      fireLevel: this.fireLevel,
      slope: this.slope
    };
  }

  /**
   * Evaluate if the sample crosses the trigger level
   * @param sample - The current sample value
   * @param triggerSpec - Contains trigger configuration
   * @returns true if trigger condition is met
   */
  evaluateTriggerCondition(sample: number, triggerSpec?: any): boolean {
    if (this.previousSample === null) {
      this.previousSample = sample;
      return false;
    }

    let crossedLevel = false;

    if (this.slope === 'positive') {
      // Positive slope: trigger when crossing from below to above
      crossedLevel = this.previousSample < this.fireLevel && sample >= this.fireLevel;
    } else {
      // Negative slope: trigger when crossing from above to below
      crossedLevel = this.previousSample > this.fireLevel && sample <= this.fireLevel;
    }

    this.previousSample = sample;
    return crossedLevel;
  }

  /**
   * Check if sample crosses arm level
   */
  private crossesArmLevel(sample: number): boolean {
    if (this.previousSample === null) {
      return false;
    }

    if (this.slope === 'positive') {
      // For positive slope, arm when crossing arm level from below
      return this.previousSample < this.armLevel && sample >= this.armLevel;
    } else {
      // For negative slope, arm when crossing arm level from above
      return this.previousSample > this.armLevel && sample <= this.armLevel;
    }
  }

  /**
   * Process a sample for scope trigger evaluation
   * Handles arm/fire state machine
   */
  processSample(sample: number, triggerSpec: { trigHoldoff: number }): boolean {
    // If in holdoff, don't evaluate trigger
    if (this.handleHoldoff()) {
      return true; // Update display during holdoff
    }

    // If no trigger levels are set, always update display
    if (this.armLevel === 0 && this.fireLevel === 0) {
      this.previousSample = sample;
      return true;
    }

    // Check for arm level crossing
    if (!this.triggerArmed && !this.triggerFired) {
      if (this.crossesArmLevel(sample)) {
        this.updateTriggerState(true, false);
      }
    }

    // Check for trigger level crossing if armed
    if (this.triggerArmed && !this.triggerFired) {
      if (this.evaluateTriggerCondition(sample)) {
        this.updateTriggerState(false, true);
        this.setHoldoff(triggerSpec.trigHoldoff);
        return true; // Update display on trigger
      }
    }

    // Update display if triggered or no trigger is set
    return this.triggerFired || (this.armLevel === 0 && this.fireLevel === 0);
  }

  /**
   * Reset trigger processor state
   */
  resetTrigger(): void {
    super.resetTrigger();
    this.previousSample = null;
  }
}