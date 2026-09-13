import { wrap } from './engine.ts';

export const coralMission = {
    id: 'submerged-coral-approach',
    title: 'Coral Nursery · approach & return',
    start: { x: -840, y: -390, heading: 0 },
    target: { x: -840, y: 35, heading: 0 },
    landmark: { x: -900, y: 180 },
    tolerance: 45,
    headingTolerance: 8,
    // Digitized launch arc approximation, not an official surveyed boundary.
    launch: { x: -1010, y: -571.5, radius: 480 },
    rulebook:
        'https://firstinspires.blob.core.windows.net/fll/challenge/2024-25/fll-challenge-submerged-rgr-eng.pdf'
};

export function insideLeftLaunch(x: number, y: number, radius = 100) {
    const launch = coralMission.launch;
    return (
        x - radius >= launch.x &&
        y - radius >= launch.y &&
        Math.hypot(x - launch.x, y - launch.y) + radius <= launch.radius
    );
}

// A teaching rubric, NOT FIRST scoring or a substitute for mechanism contact.
// Pose is used only to assess the run; the program cannot access this monitor.
export class MissionMonitor {
    validLaunch = false;
    aligned = false;
    activated = false;
    returned = false;
    private lastTool = 0;
    private toolTravel = 0;
    private wasInTarget = false;
    constructor(start: { x: number; y: number }, initialTool = 0) {
        this.validLaunch = insideLeftLaunch(start.x, start.y);
        this.lastTool = initialTool;
    }
    observe(p: {
        x: number;
        y: number;
        heading: number;
        motors: Record<string, { position: number }>;
    }) {
        const t = coralMission.target;
        const inTarget =
            Math.hypot(p.x - t.x, p.y - t.y) <= coralMission.tolerance &&
            Math.abs(wrap(p.heading - t.heading)) <= coralMission.headingTolerance;
        if (inTarget) this.aligned = true;
        const tool = p.motors.C?.position || 0;
        this.toolTravel =
            inTarget && this.wasInTarget ? this.toolTravel + Math.max(0, tool - this.lastTool) : 0;
        this.lastTool = tool;
        this.wasInTarget = inTarget;
        if (this.validLaunch && inTarget && this.toolTravel >= 60) this.activated = true;
        if (this.activated && insideLeftLaunch(p.x, p.y)) this.returned = true;
    }
    snapshot() {
        return {
            validLaunch: this.validLaunch,
            aligned: this.aligned,
            activated: this.activated,
            returned: this.returned
        };
    }
}
