// Millimeters, world X/Y on the mat; Three/Cannon use (x, height, -y).
// One definition drives rendering and collision for every perimeter wall.
export function boardSize(map = '') {
    return map === 'practice' ? { width: 23620, height: 11430 } : { width: 2362, height: 1143 };
}
export function perimeterWalls(map = '') {
    const { width, height } = boardSize(map);
    return [
        { id: 'south', size: [width + 52, 78, 26], position: [0, 39, height / 2 + 13] },
        { id: 'north', size: [width + 52, 78, 26], position: [0, 39, -height / 2 - 13] },
        { id: 'west', size: [26, 78, height], position: [-width / 2 - 13, 39, 0] },
        { id: 'east', size: [26, 78, height], position: [width / 2 + 13, 39, 0] }
    ];
}
export const tableWalls = perimeterWalls();
export function clampBoardPosition(x: number, y: number, map = '') {
    const { width, height } = boardSize(map);
    return {
        x: Math.max(-width / 2 + 100, Math.min(width / 2 - 100, x)),
        y: Math.max(-height / 2 + 100, Math.min(height / 2 - 100, y))
    };
}
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
    practice: [
        // Fixed scattered pieces, so repeated programs see the same environment.
        // The central piece also preserves the existing short wall-alignment drill.
        envelope(
            'practice-south',
            'Short central wall',
            0,
            -584.5,
            800,
            26,
            78,
            '#477f91',
            'Original free-drive layout'
        ),
        envelope(
            'practice-east',
            'Long east wall',
            2800,
            1600,
            60,
            1800,
            120,
            '#c3924d',
            'Original free-drive layout'
        ),
        envelope(
            'practice-west',
            'West wall',
            -3300,
            -1900,
            1200,
            60,
            100,
            '#477f91',
            'Original free-drive layout'
        ),
        envelope(
            'practice-far-east',
            'Far east wall',
            6500,
            -2000,
            60,
            2000,
            160,
            '#708499',
            'Original free-drive layout'
        ),
        envelope(
            'practice-far-west',
            'Far west wall',
            -7500,
            2500,
            2000,
            60,
            100,
            '#c3924d',
            'Original free-drive layout'
        )
    ],
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
