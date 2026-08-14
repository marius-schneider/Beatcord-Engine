import { expect, test } from "bun:test";

import type { BeatGrid } from "./beatgrid";
import { blendExperiences, detectExperience, selectExperience } from "./experience-engine";
import { MUSIC_DIRECTOR_SNAPSHOT_VERSION, MusicDirector } from "./music-director";
import { emptyRuntimeEvidenceSummary } from "./runtime-evidence-ledger-v1";
import { buildTrackProfile, type TrackProfile } from "./track-profile";
import { validateTransitionOverride } from "./transition-override";
import type { TrackTraits } from "./transition-planner";

function grid(energy: number, danceability: number, bpm = 124): BeatGrid {
    return {
        bpm,
        beats: Array.from({ length: 64 }, (_, index) => index * (60 / bpm)),
        beatInterval: 60 / bpm,
        analysisOffset: 0,
        musicalEndSec: 175,
        key: { name: "A minor", camelot: "8A", confidence: 0.86 },
        energy: { energy, percussiveness: energy * 0.85, danceability: danceability * 3 },
        spectral: { centroid: 3400, rolloff: 6800, flatness: 0.14, flux: 0.35 },
        downbeatPhase: 0,
        introSec: 8,
    };
}

function profile(id: string, energy: number, danceability: number, genre: "edm" | "chill"): TrackProfile {
    const beatGrid = grid(energy, danceability);
    const result = buildTrackProfile(
        { id, title: id, durationMs: 180_000 },
        {
            grid: beatGrid,
            genre,
            sections: [
                { startSec: 0, endSec: 8, kind: "intro", level: 0.25 },
                { startSec: 8, endSec: 90, kind: "body", level: energy },
                { startSec: 90, endSec: 120, kind: "drop", level: Math.min(1, energy + 0.15) },
                { startSec: 120, endSec: 180, kind: "outro", level: 0.3 },
            ],
        },
    );
    result.confidence = {
        beatGrid: 0.9,
        phrase: 0.86,
        key: 0.9,
        structure: 0.82,
        vocals: 0.8,
        stems: 0,
        overall: 0.86,
    };
    return result;
}

function traits(p: TrackProfile): TrackTraits {
    return { title: p.trackId, grid: p.beatGrid, durationMs: 180_000 };
}

test("experience vectors blend continuously", () => {
    const blend = blendExperiences({ chill: 0.7, love: 0.3 });
    expect(blend.targetEnergy).toBeGreaterThan(0.35);
    expect(blend.targetEnergy).toBeLessThan(0.48);
    expect(blend.preserveSongStructure).toBeGreaterThan(0.85);
    expect(blend.vocalOverlapTolerance).toBeLessThan(0.11);
});

test("explicit experience and intensity override Auto", () => {
    const party = selectExperience("party", 1);
    const gentleParty = selectExperience("party", 0.25);
    expect(party.requested).toBe("party");
    expect(party.confidence).toBe(1);
    expect(party.vector.transitionIntensity).toBeGreaterThan(gentleParty.vector.transitionIntensity);
});

test("Auto detects a low-energy acoustic queue as Chill", () => {
    const tracks = [profile("a", 0.2, 0.15, "chill"), profile("b", 0.28, 0.2, "chill")];
    const detected = detectExperience(tracks);
    expect(detected.requested).toBe("auto");
    expect(detected.resolved).toBe("chill");
    expect(detected.confidence).toBeGreaterThan(0.45);
});

test("Auto remains the requested mode while analysis is unavailable", () => {
    const detected = detectExperience([]);
    expect(detected.requested).toBe("auto");
    expect(detected.resolved).toBe("chill");
    expect(detected.confidence).toBeLessThan(0.5);
});

test("director applies Party intent to confident dance tracks", () => {
    const current = profile("current", 0.78, 0.88, "edm");
    const next = profile("next", 0.86, 0.92, "edm");
    const director = new MusicDirector();
    director.setExperience("party");
    const result = director.planTransition(traits(current), traits(next), current, next, {
        fadeSec: 8,
        tempoSync: true,
        eqSweep: true,
        harmonic: true,
        stemsReady: false,
        outgoingTempoRatio: 1,
        maxFadeSec: 32,
    });

    expect(result.experience.resolved).toBe("party");
    expect(result.intent.intensity).toBeGreaterThan(0.8);
    expect(result.intent.confidence).toBeGreaterThan(0.8);
    expect(["blend", "bassdrop", "filter", "riser"]).toContain(result.plan.type);
    expect(result.reasoning.reasons.join(" ")).toContain("manipulation budget");
});

test("low analysis confidence always preserves audio with a simple transition", () => {
    const current = buildTrackProfile(
        { id: "unknown-a", title: "Unknown", durationMs: 120_000 },
        { grid: null, genre: "unknown" },
    );
    const next = buildTrackProfile(
        { id: "unknown-b", title: "Unknown", durationMs: 120_000 },
        { grid: null, genre: "unknown" },
    );
    const director = new MusicDirector();
    director.setExperience("party");
    const result = director.planTransition(traits(current), traits(next), current, next, {
        fadeSec: 6,
        tempoSync: true,
        eqSweep: true,
        harmonic: true,
        stemsReady: false,
        outgoingTempoRatio: 1,
    });

    expect(["fade", "blend"]).toContain(result.plan.type);
    expect(result.plan.tempoRatio).toBe(1);
    expect(result.plan.eqSweep).toBe(false);
    expect(result.intent.confidence).toBeLessThan(0.2);
});

test("director defers a structure-preserving transition until a build resolves", () => {
    const current = profile("structured-current", 0.75, 0.8, "edm");
    const next = profile("structured-next", 0.8, 0.85, "edm");
    current.sections = [
        { ...current.sections[1]!, type: "build", start: 20, end: 40 },
        { ...current.sections[2]!, type: "drop", start: 40, end: 60 },
        { ...current.sections[3]!, type: "outro", start: 60, end: 180 },
    ];
    current.mixOutRegions = [
        {
            kind: "build",
            start: 24,
            end: 36,
            energyStart: 0.6,
            energyEnd: 0.8,
            vocals: 0.1,
            drums: 0.8,
            bass: 0.7,
            mixInQuality: 0.5,
            mixOutQuality: 0.9,
            confidence: 0.9,
            source: "section",
        },
    ];
    const director = new MusicDirector();
    director.setExperience("energy");
    director.setPerformanceStyle({ id: "natural" });
    const result = director.planTransition(traits(current), traits(next), current, next, {
        fadeSec: 8,
        tempoSync: true,
        eqSweep: true,
        harmonic: true,
        stemsReady: false,
        outgoingTempoRatio: 1,
    });
    expect(result.cue.aStartSec).toBeGreaterThanOrEqual(60);
    expect(result.cue.reason).toContain("deferred until anticipation/structural payoff");
    expect(result.performanceStyle.id).toBe("natural");
});

test("director preserves an evidenced gapless album boundary", () => {
    const current = profile("album-1", 0.6, 0.5, "chill");
    const next = profile("album-2", 0.62, 0.52, "chill");
    current.albumContext = { albumId: "concept", albumTitle: "Concept", trackNumber: 1, gapless: true };
    next.albumContext = { albumId: "concept", albumTitle: "Concept", trackNumber: 2, gapless: true };
    const result = new MusicDirector().planTransition(traits(current), traits(next), current, next, {
        fadeSec: 8,
        tempoSync: true,
        eqSweep: true,
        harmonic: true,
        stemsReady: false,
        outgoingTempoRatio: 1,
    });
    expect(result.continuityPolicy.disableCrossfade).toBe(true);
    expect(result.plan.type).toBe("cut");
    expect(result.plan.fadeSec).toBe(0.05);
    expect(result.cue.aStartSec).toBe(179.95);
});

test("director carries a timed musical moment into a backwards queue plan", () => {
    const now = 1_000_000;
    const current = profile("timed-a", 0.6, 0.6, "edm");
    const next = profile("timed-b", 0.8, 0.8, "edm");
    const targetEpochMs = now + 300_000;
    const director = new MusicDirector({ now: () => now });
    director.setTimedMoment({
        id: "target-drop",
        targetEpochMs,
        targetTrackId: next.trackId,
        kind: "drop",
        momentOffsetSec: 30,
    });
    const result = director.planTransition(traits(current), traits(next), current, next, {
        fadeSec: 8,
        tempoSync: true,
        eqSweep: true,
        harmonic: true,
        stemsReady: false,
        outgoingTempoRatio: 1,
    });
    expect(result.backtiming?.projectedMomentEpochMs).toBe(targetEpochMs);
    expect(result.backtiming?.schedule.map((entry) => entry.trackId)).toEqual([current.trackId, next.trackId]);
});

test("track selector follows the experience and session energy route", () => {
    const current = profile("current", 0.62, 0.65, "edm");
    const partyCandidate = profile("party-next", 0.82, 0.94, "edm");
    const quietCandidate = profile("quiet-next", 0.28, 0.12, "chill");
    const director = new MusicDirector();
    director.setExperience("party");
    director.observeTrack(current);

    const ranked = director.rankTrackCandidates(current, [quietCandidate, partyCandidate]);
    expect(ranked[0]?.profile.trackId).toBe("party-next");
    expect(ranked[0]?.reasons.join(" ")).toContain("party fit");
    expect(ranked[0]?.compatibility.total).toBeGreaterThan(0);
    expect(ranked[0]?.route.trackIds[0]).toBe("current");
    expect(ranked[0]?.reasons.join(" ")).toContain("best route");
    expect(ranked[0]?.reasons.join(" ")).toContain("journey fit");
});

test("track selector rotates an overexposed artist without leaving the experience", () => {
    const director = new MusicDirector();
    director.setExperience("party");
    for (let index = 0; index < 4; index++) {
        const played = profile(`played-${index}`, 0.74, 0.82, "edm");
        played.artist = "Repeated Artist";
        director.observeTrack(played);
    }
    const current = profile("current", 0.74, 0.82, "edm");
    const repeated = profile("repeated", 0.78, 0.85, "edm");
    repeated.artist = "Repeated Artist";
    const fresh = profile("fresh", 0.78, 0.85, "edm");
    fresh.artist = "Fresh Artist";

    const ranked = director.rankTrackCandidates(current, [repeated, fresh]);
    expect(ranked[0]?.profile.trackId).toBe("fresh");
    expect(ranked.find((candidate) => candidate.profile.trackId === "repeated")?.penalties.join(" ")).toContain(
        "artist fatigue",
    );
    expect(director.state().fatigue.artistRepetition).toBeGreaterThan(0.5);
});

test("human override edits the next transition without bypassing the planner", () => {
    const current = profile("override-current", 0.78, 0.88, "edm");
    const next = profile("override-next", 0.82, 0.9, "edm");
    const director = new MusicDirector({ now: () => 42_000 });
    director.setExperience("party");
    const validated = validateTransitionOverride(
        {
            fromTrackId: current.trackId,
            toTrackId: next.trackId,
            transitionType: "filter",
            fadeSec: 7,
            mixOutPointSec: 150,
            mixInPointSec: 16,
            alignment: "exact",
            scope: "next",
        },
        42_000,
    );
    if (!validated.ok) throw new Error(validated.error);
    director.setTransitionOverride(validated.override);

    const result = director.planTransition(traits(current), traits(next), current, next, {
        fadeSec: 8,
        tempoSync: true,
        eqSweep: true,
        harmonic: true,
        stemsReady: false,
        outgoingTempoRatio: 1,
        maxFadeSec: 32,
    });

    expect(result.plan.type).toBe("filter");
    expect(result.plan.fadeSec).toBe(7);
    expect(result.cue.aStartSec).toBe(150);
    expect(result.cue.bDropSec).toBe(16);
    expect(result.override?.appliedFields).toEqual(
        expect.arrayContaining(["transitionType", "fadeSec", "mixOutPointSec", "mixInPointSec", "alignment"]),
    );
    expect(director.state().override?.id).toBe("override-42000");
    expect(director.consumeTransitionOverride("override-42000")).toBe(true);
    expect(director.state().override).toBeUndefined();
});

test("human override cannot force an ineligible complex transition", () => {
    const current = buildTrackProfile(
        { id: "override-unknown-a", title: "Unknown", durationMs: 120_000 },
        { grid: null, genre: "unknown" },
    );
    const next = buildTrackProfile(
        { id: "override-unknown-b", title: "Unknown", durationMs: 120_000 },
        { grid: null, genre: "unknown" },
    );
    const director = new MusicDirector({ now: () => 43_000 });
    const validated = validateTransitionOverride({ transitionType: "acapella", stemUsage: "prefer" }, 43_000);
    if (!validated.ok) throw new Error(validated.error);
    director.setTransitionOverride(validated.override);

    const result = director.planTransition(traits(current), traits(next), current, next, {
        fadeSec: 6,
        tempoSync: true,
        eqSweep: true,
        harmonic: true,
        stemsReady: false,
        outgoingTempoRatio: 1,
    });

    expect(result.plan.type).not.toBe("acapella");
    expect(result.override?.rejectedFields).toContainEqual({
        field: "transitionType",
        reason: "requested strategy did not pass confidence and safety eligibility",
    });
});

test("runtime blends and feedback-driven Taste Profile remain subordinate to explicit intent", () => {
    const current = profile("current", 0.74, 0.82, "edm");
    const next = profile("next", 0.8, 0.88, "edm");
    const director = new MusicDirector();
    director.setExperience("chill", 1, { chill: 0.7, love: 0.3 });
    const before = director.state([current, next]);
    expect(before.experience.weights.chill).toBeCloseTo(0.7);
    expect(before.experience.weights.love).toBeCloseTo(0.3);

    director.planTransition(traits(current), traits(next), current, next, {
        fadeSec: 8,
        tempoSync: true,
        eqSweep: true,
        harmonic: true,
        stemsReady: false,
        outgoingTempoRatio: 1,
    });
    director.recordOutcome("skipped");
    const after = director.state([current, next]);
    expect(after.taste.samples).toBe(1);
    expect(after.taste.originalPreservation).toBeGreaterThan(before.taste.originalPreservation);
    expect(after.experience.requested).toBe("chill");
    expect(after.experience.vector.preserveSongStructure).toBeGreaterThan(0.85);
});

test("director snapshot round-trips learned taste and replay history, not explicit session intent", () => {
    const current = profile("snapshot-current", 0.7, 0.8, "edm");
    const next = profile("snapshot-next", 0.82, 0.9, "edm");
    const original = new MusicDirector();
    original.setExperience("party", 0.9);
    original.planTransition(traits(current), traits(next), current, next, {
        fadeSec: 8,
        tempoSync: true,
        eqSweep: true,
        harmonic: true,
        stemsReady: false,
        outgoingTempoRatio: 1,
    });
    original.recordOutcome("skipped");

    const snapshot = original.exportSnapshot();
    const restored = new MusicDirector();
    expect(restored.restoreSnapshot(snapshot)).toBe(true);

    const restoredState = restored.state();
    const replay = restored.exportSnapshot();
    expect(restored.requestedExperience).toBe("auto");
    expect(restoredState.taste).toEqual(snapshot.taste);
    expect(restoredState.session.userSkips).toBe(1);
    expect(replay.memory.recentGenres).toEqual(snapshot.memory.recentGenres);
    expect(replay.memory.transitionHistory.at(-1)?.outcome).toBe("skipped");
});

test("V1 snapshot restore sanitizes partial legacy data and rejects unknown versions", () => {
    const director = new MusicDirector();
    expect(
        director.restoreSnapshot({
            version: MUSIC_DIRECTOR_SNAPSHOT_VERSION,
            taste: { transitionIntensity: 4, samples: 2.9 },
            memory: {
                recentGenres: ["edm", 42, "chill"],
                recentBpms: [-5, 124, Number.NaN],
                energyHistory: [-1, 0.6, 3],
                transitionHistory: [{ type: "teleport" }],
            },
            userSkips: -2,
            userLikes: 3.8,
        }),
    ).toBe(true);
    const snapshot = director.exportSnapshot();
    expect(snapshot.taste.transitionIntensity).toBe(1);
    expect(snapshot.taste.samples).toBe(2.9);
    expect(snapshot.memory.recentGenres).toEqual(["edm", "chill"]);
    expect(snapshot.memory.recentBpms).toEqual([1, 124]);
    expect(snapshot.memory.energyHistory).toEqual([0, 0.6, 1]);
    expect(snapshot.memory.transitionHistory).toEqual([]);
    expect(snapshot.userSkips).toBe(0);
    expect(snapshot.userLikes).toBe(3);
    expect(director.restoreSnapshot({ version: 2 })).toBe(false);
});

test("experience evolution interpolates every policy vector without an abrupt jump", () => {
    let now = 1_000_000;
    const director = new MusicDirector({ now: () => now });
    director.setExperience("chill");
    const chill = director.state().experience;

    director.evolveExperience("party", 1, undefined, 120);
    const start = director.state().experience;
    expect(start.requested).toBe("party");
    expect(start.resolved).toBe("chill");
    expect(start.vector).toEqual(chill.vector);
    expect(start.evolution?.progress).toBe(0);

    now += 60_000;
    const middle = director.state().experience;
    expect(middle.evolution?.progress).toBeCloseTo(0.5);
    expect(middle.weights.chill).toBeCloseTo(0.5);
    expect(middle.weights.party).toBeCloseTo(0.5);
    expect(middle.vector.targetEnergy).toBeGreaterThan(chill.vector.targetEnergy);
    expect(middle.vector.targetEnergy).toBeLessThan(selectExperience("party").vector.targetEnergy);

    now += 60_000;
    const end = director.state().experience;
    expect(end.resolved).toBe("party");
    expect(end.evolution).toBeUndefined();
    expect(end.vector).toEqual(selectExperience("party").vector);
});

test("retargeting an active evolution continues from its current vector", () => {
    let now = 5_000;
    const director = new MusicDirector({ now: () => now });
    director.setExperience("chill");
    director.evolveExperience("party", 1, undefined, 100);
    now += 40_000;
    const before = director.state().experience;

    director.evolveExperience("love", 1, undefined, 60);
    const after = director.state().experience;
    expect(after.vector.targetEnergy).toBeCloseTo(before.vector.targetEnergy);
    expect(after.vector.transitionIntensity).toBeCloseTo(before.vector.transitionIntensity);
    expect(after.evolution?.to).toBe("love");
});

test("director decisions carry a complete candidate audit and inert shadow baseline", () => {
    const current = profile("audit-current", 0.76, 0.9, "edm");
    const next = profile("audit-next", 0.88, 0.95, "edm");
    const director = new MusicDirector({ now: () => 42_000 });
    director.setExperience("chill");
    const result = director.planTransition(traits(current), traits(next), current, next, {
        fadeSec: 8,
        tempoSync: true,
        eqSweep: true,
        harmonic: true,
        stemsReady: false,
        outgoingTempoRatio: 1,
    });

    expect(result.decision.inputStateHash).toMatch(/^fnv1a32-[0-9a-f]{8}$/);
    expect(result.decision.candidateScores.length).toBeGreaterThan(3);
    expect(result.decision.candidateScores.filter((candidate) => candidate.selected)).toHaveLength(1);
    expect(result.decision.selectedPlan).toEqual(result.plan);
    expect(result.decision.shadow.policy).toBe("planner-score-baseline-v1");
    expect(typeof result.decision.shadow.differsFromProduction).toBe("boolean");
    expect(result.decision.analyzerVersions.trackProfile).toBeTruthy();
    expect(result.decision.analyzerVersions.perceptualMasking).toBe("perceptual-masking-v1");
    expect(result.decision.analyzerVersions.adaptiveStretch).toBe("adaptive-stretch-v1");
    expect(result.decision.analyzerVersions.mixRegions).toBe("mix-regions-v1");
    expect(result.decision.analyzerVersions.trackCompatibility).toBe("track-compatibility-v2-tempo-awareness");
    expect(result.decision.analyzerVersions.sessionFatigue).toBe("session-fatigue-v1");
    expect(result.decision.analyzerVersions.humanOverride).toBe("transition-override-v1");
    expect(result.decision.analyzerVersions.stemQualityGate).toBe("stem-quality-gate-v2");
    expect(result.decision.analyzerVersions.analysisCache).toBe("analysis-cache-v1");
    expect(result.decision.analyzerVersions.confidenceFusion).toBe("confidence-fusion-v1");
    expect(result.decision.analyzerVersions.tempoAwareness).toBe("tempo-awareness-v1");
    expect(result.decision.analyzerVersions.genreSignal).toBe("genre-signal-v1");
    expect(result.decision.analyzerVersions.sessionJourney).toBe("session-journey-v1");
    expect(result.decision.analyzerVersions.communityPriorities).toBe("community-priorities-v1");
    expect(result.decision.analyzerVersions.architectureStatus).toBe("architecture-status-v1");
    expect(result.decision.analyzerVersions.researchRegistry).toBe("research-registry-v1");
    expect(result.decision.analyzerVersions.researchPrinciples).toBe("research-principles-v1");
    expect(result.decision.analyzerVersions.transitionCandidates).toBe("transition-candidates-v3-genre-signal");
    expect(result.decision.directorVersion).toBe("music-director-v42-evidence-calibration-runtime");
    expect(result.policyDecision.intent.experience).toBe(result.experience.resolved);
    expect(result.unifiedQuality.totalRisk).toBeGreaterThanOrEqual(0);
    expect(result.advancedExperience.energy).toBeGreaterThanOrEqual(0);
    expect(result.whyThis.transition.length).toBeGreaterThan(0);
    expect(result.intelligenceBoundary.every((item) => item.allowed)).toBe(true);
    expect(result.groupRules.consensus).toBeGreaterThanOrEqual(0);
    expect(result.recommendationV2.architecture).toHaveLength(10);
    expect(result.recommendationV2.score).toBeGreaterThanOrEqual(0);
    expect(result.affect.arousalConfidence).toBeGreaterThan(result.affect.valenceConfidence);
    expect(result.crowdGovernance.moodGroundTruth).toBe(false);
    expect(result.recommendationGovernance.primaryObjective).toBe("user-selected-experience-quality");
    expect(result.recommendationGovernance.chartPrior.finalRankingAuthority).toBe(false);
    expect(result.recommendationGovernance.sessionContract.valid).toBe(true);
    expect(result.researchGovernance.architecture).toHaveLength(11);
    expect(result.researchGovernance.controlMode).toBe("director");
    expect(result.materialIntelligence.materialPolicy.preferredBasis.length).toBeGreaterThan(0);
    expect(result.materialIntelligence.noticeabilityTarget.max).toBeGreaterThanOrEqual(0);
    expect(result.grooveCrowdIntelligence.perceptualState.perceivedEnergy).toBeGreaterThanOrEqual(0);
    expect(result.grooveCrowdIntelligence.familiarityPleasure.independentSignal).toBe(true);
    expect(result.exposureContext.contextSpecific).toBe(true);
    expect(result.performancePolicy.personalityPreset).toBeTruthy();
    expect(result.performancePolicy.candidateDecision.decision).toMatch(/play|defer|reject/);
    expect(result.beatgridV2.sync.weakest).toBeTruthy();
    expect(result.beatgridV2.phase.phaseDriftMsPerSec).toBeGreaterThanOrEqual(0);
    expect(result.clubV3.architecture).toHaveLength(18);
    expect(result.clubV3.taxonomyFamilies).toBe(7);
    expect(result.realtimeReliability.architecture.intelligenceOnCriticalPath).toBe(false);
    expect(result.realtimeReliability.route.clubPerformanceSafe).toBe(true);
    expect(result.psychoacousticCritic.rolePairs).toBe(12);
    expect(result.transitionCriticV2.evaluation.transitionNaturalness).toBeGreaterThanOrEqual(0);
    expect(result.conversationPolicy.boundary.llmAudioEngine).toBe(false);
    expect(result.tastePrivacy.localFirstBoundary.transfer).toBe("minimal-representations-only");
    expect(result.qualityGuardianV3.boundary.deterministicAudioPlanning).toBe(true);
    expect(result.evaluationReliabilityV2.shadowCritic.affectsPlayback).toBe(false);
    expect(result.semanticIntelligence.fit.separateSignals).toBe(true);
    expect(result.safeListening.energy.outputGainIncreaseDb).toBe(0);
    expect(result.distributedRecovery.futureEvent.scheduleLocally).toBe(true);
    expect(result.rightsPlanning.transition.strategy).toMatch(/neural-stem-handoff|classic-eq-transition/);
    expect(result.temporalAgent.evidence.specialistPrecisionProtected).toBe(true);
    expect(result.stemSequential.restoration.outsideTransitionUsesOriginalMaster).toBe(true);
    expect(result.provenanceSignal.evaluation.llmGroundTruth).toBe(false);
    expect(result.momentCompute.recommendation.selectsMomentNotOnlyTrack).toBe(true);
    expect(result.artistEcosystem.exposureFairness.qualifiedOnly).toBe(true);
    expect(result.artistAnalytics.nonSelection.individualUsersExposed).toBe(false);
    expect(result.artistGovernance.utility.hardConstraintsFirst).toBe(true);
    expect(result.sessionContinuity.handoffState.sessionContinuityNotOnlyPlayback).toBe(true);
    expect(result.crossProviderIdentity.source.providerIsNotRecording).toBe(true);
    expect(result.socialSession.hostPermissions).toContain("crowd-moderation");
    expect(result.experienceIntegration.event.rawAudioCallbackExposed).toBeFalse();
    expect(result.mobilityKaraokeMemory.driving.waveformEditor).toBeFalse();
    expect(result.socialPrivacyUx.social.musicRemainsPrimary).toBeTrue();
    expect(result.integrationSdkAccessibility.accessibleControls).toContain("screen-reader");
    expect(result.platformResilience.outage.cloudDegradationInterruptsAudio).toBeFalse();
    expect(result.contextSerendipityTrust.context.source).toBe("explicit-current-intent");
    expect(result.qualityOfExperience.aiResponse.cloudRequired).toBeFalse();
    expect(result.experienceQoeGovernance.intent.worksOffline).toBeTrue();
    expect(result.providerInnovation.capabilities.queueControl).toBeTrue();
    expect(result.validatedInnovations.critic.opaqueNaturalnessClaim).toBeFalse();
    expect(result.productStrategy.deferred).toContain("one-end-to-end-music-ai");
    expect(result.businessValidation.intrusiveness.passes).toBeTrue();
    expect(result.adaptiveBeatMesh.mixGrid.wholeTrackPerfectRequired).toBeFalse();
    expect(result.hierarchicalStemMixing.spatialGate.threshold).toBe(0.65);
    expect(result.robustTransitionFunnel.funnel.renderedCandidates).toBe(1);
    expect(result.analyzerKnowledge.strategyPrior.deterministicValidationRequired).toBeTrue();
    expect(result.musicalCompiler.compilation.deterministicAudioProgram).toBeTrue();
    expect(result.perceptualPlayback.safeEnergy.splIncreaseDb).toBe(0);
    expect(result.causalTaste.firewall.learnsOwnEcho).toBeFalse();
    expect(result.explorationUncertaintyTeaching.teaching.normalListenerNagged).toBeFalse();
    expect(result.stemComputeProvenanceV2.versionPrior.directSubtractionAllowed).toBeFalse();
    expect(result.multisensoryAttentionExperience.moment.oneMomentClock).toBeTrue();
    expect(result.playbackTwinCausalLedgerV2.policy.proprietaryHrtfGenerated).toBeFalse();
    expect(result.causalDecisionConfidenceV3.exploration.unsafeCandidatesExcluded).toBeTrue();
    expect(result.semanticListeningV1.bus.rawAudioStored).toBeFalse();
    expect(result.activeBeatMeshV2.teaching.visible).toBeFalse();
    expect(result.audioSourceResolutionPolicy.source.hiResLabel).toBeFalse();
    expect(result.dspPrecisionGaplessPolicy.precision.intermediateQuantization).toBeFalse();
    expect(result.immersiveRenderingV1.safeMode.spatializeBecauseDeviceSupports).toBeFalse();
    expect(result.realtimeDspRouteV3.rendererChange.journeyReplanned).toBeFalse();
    expect(result.audioIntegrityQoeV1.deliveryQoe.dspTierIndependent).toBeTrue();
    expect(result.transformFidelityLedgerV2.ledger.sourceImmutable).toBeTrue();
    expect(result.fidelitySpatialV1.artisticIntegrity.objectRepositioningDefault).toBeFalse();
    expect(result.audioFidelitySuiteV4.guardian.maximumAvailableProcessingUsed).toBeFalse();
    expect(result.presentationTransportV1.compilation.musicPlanChanged).toBeFalse();
    expect(result.deadlineTransportV2.program.clockPlan.clockFirst).toBeTrue();
    expect(result.platformEvidenceRealtimeV1.modelAdmission.route).toBe("audio-workgroup");
    expect(result.transitionValidationLabV4.critic.layers.technical).toBeGreaterThanOrEqual(0);
    expect(result.beatMeshValidationV3.deployment.aggregateF1Sufficient).toBeFalse();
    expect(result.beatMeshTortureLabV1.buckets).toHaveLength(18);
    expect(result.stemTransitionUtilityV1.benchmark.optimizeFor).toBe("musical-task-utility");
    expect(result.longitudinalTasteLabV1.program.minimumWeeks).toBe(12);
    expect(result.humanInterventionLabV1.decision.precisionOverRecall).toBeTrue();
    expect(result.performanceStyle.style.manipulation).toBeGreaterThanOrEqual(0);
    expect(result.progressivePlan.playable).toBe(true);
    expect(result.musicalIntelligence.current.sharedAnalysis.decodePasses).toBe(1);
    expect(result.vision.what.nextTrackId).toBe(result.decision.toTrackId);
    expect(result.vision.whereNext.targetEnergy.length).toBeGreaterThanOrEqual(2);
    expect(result.journeyTemplate.templateId).toBe(result.experience.resolved);
    expect(result.familiarity.noveltyTarget + result.familiarity.familiarityTarget).toBeCloseTo(1, 3);
    expect(result.surpriseBudget.remaining).toBeGreaterThanOrEqual(0);
    expect(result.strategyFatigue.strategyId).toBe(result.plan.type);
    expect(result.tension.sections.length).toBe(result.musicalIntelligence.current.sectionImportance.length);
    expect(result.emergencyContinuity.mode).toBe("none");
    expect(result.continuityPolicy.disableCrossfade).toBe(false);
    expect(result.journey.horizon.length).toBeGreaterThanOrEqual(2);
    expect(result.decision.journey).toEqual(result.journey);
    expect(result.decision.communityPriorities).toEqual(result.communityPriorities);
    expect(result.decision.architecture).toEqual(result.architecture);
    expect(result.architecture.layers).toHaveLength(10);
    expect(result.decision.research).toEqual(result.research);
    expect(result.research.sourceIds).toContain("mirex-downbeat");
    expect(result.decision.principles).toEqual(result.principles);
    expect(result.principles.results).toHaveLength(10);
    expect(result.decision.perceptualMasking).toEqual(result.perceptualMasking);
    expect(result.decision.stretchDecision).toEqual(result.stretchDecision);
    expect(result.regionSelection).not.toBeNull();
    expect(result.decision.regionSelection).toEqual(result.regionSelection ?? undefined);
    expect(result.decision.compatibility).toEqual(result.compatibility);
    expect(result.decision.compatibilityRoute).toEqual(result.compatibilityRoute);
    expect(result.decision.fatigue).toEqual(result.fatigue);
    expect(result.decision.noveltyBudget).toEqual(result.noveltyBudget);
    expect(result.decision.candidateScores.every((candidate) => candidate.noveltyPenalty !== undefined)).toBe(true);
    expect(result.decision.candidateScores.every((candidate) => candidate.signals.genreWeight === 0.1)).toBe(true);
    expect(result.decision.candidateScores.every((candidate) => candidate.signals.genreContribution <= 10)).toBe(true);
    expect(result.decision.candidateScores.every((candidate) => candidate.communityPriorities.version === 1)).toBe(
        true,
    );
    expect(result.reasoning.reasons.join(" ")).toContain("perceptual masking");
});

test("director consumes measured network, provider and longitudinal evidence", () => {
    const current = profile("evidence-current", 0.76, 0.9, "edm");
    const next = profile("evidence-next", 0.88, 0.95, "edm");
    const director = new MusicDirector({ now: () => 42_000 });
    const evidence = emptyRuntimeEvidenceSummary(42_000);
    evidence.tasteEvidence = { algorithmGenerated: 9, voluntary: 1, editorial: 0, organic: 0 };
    evidence.discoverySignals.saved = true;
    evidence.intervention = { accepted: 9, undone: 1, evidenceWindow: 10, trust: 0.8 };
    evidence.network = {
        reports: 10,
        meanClockOffsetMs: 30,
        meanBufferMs: 90,
        meanPlayoutDriftMs: 120,
        lateObjects: 4,
        meanPacketLossRate: 0.03,
    };
    evidence.providerEvidence = [
        { provider: "apple", kind: "beats", confidence: 0.95, values: [current.bpm + 1], native: true },
    ];
    director.setRuntimeEvidence(evidence);
    const result = director.planTransition(traits(current), traits(next), current, next, {
        fadeSec: 8,
        tempoSync: true,
        eqSweep: true,
        harmonic: true,
        stemsReady: false,
        outgoingTempoRatio: 1,
    });
    expect(result.runtimeEvidence.eventCount).toBe(0);
    expect(result.longitudinalTasteLabV1.selfInfluence.ratio).toBe(0.9);
    expect(result.longitudinalTasteLabV1.discoveryScore).toBeGreaterThan(0);
    expect(result.humanInterventionLabV1.trust).toBeGreaterThan(0.8);
    expect(result.deadlineTransportV2.resynchronization.action).toBe("musical-rejoin");
    expect(result.deadlineTransportV2.program.transportPlan).not.toBe("high-quality-opus");
    expect(result.platformEvidenceRealtimeV1.evidenceFusion.providerCount).toBe(2);
});

test("director penalizes ambiguous bass and foreground ownership during long overlaps", () => {
    const current = profile("mask-current", 0.84, 0.94, "edm");
    const next = profile("mask-next", 0.88, 0.96, "edm");
    current.sections = [
        {
            ...current.sections[1]!,
            type: "chorus",
            start: 0,
            end: 180,
            energy: 0.9,
            vocals: 0.94,
            drums: 0.88,
            bass: 0.96,
        },
    ];
    next.sections = [
        {
            ...next.sections[1]!,
            type: "chorus",
            start: 0,
            end: 180,
            energy: 0.92,
            vocals: 0.96,
            drums: 0.9,
            bass: 0.97,
        },
    ];
    const director = new MusicDirector();
    director.setExperience("party");
    const result = director.planTransition(traits(current), traits(next), current, next, {
        fadeSec: 10,
        tempoSync: true,
        eqSweep: true,
        harmonic: true,
        stemsReady: false,
        outgoingTempoRatio: 1,
        maxFadeSec: 32,
    });
    const blend = result.decision.candidateScores.find((candidate) => candidate.type === "blend")!;
    const bassdrop = result.decision.candidateScores.find((candidate) => candidate.type === "bassdrop")!;
    expect(blend.perceptualMaskingRisk).toBeGreaterThan(bassdrop.perceptualMaskingRisk!);
    expect(blend.reasons.join(" ")).toContain("foreground collision");
    expect(result.perceptualMasking.confidence).toBeGreaterThan(0.8);
});

test("identical director inputs produce the same replay hash, seed and scores", () => {
    const current = profile("stable-current", 0.7, 0.8, "edm");
    const next = profile("stable-next", 0.82, 0.9, "edm");
    const decide = () => {
        const director = new MusicDirector({ now: () => 99_000 });
        director.setExperience("party", 0.8);
        return director.planTransition(traits(current), traits(next), current, next, {
            fadeSec: 8,
            tempoSync: true,
            eqSweep: true,
            harmonic: true,
            stemsReady: false,
            outgoingTempoRatio: 1,
        }).decision;
    };

    const first = decide();
    const second = decide();
    expect(second.inputStateHash).toBe(first.inputStateHash);
    expect(second.seed).toBe(first.seed);
    expect(second.candidateScores).toEqual(first.candidateScores);
    expect(second.selectedPlan).toEqual(first.selectedPlan);
});

test("session fingerprint captures vibe DNA and steers a new session with different tracks", () => {
    const source = new MusicDirector({ now: () => 123_000 });
    source.setExperience("party", 0.85, { energy: 0.35, party: 0.65 });
    source.observeTrack(profile("source-a", 0.58, 0.72, "edm"));
    source.observeTrack(profile("source-b", 0.76, 0.88, "edm"));
    source.observeTrack(profile("source-c", 0.9, 0.96, "edm"));
    const fingerprint = source.exportSessionFingerprint();

    expect(fingerprint.version).toBe(1);
    expect(fingerprint.energyCurve).toEqual([0.58, 0.76, 0.9]);
    expect(fingerprint.genreDistribution.edm).toBe(1);
    expect(fingerprint.experienceDNA.weights.party).toBeCloseTo(0.65);

    const replay = new MusicDirector({ now: () => 456_000 });
    expect(replay.applySessionFingerprint(fingerprint)).toBe(true);
    const initial = replay.state();
    expect(initial.replay?.active).toBe(true);
    expect(initial.replay?.progress).toBe(0);
    expect(initial.experience.reason).toContain("replaying session fingerprint");

    const current = profile("new-current", 0.5, 0.65, "chill");
    const genreMatch = profile("new-edm", 0.7, 0.82, "edm");
    const genreMiss = profile("new-chill", 0.7, 0.82, "chill");
    const ranked = replay.rankTrackCandidates(current, [genreMiss, genreMatch]);
    expect(ranked[0]?.profile.trackId).toBe("new-edm");
    expect(ranked[0]?.reasons.join(" ")).toContain("replay genre fit");

    replay.observeTrack(current);
    expect(replay.state().replay?.progress).toBeCloseTo(0.5);
});

test("invalid session fingerprints are rejected without changing explicit intent", () => {
    const director = new MusicDirector();
    director.setExperience("love");
    expect(director.applySessionFingerprint({ version: 2 })).toBe(false);
    expect(director.applySessionFingerprint({ version: 1, experienceDNA: {}, mixPersonality: {} })).toBe(false);
    expect(director.requestedExperience).toBe("love");
    expect(director.state().replay).toBeUndefined();
});
