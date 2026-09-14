import { runTrial, type TrialInput } from './reliability';
import { samplePixels, type Pixels } from './colorSampling';
import { boardSize } from './boardGeometry';

self.onmessage = (event: MessageEvent<TrialInput & { pixels: Pixels }>) => {
    try {
        const input = event.data;
        if (![10, 20, 30].includes(input.count)) throw new Error('Choose 10, 20 or 30 trials.');
        for (let i = 0; i < input.count; i++) {
            const result = runTrial(input, i, (x, y) =>
                samplePixels(input.pixels, x, y, boardSize(input.mission.map))
            );
            self.postMessage({ result });
        }
        self.postMessage({ done: true });
    } catch (e) {
        self.postMessage({ error: e instanceof Error ? e.message : String(e) });
    }
};
