import { Engine, type Profile, type Project } from './engine.ts';
import type { MissionDefinition } from './missionCatalog.ts';
import type { Pose, Surface } from './sensors.ts';
import type { Attachments } from './attachments.ts';

export type TrialInput = {
    project: Project;
    profile: Profile;
    start: Pose;
    mission: MissionDefinition;
    count: number;
    attachments?: Attachments;
};
export type TrialResult = {
    index: number;
    seed: number;
    success: boolean;
    reason: string;
    seconds: number;
    progress: number;
    profile: Profile;
    start: Pose;
    friction: number;
    attachments?: Attachments;
};
export function trialConditions(input: TrialInput, index: number) {
    const profile = structuredClone(input.profile);
    let randomState = (profile.seed + Math.imul(index + 1, 104729)) >>> 0;
    const seed = randomState;
    const random = () => {
        randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
        return (randomState / 4294967296) * 2 - 1;
    };
    profile.seed = seed;
    const start = {
        x: input.start.x + random() * 10,
        y: input.start.y + random() * 10,
        heading: input.start.heading + random() * 3
    };
    profile.mismatch += random() * 1.5;
    profile.motorMismatch += random() * 0.8;
    profile.slip = Math.max(0, profile.slip + random() * 0.5);
    const friction = 0.45 + random() * 0.09;
    return { profile, start, friction, seed };
}
export function runTrial(
    input: TrialInput,
    index: number,
    colorAt: (x: number, y: number) => Surface
): TrialResult {
    const c = trialConditions(input, index);
    const engine = new Engine(
        input.project,
        c.profile,
        c.start,
        null,
        input.mission,
        c.friction,
        input.attachments
    );
    engine.colorAt = colorAt;
    engine.start();
    while (engine.state === 'running') engine.step();
    const result = engine.competition!;
    return {
        index: index + 1,
        ...c,
        attachments: input.attachments ? structuredClone(input.attachments) : undefined,
        success: engine.state === 'finished' && result.complete,
        reason:
            engine.error ||
            result.failed ||
            (result.complete ? 'Completed' : 'Program ended before completing the objective'),
        seconds: engine.time,
        progress: result.progress
    };
}
