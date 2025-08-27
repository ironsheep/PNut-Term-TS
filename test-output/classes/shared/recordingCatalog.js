"use strict";
/** @format */
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordingCatalog = void 0;
// src/classes/shared/recordingCatalog.ts
var fs = require("fs");
var path = require("path");
/**
 * Recording catalog for managing recorded debug sessions
 */
var RecordingCatalog = /** @class */ (function () {
    function RecordingCatalog(basePath) {
        if (basePath === void 0) { basePath = path.join(process.cwd(), 'tests', 'recordings'); }
        this.catalog = [];
        this.catalogPath = path.join(basePath, 'catalog.json');
        // Ensure directory exists
        var dir = path.dirname(this.catalogPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        this.loadCatalog();
    }
    /**
     * Load catalog from disk
     */
    RecordingCatalog.prototype.loadCatalog = function () {
        if (fs.existsSync(this.catalogPath)) {
            try {
                var content = fs.readFileSync(this.catalogPath, 'utf-8');
                this.catalog = JSON.parse(content);
            }
            catch (error) {
                console.error('Failed to load catalog:', error);
                this.catalog = [];
            }
        }
        else {
            this.catalog = [];
            this.saveCatalog();
        }
    };
    /**
     * Save catalog to disk
     */
    RecordingCatalog.prototype.saveCatalog = function () {
        try {
            var content = JSON.stringify(this.catalog, null, 2);
            fs.writeFileSync(this.catalogPath, content, 'utf-8');
        }
        catch (error) {
            console.error('Failed to save catalog:', error);
        }
    };
    /**
     * Add a new recording to the catalog
     */
    RecordingCatalog.prototype.addRecording = function (entry) {
        // Remove any existing entry with same sessionId
        this.catalog = this.catalog.filter(function (e) { return e.sessionId !== entry.sessionId; });
        // Add new entry
        this.catalog.push(entry);
        // Sort by timestamp (newest first)
        this.catalog.sort(function (a, b) { return b.metadata.timestamp - a.metadata.timestamp; });
        this.saveCatalog();
    };
    /**
     * Update recording metadata after completion
     */
    RecordingCatalog.prototype.updateRecording = function (sessionId, updates) {
        var entry = this.catalog.find(function (e) { return e.sessionId === sessionId; });
        if (entry) {
            entry.metadata = __assign(__assign({}, entry.metadata), updates);
            this.saveCatalog();
        }
    };
    /**
     * Get all recordings
     */
    RecordingCatalog.prototype.getAllRecordings = function () {
        return __spreadArray([], this.catalog, true);
    };
    /**
     * Get recordings by tag
     */
    RecordingCatalog.prototype.getRecordingsByTag = function (tag) {
        return this.catalog.filter(function (e) { var _a; return (_a = e.metadata.tags) === null || _a === void 0 ? void 0 : _a.includes(tag); });
    };
    /**
     * Get recordings by window type
     */
    RecordingCatalog.prototype.getRecordingsByWindowType = function (windowType) {
        return this.catalog.filter(function (e) { var _a; return (_a = e.metadata.windowTypes) === null || _a === void 0 ? void 0 : _a.includes(windowType); });
    };
    /**
     * Get recording by session ID
     */
    RecordingCatalog.prototype.getRecording = function (sessionId) {
        return this.catalog.find(function (e) { return e.sessionId === sessionId; });
    };
    /**
     * Delete a recording
     */
    RecordingCatalog.prototype.deleteRecording = function (sessionId) {
        var entry = this.catalog.find(function (e) { return e.sessionId === sessionId; });
        if (entry) {
            // Delete the file
            var filePath = path.join(path.dirname(this.catalogPath), 'sessions', entry.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            // Remove from catalog
            this.catalog = this.catalog.filter(function (e) { return e.sessionId !== sessionId; });
            this.saveCatalog();
            return true;
        }
        return false;
    };
    /**
     * Get recent recordings
     */
    RecordingCatalog.prototype.getRecentRecordings = function (limit) {
        if (limit === void 0) { limit = 10; }
        return this.catalog.slice(0, limit);
    };
    /**
     * Search recordings by description or name
     */
    RecordingCatalog.prototype.searchRecordings = function (query) {
        var lowerQuery = query.toLowerCase();
        return this.catalog.filter(function (e) {
            var _a, _b;
            return e.metadata.sessionName.toLowerCase().includes(lowerQuery) ||
                ((_a = e.metadata.description) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(lowerQuery)) ||
                ((_b = e.metadata.testScenario) === null || _b === void 0 ? void 0 : _b.toLowerCase().includes(lowerQuery));
        });
    };
    /**
     * Get total size of all recordings
     */
    RecordingCatalog.prototype.getTotalSize = function () {
        return this.catalog.reduce(function (sum, e) { return sum + (e.metadata.fileSize || 0); }, 0);
    };
    /**
     * Clean up old recordings
     */
    RecordingCatalog.prototype.cleanupOldRecordings = function (daysToKeep) {
        if (daysToKeep === void 0) { daysToKeep = 30; }
        var cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
        var toDelete = this.catalog.filter(function (e) { return e.metadata.timestamp < cutoffTime; });
        var deleted = 0;
        for (var _i = 0, toDelete_1 = toDelete; _i < toDelete_1.length; _i++) {
            var entry = toDelete_1[_i];
            if (this.deleteRecording(entry.sessionId)) {
                deleted++;
            }
        }
        return deleted;
    };
    /**
     * Export catalog to CSV
     */
    RecordingCatalog.prototype.exportToCSV = function () {
        var headers = ['Session ID', 'Name', 'Description', 'Date', 'Duration (ms)', 'Messages', 'Size (bytes)', 'Window Types'];
        var rows = this.catalog.map(function (e) {
            var _a;
            return [
                e.sessionId,
                e.metadata.sessionName,
                e.metadata.description || '',
                new Date(e.metadata.timestamp).toISOString(),
                e.metadata.duration || '',
                e.metadata.messageCount || '',
                e.metadata.fileSize || '',
                ((_a = e.metadata.windowTypes) === null || _a === void 0 ? void 0 : _a.join(';')) || ''
            ];
        });
        return __spreadArray([headers], rows, true).map(function (row) { return row.map(function (cell) { return "\"".concat(cell, "\""); }).join(','); }).join('\n');
    };
    return RecordingCatalog;
}());
exports.RecordingCatalog = RecordingCatalog;
