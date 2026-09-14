import { boardSize } from './boardGeometry.ts';
import type { Pixels } from './colorSampling.ts';

// World millimeters; two continuous 40 mm black lines, well clear of the wall pieces.
export const practiceLines = [
    {
        points: [
            [-9000, 800],
            [9000, 800]
        ],
        width: 40
    },
    {
        points: [
            [-5000, -4500],
            [-5000, 3500],
            [3000, 3500]
        ],
        width: 40
    }
];
export const practiceGridSpacing = 500;
export function makePracticeField(): Pixels {
    // Bounded raster size: enlarging the field must not allocate a 23k × 11k texture.
    const width = 4096,
        { width: worldWidth, height: worldHeight } = boardSize('practice');
    const height = Math.round((width * worldHeight) / worldWidth);
    const data = new Uint8ClampedArray(width * height * 4);
    for (let py = 0; py < height; py++) {
        const y = (0.5 - py / (height - 1)) * worldHeight;
        for (let px = 0; px < width; px++) {
            const x = (px / (width - 1) - 0.5) * worldWidth;
            const grid =
                Math.abs(x - Math.round(x / practiceGridSpacing) * practiceGridSpacing) < 4 ||
                Math.abs(y - Math.round(y / practiceGridSpacing) * practiceGridSpacing) < 4;
            const i = (py * width + px) * 4;
            data[i] = grid ? 218 : 248;
            data[i + 1] = grid ? 226 : 250;
            data[i + 2] = grid ? 235 : 252;
            data[i + 3] = 255;
        }
    }
    // Rasterize only each segment's bounding rectangle (no full-image distance loops).
    for (const line of practiceLines)
        for (let i = 1; i < line.points.length; i++) {
            const [ax, ay] = line.points[i - 1],
                [bx, by] = line.points[i],
                r = line.width / 2;
            const left = Math.max(
                0,
                Math.ceil(((Math.min(ax, bx) - r) / worldWidth + 0.5) * (width - 1))
            );
            const right = Math.min(
                width - 1,
                Math.floor(((Math.max(ax, bx) + r) / worldWidth + 0.5) * (width - 1))
            );
            const top = Math.max(
                0,
                Math.ceil((0.5 - (Math.max(ay, by) + r) / worldHeight) * (height - 1))
            );
            const bottom = Math.min(
                height - 1,
                Math.floor((0.5 - (Math.min(ay, by) - r) / worldHeight) * (height - 1))
            );
            for (let py = top; py <= bottom; py++)
                for (let px = left; px <= right; px++) {
                    const at = (py * width + px) * 4;
                    data[at] = 25;
                    data[at + 1] = 30;
                    data[at + 2] = 36;
                }
        }
    return { width, height, data };
}
