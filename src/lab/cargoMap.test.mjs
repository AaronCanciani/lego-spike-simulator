import test from 'node:test';
import assert from 'node:assert/strict';
import { drawCargoMap, cargoMissionMap } from './cargoMap.ts';
import { ManipulationWorld, defaultLift } from './manipulation.ts';
import { classifyRgb } from './colorSampling.ts';
// Capture canvas draw operations to verify mission/map alignment without a DOM.
function artwork() {
    const rects = [],
        labels = [];
    const context = {
        canvas: { width: 2362, height: 1143 },
        save() {},
        restore() {},
        scale(x, y) {
            assert.equal(x, 1);
            assert.equal(y, 1);
        },
        fillRect(x, y, w, h) {
            rects.push({ x, y, w, h, color: this.fillStyle });
        },
        fillText(text) {
            labels.push(text);
        }
    };
    drawCargoMap(context);
    const at = ({ x, y }) =>
        rects.findLast(
            (r) =>
                x + 1181 >= r.x &&
                x + 1181 <= r.x + r.w &&
                571.5 - y >= r.y &&
                571.5 - y <= r.y + r.h
        ).color;
    return { at, labels };
}
test('mission artwork aligns start, physical pickup and scored delivery zone', () => {
    const { at, labels } = artwork();
    assert.equal(at(cargoMissionMap.start), '#d8e9f5');
    assert.equal(at(cargoMissionMap.pickup), '#faf1d8');
    assert.equal(at(cargoMissionMap.delivery), '#c6ead9');
    const world = new ManipulationWorld(cargoMissionMap.start, defaultLift);
    assert.equal(world.cube.position.x * 1000, cargoMissionMap.pickup.x);
    assert.equal(-world.cube.position.z * 1000, cargoMissionMap.pickup.y);
    assert.ok(labels.includes('01  START'));
    assert.ok(labels.includes('03  DELIVERY DOCK'));
});
test('printed guide is actually black in the color classifier, distinct from dock paving', () => {
    const { at } = artwork();
    const classify = (p) => {
        const hex = at(p);
        return classifyRgb(...[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)));
    };
    assert.equal(classify({ x: -65, y: -190 }).color, 0);
    assert.ok(classify({ x: -65, y: -190 }).reflection < 15);
    assert.ok(classify({ x: 50, y: -190 }).reflection > 80);
});
