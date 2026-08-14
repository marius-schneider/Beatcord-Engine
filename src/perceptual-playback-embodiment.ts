const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
export type OutputType = "phone" | "laptop" | "headphones" | "speaker" | "car" | "club";
export interface OutputProfile {
    type: OutputType;
    dynamicCapability: number;
    maxReliableBass: number;
    spatialCapability: number;
    calibrationConfidence: number;
}
export interface PerceptualPlaybackTwin {
    outputDevice: OutputProfile;
    environmentNoise?: number;
    userAudioPreferences: { clarity: number; bass: number; dynamics: number };
    confidence: number;
}
export type PlaybackPolicy =
    | "protect-low-end-headroom"
    | "preserve-low-end-dynamics"
    | "preserve-stereo-detail"
    | "balanced";
export function adaptivePlaybackPolicy(twin: PerceptualPlaybackTwin): {
    policy: PlaybackPolicy;
    subtle: true;
    reversible: true;
    artistPreserving: true;
} {
    const policy =
        twin.outputDevice.type === "phone" || twin.outputDevice.type === "laptop"
            ? "protect-low-end-headroom"
            : twin.outputDevice.type === "headphones"
              ? "preserve-stereo-detail"
              : twin.outputDevice.type === "speaker" || twin.outputDevice.type === "club"
                ? "preserve-low-end-dynamics"
                : "balanced";
    return { policy, subtle: true, reversible: true, artistPreserving: true };
}
export interface AdaptiveMasterBudget {
    eqDb: number;
    dynamicRangeChange: number;
    stereoModification: number;
    loudnessOffset: number;
}
export function adaptiveMasterBudget(experience: "chill" | "love" | "energy" | "party"): AdaptiveMasterBudget {
    const scale = experience === "party" ? 1 : experience === "energy" ? 0.75 : 0.4;
    return {
        eqDb: round(1.5 * scale),
        dynamicRangeChange: round(scale),
        stereoModification: round(0.1 * scale),
        loudnessOffset: round(scale),
    };
}
export function ambientLoudnessProtection(noise: number): {
    clarityAdaptation: number;
    dynamicOptimization: number;
    maskingCompensation: number;
    volumeGainDb: number;
    volumeLast: true;
} {
    const level = clamp01(noise);
    return {
        clarityAdaptation: round(level * 0.5),
        dynamicOptimization: round(level * 0.35),
        maskingCompensation: round(level * 0.4),
        volumeGainDb: level > 0.8 ? 1 : 0,
        volumeLast: true,
    };
}
export function safeEnergyStrategy(targetEnergy: number): {
    selection: number;
    rhythm: number;
    transients: number;
    arrangement: number;
    journey: number;
    splIncreaseDb: 0;
} {
    const value = clamp01(targetEnergy);
    return { selection: value, rhythm: value, transients: value, arrangement: value, journey: value, splIncreaseDb: 0 };
}

export type EnvironmentalSound =
    | "sirens"
    | "horns"
    | "announcements"
    | "conversation-partner"
    | "traffic"
    | "crowd-noise"
    | "birds";
export function semanticEnvironmentMix(sound: EnvironmentalSound): {
    level: number;
    class: "always-hear" | "prefer-hear" | "reduce" | "neutral";
} {
    if (["sirens", "horns", "announcements"].includes(sound)) return { level: 1, class: "always-hear" };
    if (sound === "conversation-partner") return { level: 0.85, class: "prefer-hear" };
    if (["traffic", "crowd-noise"].includes(sound)) return { level: 0.2, class: "reduce" };
    return { level: 0.6, class: "neutral" };
}
export interface ExternalAttentionEvent {
    type: "speech" | "warning" | "announcement";
    urgency: number;
    confidence: number;
    durationEstimate?: number;
}
export function spectralEnvironmentDucking(event: ExternalAttentionEvent): {
    gainDuckDb: number;
    spectralPocket: [number, number] | null;
    preserveImmersion: boolean;
} {
    if (event.type === "speech" || event.type === "announcement")
        return { gainDuckDb: event.urgency > 0.8 ? -3 : 0, spectralPocket: [1_000, 4_000], preserveImmersion: true };
    return { gainDuckDb: -6 * clamp01(event.urgency), spectralPocket: null, preserveImmersion: false };
}
export function conversationSafeJourney(
    event: ExternalAttentionEvent | null,
    targetMomentInSec: number,
): { action: "continue" | "delay-target-moment" | "choose-lower-foreground"; resumeJourney: true } {
    if (!event || event.confidence < 0.6) return { action: "continue", resumeJourney: true };
    return { action: targetMomentInSec <= 15 ? "delay-target-moment" : "choose-lower-foreground", resumeJourney: true };
}
export const AMBIENT_PRIVACY = {
    onDevicePreferred: true,
    rawMicrophoneStored: false,
    explicitOptIn: true,
    transcriptionRequired: false,
} as const;

export interface SpatialProfile {
    personalization: "generic" | "estimated" | "measured";
    confidence: number;
    source: "os-provided" | "beatcord";
}
export function spatialProfilePolicy(osProfile: SpatialProfile | null): SpatialProfile {
    return osProfile ?? { personalization: "generic", confidence: 0.25, source: "beatcord" };
}
export interface SpatialRole {
    role: string;
    azimuth?: number;
    elevation?: number;
    distance?: number;
    width?: number;
}
export function spatialRoleHandoff(
    roles: readonly SpatialRole[],
    creativeMode: boolean,
): { roles: SpatialRole[]; movement: "subtle" | "creative"; objectives: readonly string[] } {
    return {
        roles: [...roles],
        movement: creativeMode ? "creative" : "subtle",
        objectives: ["separation", "clarity", "continuity"],
    };
}
export type VirtualVenue = "studio" | "small-club" | "open-air" | "arena";
export function virtualVenue(
    venue: VirtualVenue,
    explicit: boolean,
): { apply: boolean; venue: VirtualVenue; automaticMasterReverb: false } {
    return { apply: explicit, venue, automaticMasterReverb: false };
}

export interface HapticEventIr {
    time: number;
    intensity: number;
    kind: "pulse" | "drop" | "transition" | "melody";
}
export interface HapticMusicIR {
    pulse: HapticEventIr[];
    bass: HapticEventIr[];
    melody?: HapticEventIr[];
    moments: HapticEventIr[];
}
export function hapticRoleMix(device: "watch" | "phone" | "chair-vest", ir: HapticMusicIR): HapticEventIr[] {
    if (device === "watch") return ir.pulse.map((event) => ({ ...event, intensity: Math.min(0.3, event.intensity) }));
    if (device === "phone") return ir.moments.filter((event) => event.kind === "drop" || event.kind === "transition");
    return [...ir.bass, ...ir.pulse];
}
export function perceptualHapticCritic(input: { alignment: number; humanRating: number; comfort: number }): number {
    return round(clamp01(input.alignment) * 0.35 + clamp01(input.humanRating) * 0.4 + clamp01(input.comfort) * 0.25);
}
export interface MovementContext {
    cadence: number;
    accentPattern: number[];
    groove: number;
    barPhase: number;
    contactPattern: number[];
    confidence: number;
}
export function motionCompatibility(music: MovementContext, body: MovementContext): number {
    const cadence = 1 - Math.min(1, Math.abs(music.cadence - body.cadence) / Math.max(1, music.cadence));
    const accent = 1 - Math.abs((music.accentPattern[0] ?? 0) - (body.accentPattern[0] ?? 0));
    const phase = 1 - Math.abs(music.barPhase - body.barPhase);
    return round(
        (cadence * 0.35 + accent * 0.25 + (1 - Math.abs(music.groove - body.groove)) * 0.2 + phase * 0.2) *
            Math.min(music.confidence, body.confidence),
    );
}
export type WorkoutPhase = "warmup" | "cadence-lock" | "push" | "recovery";
export function bodyAlignedJourney(phase: WorkoutPhase): { phase: WorkoutPhase; target: string; medicalClaim: false } {
    return {
        phase,
        target: {
            warmup: "gentle-accents",
            "cadence-lock": "stable-contact-alignment",
            push: "strong-aligned-moments",
            recovery: "lower-intensity-continuity",
        }[phase],
        medicalClaim: false,
    };
}
export interface BodyEnergySignal {
    activityLevel: number;
    heartRateRelative?: number;
    movementIntensity?: number;
    confidence: number;
}
export function bioadaptiveEnergy(
    signal: BodyEnergySignal,
    useCase: "workout" | "running" | "cooldown" | "emotion-inference",
): { allowed: boolean; interpretation: "physical-activation" | "none"; emotionClaim: false } {
    const allowed = useCase !== "emotion-inference" && signal.confidence >= 0.6;
    return { allowed, interpretation: allowed ? "physical-activation" : "none", emotionClaim: false };
}
