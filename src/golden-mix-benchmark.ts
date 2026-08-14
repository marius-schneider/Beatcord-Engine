import type { BeatGrid } from "./beatgrid";
import { buildMixRegions } from "./mix-regions";
import type { TrackProfile, TrackSection, TrackSectionType } from "./track-profile";
import type { TimeRegion } from "./track-profile.types";
import type { TrackTraits, TransitionType } from "./transition-planner";
import { buildTransitionPreview, type TransitionPreview } from "./transition-preview";

export interface GoldenTrackGroundTruth {
    id: string;
    title: string;
    durationSec: number;
    bpm: number;
    camelot: string;
    energy: number;
    danceability: number;
    acousticness: number;
    valence: number;
    vocalness: number;
    complexity: number;
    confidence: number;
    downbeats: number[];
    phraseBoundaries: number[];
    sections: TrackSection[];
    vocalRegions: TimeRegion[];
}

export interface GoldenMixExpectation {
    acceptableTypes: TransitionType[];
    forbiddenTypes: TransitionType[];
    minNaturalness: number;
    maxArtifactRisk: number;
    /** Optional maximum distance from the nearest annotated outgoing phrase boundary. */
    maxCueErrorBeats?: number;
}

export interface GoldenMixCase {
    version: 1;
    id: string;
    difficulty: "easy" | "medium" | "hard";
    description: string;
    current: GoldenTrackGroundTruth;
    next: GoldenTrackGroundTruth;
    expected: GoldenMixExpectation;
    subjective: {
        panelRating: number;
        notes: string;
    };
}

export interface GoldenMixCaseResult {
    caseId: string;
    passed: boolean;
    failures: string[];
    recommendedType: TransitionType;
    offeredTypes: TransitionType[];
    naturalness: number;
    artifactRisk: number;
    cueErrorBeats: number | null;
    preview: TransitionPreview;
}

export interface GoldenMixBenchmarkThresholds {
    minPassRate?: number;
    maxForbiddenOfferRate?: number;
    minMeanNaturalness?: number;
    maxMeanArtifactRisk?: number;
}

export interface GoldenMixBenchmarkReport {
    version: 1;
    passed: boolean;
    totalCases: number;
    passedCases: number;
    passRate: number;
    forbiddenOfferRate: number;
    meanNaturalness: number;
    meanArtifactRisk: number;
    meanPanelRating: number;
    failures: string[];
    cases: GoldenMixCaseResult[];
}

const TRANSITION_TYPES = new Set<TransitionType>([
    "blend",
    "cut",
    "fade",
    "filter",
    "echo",
    "bassdrop",
    "spinback",
    "gate",
    "roll",
    "riser",
    "acapella",
]);

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const round = (value: number, digits = 3) => {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
};

function isNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function isRegion(value: unknown): value is TimeRegion {
    if (typeof value !== "object" || value === null) return false;
    const region = value as Partial<TimeRegion>;
    return isNumber(region.start) && isNumber(region.end) && region.start >= 0 && region.end > region.start;
}

function isSection(value: unknown): value is TrackSection {
    if (!isRegion(value)) return false;
    const section = value as Partial<TrackSection>;
    const types = new Set<TrackSectionType>([
        "intro",
        "verse",
        "pre-chorus",
        "chorus",
        "bridge",
        "break",
        "build",
        "drop",
        "outro",
        "unknown",
    ]);
    return (
        typeof section.type === "string" &&
        types.has(section.type as TrackSectionType) &&
        [
            section.energy,
            section.vocals,
            section.drums,
            section.bass,
            section.entryQuality,
            section.exitQuality,
            section.phraseConfidence,
            section.structureConfidence,
        ].every((number) => isNumber(number) && number >= 0 && number <= 1)
    );
}

function isTrack(value: unknown): value is GoldenTrackGroundTruth {
    if (typeof value !== "object" || value === null) return false;
    const track = value as Partial<GoldenTrackGroundTruth>;
    return (
        typeof track.id === "string" &&
        track.id.length > 0 &&
        typeof track.title === "string" &&
        isNumber(track.durationSec) &&
        track.durationSec > 0 &&
        isNumber(track.bpm) &&
        track.bpm > 0 &&
        typeof track.camelot === "string" &&
        [
            track.energy,
            track.danceability,
            track.acousticness,
            track.valence,
            track.vocalness,
            track.complexity,
            track.confidence,
        ].every((number) => isNumber(number) && number >= 0 && number <= 1) &&
        Array.isArray(track.downbeats) &&
        track.downbeats.length > 0 &&
        track.downbeats.every((number) => isNumber(number) && number >= 0) &&
        Array.isArray(track.phraseBoundaries) &&
        track.phraseBoundaries.length > 0 &&
        track.phraseBoundaries.every((number) => isNumber(number) && number >= 0) &&
        Array.isArray(track.sections) &&
        track.sections.length > 0 &&
        track.sections.every(isSection) &&
        Array.isArray(track.vocalRegions) &&
        track.vocalRegions.every(isRegion)
    );
}

/** Strict runtime validation keeps hand-edited benchmark manifests trustworthy. */
export function validateGoldenMixCase(
    value: unknown,
): { ok: true; value: GoldenMixCase } | { ok: false; error: string } {
    if (typeof value !== "object" || value === null) return { ok: false, error: "case must be an object" };
    const item = value as Partial<GoldenMixCase>;
    if (item.version !== 1) return { ok: false, error: "unsupported case version" };
    if (typeof item.id !== "string" || !/^[a-z0-9-]+$/.test(item.id)) {
        return { ok: false, error: "id must use lowercase kebab-case" };
    }
    if (!item.description || typeof item.description !== "string") return { ok: false, error: "description required" };
    if (!item.difficulty || !["easy", "medium", "hard"].includes(item.difficulty)) {
        return { ok: false, error: "difficulty must be easy, medium or hard" };
    }
    if (!isTrack(item.current) || !isTrack(item.next)) return { ok: false, error: "invalid track ground truth" };
    const expected = item.expected;
    if (
        !expected ||
        !Array.isArray(expected.acceptableTypes) ||
        !expected.acceptableTypes.length ||
        !expected.acceptableTypes.every((type) => TRANSITION_TYPES.has(type)) ||
        !Array.isArray(expected.forbiddenTypes) ||
        !expected.forbiddenTypes.every((type) => TRANSITION_TYPES.has(type)) ||
        expected.acceptableTypes.some((type) => expected.forbiddenTypes.includes(type)) ||
        !isNumber(expected.minNaturalness) ||
        expected.minNaturalness < 0 ||
        expected.minNaturalness > 100 ||
        !isNumber(expected.maxArtifactRisk) ||
        expected.maxArtifactRisk < 0 ||
        expected.maxArtifactRisk > 100 ||
        (expected.maxCueErrorBeats !== undefined &&
            (!isNumber(expected.maxCueErrorBeats) || expected.maxCueErrorBeats < 0))
    ) {
        return { ok: false, error: "invalid expectations" };
    }
    if (
        !item.subjective ||
        !isNumber(item.subjective.panelRating) ||
        item.subjective.panelRating < 0 ||
        item.subjective.panelRating > 5 ||
        typeof item.subjective.notes !== "string"
    ) {
        return { ok: false, error: "invalid subjective reference" };
    }
    return { ok: true, value: item as GoldenMixCase };
}

function grid(track: GoldenTrackGroundTruth): BeatGrid {
    const beatInterval = 60 / track.bpm;
    const origin = track.downbeats[0] ?? 0;
    const beats: number[] = [];
    for (let beat = origin; beat <= track.durationSec; beat += beatInterval) beats.push(round(beat));
    const intro = track.sections.find((section) => section.type === "intro");
    const outro = [...track.sections].reverse().find((section) => section.type === "outro");
    return {
        bpm: track.bpm,
        beats,
        beatInterval,
        analysisOffset: 0,
        musicalEndSec: outro?.start ?? track.durationSec,
        key: { name: track.camelot, camelot: track.camelot, confidence: track.confidence },
        energy: {
            energy: track.energy,
            percussiveness: clamp01(track.danceability * 0.78 + track.energy * 0.22),
            danceability: track.danceability * 3,
        },
        spectral: {
            centroid: 1_500 + track.energy * 2_500,
            rolloff: 4_000 + track.energy * 4_000,
            flatness: 0.05 + track.complexity * 0.18,
            flux: 0.12 + track.danceability * 0.4,
        },
        downbeatPhase: 0,
        introSec: intro?.end ?? 0,
    };
}

function profile(track: GoldenTrackGroundTruth, beatGrid: BeatGrid): TrackProfile {
    const mixRegions = buildMixRegions({
        sections: track.sections,
        beatGrid,
        durationSec: track.durationSec,
        trackEnergy: track.energy,
        vocalness: track.vocalness,
        complexity: track.complexity,
    });
    const intro = track.sections.find((section) => section.type === "intro");
    const outro = [...track.sections].reverse().find((section) => section.type === "outro");
    return {
        trackId: track.id,
        artist: "Golden Mix Ground Truth",
        bpm: track.bpm,
        bpmConfidence: track.confidence,
        key: track.camelot,
        mode: track.camelot.endsWith("A") ? "minor" : "major",
        keyConfidence: track.confidence,
        genres: [{ genre: "unknown", confidence: track.confidence }],
        energy: track.energy,
        valence: track.valence,
        danceability: track.danceability,
        acousticness: track.acousticness,
        vocalness: track.vocalness,
        intensity: clamp01(track.energy * 0.6 + track.danceability * 0.4),
        complexity: track.complexity,
        loudness: -12,
        dynamicRange: 8,
        beatGrid,
        sections: track.sections,
        mixInRegions: mixRegions.mixIn,
        mixOutRegions: mixRegions.mixOut,
        vocalRegions: track.vocalRegions,
        ...(intro ? { intro: { start: intro.start, end: intro.end } } : {}),
        ...(outro ? { outro: { start: outro.start, end: outro.end } } : {}),
        confidence: {
            beatGrid: track.confidence,
            phrase: track.confidence,
            key: track.confidence,
            structure: track.confidence,
            vocals: track.confidence,
            stems: 0,
            overall: track.confidence,
        },
        provenance: {
            bpm: "measured",
            key: "measured",
            structure: "measured",
            vocals: "measured",
        },
    };
}

function traits(track: GoldenTrackGroundTruth, beatGrid: BeatGrid): TrackTraits {
    return {
        title: track.title,
        uploader: "Golden Mix Ground Truth",
        grid: beatGrid,
        durationMs: track.durationSec * 1_000,
    };
}

function nearestCueErrorBeats(cueSec: number, boundaries: readonly number[], bpm: number): number | null {
    if (!boundaries.length || bpm <= 0) return null;
    const errorSec = Math.min(...boundaries.map((boundary) => Math.abs(boundary - cueSec)));
    return round(errorSec / (60 / bpm));
}

export function evaluateGoldenMixCase(item: GoldenMixCase): GoldenMixCaseResult {
    const currentGrid = grid(item.current);
    const nextGrid = grid(item.next);
    const preview = buildTransitionPreview(
        traits(item.current, currentGrid),
        traits(item.next, nextGrid),
        profile(item.current, currentGrid),
        profile(item.next, nextGrid),
        {
            fadeSec: 8,
            maxFadeSec: 16,
            tempoTolerance: 0.08,
            preserveStructure: 0.8,
            vocalOverlapTolerance: 0.12,
            now: () => 0,
        },
    );
    const recommended = preview.variants.find((variant) => variant.id === preview.recommendedVariantId)!;
    const offeredTypes = preview.variants.map((variant) => variant.plan.type);
    const failures: string[] = [];
    if (!item.expected.acceptableTypes.includes(recommended.plan.type)) {
        failures.push(`recommended ${recommended.plan.type}, expected ${item.expected.acceptableTypes.join("/")}`);
    }
    const forbidden = offeredTypes.filter((type) => item.expected.forbiddenTypes.includes(type));
    if (forbidden.length) failures.push(`offered forbidden ${[...new Set(forbidden)].join(", ")}`);
    if (recommended.metrics.naturalness < item.expected.minNaturalness) {
        failures.push(
            `naturalness ${recommended.metrics.naturalness.toFixed(1)} < ${item.expected.minNaturalness.toFixed(1)}`,
        );
    }
    if (recommended.metrics.artifactRisk > item.expected.maxArtifactRisk) {
        failures.push(
            `artifact risk ${recommended.metrics.artifactRisk.toFixed(1)} > ${item.expected.maxArtifactRisk.toFixed(1)}`,
        );
    }
    const cueErrorBeats = nearestCueErrorBeats(
        recommended.cue.aStartSec,
        item.current.phraseBoundaries,
        item.current.bpm,
    );
    if (
        item.expected.maxCueErrorBeats !== undefined &&
        cueErrorBeats !== null &&
        cueErrorBeats > item.expected.maxCueErrorBeats
    ) {
        failures.push(`cue error ${cueErrorBeats.toFixed(1)} beats > ${item.expected.maxCueErrorBeats.toFixed(1)}`);
    }
    return {
        caseId: item.id,
        passed: failures.length === 0,
        failures,
        recommendedType: recommended.plan.type,
        offeredTypes,
        naturalness: recommended.metrics.naturalness,
        artifactRisk: recommended.metrics.artifactRisk,
        cueErrorBeats,
        preview,
    };
}

export function runGoldenMixBenchmark(
    cases: readonly GoldenMixCase[],
    thresholds: GoldenMixBenchmarkThresholds = {},
): GoldenMixBenchmarkReport {
    if (!cases.length) throw new Error("golden mix benchmark needs at least one case");
    const results = cases.map(evaluateGoldenMixCase);
    const passedCases = results.filter((result) => result.passed).length;
    const forbiddenOffers = results.reduce(
        (count, result, index) =>
            count + result.offeredTypes.filter((type) => cases[index]!.expected.forbiddenTypes.includes(type)).length,
        0,
    );
    const offered = results.reduce((count, result) => count + result.offeredTypes.length, 0);
    const passRate = passedCases / results.length;
    const forbiddenOfferRate = forbiddenOffers / Math.max(1, offered);
    const meanNaturalness = results.reduce((sum, result) => sum + result.naturalness, 0) / results.length;
    const meanArtifactRisk = results.reduce((sum, result) => sum + result.artifactRisk, 0) / results.length;
    const meanPanelRating = cases.reduce((sum, item) => sum + item.subjective.panelRating, 0) / cases.length;
    const failures = results.flatMap((result) => result.failures.map((failure) => `${result.caseId}: ${failure}`));
    const minPassRate = thresholds.minPassRate ?? 1;
    const maxForbiddenOfferRate = thresholds.maxForbiddenOfferRate ?? 0;
    const minMeanNaturalness = thresholds.minMeanNaturalness ?? 65;
    const maxMeanArtifactRisk = thresholds.maxMeanArtifactRisk ?? 40;
    if (passRate < minPassRate) failures.push(`pass rate ${round(passRate)} < ${minPassRate}`);
    if (forbiddenOfferRate > maxForbiddenOfferRate) {
        failures.push(`forbidden offer rate ${round(forbiddenOfferRate)} > ${maxForbiddenOfferRate}`);
    }
    if (meanNaturalness < minMeanNaturalness) {
        failures.push(`mean naturalness ${round(meanNaturalness, 1)} < ${minMeanNaturalness}`);
    }
    if (meanArtifactRisk > maxMeanArtifactRisk) {
        failures.push(`mean artifact risk ${round(meanArtifactRisk, 1)} > ${maxMeanArtifactRisk}`);
    }
    return {
        version: 1,
        passed: failures.length === 0,
        totalCases: results.length,
        passedCases,
        passRate: round(passRate),
        forbiddenOfferRate: round(forbiddenOfferRate),
        meanNaturalness: round(meanNaturalness, 1),
        meanArtifactRisk: round(meanArtifactRisk, 1),
        meanPanelRating: round(meanPanelRating, 2),
        failures,
        cases: results,
    };
}
