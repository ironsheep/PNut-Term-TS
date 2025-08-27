"use strict";
/** @format */
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
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageExtractor = exports.PatternElementType = exports.MessageType = void 0;
// src/classes/shared/messageExtractor.ts
var events_1 = require("events");
var circularBuffer_1 = require("./circularBuffer");
/**
 * Two-Tier Pattern Matching: Message Classification by Confidence Level
 * Based on Pascal study decisions for P2 message routing
 */
var MessageType;
(function (MessageType) {
    // TIER 1: VERY DISTINCTIVE (Always route correctly)
    MessageType["DB_PACKET"] = "DB_PACKET";
    MessageType["COG_MESSAGE"] = "COG_MESSAGE";
    MessageType["BACKTICK_WINDOW"] = "BACKTICK_WINDOW";
    // TIER 2: NEEDS CONTEXT VALIDATION  
    MessageType["DEBUGGER_80BYTE"] = "DEBUGGER_80BYTE";
    MessageType["P2_SYSTEM_INIT"] = "P2_SYSTEM_INIT";
    // DEFAULT ROUTE
    MessageType["TERMINAL_OUTPUT"] = "TERMINAL_OUTPUT";
    // SPECIAL CASES  
    MessageType["INCOMPLETE_DEBUG"] = "INCOMPLETE_DEBUG";
    MessageType["INVALID_COG"] = "INVALID_COG"; // Invalid COG ID → Debug Logger with warning
})(MessageType || (exports.MessageType = MessageType = {}));
/**
 * Two-Tier Pattern Matching: Pattern Definition Types
 */
var PatternElementType;
(function (PatternElementType) {
    PatternElementType["EXACT_BYTE"] = "EXACT_BYTE";
    PatternElementType["ANY_BYTE"] = "ANY_BYTE";
    PatternElementType["LENGTH_FIELD"] = "LENGTH_FIELD";
    PatternElementType["UNTIL_BYTE"] = "UNTIL_BYTE";
    PatternElementType["COG_ID_RANGE"] = "COG_ID_RANGE";
    PatternElementType["COG_ID_BINARY"] = "COG_ID_BINARY";
    PatternElementType["TEXT_PATTERN"] = "TEXT_PATTERN";
    PatternElementType["TERMINATOR"] = "TERMINATOR"; // { type: 'terminator', value: 0x0D }
})(PatternElementType || (exports.PatternElementType = PatternElementType = {}));
/**
 * MessageExtractor - Two-Tier Pattern Matching with Single Forward Scan
 *
 * Based on Pascal study architectural decisions for P2 serial message routing.
 * Implements Two-Tier Pattern Matching with confidence-based classification.
 *
 * TIER 1 - PATTERN RECOGNITION (What type of message is this?)
 * - Recognize basic message patterns without full validation
 * - Priority-ordered pattern matching (0xDB → COG → Backtick → 80-byte)
 * - Fast pattern recognition for immediate classification
 *
 * TIER 2 - COMPLETENESS VALIDATION (Is the message complete and valid?)
 * - Validate full payload received for 0xDB packets
 * - Validate COG ID ranges and terminators for text messages
 * - Validate catalog entries for window commands
 * - Context validation for 80-byte debugger packets
 *
 * ROUTING PHILOSOPHY: "Terminal FIRST, Debugger SECOND"
 * - Everything routes to Terminal (blue window) unless proven to be debug data
 * - Invalid debug messages → Debug Logger with warnings, not Terminal
 * - Partial messages → Intended destination with INCOMPLETE warning
 *
 * SINGLE-PASS PROCESSING (No putbacks, more efficient than Chip's Pascal)
 * - Never rescans data using position save/restore for backtrack scenarios
 * - Handles partial messages by waiting for completion
 * - Advances buffer only after successful extraction or definitive routing decision
 *
 * DEFENSIVE PATTERN MATCHING
 * - Handles P2 protocol ambiguities with confidence levels
 * - Pattern validation prevents misrouting binary data to terminal
 * - Context-aware 80-byte packet detection
 */
var MessageExtractor = /** @class */ (function (_super) {
    __extends(MessageExtractor, _super);
    function MessageExtractor(buffer, outputQueue) {
        var _a;
        var _this = _super.call(this) || this;
        _this.lastScanPosition = 0;
        _this.partialMessageDetected = false;
        // Statistics
        _this.messagesExtracted = (_a = {},
            _a[MessageType.DB_PACKET] = 0,
            _a[MessageType.COG_MESSAGE] = 0,
            _a[MessageType.BACKTICK_WINDOW] = 0,
            _a[MessageType.DEBUGGER_80BYTE] = 0,
            _a[MessageType.P2_SYSTEM_INIT] = 0,
            _a[MessageType.TERMINAL_OUTPUT] = 0,
            _a[MessageType.INCOMPLETE_DEBUG] = 0,
            _a[MessageType.INVALID_COG] = 0,
            _a);
        _this.partialMessageWaits = 0;
        _this.totalBytesExtracted = 0;
        // Performance monitoring
        _this.performanceMonitor = null;
        // Two-Tier Pattern Definitions (Pascal study decisions)
        _this.MESSAGE_PATTERNS = [
            // TIER 1: 0xDB Packets - VERY DISTINCTIVE (Priority 1)
            {
                messageType: MessageType.DB_PACKET,
                confidence: 'VERY_DISTINCTIVE',
                tier1Pattern: [
                    { type: PatternElementType.EXACT_BYTE, value: 0xDB },
                    { type: PatternElementType.ANY_BYTE, length: 1 }, // Subtype
                    { type: PatternElementType.LENGTH_FIELD, bytes: 2 } // Payload length
                ],
                tier2Validation: ['VALIDATE_PAYLOAD_RECEIVED', 'VALIDATE_CHECKSUM'],
                priority: 1,
                description: '0xDB protocol packets with length validation'
            },
            // TIER 1: COG Messages - DISTINCTIVE (Priority 2)
            {
                messageType: MessageType.COG_MESSAGE,
                confidence: 'DISTINCTIVE',
                tier1Pattern: [
                    { type: PatternElementType.TEXT_PATTERN, pattern: 'Cog', caseSensitive: true },
                    { type: PatternElementType.COG_ID_RANGE, min: 0, max: 7 },
                    { type: PatternElementType.EXACT_BYTE, value: 0x20 }, // ' ' (first space)
                    { type: PatternElementType.EXACT_BYTE, value: 0x20 } // ' ' (second space)
                ],
                tier2Validation: ['VALIDATE_COG_ID', 'VALIDATE_CR_TERMINATOR'],
                priority: 2,
                description: 'COG messages with two spaces after COG ID (no colon)'
            },
            // TIER 1: P2 System Init - VERY DISTINCTIVE (Priority 3)
            {
                messageType: MessageType.P2_SYSTEM_INIT,
                confidence: 'VERY_DISTINCTIVE',
                tier1Pattern: [
                    { type: PatternElementType.TEXT_PATTERN, pattern: 'Cog0 INIT $0000_0000 $0000_0000 load', caseSensitive: true }
                ],
                tier2Validation: ['VALIDATE_P2_SYSTEM_INIT_EOL'],
                priority: 3,
                description: 'P2 system reboot synchronization marker'
            },
            // TIER 1: Backtick Window Commands - DISTINCTIVE (Priority 4)
            {
                messageType: MessageType.BACKTICK_WINDOW,
                confidence: 'DISTINCTIVE',
                tier1Pattern: [
                    { type: PatternElementType.EXACT_BYTE, value: 0x60 }, // Backtick
                    { type: PatternElementType.UNTIL_BYTE, value: 0x20 } // Extract to space
                ],
                tier2Validation: ['VALIDATE_WINDOW_CATALOG', 'VALIDATE_CR_TERMINATOR'],
                priority: 4,
                description: 'Backtick window commands with catalog validation'
            },
            // TIER 2: 80+ byte Debugger Packet - NEEDS CONTEXT (Priority 5)
            {
                messageType: MessageType.DEBUGGER_80BYTE,
                confidence: 'NEEDS_CONTEXT',
                tier1Pattern: [
                    { type: PatternElementType.COG_ID_BINARY, min: 0, max: 7 },
                    { type: PatternElementType.ANY_BYTE, length: 79 } // Minimum remaining packet data
                ],
                tier2Validation: ['VALIDATE_DEBUGGER_PACKET_SIZE', 'VALIDATE_COG_CONTEXT'],
                priority: 5,
                description: '80+ byte debugger packets with binary COG IDs (0x00-0x07)'
            }
        ];
        _this.buffer = buffer;
        _this.outputQueue = outputQueue;
        return _this;
    }
    /**
     * Set performance monitor for instrumentation
     */
    MessageExtractor.prototype.setPerformanceMonitor = function (monitor) {
        this.performanceMonitor = monitor;
    };
    /**
     * TIER 1: Pattern Recognition Engine
     * Attempts to match buffer data against known patterns
     */
    MessageExtractor.prototype.matchPattern = function (pattern) {
        this.buffer.savePosition();
        var matchedLength = 0;
        var metadata = {};
        try {
            for (var _i = 0, _a = pattern.tier1Pattern; _i < _a.length; _i++) {
                var element = _a[_i];
                var result = this.matchPatternElement(element, metadata);
                if (!result.matched) {
                    this.buffer.restorePosition();
                    return { matched: false, length: 0 };
                }
                matchedLength += result.length;
            }
            // Pattern matched successfully
            this.buffer.restorePosition(); // Reset for actual extraction
            return { matched: true, length: matchedLength, metadata: metadata };
        }
        catch (error) {
            this.buffer.restorePosition();
            return { matched: false, length: 0 };
        }
    };
    /**
     * Match individual pattern elements
     */
    MessageExtractor.prototype.matchPatternElement = function (element, metadata) {
        switch (element.type) {
            case PatternElementType.EXACT_BYTE:
                return this.matchExactByte(element.value);
            case PatternElementType.ANY_BYTE:
                return this.matchAnyBytes(element.length || 1);
            case PatternElementType.LENGTH_FIELD:
                return this.matchLengthField(element.bytes || 2, metadata);
            case PatternElementType.UNTIL_BYTE:
                return this.matchUntilByte(element.value, metadata);
            case PatternElementType.COG_ID_RANGE:
                return this.matchCogIdRange(element.min || 0, element.max || 7, metadata);
            case PatternElementType.COG_ID_BINARY:
                return this.matchCogIdBinary(element.min || 0, element.max || 7, metadata);
            case PatternElementType.TEXT_PATTERN:
                return this.matchTextPattern(element.pattern, element.caseSensitive || false);
            case PatternElementType.TERMINATOR:
                return this.matchExactByte(element.value);
            default:
                return { matched: false, length: 0 };
        }
    };
    /**
     * Match exact byte value
     */
    MessageExtractor.prototype.matchExactByte = function (expectedValue) {
        var result = this.buffer.next();
        if (result.status === circularBuffer_1.NextStatus.DATA && result.value === expectedValue) {
            return { matched: true, length: 1 };
        }
        return { matched: false, length: 0 };
    };
    /**
     * Match any sequence of bytes
     */
    MessageExtractor.prototype.matchAnyBytes = function (length) {
        for (var i = 0; i < length; i++) {
            var result = this.buffer.next();
            if (result.status !== circularBuffer_1.NextStatus.DATA) {
                return { matched: false, length: 0 };
            }
        }
        return { matched: true, length: length };
    };
    /**
     * Match and extract length field
     */
    MessageExtractor.prototype.matchLengthField = function (bytes, metadata) {
        var payloadLength = 0;
        for (var i = 0; i < bytes; i++) {
            var result = this.buffer.next();
            if (result.status !== circularBuffer_1.NextStatus.DATA) {
                return { matched: false, length: 0 };
            }
            payloadLength |= (result.value << (i * 8)); // Little-endian
        }
        metadata.payloadSize = payloadLength;
        return { matched: true, length: bytes };
    };
    /**
     * Match until specific byte value
     */
    MessageExtractor.prototype.matchUntilByte = function (terminator, metadata) {
        var length = 0;
        var command = '';
        while (length < 256) { // Prevent infinite loops
            var result = this.buffer.next();
            if (result.status !== circularBuffer_1.NextStatus.DATA) {
                return { matched: false, length: 0 };
            }
            length++;
            if (result.value === terminator) {
                metadata.windowCommand = command;
                return { matched: true, length: length };
            }
            command += String.fromCharCode(result.value);
        }
        return { matched: false, length: 0 };
    };
    /**
     * Match COG ID in valid range
     */
    MessageExtractor.prototype.matchCogIdRange = function (min, max, metadata) {
        var result = this.buffer.next();
        if (result.status === circularBuffer_1.NextStatus.DATA) {
            // COG IDs in P2 messages are ASCII digits '0'-'7' (0x30-0x37)
            var cogIdAscii = result.value;
            if (cogIdAscii >= 0x30 && cogIdAscii <= 0x37) {
                var cogId = cogIdAscii - 0x30; // Convert ASCII to number (0-7)
                if (cogId >= min && cogId <= max) {
                    metadata.cogId = cogId;
                    return { matched: true, length: 1 };
                }
            }
        }
        return { matched: false, length: 0 };
    };
    /**
     * Match binary COG ID in valid range (0x00-0x07)
     */
    MessageExtractor.prototype.matchCogIdBinary = function (min, max, metadata) {
        var result = this.buffer.next();
        if (result.status === circularBuffer_1.NextStatus.DATA) {
            // COG IDs in binary packets are raw bytes 0x00-0x07
            var cogId = result.value;
            if (cogId >= min && cogId <= max) {
                metadata.cogId = cogId;
                return { matched: true, length: 1 };
            }
        }
        return { matched: false, length: 0 };
    };
    /**
     * Match text pattern
     */
    MessageExtractor.prototype.matchTextPattern = function (pattern, caseSensitive) {
        var targetBytes = new TextEncoder().encode(caseSensitive ? pattern : pattern.toLowerCase());
        for (var i = 0; i < targetBytes.length; i++) {
            var result = this.buffer.next();
            if (result.status !== circularBuffer_1.NextStatus.DATA) {
                return { matched: false, length: 0 };
            }
            var byteValue = result.value;
            if (!caseSensitive && byteValue >= 65 && byteValue <= 90) {
                byteValue += 32; // Convert to lowercase
            }
            if (byteValue !== targetBytes[i]) {
                return { matched: false, length: 0 };
            }
        }
        return { matched: true, length: targetBytes.length };
    };
    /**
     * TIER 2: Validation Engine
     * Validates pattern completeness and context
     */
    MessageExtractor.prototype.validatePattern = function (pattern, metadata) {
        if (!pattern.tier2Validation) {
            return { valid: true, status: 'COMPLETE' };
        }
        var mergedResult = {
            valid: true,
            status: 'COMPLETE'
        };
        for (var _i = 0, _a = pattern.tier2Validation; _i < _a.length; _i++) {
            var validation = _a[_i];
            var result = this.performValidation(validation, pattern, metadata);
            if (!result.valid) {
                return result;
            }
            // Merge validation results (preserve eolLength, eolSequence, messageEndPosition, etc.)
            if (result.eolLength !== undefined) {
                mergedResult.eolLength = result.eolLength;
            }
            if (result.eolSequence !== undefined) {
                mergedResult.eolSequence = result.eolSequence;
            }
            if (result.messageEndPosition !== undefined) {
                mergedResult.messageEndPosition = result.messageEndPosition;
            }
        }
        return mergedResult;
    };
    /**
     * Perform individual validation checks
     */
    MessageExtractor.prototype.performValidation = function (validation, pattern, metadata) {
        switch (validation) {
            case 'VALIDATE_PAYLOAD_RECEIVED':
                return this.validatePayloadReceived(metadata);
            case 'VALIDATE_CHECKSUM':
                return this.validateChecksum(metadata);
            case 'VALIDATE_COG_ID':
                return this.validateCogId(metadata);
            case 'VALIDATE_CR_TERMINATOR':
                return this.validateCRTerminator();
            case 'GOLDEN_SYNC_POINT':
                return this.handleGoldenSyncPoint();
            case 'VALIDATE_P2_SYSTEM_INIT_EOL':
                return this.validateP2SystemInitEOL();
            case 'VALIDATE_WINDOW_CATALOG':
                return this.validateWindowCatalog(metadata);
            case 'VALIDATE_NEXT_MESSAGE_BOUNDARY':
                return this.validateNextMessageBoundary(metadata);
            case 'VALIDATE_DEBUGGER_PACKET_SIZE':
                return this.validateDebuggerPacketSize(metadata);
            case 'VALIDATE_COG_CONTEXT':
                return this.validateCogContext(metadata);
            default:
                return { valid: false, status: 'INVALID', warning: "Unknown validation: ".concat(validation) };
        }
    };
    /**
     * Validate that full payload has been received for 0xDB packets
     */
    MessageExtractor.prototype.validatePayloadReceived = function (metadata) {
        if (!metadata.payloadSize) {
            return { valid: false, status: 'INCOMPLETE', warning: 'No payload size found' };
        }
        // Reject unreasonably large payloads (over 8KB is suspicious for P2)
        if (metadata.payloadSize > 8192) {
            return { valid: false, status: 'INVALID', warning: "Payload too large: ".concat(metadata.payloadSize, " bytes") };
        }
        // Check if enough data is available in buffer for payload after current position
        // We need to peek ahead to see if payload is complete without consuming
        // First, advance past the header (4 bytes for 0xDB packets)
        this.buffer.savePosition();
        // Skip header bytes (0xDB + subtype + 2-byte length = 4 bytes)
        for (var i = 0; i < 4; i++) {
            var headerResult = this.buffer.next();
            if (headerResult.status !== circularBuffer_1.NextStatus.DATA) {
                this.buffer.restorePosition();
                return { valid: false, status: 'INCOMPLETE', warning: 'Cannot read header' };
            }
        }
        var payloadBytesAvailable = 0;
        // Now check payload bytes
        for (var i = 0; i < metadata.payloadSize; i++) {
            var result = this.buffer.next();
            if (result.status !== circularBuffer_1.NextStatus.DATA) {
                this.buffer.restorePosition();
                return { valid: false, status: 'INCOMPLETE', warning: "Payload incomplete: ".concat(payloadBytesAvailable, "/").concat(metadata.payloadSize, " bytes") };
            }
            payloadBytesAvailable++;
        }
        this.buffer.restorePosition();
        return { valid: true, status: 'COMPLETE' };
    };
    /**
     * Validate checksum for 0xDB packets (placeholder implementation)
     */
    MessageExtractor.prototype.validateChecksum = function (metadata) {
        // TODO: Implement actual checksum validation when protocol is fully understood
        return { valid: true, status: 'COMPLETE' };
    };
    /**
     * Validate COG ID is in valid range and not prohibited
     */
    MessageExtractor.prototype.validateCogId = function (metadata) {
        if (metadata.cogId === undefined) {
            return { valid: false, status: 'INVALID', warning: 'Missing COG ID' };
        }
        // COG 0 debugger windows are not created by test hardware
        if (metadata.cogId === 0 && metadata.forDebuggerWindow) {
            return { valid: false, status: 'INVALID', warning: 'COG 0 debugger packets not expected from test hardware' };
        }
        if (metadata.cogId < 0 || metadata.cogId > 7) {
            return { valid: false, status: 'INVALID', warning: "Invalid COG ID: ".concat(metadata.cogId) };
        }
        return { valid: true, status: 'COMPLETE' };
    };
    /**
     * Validate CR terminator exists for text messages
     * Returns actual EOL sequence found and its length
     */
    MessageExtractor.prototype.validateCRTerminator = function () {
        // Save position to check for CR without consuming
        this.buffer.savePosition();
        // Scan ahead for CR within reasonable distance
        for (var i = 0; i < 512; i++) {
            var result = this.buffer.next();
            if (result.status !== circularBuffer_1.NextStatus.DATA) {
                this.buffer.restorePosition();
                return { valid: false, status: 'INCOMPLETE', warning: 'No data available for CR check' };
            }
            if (result.value === 0x0D) { // CR found
                // Check if it's followed by LF (CRLF sequence)
                var eolLength = 1;
                var eolSequence = '\r';
                var nextResult = this.buffer.next();
                if (nextResult.status === circularBuffer_1.NextStatus.DATA && nextResult.value === 0x0A) {
                    // Found CRLF sequence
                    eolLength = 2;
                    eolSequence = '\r\n';
                }
                this.buffer.restorePosition();
                return {
                    valid: true,
                    status: 'COMPLETE',
                    eolLength: eolLength,
                    eolSequence: eolSequence,
                    messageEndPosition: i // Absolute position of CR from start of validation
                };
            }
        }
        this.buffer.restorePosition();
        return { valid: false, status: 'INCOMPLETE', warning: 'CR terminator not found within 512 bytes' };
    };
    /**
     * Handle P2 system synchronization point
     */
    MessageExtractor.prototype.handleGoldenSyncPoint = function () {
        // P2 system reboot - perfect synchronization
        this.emit('goldenSyncPoint', { timestamp: Date.now() });
        return { valid: true, status: 'COMPLETE' };
    };
    /**
     * Validate P2 System Init message with proper EOL handling
     */
    MessageExtractor.prototype.validateP2SystemInitEOL = function () {
        // P2 System Init messages are ASCII text that must end with CRLF, LFCR, CR, or LF
        // Use the same EOL validation as COG messages
        this.buffer.savePosition();
        var i = 0;
        var maxBytes = 512; // Reasonable limit for P2 init message
        while (i < maxBytes && this.buffer.hasData()) {
            var result = this.buffer.next();
            if (result.status !== circularBuffer_1.NextStatus.DATA) {
                this.buffer.restorePosition();
                return { valid: false, status: 'INCOMPLETE', warning: 'Buffer exhausted before finding terminator' };
            }
            if (result.value === 0x0D) { // CR
                var eolLength = 1;
                var eolSequence = '\r';
                // Check for LF following CR (CRLF pattern)
                if (this.buffer.hasData()) {
                    var nextResult = this.buffer.next();
                    if (nextResult.status === circularBuffer_1.NextStatus.DATA && nextResult.value === 0x0A) {
                        eolLength = 2;
                        eolSequence = '\r\n';
                    }
                    else {
                        // Put back the byte that wasn't LF
                        this.buffer.restorePosition();
                        this.buffer.savePosition();
                        // Re-advance to CR position
                        for (var j = 0; j <= i; j++) {
                            this.buffer.next();
                        }
                    }
                }
                this.buffer.restorePosition();
                // Emit golden sync point for P2 system reboot detection
                this.emit('goldenSyncPoint', { timestamp: Date.now() });
                return {
                    valid: true,
                    status: 'COMPLETE',
                    messageEndPosition: i, // Position of CR from start
                    eolLength: eolLength,
                    eolSequence: eolSequence
                };
            }
            else if (result.value === 0x0A) { // LF
                var eolLength = 1;
                var eolSequence = '\n';
                // Check for CR following LF (LFCR pattern)
                if (this.buffer.hasData()) {
                    var nextResult = this.buffer.next();
                    if (nextResult.status === circularBuffer_1.NextStatus.DATA && nextResult.value === 0x0D) {
                        eolLength = 2;
                        eolSequence = '\n\r';
                    }
                    else {
                        // Put back the byte that wasn't CR
                        this.buffer.restorePosition();
                        this.buffer.savePosition();
                        // Re-advance to LF position
                        for (var j = 0; j <= i; j++) {
                            this.buffer.next();
                        }
                    }
                }
                this.buffer.restorePosition();
                // Emit golden sync point for P2 system reboot detection
                this.emit('goldenSyncPoint', { timestamp: Date.now() });
                return {
                    valid: true,
                    status: 'COMPLETE',
                    messageEndPosition: i, // Position of LF from start
                    eolLength: eolLength,
                    eolSequence: eolSequence
                };
            }
            i++;
        }
        this.buffer.restorePosition();
        return { valid: false, status: 'INCOMPLETE', warning: 'EOL terminator not found within 512 bytes' };
    };
    /**
     * Validate window command against catalog or created windows
     */
    MessageExtractor.prototype.validateWindowCatalog = function (metadata) {
        if (!metadata.windowCommand) {
            return { valid: false, status: 'INVALID', warning: 'No window command found' };
        }
        // TODO: Implement actual window catalog validation
        // For now, accept all window commands
        return { valid: true, status: 'COMPLETE' };
    };
    /**
     * Validate 80-byte debugger packet by checking what follows
     */
    MessageExtractor.prototype.validateNextMessageBoundary = function (metadata) {
        // Save position after current packet
        this.buffer.savePosition();
        // Skip the COG ID byte (already validated by pattern matching)
        var cogResult = this.buffer.next();
        if (cogResult.status !== circularBuffer_1.NextStatus.DATA) {
            this.buffer.restorePosition();
            return { valid: false, status: 'INCOMPLETE', warning: 'COG ID byte not available' };
        }
        // Consume the 79 remaining bytes of the 80-byte packet
        for (var i = 0; i < 79; i++) {
            var result = this.buffer.next();
            if (result.status !== circularBuffer_1.NextStatus.DATA) {
                this.buffer.restorePosition();
                return { valid: false, status: 'INCOMPLETE', warning: '80-byte packet incomplete' };
            }
        }
        // Check what follows: should be 0xDB, "Cog", backtick, or another 0-7
        var nextResult = this.buffer.next();
        this.buffer.restorePosition();
        // If no more data, assume it's at the end of the stream (valid)
        if (nextResult.status !== circularBuffer_1.NextStatus.DATA) {
            return { valid: true, status: 'COMPLETE' };
        }
        var nextByte = nextResult.value;
        // Valid followers: 0xDB, 'C' (Cog), 0x60 (backtick), or 0-7 (another packet)
        if (nextByte === 0xDB || nextByte === 0x43 || nextByte === 0x60 || (nextByte >= 0 && nextByte <= 7)) {
            return { valid: true, status: 'COMPLETE' };
        }
        return { valid: false, status: 'INVALID', warning: "Invalid byte after 80-byte packet: 0x".concat(nextByte.toString(16)) };
    };
    /**
     * Validate debugger packet size (flexible 80+ bytes)
     * Use heuristics to determine packet boundaries without look-ahead
     */
    MessageExtractor.prototype.validateDebuggerPacketSize = function (metadata) {
        this.buffer.savePosition();
        // FIXED: For COG debugger packets, we know they are exactly 80 bytes
        // Don't scan for boundaries - embedded EOL bytes would confuse boundary detection
        var availableBytes = 0;
        // Count exactly how many bytes are available (including the COG ID)
        while (availableBytes < 80 && this.buffer.hasData()) {
            var result = this.buffer.next();
            if (result.status !== circularBuffer_1.NextStatus.DATA) {
                break;
            }
            availableBytes++;
        }
        this.buffer.restorePosition();
        // We need exactly 80 bytes for a complete COG packet
        if (availableBytes >= 80) {
            metadata.actualPacketSize = 80; // Always exactly 80 bytes
            return { valid: true, status: 'COMPLETE' };
        }
        return { valid: false, status: 'INCOMPLETE', warning: "Insufficient data: ".concat(availableBytes, " bytes (need exactly 80)") };
    };
    /**
     * Validate COG context for debugger packets
     */
    MessageExtractor.prototype.validateCogContext = function (metadata) {
        // TODO: Implement context validation based on COG activity
        // For now, accept all COG contexts
        return { valid: true, status: 'COMPLETE' };
    };
    /**
     * Extract messages from buffer
     * Called by SerialReceiver via setImmediate
     * Returns true if more data might be extractable
     */
    MessageExtractor.prototype.extractMessages = function () {
        var messagesExtracted = 0;
        var continueExtracting = true;
        while (continueExtracting && this.buffer.hasData()) {
            var extracted = this.extractNextMessage();
            if (extracted) {
                messagesExtracted++;
                // Record performance metrics
                if (this.performanceMonitor) {
                    this.performanceMonitor.recordExtraction();
                    this.performanceMonitor.recordMessage();
                }
                // Queue the message
                var queued = this.outputQueue.enqueue(extracted);
                if (!queued) {
                    console.error('[MessageExtractor] Output queue full, message dropped');
                    this.emit('queueFull', extracted);
                    // Record extraction error
                    if (this.performanceMonitor) {
                        this.performanceMonitor.recordExtractionError();
                    }
                }
            }
            else {
                // No complete message available
                continueExtracting = false;
            }
        }
        if (messagesExtracted > 0) {
            this.emit('messagesExtracted', messagesExtracted);
        }
        return this.buffer.hasData() && this.partialMessageDetected;
    };
    /**
     * Extract next complete message using Two-Tier Pattern Matching
     * Returns null if no complete message available
     */
    MessageExtractor.prototype.extractNextMessage = function () {
        // Reset partial flag
        this.partialMessageDetected = false;
        // TIER 1: Try each pattern in priority order
        for (var _i = 0, _a = this.MESSAGE_PATTERNS; _i < _a.length; _i++) {
            var pattern = _a[_i];
            var match = this.matchPattern(pattern);
            if (match.matched) {
                // TIER 2: Validate pattern completeness
                var validation = this.validatePattern(pattern, match.metadata);
                if (validation.valid) {
                    // Extract complete message
                    var extracted = this.extractCompleteMessage(pattern, match.length, match.metadata, validation);
                    if (extracted) {
                        return extracted;
                    }
                }
                else if (validation.status === 'INCOMPLETE') {
                    // Partial message - wait for more data
                    // KEEP buffer position at start of message so we can re-match when more data arrives
                    // The matchPattern already restored position, so we don't need to advance
                    this.partialMessageDetected = true;
                    this.partialMessageWaits++;
                    return null;
                }
                else {
                    // Invalid pattern - route to appropriate destination with warning
                    return this.handleInvalidPattern(pattern, match.metadata, validation);
                }
            }
        }
        // No patterns matched - default to Terminal Output (Terminal FIRST principle)
        return this.extractTerminalOutput();
    };
    /**
     * Extract complete validated message
     */
    MessageExtractor.prototype.extractCompleteMessage = function (pattern, length, metadata, validation) {
        // For 0xDB packets, include payload in total message length
        var totalLength = length;
        if (pattern.messageType === MessageType.DB_PACKET && metadata.payloadSize) {
            totalLength = length + metadata.payloadSize; // Header + payload
        }
        // For text messages, calculate total length from message end position + EOL length
        if (validation.messageEndPosition !== undefined && validation.eolLength) {
            totalLength = validation.messageEndPosition + validation.eolLength; // Absolute position of CR + EOL length
        }
        // For debugger packets, use actual measured size if available
        if (pattern.messageType === MessageType.DEBUGGER_80BYTE && metadata.actualPacketSize) {
            totalLength = metadata.actualPacketSize;
        }
        // Extract the actual message data
        var messageData = new Uint8Array(totalLength);
        for (var i = 0; i < totalLength; i++) {
            var result = this.buffer.next();
            if (result.status !== circularBuffer_1.NextStatus.DATA) {
                console.error('[MessageExtractor] Failed to extract validated message');
                return null;
            }
            messageData[i] = result.value;
        }
        // Update statistics
        this.messagesExtracted[pattern.messageType]++;
        this.totalBytesExtracted += totalLength;
        // Create extracted message with Two-Tier metadata
        var extractedMessage = {
            type: pattern.messageType,
            data: messageData,
            timestamp: Date.now(),
            confidence: pattern.confidence,
            metadata: __assign(__assign({}, metadata), { validationStatus: validation.status, patternMatched: pattern.description })
        };
        // Log message classification for debugging (disabled in production)
        if (process.env.NODE_ENV === 'development' || process.env.DEBUG_CLASSIFICATION) {
            var preview = messageData.length > 0 ?
                "[".concat(Array.from(messageData.slice(0, Math.min(8, messageData.length))).map(function (b) { return '0x' + b.toString(16).padStart(2, '0'); }).join(' ')).concat(messageData.length > 8 ? '...' : '', "]") :
                '[empty]';
            console.log("[MessageExtractor] CLASSIFIED: ".concat(pattern.messageType, " - ").concat(messageData.length, " bytes - ").concat(preview));
        }
        return extractedMessage;
    };
    /**
     * Handle invalid patterns with warning routing
     */
    MessageExtractor.prototype.handleInvalidPattern = function (pattern, metadata, validation) {
        var _a;
        // For invalid COG IDs, route to Debug Logger with warning
        if (pattern.messageType === MessageType.COG_MESSAGE && ((_a = validation.warning) === null || _a === void 0 ? void 0 : _a.includes('Invalid COG ID'))) {
            // Consume the problematic message to CR
            var invalidData = this.consumeToTerminator(0x0D, 512);
            if (invalidData) {
                this.messagesExtracted[MessageType.INVALID_COG]++;
                this.totalBytesExtracted += invalidData.length;
                // Log message classification for debugging
                // Log invalid COG classification for debugging (disabled in production)
                if (process.env.NODE_ENV === 'development' || process.env.DEBUG_CLASSIFICATION) {
                    var preview = invalidData.length > 0 ?
                        "[".concat(Array.from(invalidData.slice(0, Math.min(8, invalidData.length))).map(function (b) { return '0x' + b.toString(16).padStart(2, '0'); }).join(' ')).concat(invalidData.length > 8 ? '...' : '', "]") :
                        '[empty]';
                    console.log("[MessageExtractor] CLASSIFIED: INVALID_COG - ".concat(invalidData.length, " bytes - ").concat(preview));
                }
                return {
                    type: MessageType.INVALID_COG,
                    data: invalidData,
                    timestamp: Date.now(),
                    confidence: 'DEFAULT',
                    metadata: __assign(__assign({}, metadata), { validationStatus: 'INVALID', warningMessage: validation.warning })
                };
            }
        }
        // For other invalid patterns, try extracting to terminal
        return this.extractTerminalOutput();
    };
    /**
     * Extract terminal output (default route - Terminal FIRST principle)
     * FIXED: Proper EOL handling for complete messages only
     */
    MessageExtractor.prototype.extractTerminalOutput = function () {
        // Look for complete line with proper EOL termination
        var terminalData = this.consumeToEOL(1024);
        // If no complete line found, return null to wait for more data
        if (!terminalData || terminalData.length === 0) {
            return null; // Wait for complete message
        }
        this.messagesExtracted[MessageType.TERMINAL_OUTPUT]++;
        this.totalBytesExtracted += terminalData.length;
        // Log message classification for debugging
        // Log terminal output classification for debugging (disabled in production) 
        if (process.env.NODE_ENV === 'development' || process.env.DEBUG_CLASSIFICATION) {
            var preview = terminalData.length > 0 ?
                "[".concat(Array.from(terminalData.slice(0, Math.min(8, terminalData.length))).map(function (b) { return '0x' + b.toString(16).padStart(2, '0'); }).join(' ')).concat(terminalData.length > 8 ? '...' : '', "]") :
                '[empty]';
            console.log("[MessageExtractor] CLASSIFIED: TERMINAL_OUTPUT (fallback) - ".concat(terminalData.length, " bytes - ").concat(preview));
        }
        return {
            type: MessageType.TERMINAL_OUTPUT,
            data: terminalData,
            timestamp: Date.now(),
            confidence: 'DEFAULT'
        };
    };
    /**
     * Consume remaining data up to limit (for terminal output when no terminator found)
     */
    MessageExtractor.prototype.consumeRemainingData = function (maxBytes) {
        var bytes = [];
        while (bytes.length < maxBytes && this.buffer.hasData()) {
            var result = this.buffer.next();
            if (result.status !== circularBuffer_1.NextStatus.DATA) {
                break;
            }
            bytes.push(result.value);
        }
        return bytes.length > 0 ? new Uint8Array(bytes) : null;
    };
    /**
     * FIXED: Consume complete line with proper EOL handling
     * Handles: CR, LF, CRLF, LFCR - returns null if no complete line found
     */
    MessageExtractor.prototype.consumeToEOL = function (maxBytes) {
        this.buffer.savePosition();
        var bytes = [];
        var foundEOL = false;
        // CRITICAL: Limit search to prevent scanning into binary COG packet data
        // ASCII messages in P2 debugger are typically under 50 bytes
        // COG packets immediately follow ASCII messages and contain 0x0A/0x0D bytes  
        // that are NOT EOL terminators - they're binary data that would confuse the parser
        // The COG1 packet has false 0x0A at position ~26, so we must stop before that
        var searchLimit = Math.min(maxBytes, 45); // Conservative limit - must find EOL within 45 bytes
        while (bytes.length < searchLimit && this.buffer.hasData()) {
            var result = this.buffer.next();
            if (result.status !== circularBuffer_1.NextStatus.DATA) {
                break;
            }
            bytes.push(result.value);
            // Check for EOL patterns
            if (result.value === 0x0D || result.value === 0x0A) { // CR or LF
                // Look ahead for CRLF or LFCR pattern
                if (this.buffer.hasData()) {
                    var nextResult = this.buffer.next();
                    if (nextResult.status === circularBuffer_1.NextStatus.DATA) {
                        var nextByte = nextResult.value;
                        // Check for two-character EOL patterns
                        if ((result.value === 0x0D && nextByte === 0x0A) || // CRLF
                            (result.value === 0x0A && nextByte === 0x0D)) { // LFCR
                            bytes.push(nextByte);
                        }
                        else {
                            // Single character EOL, put back the next byte
                            this.buffer.restorePosition();
                            // Re-extract up to the single EOL
                            this.buffer.savePosition();
                            var finalBytes = [];
                            for (var i = 0; i < bytes.length - 1; i++) {
                                var b = this.buffer.next();
                                if (b.status === circularBuffer_1.NextStatus.DATA)
                                    finalBytes.push(b.value);
                            }
                            // Add the single EOL character
                            var eol = this.buffer.next();
                            if (eol.status === circularBuffer_1.NextStatus.DATA)
                                finalBytes.push(eol.value);
                            return new Uint8Array(finalBytes);
                        }
                    }
                }
                foundEOL = true;
                break;
            }
        }
        if (foundEOL) {
            var result = new Uint8Array(bytes);
            return result;
        }
        else {
            // No complete line found within search limit, restore position and wait
            // This prevents scanning into binary COG packet data looking for false EOL patterns
            this.buffer.restorePosition();
            return null;
        }
    };
    /**
     * LEGACY: Consume bytes until terminator or limit
     */
    MessageExtractor.prototype.consumeToTerminator = function (terminator, maxBytes) {
        var bytes = [];
        while (bytes.length < maxBytes && this.buffer.hasData()) {
            var result = this.buffer.next();
            if (result.status !== circularBuffer_1.NextStatus.DATA) {
                break;
            }
            bytes.push(result.value);
            if (result.value === terminator) {
                break;
            }
        }
        return bytes.length > 0 ? new Uint8Array(bytes) : null;
    };
    /**
     * Get extraction statistics
     */
    MessageExtractor.prototype.getStats = function () {
        return {
            messagesExtracted: __assign({}, this.messagesExtracted),
            partialMessageWaits: this.partialMessageWaits,
            totalBytesExtracted: this.totalBytesExtracted,
            outputQueueStats: this.outputQueue.getStats()
        };
    };
    /**
     * Reset statistics
     */
    MessageExtractor.prototype.resetStats = function () {
        for (var key in this.messagesExtracted) {
            this.messagesExtracted[key] = 0;
        }
        this.partialMessageWaits = 0;
        this.totalBytesExtracted = 0;
    };
    /**
     * Get output queue reference
     */
    MessageExtractor.prototype.getOutputQueue = function () {
        return this.outputQueue;
    };
    return MessageExtractor;
}(events_1.EventEmitter));
exports.MessageExtractor = MessageExtractor;
