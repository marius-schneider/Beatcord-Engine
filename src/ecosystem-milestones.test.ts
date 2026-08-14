import { describe, expect, test } from "bun:test";
import {
    ECOSYSTEM_EXPERIENCE_PROMISE,
    ECOSYSTEM_MILESTONES,
    ECOSYSTEM_STATE_MODEL,
    milestoneProgress,
} from "./ecosystem-milestones";

describe("ecosystem milestones", () => {
    test("models milestones 21 through 32 without gaps", () => {
        expect(ECOSYSTEM_MILESTONES.map((milestone) => milestone.id)).toEqual([
            21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
        ]);
    });

    test("reports implemented and missing capabilities", () => {
        const progress = milestoneProgress(21, new Set(["canonical-session-state", "device-roles"]));
        expect(progress).toMatchObject({ id: 21, complete: 2, total: 8, ratio: 0.25 });
        expect(progress.missing).toContain("recovery");
    });

    test("reduces the ecosystem to four coherent user states", () => {
        expect(ECOSYSTEM_STATE_MODEL).toEqual(["music-state", "session-state", "social-state", "device-state"]);
        expect(ECOSYSTEM_EXPERIENCE_PROMISE).toContain("where I am");
    });
});
