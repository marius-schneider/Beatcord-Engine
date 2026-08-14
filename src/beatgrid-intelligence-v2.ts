const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1000) / 1000;

export interface TimelineBeat {
    time: number;
    index: number;
    bar: number;
    beatInBar: number;
    bpmLocal: number;
    confidence: number;
}

export interface TempoSegment {
    start: number;
    end: number;
    bpmStart: number;
    bpmEnd: number;
    stability: number;
    confidence: number;
}

export interface MeterSegment {
    start: number;
    end: number;
    numerator: number;
    denominator: number;
    confidence: number;
}
export interface PhraseSegment {
    start: number;
    end: number;
    bars: number;
    confidence: number;
}

export interface ResearchBeatGrid {
    beats: TimelineBeat[];
    tempoSegments: TempoSegment[];
    meterSegments: MeterSegment[];
    downbeats: number[];
    phrases: PhraseSegment[];
    confidence: { beat: number; downbeat: number; meter: number; phrase: number };
}

export type BeatgridMode = "static" | "drifting" | "ramping" | "sectional" | "free";

export function classifyBeatgridMode(grid: ResearchBeatGrid): BeatgridMode {
    if (grid.beats.length < 4 || grid.confidence.beat < 0.25) return "free";
    const segments = grid.tempoSegments;
    if (!segments.length) return "free";
    const changes = segments.map((segment) => segment.bpmEnd - segment.bpmStart);
    const ranges = segments.map((segment) => Math.abs(segment.bpmEnd - segment.bpmStart));
    const centers = segments.map((segment) => (segment.bpmStart + segment.bpmEnd) / 2);
    const totalDirection = changes.reduce((sum, change) => sum + Math.sign(change), 0);
    if (segments.length >= 2 && Math.max(...centers) - Math.min(...centers) >= 3 && ranges.every((range) => range < 1))
        return "sectional";
    if (ranges.some((range) => range >= 2) && Math.abs(totalDirection) >= Math.ceil(segments.length * 0.7))
        return "ramping";
    if (ranges.some((range) => range >= 0.4) || segments.some((segment) => segment.stability < 0.75)) return "drifting";
    return "static";
}

export interface LocalGridConfidence {
    start: number;
    end: number;
    beat: number;
    downbeat: number;
    phrase: number;
}
export function localGridConfidence(
    grid: ResearchBeatGrid,
    regions: readonly { start: number; end: number }[],
): LocalGridConfidence[] {
    return regions.map((region) => {
        const beats = grid.beats.filter((beat) => beat.time >= region.start && beat.time < region.end);
        const phrases = grid.phrases.filter((phrase) => phrase.start < region.end && phrase.end > region.start);
        const downbeats = grid.downbeats.filter((time) => time >= region.start && time < region.end);
        return {
            ...region,
            beat: round(beats.reduce((sum, beat) => sum + beat.confidence, 0) / Math.max(1, beats.length)),
            downbeat: round(clamp01((downbeats.length / Math.max(1, beats.length / 4)) * grid.confidence.downbeat)),
            phrase: round(phrases.reduce((sum, phrase) => sum + phrase.confidence, 0) / Math.max(1, phrases.length)),
        };
    });
}

export interface BeatEnsembleHypothesis {
    beats: number[];
    bpm: number;
    source: string;
    confidence: number;
}
export interface BeatConsensus {
    beats: number[];
    bpm: number;
    agreement: number;
    sources: string[];
    confidence: number;
}

export function ensembleBeatHypotheses(
    hypotheses: readonly BeatEnsembleHypothesis[],
    toleranceSec = 0.06,
): BeatConsensus {
    if (!hypotheses.length) return { beats: [], bpm: 0, agreement: 0, sources: [], confidence: 0 };
    const reference = [...hypotheses].sort((a, b) => b.confidence - a.confidence)[0]!;
    const beats = reference.beats.filter(
        (beat) =>
            hypotheses.filter((hypothesis) =>
                hypothesis.beats.some((candidate) => Math.abs(candidate - beat) <= toleranceSec),
            ).length >= Math.ceil(hypotheses.length / 2),
    );
    const weight = hypotheses.reduce((sum, hypothesis) => sum + clamp01(hypothesis.confidence), 0);
    const bpm =
        hypotheses.reduce((sum, hypothesis) => sum + hypothesis.bpm * clamp01(hypothesis.confidence), 0) /
        Math.max(1, weight);
    const agreement = beats.length / Math.max(1, reference.beats.length);
    return {
        beats,
        bpm: round(bpm),
        agreement: round(agreement),
        sources: hypotheses.map((hypothesis) => hypothesis.source),
        confidence: round(clamp01(agreement * (weight / hypotheses.length))),
    };
}

export interface TempoInterpretation {
    canonical: number;
    alternatives: number[];
    meterSupport: number;
    genrePrior: number;
    genreIsHardRule: false;
}
export function resolveTempoFamily(
    detectedBpm: number,
    input: { meterSupport: number; genrePriorBpm?: number; genrePriorStrength?: number },
): TempoInterpretation {
    const candidates = [
        ...new Set(
            [detectedBpm, detectedBpm * 2, detectedBpm / 2]
                .filter((bpm) => bpm >= 45 && bpm <= 220)
                .map((bpm) => round(bpm)),
        ),
    ];
    const prior = input.genrePriorBpm;
    const strength = clamp01(input.genrePriorStrength ?? 0);
    const canonical =
        prior === undefined
            ? detectedBpm
            : [...candidates].sort(
                  (a, b) =>
                      Math.abs(a - prior) * strength +
                      Math.abs(a - detectedBpm) * (1 - strength) -
                      (Math.abs(b - prior) * strength + Math.abs(b - detectedBpm) * (1 - strength)),
              )[0]!;
    return {
        canonical: round(canonical),
        alternatives: candidates.filter((bpm) => bpm !== canonical),
        meterSupport: round(clamp01(input.meterSupport)),
        genrePrior: round(strength),
        genreIsHardRule: false,
    };
}

export function downbeatAlignment(
    outgoingDownbeat: number,
    incomingDownbeat: number,
    beatPeriodSec: number,
    meter = 4,
): { beatAligned: boolean; barAligned: boolean; barPhaseError: number } {
    const beatOffset = Math.abs(outgoingDownbeat - incomingDownbeat) / Math.max(0.001, beatPeriodSec);
    const nearestBeat = Math.round(beatOffset);
    const phase = nearestBeat % meter;
    return {
        beatAligned: Math.abs(beatOffset - nearestBeat) <= 0.08,
        barAligned: Math.abs(beatOffset - nearestBeat) <= 0.08 && phase === 0,
        barPhaseError: phase,
    };
}

export interface MusicalClock {
    samplePhase: number;
    transientPhase: number;
    beatPhase: number;
    barPhase: number;
    phrasePhase: number;
    sectionPhase: number;
    journeyPhase: number;
}
export function hierarchicalMusicalClock(input: {
    timeSec: number;
    sampleRate: number;
    beatPeriodSec: number;
    beatsPerBar: number;
    barsPerPhrase: number;
    phrasesPerSection: number;
    sectionProgress: number;
    journeyProgress: number;
}): MusicalClock {
    const beatPosition = input.timeSec / Math.max(0.001, input.beatPeriodSec);
    const barPosition = beatPosition / input.beatsPerBar;
    const phrasePosition = barPosition / input.barsPerPhrase;
    const fraction = (value: number) => round(((value % 1) + 1) % 1);
    return {
        samplePhase: fraction(input.timeSec * input.sampleRate),
        transientPhase: fraction(beatPosition * 2),
        beatPhase: fraction(beatPosition),
        barPhase: fraction(barPosition),
        phrasePhase: fraction(phrasePosition),
        sectionPhase: round(clamp01(input.sectionProgress)),
        journeyPhase: round(clamp01(input.journeyProgress)),
    };
}

export function phraseLock(
    outgoingPhrasePhase: number,
    incomingPhrasePhase: number,
    confidence: number,
    tolerance = 0.08,
): boolean {
    const difference = Math.abs(outgoingPhrasePhase - incomingPhrasePhase);
    const circularDifference = Math.min(difference, 1 - difference);
    return confidence >= 0.55 && circularDifference <= tolerance;
}

export type AnalysisNode =
    | "beat-grid"
    | "downbeats"
    | "meter"
    | "phrase"
    | "structure"
    | "cue-points"
    | "transition-zones"
    | "lighting-events";
export class AnalysisDependencyGraph {
    readonly #dependencies: Record<AnalysisNode, AnalysisNode[]> = {
        "beat-grid": ["downbeats", "meter", "phrase", "structure", "cue-points", "transition-zones", "lighting-events"],
        downbeats: ["phrase", "structure", "cue-points", "transition-zones", "lighting-events"],
        meter: ["phrase", "structure"],
        phrase: ["structure", "cue-points", "transition-zones", "lighting-events"],
        structure: ["cue-points", "transition-zones", "lighting-events"],
        "cue-points": ["transition-zones"],
        "transition-zones": [],
        "lighting-events": [],
    };

    invalidate(node: AnalysisNode): { invalidated: AnalysisNode[]; incrementalReanalysis: true } {
        const found = new Set<AnalysisNode>();
        const visit = (current: AnalysisNode) => {
            for (const child of this.#dependencies[current])
                if (!found.has(child)) {
                    found.add(child);
                    visit(child);
                }
        };
        visit(node);
        return { invalidated: [...found], incrementalReanalysis: true };
    }
}

export interface SyncQuality {
    tempo: number;
    phase: number;
    bar: number;
    phrase: number;
    groove: number;
}
export function syncQualityDecision(quality: SyncQuality): {
    quality: SyncQuality;
    blendReady: boolean;
    weakest: keyof SyncQuality;
} {
    const entries = Object.entries(quality) as [keyof SyncQuality, number][];
    const weakest = [...entries].sort((a, b) => a[1] - b[1])[0]!;
    return {
        quality: Object.fromEntries(
            entries.map(([key, value]) => [key, round(clamp01(value))]),
        ) as unknown as SyncQuality,
        blendReady: entries.every(([, value]) => value >= 0.7),
        weakest: weakest[0],
    };
}

export function measurePhaseDrift(input: { initialErrorMs: number; finalErrorMs: number; durationSec: number }): {
    phaseErrorMs: number;
    phaseDriftMsPerSec: number;
    currentlyAligned: boolean;
    drifting: boolean;
} {
    const drift = (input.finalErrorMs - input.initialErrorMs) / Math.max(0.001, input.durationSec);
    return {
        phaseErrorMs: round(input.finalErrorMs),
        phaseDriftMsPerSec: round(drift),
        currentlyAligned: Math.abs(input.finalErrorMs) <= 20,
        drifting: Math.abs(drift) >= 0.5,
    };
}
