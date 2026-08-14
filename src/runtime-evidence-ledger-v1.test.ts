import { describe, expect, test } from "bun:test";
import {
    emptyRuntimeEvidenceSummary,
    type RuntimeEvidenceEventV1,
    type RuntimeEvidenceKindV1,
    RuntimeEvidenceLedgerV1,
    summarizeRuntimeEvidence,
    validateRuntimeEvidenceEvent,
} from "./runtime-evidence-ledger-v1";

const DAY = 86_400_000;
const event = (id: string, kind: RuntimeEvidenceKindV1, atMs = 100 * DAY): RuntimeEvidenceEventV1 => ({
    version: 1,
    id,
    kind,
    atMs,
    weight: 1,
});

describe("runtime evidence ledger v1", () => {
    test("rejects malformed and out-of-range evidence", () => {
        expect(validateRuntimeEvidenceEvent({ version: 1, id: "x", kind: "undo", atMs: 1, weight: 2 })).toBeNull();
        expect(validateRuntimeEvidenceEvent({ version: 1, id: "x", kind: "unknown", atMs: 1, weight: 1 })).toBeNull();
        expect(
            validateRuntimeEvidenceEvent({
                ...event("provider", "provider-analysis", 1),
                providerEvidence: { provider: "apple", kind: "beats", confidence: 2, values: [120], native: true },
            }),
        ).toBeNull();
        expect(
            validateRuntimeEvidenceEvent({
                ...event("network", "network-sync", 1),
                network: {
                    clockOffsetMs: 0,
                    bufferMs: 1_000_000,
                    playoutDriftMs: 0,
                    lateObjects: 0,
                    packetLossRate: 0,
                },
            }),
        ).toBeNull();
    });
    test("summarizes voluntary and algorithmic evidence separately", () => {
        const summary = summarizeRuntimeEvidence(
            [event("a", "algorithm-recommendation"), event("v", "voluntary-search")],
            { nowMs: 100 * DAY },
        );
        expect(summary.tasteEvidence).toEqual({ algorithmGenerated: 1, voluntary: 1, editorial: 0, organic: 0 });
    });
    test("learns intervention trust only after a meaningful window", () => {
        const events = Array.from({ length: 10 }, (_, index) =>
            event(`${index}`, index < 8 ? "transition-completed" : "undo"),
        );
        expect(summarizeRuntimeEvidence(events, { nowMs: 100 * DAY, previousTrust: 0.5 }).intervention).toEqual({
            accepted: 8,
            undone: 2,
            evidenceWindow: 10,
            trust: 0.53,
        });
    });
    test("tracks long-lived discovery rather than non-skip alone", () => {
        const summary = summarizeRuntimeEvidence(
            [{ ...event("replay", "user-replay", 60 * DAY), subjectRef: "track:hash" }, event("save", "track-save")],
            { nowMs: 100 * DAY },
        );
        expect(summary.discoverySignals.replayAfterMonth).toBeTrue();
        expect(summary.discoverySignals.saved).toBeTrue();
    });
    test("derives profile drift and identification from explicit corrections", () => {
        const summary = summarizeRuntimeEvidence(
            [
                event("confirm", "profile-confirm"),
                event("correct", "profile-correct"),
                event("remove", "profile-remove"),
            ],
            { nowMs: 100 * DAY },
        );
        expect(summary.profile).toEqual({
            confirmed: 1,
            corrected: 1,
            removed: 1,
            evidenceWindow: 3,
            profileDrift: 0.666667,
            userConfirmedChange: 0.333333,
            profileIdentification: 0.333333,
        });
    });
    test("aggregates real network sync observations", () => {
        const summary = summarizeRuntimeEvidence(
            [
                {
                    ...event("network", "network-sync"),
                    network: {
                        clockOffsetMs: -10,
                        bufferMs: 40,
                        playoutDriftMs: 5,
                        lateObjects: 2,
                        packetLossRate: 0.01,
                    },
                },
            ],
            { nowMs: 100 * DAY },
        );
        expect(summary.network).toMatchObject({
            reports: 1,
            meanClockOffsetMs: 10,
            meanBufferMs: 40,
            meanPlayoutDriftMs: 5,
            lateObjects: 2,
            meanPacketLossRate: 0.01,
        });
    });
    test("retains only the newest provider evidence per provider and kind", () => {
        const providerEvidence = {
            provider: "apple" as const,
            kind: "beats" as const,
            confidence: 0.9,
            values: [120],
            native: true,
        };
        const summary = summarizeRuntimeEvidence(
            [
                { ...event("old", "provider-analysis", 99 * DAY), providerEvidence },
                { ...event("new", "provider-analysis"), providerEvidence: { ...providerEvidence, values: [121] } },
            ],
            { nowMs: 100 * DAY },
        );
        expect(summary.providerEvidence).toHaveLength(1);
        expect(summary.providerEvidence[0]?.values).toEqual([121]);
    });
    test("bounds memory and defensively copies returned events", () => {
        const ledger = new RuntimeEvidenceLedgerV1(100);
        for (let index = 0; index < 110; index++) ledger.append(event(`${index}`, "voluntary-search"));
        const values = ledger.events();
        values[0]!.id = "mutated";
        expect(values).toHaveLength(100);
        expect(ledger.events()[0]?.id).toBe("10");
    });
    test("restores valid events while dropping corrupt journal entries", () => {
        const ledger = new RuntimeEvidenceLedgerV1();
        expect(ledger.restore([event("valid", "undo"), { broken: true }])).toBe(1);
    });
    test("returns a stable empty summary", () => {
        expect(emptyRuntimeEvidenceSummary(123, 30)).toMatchObject({
            generatedAtMs: 123,
            windowDays: 30,
            eventCount: 0,
        });
    });
});
