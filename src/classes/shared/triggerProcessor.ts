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
 * Implements level-based triggering with arm/fire states (Pascal-faithful)
 */
export class ScopeTriggerProcessor extends TriggerProcessor {
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
   * Evaluate if the sample is at or beyond the trigger level
   * Pascal behavior: Absolute comparison, not crossing detection
   * @param sample - The current sample value
   * @param triggerSpec - Contains trigger configuration
   * @returns true if trigger condition is met
   */
  evaluateTriggerCondition(sample: number, triggerSpec?: any): boolean {
    // Pascal lines 1297-1312: Pure absolute comparison, no previous sample needed
    let conditionMet = false;

    if (this.slope === 'positive') {
      // Pascal line 1300: if t >= vTriggerFire then
      // Positive slope: trigger when sample AT OR ABOVE fire level
      conditionMet = sample >= this.fireLevel;
    } else {
      // Pascal line 1308: if t <= vTriggerFire then
      // Negative slope: trigger when sample AT OR BELOW fire level
      conditionMet = sample <= this.fireLevel;
    }

    return conditionMet;
  }

  /**
   * Check if sample is at arm level (absolute level checking, not crossing)
   * Pascal behavior: Arm when sample reaches arm level, not when crossing
   */
  private isAtArmLevel(sample: number): boolean {
    if (this.slope === 'positive') {
      // For positive slope, arm when sample is at or below arm level
      return sample <= this.armLevel;
    } else {
      // For negative slope, arm when sample is at or above arm level
      return sample >= this.armLevel;
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

    // Check if sample is at arm level (absolute level, matches Pascal behavior)
    if (!this.triggerArmed && !this.triggerFired) {
      if (this.isAtArmLevel(sample)) {
        this.updateTriggerState(true, false);
      }
    }

    // Check for trigger level (absolute comparison) if armed
    // Pascal lines 1297-1312: if armed, check if at/beyond fire level
    if (this.triggerArmed && !this.triggerFired) {
      if (this.evaluateTriggerCondition(sample)) {
        // Pascal: vTriggered := True; vArmed := False;
        this.updateTriggerState(false, true);
        this.setHoldoff(triggerSpec.trigHoldoff);
        return true; // Update display on trigger
      }
    }

    // Update display only if trigger has fired
    // Pascal logic: Display updates when triggered AND holdoff expired
    return this.triggerFired;
  }

  /**
   * Reset trigger processor state
   */
  resetTrigger(): void {
    super.resetTrigger();
  }
}