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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.COGLogExporter = void 0;
// src/classes/shared/cogLogExporter.ts
var fs = require("fs");
var path = require("path");
var events_1 = require("events");
/**
 * COGLogExporter - Exports COG-separated debug logs
 *
 * Features:
 * - Saves all 8 COG logs alongside main debug log
 * - Uses naming convention: mainlog.cog.0.log through mainlog.cog.7.log
 * - Handles empty COGs with informative header
 * - Single action exports all COGs
 */
var COGLogExporter = /** @class */ (function (_super) {
    __extends(COGLogExporter, _super);
    function COGLogExporter() {
        var _this = _super.call(this) || this;
        _this.mainLogPath = null;
        _this.cogBuffers = new Map();
        _this.cogMetadata = new Map();
        // Initialize buffers for all 8 COGs
        for (var i = 0; i < 8; i++) {
            _this.cogBuffers.set(i, []);
            _this.cogMetadata.set(i, {
                cogId: i,
                messages: [],
                hasTraffic: false,
                messageCount: 0
            });
        }
        return _this;
    }
    /**
     * Set the main log file path (needed for naming COG logs)
     */
    COGLogExporter.prototype.setMainLogPath = function (logPath) {
        this.mainLogPath = logPath;
    };
    /**
     * Add message to COG buffer
     */
    COGLogExporter.prototype.addCOGMessage = function (cogId, message) {
        if (cogId < 0 || cogId > 7)
            return;
        var buffer = this.cogBuffers.get(cogId);
        buffer.push(message);
        var metadata = this.cogMetadata.get(cogId);
        metadata.messages.push(message);
        metadata.hasTraffic = true;
        metadata.messageCount++;
        var now = new Date();
        if (!metadata.firstMessageTime) {
            metadata.firstMessageTime = now;
        }
        metadata.lastMessageTime = now;
    };
    /**
     * Export all COG logs to files (only COGs with traffic)
     */
    COGLogExporter.prototype.exportAllCOGLogs = function () {
        return __awaiter(this, void 0, void 0, function () {
            var filesCreated, baseDir, baseName, cogId, metadata, cogLogPath, content, error_1, errorMsg;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.mainLogPath) {
                            return [2 /*return*/, {
                                    success: false,
                                    filesCreated: [],
                                    baseLogPath: '',
                                    error: 'Main log path not set - cannot determine output location'
                                }];
                        }
                        filesCreated = [];
                        baseDir = path.dirname(this.mainLogPath);
                        baseName = path.basename(this.mainLogPath, '.log');
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 6, , 7]);
                        cogId = 0;
                        _a.label = 2;
                    case 2:
                        if (!(cogId < 8)) return [3 /*break*/, 5];
                        metadata = this.cogMetadata.get(cogId);
                        // Skip empty COGs - no point creating empty files
                        if (!metadata.hasTraffic || metadata.messageCount === 0) {
                            return [3 /*break*/, 4];
                        }
                        cogLogPath = path.join(baseDir, "".concat(baseName, "-cog").concat(cogId, ".log"));
                        content = this.generateCOGLogContent(cogId);
                        return [4 /*yield*/, fs.promises.writeFile(cogLogPath, content, 'utf8')];
                    case 3:
                        _a.sent();
                        filesCreated.push(cogLogPath);
                        _a.label = 4;
                    case 4:
                        cogId++;
                        return [3 /*break*/, 2];
                    case 5:
                        // Emit success event
                        this.emit('exportComplete', {
                            filesCreated: filesCreated,
                            totalMessages: this.getTotalMessageCount(),
                            timestamp: new Date()
                        });
                        return [2 /*return*/, {
                                success: true,
                                filesCreated: filesCreated,
                                baseLogPath: this.mainLogPath
                            }];
                    case 6:
                        error_1 = _a.sent();
                        errorMsg = error_1 instanceof Error ? error_1.message : 'Unknown error';
                        this.emit('exportError', {
                            error: errorMsg,
                            timestamp: new Date()
                        });
                        return [2 /*return*/, {
                                success: false,
                                filesCreated: filesCreated,
                                baseLogPath: this.mainLogPath,
                                error: errorMsg
                            }];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Generate content for a COG log file
     */
    COGLogExporter.prototype.generateCOGLogContent = function (cogId) {
        var metadata = this.cogMetadata.get(cogId);
        var buffer = this.cogBuffers.get(cogId);
        var lines = [];
        // Add header
        lines.push('='.repeat(80));
        lines.push("COG ".concat(cogId, " Debug Log"));
        lines.push("Generated: ".concat(new Date().toISOString()));
        lines.push("Main Log: ".concat(this.mainLogPath ? path.basename(this.mainLogPath) : 'Unknown'));
        lines.push('='.repeat(80));
        lines.push('');
        // Handle empty COG
        if (!metadata.hasTraffic || buffer.length === 0) {
            lines.push("COG ".concat(cogId, " - No traffic received during this session"));
            lines.push('');
            lines.push('This COG did not send any debug messages during the logging period.');
            lines.push('If you expected traffic from this COG, verify:');
            lines.push('  1. The COG is running debug code');
            lines.push('  2. Debug output is enabled for this COG');
            lines.push('  3. The COG ID is correctly configured');
        }
        else {
            // Add statistics
            lines.push("Message Count: ".concat(metadata.messageCount));
            if (metadata.firstMessageTime) {
                lines.push("First Message: ".concat(metadata.firstMessageTime.toISOString()));
            }
            if (metadata.lastMessageTime) {
                lines.push("Last Message: ".concat(metadata.lastMessageTime.toISOString()));
            }
            lines.push('');
            lines.push('-'.repeat(80));
            lines.push('');
            // Add all messages
            for (var _i = 0, buffer_1 = buffer; _i < buffer_1.length; _i++) {
                var message = buffer_1[_i];
                lines.push(message);
            }
        }
        lines.push('');
        lines.push('='.repeat(80));
        lines.push('End of COG ' + cogId + ' Log');
        lines.push('='.repeat(80));
        return lines.join('\n');
    };
    /**
     * Get total message count across all COGs
     */
    COGLogExporter.prototype.getTotalMessageCount = function () {
        var total = 0;
        for (var _i = 0, _a = this.cogMetadata.values(); _i < _a.length; _i++) {
            var metadata = _a[_i];
            total += metadata.messageCount;
        }
        return total;
    };
    /**
     * Clear all COG buffers
     */
    COGLogExporter.prototype.clearAll = function () {
        for (var i = 0; i < 8; i++) {
            this.cogBuffers.set(i, []);
            this.cogMetadata.set(i, {
                cogId: i,
                messages: [],
                hasTraffic: false,
                messageCount: 0
            });
        }
    };
    /**
     * Get statistics for display
     */
    COGLogExporter.prototype.getStatistics = function () {
        var stats = {
            mainLogPath: this.mainLogPath,
            totalMessages: this.getTotalMessageCount(),
            cogsWithTraffic: 0,
            cogDetails: []
        };
        for (var _i = 0, _a = this.cogMetadata; _i < _a.length; _i++) {
            var _b = _a[_i], cogId = _b[0], metadata = _b[1];
            if (metadata.hasTraffic) {
                stats.cogsWithTraffic++;
            }
            stats.cogDetails.push({
                cogId: cogId,
                messageCount: metadata.messageCount,
                hasTraffic: metadata.hasTraffic,
                bufferSize: this.cogBuffers.get(cogId).length
            });
        }
        return stats;
    };
    /**
     * Generate export summary for notification
     */
    COGLogExporter.prototype.generateExportSummary = function (result) {
        if (!result.success) {
            return "Failed to export COG logs: ".concat(result.error);
        }
        var stats = this.getStatistics();
        var baseName = path.basename(this.mainLogPath || 'logs');
        if (stats.cogsWithTraffic === 0) {
            return "No COG logs to export - no COGs received traffic";
        }
        // Extract COG IDs from created files
        var cogIds = [];
        for (var _i = 0, _a = result.filesCreated; _i < _a.length; _i++) {
            var filePath = _a[_i];
            var match = path.basename(filePath).match(/-cog(\d)\.log$/);
            if (match) {
                cogIds.push(parseInt(match[1], 10));
            }
        }
        if (cogIds.length === 1) {
            return "Exported COG ".concat(cogIds[0], " log (").concat(stats.totalMessages, " messages) alongside ").concat(baseName);
        }
        else if (cogIds.length === 8) {
            return "Exported all 8 COG logs (".concat(stats.totalMessages, " total messages) alongside ").concat(baseName);
        }
        else {
            var cogList = cogIds.join(', ');
            return "Exported ".concat(cogIds.length, " COG logs (COGs ").concat(cogList, ") alongside ").concat(baseName);
        }
    };
    return COGLogExporter;
}(events_1.EventEmitter));
exports.COGLogExporter = COGLogExporter;
