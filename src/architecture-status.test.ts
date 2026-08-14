import { describe, expect, test } from "bun:test";

import { assessArchitectureStatus, BEATCORD_ARCHITECTURE, updateArchitectureStatus } from "./architecture-status";

describe("extended architecture status", () => {
    test("has the ten stable roadmap layers in order", () => {
        expect(BEATCORD_ARCHITECTURE.map((layer) => layer.id)).toEqual([
            "experience",
            "context",
            "music-director",
            "queue-route-planner",
            "musical-intelligence",
            "transition-intelligence",
            "rescue-engine",
            "audio-engine",
            "quality-guardian",
            "compute-scheduler",
        ]);
    });

    test("reports partial capabilities honestly instead of flattening them to ready", () => {
        const status = assessArchitectureStatus({
            context: { session: true, activity: 0.5, crowd: false, "user-intent": true },
        });
        const context = status.layers.find((layer) => layer.id === "context")!;
        expect(context.status).toBe("degraded");
        expect(context.components.find((component) => component.id === "crowd")?.status).toBe("unavailable");
        expect(context.reasons.join(" ")).toContain("Crowd");
    });

    test("normalizes numerical evidence and produces an overall readiness", () => {
        const evidence = Object.fromEntries(
            BEATCORD_ARCHITECTURE.map((layer) => [
                layer.id,
                Object.fromEntries(layer.components.map((component) => [component.id, 0.9])),
            ]),
        );
        const status = assessArchitectureStatus(evidence);
        expect(status.status).toBe("ready");
        expect(status.readyLayers).toBe(10);
        expect(status.overall).toBe(0.9);
    });

    test("late runtime evidence upgrades only the affected layer", () => {
        const initial = assessArchitectureStatus({ "rescue-engine": { fallback: true } });
        const updated = updateArchitectureStatus(initial, {
            "rescue-engine": { validation: true, deadline: true },
        });
        expect(updated.layers.find((layer) => layer.id === "rescue-engine")?.status).toBe("ready");
        expect(updated.layers.find((layer) => layer.id === "experience")?.status).toBe("unavailable");
    });
});
