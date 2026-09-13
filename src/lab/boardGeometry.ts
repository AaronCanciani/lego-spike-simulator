// Millimeters, world X/Y on the mat; Three/Cannon use (x, height, -y).
// One definition drives rendering and collision for every perimeter wall.
export const tableWalls = [
    { id: 'south', size: [2414, 78, 26], position: [0, 39, 584.5] },
    { id: 'north', size: [2414, 78, 26], position: [0, 39, -584.5] },
    { id: 'west', size: [26, 78, 1143], position: [-1194, 39, 0] },
    { id: 'east', size: [26, 78, 1143], position: [1194, 39, 0] }
];
export type BoardObstacle = {
    id: string;
    name: string;
    x: number;
    y: number;
    width: number;
    depth: number;
    height: number;
    color: string;
    source: string;
};
const submerged =
    'https://firstinspires.blob.core.windows.net/fll/challenge/2024-25/fll-challenge-submerged-field-setup-guide.pdf';
const unearthed =
    'https://firstinspires.blob.core.windows.net/fll/challenge/2025-26/fll-challenge-unearthed-field-setup-reference-guide.pdf';
// Conservative STATIC collision envelopes, not completed mission mechanisms.
// Centers digitized from setup diagrams / existing field photo; sizes and heights
// are deliberately documented estimates. Printed route lines are never walls.
const envelope = (
    id: string,
    name: string,
    x: number,
    y: number,
    width: number,
    depth: number,
    height: number,
    color: string,
    source: string
): BoardObstacle => ({ id, name, x, y, width, depth, height, color, source });
export const boardObstacles: Record<string, BoardObstacle[]> = {
    '2021': [
        envelope(
            'cargo-ship',
            'Cargo ship footprint',
            435,
            475,
            380,
            110,
            80,
            '#e8aa40',
            'static/maps/FLL2021.jpg'
        ),
        envelope(
            'cargo-crane',
            'Crane base footprint',
            540,
            380,
            240,
            90,
            110,
            '#3e9bc1',
            'static/maps/FLL2021.jpg'
        ),
        envelope(
            'cargo-east-rail',
            'East rail structure',
            1090,
            50,
            90,
            370,
            85,
            '#e8aa40',
            'static/maps/FLL2021.jpg'
        ),
        envelope(
            'cargo-sorting',
            'Southeast sorting structure',
            850,
            -300,
            290,
            100,
            90,
            '#e8aa40',
            'static/maps/FLL2021.jpg'
        )
    ],
    '2024': [
        envelope(
            'sea-nursery',
            'M01 Coral Nursery base',
            -905,
            115,
            180,
            145,
            55,
            '#54b5c5',
            submerged
        ),
        envelope('sea-reef', 'M03 Coral Reef base', -370, 475, 180, 145, 85, '#52ad79', submerged),
        envelope('sea-shark', 'M02 Shark structure', -905, 470, 165, 130, 90, '#54b5c5', submerged),
        envelope(
            'sea-submersible',
            'M10 Submersible support',
            75,
            500,
            65,
            100,
            220,
            '#6096b8',
            submerged
        ),
        envelope(
            'sea-sonar',
            'M11 Sonar Discovery structure',
            515,
            425,
            150,
            145,
            100,
            '#54b5c5',
            submerged
        ),
        envelope(
            'sea-whale',
            'M12 Feed the Whale structure',
            905,
            475,
            145,
            125,
            100,
            '#a485c8',
            submerged
        )
    ],
    '2025': [
        envelope(
            'dig-brushing',
            'M01 Surface Brushing structure',
            -900,
            100,
            160,
            115,
            105,
            '#b9a07c',
            unearthed
        ),
        envelope(
            'dig-mineshaft',
            'M03 Mineshaft base',
            -350,
            485,
            130,
            130,
            160,
            '#9e7960',
            unearthed
        ),
        envelope(
            'dig-dwelling',
            'M05 Who Lived Here structure',
            600,
            470,
            180,
            150,
            120,
            '#b9a07c',
            unearthed
        ),
        envelope('dig-silo', 'M08 Silo structure', 875, 105, 160, 150, 130, '#b9a07c', unearthed)
    ]
};
export const obstaclesForBoard = (map: string) => boardObstacles[map] ?? [];
