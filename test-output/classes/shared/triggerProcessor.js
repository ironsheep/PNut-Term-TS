/** @format */
'use strict';
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScopeTriggerProcessor = exports.LogicTriggerProcessor = exports.TriggerProcessor = void 0;
// src/classes/shared/triggerProcessor.ts
/**
 * Base class for trigger processing functionality
 * Handles common trigger states and holdoff management
 */
var TriggerProcessor = /** @class */ (function () {
    function TriggerProcessor() {
        this.holdoffCounter = 0;
        this.triggerArmed = false;
        this.triggerFired = false;
    }
    /**
     * Handle holdoff countdown
     * Returns true if holdoff is active (counter > 0)
     */
    TriggerProcessor.prototype.handleHoldoff = function () {
        if (this.holdoffCounter > 0) {
            this.holdoffCounter--;
            return true; // Still in holdoff
        }
        return false; // Holdoff expired
    };
    /**
     * Update trigger state
     */
    TriggerProcessor.prototype.updateTriggerState = function (armed, fired) {
        this.triggerArmed = armed;
        this.triggerFired = fired;
    };
    /**
     * Reset trigger to initial state
     */
    TriggerProcessor.prototype.resetTrigger = function () {
        this.triggerArmed = false;
        this.triggerFired = false;
        this.holdoffCounter = 0;
    };
    /**
     * Get current trigger state
     */
    TriggerProcessor.prototype.getTriggerState = function () {
        return {
            armed: this.triggerArmed,
            fired: this.triggerFired,
            holdoff: this.holdoffCounter
        };
    };
    /**
     * Set holdoff counter
     */
    TriggerProcessor.prototype.setHoldoff = function (count) {
        this.holdoffCounter = count;
    };
    return TriggerProcessor;
}());
exports.TriggerProcessor = TriggerProcessor;
/**
 * Logic window trigger processor
 * Implements mask/match bit-pattern triggering
 */
var LogicTriggerProcessor = /** @class */ (function (_super) {
    __extends(LogicTriggerProcessor, _super);
    function LogicTriggerProcessor() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    /**
     * Evaluate if the sample matches the trigger pattern
     * @param sample - The numeric sample to test
     * @param triggerSpec - Contains trigMask and trigMatch values
     * @returns true if the sample matches the trigger pattern
     */
    LogicTriggerProcessor.prototype.evaluateTriggerCondition = function (sample, triggerSpec) {
        // Apply mask to sample and check if it matches the expected pattern
        var maskedSample = sample & triggerSpec.trigMask;
        return maskedSample === triggerSpec.trigMatch;
    };
    /**
     * Process a sample for trigger evaluation
     * Returns true if the display should be updated (no trigger or triggered)
     */
    LogicTriggerProcessor.prototype.processSample = function (sample, triggerSpec) {
        // If in holdoff, don't evaluate trigger
        if (this.handleHoldoff()) {
            return true; // Update display during holdoff
        }
        // If no trigger is configured (mask is 0), always update display
        if (triggerSpec.trigMask === 0) {
            return true;
        }
        // Evaluate trigger condition
        var triggerConditionMet = this.evaluateTriggerCondition(sample, triggerSpec);
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
    };
    return LogicTriggerProcessor;
}(TriggerProcessor));
exports.LogicTriggerProcessor = LogicTriggerProcessor;
/**
 * Scope window trigger processor
 * Implements level-crossing triggering with arm/fire states
 */
var ScopeTriggerProcessor = /** @class */ (function (_super) {
    __extends(ScopeTriggerProcessor, _super);
    function ScopeTriggerProcessor() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.previousSample = null;
        _this.armLevel = 0;
        _this.fireLevel = 0;
        _this.slope = 'positive';
        return _this;
    }
    /**
     * Set trigger levels
     */
    ScopeTriggerProcessor.prototype.setTriggerLevels = function (armLevel, fireLevel, slope) {
        if (slope === void 0) { slope = 'positive'; }
        this.armLevel = armLevel;
        this.fireLevel = fireLevel;
        this.slope = slope;
    };
    /**
     * Get current trigger levels
     */
    ScopeTriggerProcessor.prototype.getTriggerLevels = function () {
        return {
            armLevel: this.armLevel,
            fireLevel: this.fireLevel,
            slope: this.slope
        };
    };
    /**
     * Evaluate if the sample crosses the trigger level
     * @param sample - The current sample value
     * @param triggerSpec - Contains trigger configuration
     * @returns true if trigger condition is met
     */
    ScopeTriggerProcessor.prototype.evaluateTriggerCondition = function (sample, triggerSpec) {
        if (this.previousSample === null) {
            this.previousSample = sample;
            return false;
        }
        var crossedLevel = false;
        if (this.slope === 'positive') {
            // Positive slope: trigger when crossing from below to above
            crossedLevel = this.previousSample < this.fireLevel && sample >= this.fireLevel;
        }
        else {
            // Negative slope: trigger when crossing from above to below
            crossedLevel = this.previousSample > this.fireLevel && sample <= this.fireLevel;
        }
        this.previousSample = sample;
        return crossedLevel;
    };
    /**
     * Check if sample crosses arm level
     */
    ScopeTriggerProcessor.prototype.crossesArmLevel = function (sample) {
        if (this.previousSample === null) {
            return false;
        }
        if (this.slope === 'positive') {
            // For positive slope, arm when crossing arm level from below
            return this.previousSample < this.armLevel && sample >= this.armLevel;
        }
        else {
            // For negative slope, arm when crossing arm level from above
            return this.previousSample > this.armLevel && sample <= this.armLevel;
        }
    };
    /**
     * Process a sample for scope trigger evaluation
     * Handles arm/fire state machine
     */
    ScopeTriggerProcessor.prototype.processSample = function (sample, triggerSpec) {
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
                this.previousSample = sample;
                return true; // Update display on trigger
            }
        }
        // Store current sample for next comparison
        this.previousSample = sample;
        // Update display if triggered or no trigger is set
        return this.triggerFired || (this.armLevel === 0 && this.fireLevel === 0);
    };
    /**
     * Reset trigger processor state
     */
    ScopeTriggerProcessor.prototype.resetTrigger = function () {
        _super.prototype.resetTrigger.call(this);
        this.previousSample = null;
    };
    return ScopeTriggerProcessor;
}(TriggerProcessor));
exports.ScopeTriggerProcessor = ScopeTriggerProcessor;
