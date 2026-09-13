import type { Pixels } from './colorSampling.ts';

// Synthetic training mat, not a historical FLL mission or surveyed geometry.
export const courseStart = {
    red: { x: -455, y: -350, heading: 0 },
    blue: { x: -455, y: -350, heading: 0 },
    line: { x: 57, y: -450, heading: 0 }
};
export function lineCenter(y: number) {
    return 40 * (1 - Math.cos(((y + 350) / 700) * 2 * Math.PI));
}
export function makeSensorCourse(markerShift = 0): Pixels {
    const width = 1600,
        height = 800,
        data = new Uint8ClampedArray(width * height * 4);
    for (let py = 0; py < height; py++)
        for (let px = 0; px < width; px++) {
            const x = (px / (width - 1) - 0.5) * 2362;
            const y = (0.5 - py / (height - 1)) * 1143;
            let rgb = [248, 250, 252];
            if (Math.abs(x - lineCenter(y)) <= 12 && y >= -400 && y <= 350) rgb = [25, 25, 25];
            // Two distinct color targets: a red-seeking robot must ignore the blue one.
            if (x >= -650 && x <= -280) {
                if (y >= -50 + markerShift && y <= -15 + markerShift) rgb = [30, 90, 168];
                if (y >= 220 + markerShift && y <= 255 + markerShift) rgb = [180, 0, 0];
            }
            if (x >= -20 && x <= 60 && y >= 270 && y <= 305) rgb = [180, 0, 0];
            const i = (py * width + px) * 4;
            data[i] = rgb[0];
            data[i + 1] = rgb[1];
            data[i + 2] = rgb[2];
            data[i + 3] = 255;
        }
    return { width, height, data };
}
