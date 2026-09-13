import { cargoPickup, deliveryZone, liftStart } from './manipulation.ts';

// Original printable-style mission artwork: no FIRST/LEGO imagery is included.
export const cargoMissionMap = {
    id: 'cargo-harbor',
    title: 'Cargo Harbor · delivery mission',
    start: liftStart,
    pickup: cargoPickup,
    delivery: deliveryZone,
    brief: 'Start in blue. Pick up the orange cargo with motor C. Set it down fully inside the green dock, then back away.'
};

export function drawCargoMap(ctx: CanvasRenderingContext2D) {
    const width = ctx.canvas.width,
        height = ctx.canvas.height;
    ctx.save();
    ctx.scale(width / 2362, height / 1143);
    const point = (x: number, y: number) => [x + 1181, 571.5 - y];
    const rect = (x: number, y: number, w: number, h: number, color: string) => {
        const [px, py] = point(x, y);
        ctx.fillStyle = color;
        ctx.fillRect(px - w / 2, py - h / 2, w, h);
    };
    const text = (value: string, x: number, y: number, size: number, color: string) => {
        const [px, py] = point(x, y);
        ctx.fillStyle = color;
        ctx.font = `700 ${size}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(value, px, py);
    };
    rect(0, 0, 2362, 1143, '#142d44');
    // Water markings and printed berths are decoration, not physical obstacles.
    for (let y = -470; y <= 470; y += 70) {
        for (const x of [-820, 820]) rect(x, y, 370, 3, '#264b66');
    }
    rect(0, -25, 820, 1000, '#edf2ee');
    for (let x = -350; x <= 350; x += 100) rect(x, -25, 1.5, 970, '#d4ddd8');
    for (let y = -475; y <= 425; y += 100) rect(0, y, 790, 1.5, '#d4ddd8');
    for (const x of [-405, 405]) {
        rect(x, -25, 12, 1000, '#f4c64e');
        for (let y = -480; y <= 430; y += 40) rect(x, y, 12, 16, '#243b48');
    }
    text('CARGO', -780, 200, 92, '#b9d9e6');
    text('HARBOR', -780, 95, 92, '#b9d9e6');
    text('MISSION 01', -780, -35, 32, '#f4c64e');
    text('ORIGINAL TRAINING FIELD', -780, -110, 21, '#89afc1');
    text('PICK UP', 780, 180, 40, '#b9d9e6');
    text('CARRY', 780, 75, 40, '#b9d9e6');
    text('DELIVER', 780, -30, 40, '#f4c64e');
    text('Printed docks are not obstacles', 780, -180, 20, '#89afc1');
    // A real black printed guide for future sensor-guided programs, not hidden navigation.
    rect(-65, -80, 18, 330, '#191919');
    rect(liftStart.x, liftStart.y, 290, 190, '#3177b5');
    rect(liftStart.x, liftStart.y, 270, 170, '#d8e9f5');
    text('01  START', 0, -425, 24, '#244d73');
    text('↑', 0, -295, 46, '#244d73');
    rect(cargoPickup.x, cargoPickup.y, 120, 120, '#f3cb7e');
    rect(cargoPickup.x, cargoPickup.y, 106, 106, '#faf1d8');
    text('02  PICKUP', 235, -85, 25, '#795521');
    const d = deliveryZone;
    rect(d.x, d.y, d.width + 14, d.depth + 14, '#229575');
    rect(d.x, d.y, d.width, d.depth, '#c6ead9');
    text('03  DELIVERY DOCK', 0, 300, 27, '#17684f');
    text('Set cargo down, then clear the forks', 0, 350, 19, '#416556');
    text('SPIKE LAB  /  2362 × 1143 mm', 0, -505, 18, '#61736b');
    ctx.restore();
}
