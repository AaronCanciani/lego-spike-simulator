// Shared by the rendered field and headless tests: never substitute color IDs
// directly for pixel classification in end-to-end color tests.
export type Pixels = { width: number; height: number; data: Uint8ClampedArray };
export function classifyRgb(r: number, g: number, b: number) {
    const high = Math.max(r, g, b),
        low = Math.min(r, g, b);
    let color = -1;
    if (high < 65) color = 0;
    else if (high - low < 35) color = high < 170 ? -1 : 10;
    else if (r > g * 1.3 && b > g * 1.3) color = 1;
    else if (g >= b * 0.75 && b >= g * 0.8 && r < g * 0.8) color = 4;
    else if (b > r * 1.15 && b > g * 1.05) color = 3;
    else if (r > g * 1.35 && r > b * 1.25) color = 9;
    else if (r > 150 && g > 125 && b < g * 0.7) color = 7;
    else if (g > r * 1.1 && g > b * 1.05) color = 6;
    else if (b > r && g > r) color = 4;
    return { color, reflection: Math.round(((r * 0.2126 + g * 0.7152 + b * 0.0722) / 255) * 100) };
}
export function samplePixels(
    pixels: Pixels,
    x: number,
    y: number,
    bounds = { width: 2362, height: 1143 }
) {
    const px = Math.round((x / bounds.width + 0.5) * (pixels.width - 1));
    const py = Math.round((0.5 - y / bounds.height) * (pixels.height - 1));
    if (px < 0 || py < 0 || px >= pixels.width || py >= pixels.height)
        return { color: -1, reflection: 0 };
    let r = 0,
        g = 0,
        b = 0;
    for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++) {
            const ix = Math.max(0, Math.min(pixels.width - 1, px + dx));
            const iy = Math.max(0, Math.min(pixels.height - 1, py + dy));
            const i = (iy * pixels.width + ix) * 4;
            r += pixels.data[i];
            g += pixels.data[i + 1];
            b += pixels.data[i + 2];
        }
    return classifyRgb(r / 9, g / 9, b / 9);
}
