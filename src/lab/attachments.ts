export type ToolKind = 'none' | 'lift' | 'dozer' | 'paddle';
export type ToolConfig = {
    kind: ToolKind;
    facing: 'front' | 'rear';
    forward: number;
    side: number;
    height: number;
    length: number;
    width: number;
    drop: number;
    ratio: number;
    polarity: number;
    min: number;
    max: number;
    initial: number;
    mass: number;
    torque: number;
};
export type Attachments = Record<'C' | 'D', ToolConfig>;
export type ToolPart = {
    id: string;
    size: [number, number, number];
    position: [number, number, number];
    angle: number;
    color: string;
};
export function toolPreset(kind: ToolKind): ToolConfig {
    const common = {
        kind,
        facing: 'front' as const,
        forward: 75,
        side: 0,
        height: 105,
        length: 185,
        width: 24,
        drop: 96,
        ratio: 3,
        polarity: 1,
        min: 0,
        max: 110,
        initial: 15,
        mass: 0.09,
        torque: 0.2
    };
    if (kind === 'dozer')
        return {
            ...common,
            facing: 'rear',
            forward: -75,
            length: 170,
            width: 120,
            drop: 75,
            height: 105,
            max: 95,
            initial: 45,
            mass: 0.16
        };
    if (kind === 'paddle')
        return {
            ...common,
            forward: 90,
            height: 25,
            length: 120,
            width: 80,
            drop: 0,
            ratio: 1,
            min: -5,
            max: 110,
            initial: 0,
            mass: 0.12,
            torque: 0.4375
        };
    return common;
}
export const adbAttachments: Attachments = { C: toolPreset('dozer'), D: toolPreset('lift') };
export const legacyAttachments: Attachments = { C: toolPreset('paddle'), D: toolPreset('none') };
export function validateAttachments(tools: Attachments) {
    if (!tools?.C || !tools?.D) throw new Error('Configure both attachment ports C and D.');
    for (const c of Object.values(tools)) {
        if (
            !['none', 'lift', 'dozer', 'paddle'].includes(c.kind) ||
            !['front', 'rear'].includes(c.facing)
        )
            throw new Error('Unknown attachment type or facing.');
        for (const key of [
            'forward',
            'side',
            'height',
            'length',
            'width',
            'drop',
            'ratio',
            'polarity',
            'min',
            'max',
            'initial',
            'mass',
            'torque'
        ] as const)
            if (!Number.isFinite(c[key]))
                throw new Error('Attachment settings must be finite numbers.');
        if (
            Math.abs(c.forward) > 200 ||
            Math.abs(c.side) > 150 ||
            c.height < 10 ||
            c.height > 250 ||
            c.length < 30 ||
            c.length > 400 ||
            c.width < 8 ||
            c.width > 300 ||
            c.drop < 0 ||
            c.drop > 250 ||
            c.ratio < 0.25 ||
            c.ratio > 20 ||
            ![-1, 1].includes(c.polarity) ||
            c.min < -90 ||
            c.max > 170 ||
            c.max <= c.min ||
            c.initial < c.min ||
            c.initial > c.max ||
            c.mass < 0.01 ||
            c.mass > 1 ||
            c.torque < 0.01 ||
            c.torque > 1
        )
            throw new Error(
                'Attachment geometry, gearing or limits are outside the supported range.'
            );
    }
}
// Shared solid geometry for rendering AND collision. Dimensions are adjustable estimates
// from LEGO's Dozer Blade / Lift Arm instructions; the gearing remains configurable.
export function toolParts(c: ToolConfig): ToolPart[] {
    if (c.kind === 'none') return [];
    const parts: ToolPart[] = [];
    const add = (
        id: string,
        size: ToolPart['size'],
        position: ToolPart['position'],
        color: string,
        angle = 0
    ) => parts.push({ id, size, position, color, angle });
    const beam = (id: string, x: number, a: [number, number], b: [number, number], width = 8) => {
        const dy = b[0] - a[0],
            dz = b[1] - a[1];
        add(
            id,
            [width, 8, Math.hypot(dy, dz)],
            [x, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
            '#27333a',
            Math.atan2(dy, -dz)
        );
    };
    if (c.kind === 'paddle') add('plate', [c.width, 8, c.length], [0, 0, -c.length / 2], '#ffc84a');
    if (c.kind === 'lift') {
        for (const [i, x] of [-c.width / 2 + 4, c.width / 2 - 4].entries()) {
            beam(`upper-${i}`, x, [0, 0], [-c.drop * 0.35, -c.length * 0.4]);
            beam(`elbow-${i}`, x, [-c.drop * 0.35, -c.length * 0.4], [-c.drop, -c.length * 0.72]);
            beam(`finger-${i}`, x, [-c.drop, -c.length * 0.72], [-c.drop, -c.length]);
        }
        add('tip', [c.width, 6, 20], [0, -c.drop, -c.length + 10], '#27333a');
    }
    if (c.kind === 'dozer') {
        // Segmented curved supports reproduce the arched outline without a decorative-only mesh.
        const points: [number, number][] = [
            [0, 0],
            [12, -c.length * 0.25],
            [0, -c.length * 0.55],
            [-c.drop * 0.45, -c.length * 0.85],
            [-c.drop, -c.length]
        ];
        for (const [side, x] of [-c.width / 2 + 4, c.width / 2 - 4].entries())
            for (let i = 0; i < points.length - 1; i++)
                beam(`arch-${side}-${i}`, x, points[i], points[i + 1]);
        add('blade', [c.width, 45, 8], [0, -c.drop + 18, -c.length], '#66c5e5');
        add('blade-edge', [c.width, 8, 16], [0, -c.drop - 3, -c.length + 4], '#a33287');
    }
    return parts;
}
