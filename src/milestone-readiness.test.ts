import { describe, expect, test } from "bun:test";

import { assessArchitectureStatus } from "./architecture-status";
import { assessMilestoneReadiness } from "./milestone-readiness";

describe("roadmap milestone readiness", () => {
    test("tracks all 46 capabilities across milestones 8 through 13", () => {
        const report = assessMilestoneReadiness();
        expect(report.milestones.map((milestone) => milestone.id)).toEqual([8, 9, 10, 11, 12, 13]);
        expect(report.totalCapabilities).toBe(46);
        expect(report.implementationCompletion).toBeGreaterThan(0.7);
        expect(report.implementationCompletion).toBeLessThan(1);
    });

    test("does not claim known gaps are complete", () => {
        const report = assessMilestoneReadiness();
        const all = report.milestones.flatMap((milestone) => milestone.capabilities);
        expect(all.find((item) => item.id === "meter-confidence")?.implementation).toBe("missing");
        expect(all.find((item) => item.id === "crowd-mode")?.implementation).toBe("missing");
        expect(all.find((item) => item.id === "transition-simulation")?.implementation).toBe("partial");
        expect(all.find((item) => item.id === "half-double-time")?.implementation).toBe("complete");
    });

    test("combines implementation truth with per-session runtime readiness", () => {
        const architecture = assessArchitectureStatus({
            "musical-intelligence": { beat: true, structure: 0.5 },
            context: { activity: 0.5, session: true, crowd: false, "user-intent": true },
        });
        const report = assessMilestoneReadiness(architecture);
        const all = report.milestones.flatMap((milestone) => milestone.capabilities);
        expect(all.find((item) => item.id === "downbeat-detection")?.runtime).toBe("ready");
        expect(all.find((item) => item.id === "song-structure-graph")?.runtime).toBe("degraded");
        expect(all.find((item) => item.id === "crowd-mode")?.runtime).toBe("unavailable");
        expect(report.runtimeReadiness).not.toBeNull();
    });
});
