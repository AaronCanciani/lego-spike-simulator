import type { Pose } from './sensors.ts';

export const archivedMaps = [
    { id: '2018', name: 'INTO ORBIT' },
    { id: '2019', name: 'CITY SHAPER' },
    { id: '2020', name: 'RePLAY' },
    { id: '2021', name: 'CARGO CONNECT' },
    { id: '2022', name: 'SUPERPOWERED' },
    { id: '2023', name: 'MASTERPIECE' },
    { id: '2024', name: 'SUBMERGED' },
    { id: '2025', name: 'UNEARTHED' }
];
export type MissionKind =
    | 'crane'
    | 'build'
    | 'boccia'
    | 'step'
    | 'tire'
    | 'solar'
    | 'wind'
    | 'screens'
    | 'dock'
    | 'space'
    | 'wall';
export type MissionDefinition = {
    id: string;
    map: string;
    number: string;
    name: string;
    kind: MissionKind;
    goal: string;
    skills: string;
    route: string;
    source: string;
    target: { x: number; y: number };
    start: Pose;
    approach: Pose;
};
const archive = 'https://www.firstinspires.org/resources/library/fll/past-challenges';
const left = { x: -870, y: -400, heading: 0 };
const right = { x: 840, y: -400, heading: 0 };
// Digitized teaching placements, not surveyed LEGO mechanism geometry or an official scoresheet.
const entry = (
    id: string,
    map: string,
    number: string,
    name: string,
    kind: MissionKind,
    x: number,
    y: number,
    goal: string,
    skills: string,
    route: string,
    source = archive
): MissionDefinition => ({
    id,
    map,
    number,
    name,
    kind,
    target: { x, y },
    goal,
    skills,
    route,
    source,
    start: x > 400 && Number(map) >= 2022 ? { ...right } : { ...left },
    approach: { x, y: y - 310, heading: 0 }
});
export const missionCatalog: MissionDefinition[] = [
    entry(
        'city-crane',
        '2019',
        'M02',
        'Crane',
        'crane',
        -470,
        335,
        'Push the blue release plate to lower the suspended blue unit onto the mat.',
        'Line following · accurate contact · release',
        'From the left launch, acquire the rising black line, follow its corner toward the crane, then make a slow final approach.',
        'https://education.lego.com/en-us/lessons/first-lego-league-archived-missions/the-crane-mission/'
    ),
    entry(
        'city-build',
        '2019',
        'M12',
        'Design & Build',
        'build',
        140,
        -140,
        'Deliver the red building unit completely inside the red target outline and leave it resting.',
        'Color boundary detection · delivery · stopping distance',
        'Carry the unit from the left launch, use the lower black route as a reference, then locate the red circle. The teaching target is outlined in 3D.'
    ),
    entry(
        'replay-boccia',
        '2020',
        'M08',
        'Boccia Share',
        'boccia',
        -290,
        430,
        'Press exactly one colored release plate to send its cube over the north wall. Do not release both.',
        'Line following · wall approach · selective contact',
        'Acquire the long vertical line from the left launch and follow it north. Slow down before the two release plates.',
        'https://education.lego.com/en-us/lessons/first-lego-league-archived-missions/the-boccia-shared-mission/'
    ),
    entry(
        'replay-step',
        '2020',
        'M02',
        'Step Counter',
        'step',
        -660,
        150,
        'Push the green carriage at least 150 mm along its rail, then stop. Overspeed impacts do not help.',
        'Slow contact · motor mismatch · heading control',
        'Leave the left launch toward the counter, turn east, and push steadily along the horizontal rail.'
    ),
    entry(
        'replay-tire',
        '2020',
        'M09',
        'Tire Flip',
        'tire',
        550,
        0,
        'Flip the heavy tire white-side up and leave it in the target circle. Keep the whole tire east of the red limit.',
        'Red boundary · powered arm · payload clearance',
        'Use the lower black route to reach the tire area; account for the tire and arm footprint before turning.'
    ),
    entry(
        'power-solar',
        '2022',
        'M04',
        'Solar Farm',
        'solar',
        -180,
        435,
        'Remove all three energy units completely from their marked starting circles.',
        'Long line following · collection · repeatability',
        'From the left launch, follow the curved line north, turn onto the upper horizontal line, then approach the three units.'
    ),
    entry(
        'power-wind',
        '2022',
        'M07',
        'Wind Turbine',
        'wind',
        850,
        345,
        'Push and release the red plate three times to release all three energy units.',
        'Repeated contact · backing away · distance approach',
        'From the right launch, acquire the angled T-shaped line. Approach slowly and back away enough for the plate to reset between pushes.'
    ),
    entry(
        'art-screens',
        '2023',
        'M03',
        'Immersive Experience',
        'screens',
        -310,
        385,
        'Press the activation plate to raise all three screens, then leave the model untouched.',
        'Curved line · branch selection · retreat',
        'Follow the left curved branch toward the upper-left models, then approach the screen activator and retreat.'
    ),
    entry(
        'sea-vessel',
        '2024',
        'M15',
        'Research Vessel',
        'dock',
        800,
        -160,
        'Push the vessel into the dock until its bow reaches the latch. Leave it resting without robot contact.',
        'Distance approach · wall alignment · gentle docking',
        'Launch from the right, square your approach with a wall or line reference, then push the vessel north between the dock guides.'
    ),
    entry(
        'orbit-space',
        '2018',
        'M01',
        'Space Travel',
        'space',
        -980,
        350,
        'Press the release plate so the preloaded cart rolls down the ramp and past the marked finish.',
        'Wall reference · ramp release · precise contact',
        'From the southwest base, approach the northwest ramp using the west wall as a reference; align before releasing the cart.'
    )
];
missionCatalog.find((m) => m.kind === 'step')!.approach = { x: -970, y: 150, heading: 90 };
missionCatalog.find((m) => m.kind === 'boccia')!.approach.x -= 60;
missionCatalog.find((m) => m.kind === 'build')!.approach = { x: -710, y: -385, heading: 0 };
missionCatalog.find((m) => m.kind === 'tire')!.approach = { x: 550, y: -300, heading: 0 };
missionCatalog.find((m) => m.kind === 'dock')!.approach = { x: 800, y: -475, heading: 0 };
missionCatalog.find((m) => m.kind === 'dock')!.start = { x: 960, y: -430, heading: 0 };
export const wallMission: MissionDefinition = {
    id: 'wall-alignment',
    map: 'practice',
    number: 'LAB',
    name: 'Square up against a wall',
    kind: 'wall',
    target: { x: 0, y: -481.5 },
    start: { x: 0, y: -330, heading: 12 },
    approach: { x: 0, y: -330, heading: 12 },
    goal: 'Back into the south wall until both rear corners align, stop, then drive forward at least 100 mm while keeping heading within 3°.',
    skills: 'Wall contact · gyro reset · slip under load',
    route: 'Back up gently; the wall must rotate the chassis physically, not snap its heading. Then drive away.',
    source: archive
};
export function findMission(id: string) {
    return [...missionCatalog, wallMission].find((m) => m.id === id) ?? null;
}
