import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Optional, local-only reference asset. Do not commit or redistribute the model
// until model-level and LDraw-part permissions have been verified.
const source = 'https://ahfiles.s3.amazonaws.com/robots/DrivingBase3.mpd';
const expected = 'f9cf37808820863094a74fe92e3700ef20ae811440348f1e8e64ee891aa82a01';
const response = await fetch(source);
if (!response.ok) throw new Error(`Model download failed: ${response.status}`);
const data = Buffer.from(await response.arrayBuffer());
if (createHash('sha256').update(data).digest('hex') !== expected)
    throw new Error('Reference model changed; review before using it.');
const directory = new URL('../static/models/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL('DrivingBase3.mpd', directory), data);
console.log('Pinned reference model ready locally. It is not included in git.');
