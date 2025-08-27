/** @format */
'use strict';
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
exports.SpriteManager = void 0;
var SpriteManager = /** @class */ (function () {
    function SpriteManager() {
        // Initialize array with null values for 256 sprites
        this.sprites = new Array(SpriteManager.MAX_SPRITES).fill(null);
    }
    /**
     * Define a sprite with pixel data and color palette
     * @param id Sprite ID (0-255)
     * @param width Sprite width in pixels
     * @param height Sprite height in pixels
     * @param pixels Array of pixel indices into color palette
     * @param colors Array of 256 RGB24 color values
     * @throws Error if parameters are invalid
     */
    SpriteManager.prototype.defineSprite = function (id, width, height, pixels, colors) {
        // Validate sprite ID
        if (id < 0 || id >= SpriteManager.MAX_SPRITES) {
            throw new Error("Sprite ID must be between 0 and ".concat(SpriteManager.MAX_SPRITES - 1));
        }
        // Validate dimensions
        if (width <= 0 || height <= 0) {
            throw new Error('Sprite dimensions must be positive');
        }
        // Validate pixel data size
        var expectedPixels = width * height;
        if (pixels.length !== expectedPixels) {
            throw new Error("Expected ".concat(expectedPixels, " pixels, got ").concat(pixels.length));
        }
        // Validate color palette size
        if (colors.length !== 256) {
            throw new Error("Color palette must contain exactly 256 colors, got ".concat(colors.length));
        }
        // Validate pixel indices are within palette range
        for (var i = 0; i < pixels.length; i++) {
            if (pixels[i] < 0 || pixels[i] > 255) {
                throw new Error("Pixel index ".concat(pixels[i], " at position ").concat(i, " is out of range (0-255)"));
            }
        }
        // Store sprite definition
        this.sprites[id] = {
            width: width,
            height: height,
            pixels: __spreadArray([], pixels, true), // Copy arrays to prevent external modification
            colors: __spreadArray([], colors, true)
        };
    };
    /**
     * Draw a sprite to a canvas context with transformations
     * @param ctx Target canvas rendering context
     * @param id Sprite ID (0-255)
     * @param x X coordinate for sprite center
     * @param y Y coordinate for sprite center
     * @param orientation Rotation/flip mode (0-7)
     * @param scale Scale factor (1.0 = normal size)
     * @param opacity Opacity value (0-255, where 255 = fully opaque)
     * @throws Error if sprite not defined or parameters invalid
     */
    SpriteManager.prototype.drawSprite = function (ctx, id, x, y, orientation, scale, opacity) {
        if (orientation === void 0) { orientation = 0; }
        if (scale === void 0) { scale = 1.0; }
        if (opacity === void 0) { opacity = 255; }
        // Validate sprite ID
        if (id < 0 || id >= SpriteManager.MAX_SPRITES) {
            throw new Error("Sprite ID must be between 0 and ".concat(SpriteManager.MAX_SPRITES - 1));
        }
        // Get sprite definition
        var sprite = this.sprites[id];
        if (!sprite) {
            throw new Error("Sprite ".concat(id, " is not defined"));
        }
        // Validate orientation
        if (orientation < 0 || orientation > 7) {
            throw new Error('Orientation must be between 0 and 7');
        }
        // Validate scale
        if (scale <= 0) {
            throw new Error('Scale must be positive');
        }
        // Clamp opacity to valid range
        opacity = Math.max(0, Math.min(255, opacity));
        // Save context state
        ctx.save();
        try {
            // Apply transformations
            ctx.translate(x, y);
            // Apply orientation (0-7)
            // 0: 0° rotation
            // 1: 90° rotation
            // 2: 180° rotation
            // 3: 270° rotation
            // 4: 0° rotation + horizontal flip
            // 5: 90° rotation + horizontal flip
            // 6: 180° rotation + horizontal flip
            // 7: 270° rotation + horizontal flip
            var flipH = orientation >= 4;
            var rotation = (orientation % 4) * 90;
            if (flipH) {
                ctx.scale(-1, 1);
            }
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.scale(scale, scale);
            // Set opacity
            ctx.globalAlpha = opacity / 255;
            // Calculate drawing offset (sprite drawn from center)
            var halfWidth = sprite.width / 2;
            var halfHeight = sprite.height / 2;
            // Create temporary canvas for sprite rendering
            var tempCanvas = new OffscreenCanvas(sprite.width, sprite.height);
            var tempCtx = tempCanvas.getContext('2d');
            if (!tempCtx) {
                throw new Error('Failed to create temporary context for sprite rendering');
            }
            // Get image data for direct pixel manipulation
            var imageData = tempCtx.createImageData(sprite.width, sprite.height);
            var data = imageData.data;
            // Render sprite pixels using color palette
            for (var py = 0; py < sprite.height; py++) {
                for (var px = 0; px < sprite.width; px++) {
                    var pixelIndex = py * sprite.width + px;
                    var colorIndex = sprite.pixels[pixelIndex];
                    var rgb24 = sprite.colors[colorIndex];
                    // Extract RGB components from RGB24
                    var r = (rgb24 >> 16) & 0xFF;
                    var g = (rgb24 >> 8) & 0xFF;
                    var b = rgb24 & 0xFF;
                    // Set pixel in image data (RGBA format)
                    var dataIndex = pixelIndex * 4;
                    data[dataIndex] = r;
                    data[dataIndex + 1] = g;
                    data[dataIndex + 2] = b;
                    data[dataIndex + 3] = 255; // Full alpha in image data
                }
            }
            // Put image data to temporary canvas
            tempCtx.putImageData(imageData, 0, 0);
            // Draw temporary canvas to main context
            ctx.drawImage(tempCanvas, -halfWidth, -halfHeight);
        }
        finally {
            // Restore context state
            ctx.restore();
        }
    };
    /**
     * Clear a specific sprite definition
     * @param id Sprite ID (0-255)
     */
    SpriteManager.prototype.clearSprite = function (id) {
        if (id >= 0 && id < SpriteManager.MAX_SPRITES) {
            this.sprites[id] = null;
        }
    };
    /**
     * Clear all sprite definitions
     */
    SpriteManager.prototype.clearAllSprites = function () {
        this.sprites.fill(null);
    };
    /**
     * Check if a sprite is defined
     * @param id Sprite ID (0-255)
     * @returns true if sprite is defined, false otherwise
     */
    SpriteManager.prototype.isSpriteDefine = function (id) {
        if (id < 0 || id >= SpriteManager.MAX_SPRITES) {
            return false;
        }
        return this.sprites[id] !== null;
    };
    /**
     * Get sprite dimensions
     * @param id Sprite ID (0-255)
     * @returns Object with width and height, or null if sprite not defined
     */
    SpriteManager.prototype.getSpriteDimensions = function (id) {
        if (id < 0 || id >= SpriteManager.MAX_SPRITES) {
            return null;
        }
        var sprite = this.sprites[id];
        if (!sprite) {
            return null;
        }
        return {
            width: sprite.width,
            height: sprite.height
        };
    };
    SpriteManager.MAX_SPRITES = 256;
    return SpriteManager;
}());
exports.SpriteManager = SpriteManager;
