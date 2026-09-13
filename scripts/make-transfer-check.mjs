// Creates disposable, non-personal transfer fixtures for opening in LEGO's app.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exportLego } from '../src/lab/legoTransfer.ts';
import { missionProgram } from '../src/lab/missionPrograms.ts';
const folder = mkdtempSync(join(tmpdir(), 'spike-transfer-'));
writeFileSync(
    join(folder, 'Transfer check.llsp3'),
    await exportLego(missionProgram('wall'), 'Transfer check')
);
console.log(folder);
