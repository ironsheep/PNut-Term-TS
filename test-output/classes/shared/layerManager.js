/** @format */
'use strict';
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
exports.LayerManager = void 0;
// src/classes/shared/layerManager.ts
var fs = require("fs/promises");
var path = require("path");
var LayerManager = /** @class */ (function () {
    function LayerManager() {
        // Initialize array with null values for 8 layers
        this.layers = new Array(LayerManager.MAX_LAYERS).fill(null);
    }
    /**
     * Load a bitmap file into the specified layer
     * @param index Layer index (0-7)
     * @param filepath Path to the bitmap file
     * @throws Error if index is out of bounds or file cannot be loaded
     */
    LayerManager.prototype.loadLayer = function (index, filepath) {
        return __awaiter(this, void 0, void 0, function () {
            var ext, supportedFormats, buffer, blob, imageBitmap, canvas, ctx, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // Validate layer index
                        if (index < 0 || index >= LayerManager.MAX_LAYERS) {
                            throw new Error("Layer index must be between 0 and ".concat(LayerManager.MAX_LAYERS - 1));
                        }
                        ext = path.extname(filepath).toLowerCase();
                        supportedFormats = ['.bmp', '.png', '.jpg', '.jpeg', '.gif'];
                        if (!supportedFormats.includes(ext)) {
                            throw new Error("Unsupported file format: ".concat(ext, ". Supported formats: ").concat(supportedFormats.join(', ')));
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 5, , 6]);
                        // Check if file exists
                        return [4 /*yield*/, fs.access(filepath)];
                    case 2:
                        // Check if file exists
                        _a.sent();
                        return [4 /*yield*/, fs.readFile(filepath)];
                    case 3:
                        buffer = _a.sent();
                        blob = new Blob([new Uint8Array(buffer)]);
                        return [4 /*yield*/, createImageBitmap(blob)];
                    case 4:
                        imageBitmap = _a.sent();
                        canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
                        ctx = canvas.getContext('2d');
                        if (!ctx) {
                            throw new Error('Failed to get 2D context from OffscreenCanvas');
                        }
                        // Draw image to canvas
                        ctx.drawImage(imageBitmap, 0, 0);
                        // Clear any existing layer
                        if (this.layers[index]) {
                            this.layers[index] = null; // Let GC clean up the old canvas
                        }
                        // Store the new layer
                        this.layers[index] = canvas;
                        return [3 /*break*/, 6];
                    case 5:
                        error_1 = _a.sent();
                        if (error_1 instanceof Error) {
                            if (error_1.message.includes('ENOENT')) {
                                throw new Error("File not found: ".concat(filepath));
                            }
                            throw new Error("Failed to load image: ".concat(error_1.message));
                        }
                        throw error_1;
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Draw a layer to a target canvas context with optional cropping
     * @param ctx Target canvas rendering context
     * @param layerIndex Layer index (0-7)
     * @param sourceRect Optional source rectangle for cropping (null for AUTO mode)
     * @param destX Destination X coordinate (default: 0)
     * @param destY Destination Y coordinate (default: 0)
     * @throws Error if layer index is invalid or layer is not loaded
     */
    LayerManager.prototype.drawLayerToCanvas = function (ctx, layerIndex, sourceRect, destX, destY) {
        if (destX === void 0) { destX = 0; }
        if (destY === void 0) { destY = 0; }
        // Validate layer index
        if (layerIndex < 0 || layerIndex >= LayerManager.MAX_LAYERS) {
            throw new Error("Layer index must be between 0 and ".concat(LayerManager.MAX_LAYERS - 1));
        }
        // Check if layer is loaded
        var layer = this.layers[layerIndex];
        if (!layer) {
            throw new Error("Layer ".concat(layerIndex, " is not loaded"));
        }
        try {
            if (sourceRect) {
                // Manual crop mode with explicit source rectangle
                ctx.drawImage(layer, sourceRect.left, sourceRect.top, sourceRect.width, sourceRect.height, destX, destY, sourceRect.width, sourceRect.height);
            }
            else {
                // AUTO mode - use full layer dimensions
                ctx.drawImage(layer, destX, destY);
            }
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error("Failed to draw layer: ".concat(error.message));
            }
            throw error;
        }
    };
    /**
     * Get the dimensions of a loaded layer
     * @param layerIndex Layer index (0-7)
     * @returns Object with width and height, or null if layer not loaded
     */
    LayerManager.prototype.getLayerDimensions = function (layerIndex) {
        if (layerIndex < 0 || layerIndex >= LayerManager.MAX_LAYERS) {
            return null;
        }
        var layer = this.layers[layerIndex];
        if (!layer) {
            return null;
        }
        return {
            width: layer.width,
            height: layer.height
        };
    };
    /**
     * Clear a specific layer
     * @param layerIndex Layer index (0-7)
     */
    LayerManager.prototype.clearLayer = function (layerIndex) {
        if (layerIndex >= 0 && layerIndex < LayerManager.MAX_LAYERS) {
            this.layers[layerIndex] = null;
        }
    };
    /**
     * Clear all layers
     */
    LayerManager.prototype.clearAllLayers = function () {
        this.layers.fill(null);
    };
    /**
     * Check if a layer is loaded
     * @param layerIndex Layer index (0-7)
     * @returns true if layer is loaded, false otherwise
     */
    LayerManager.prototype.isLayerLoaded = function (layerIndex) {
        if (layerIndex < 0 || layerIndex >= LayerManager.MAX_LAYERS) {
            return false;
        }
        return this.layers[layerIndex] !== null;
    };
    LayerManager.MAX_LAYERS = 8;
    return LayerManager;
}());
exports.LayerManager = LayerManager;
