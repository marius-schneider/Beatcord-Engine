import type { ClubMusicalRole } from "./club-transition-planner-v2";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const round = (v: number) => Math.round(v * 1000) / 1000;

export interface PsychoacousticState {
    perceptualLoudness: number;
    masking: number;
    clarity: number;
    foregroundSeparation: number;
    transientDefinition: number;
    roughness: number;
    spatialSeparation: number;
}
export interface RoleMasking {
    masker: ClubMusicalRole;
    masked: ClubMusicalRole;
    spectralMasking: number;
    temporalMasking: number;
}
export interface PerceptualMaskingMatrix {
    sourceRoles: RoleMasking[];
}

export function buildMaskingMatrix(
    roles: readonly { role: ClubMusicalRole; spectralEnergy: readonly number[]; onsetDensity: number }[],
): PerceptualMaskingMatrix {
    const sourceRoles: RoleMasking[] = [];
    for (const masker of roles)
        for (const masked of roles) {
            if (masker === masked) continue;
            const dimensions = Math.max(masker.spectralEnergy.length, masked.spectralEnergy.length);
            const overlap =
                Array.from({ length: dimensions }, (_, index) =>
                    Math.min(masker.spectralEnergy[index] ?? 0, masked.spectralEnergy[index] ?? 0),
                ).reduce((sum, value) => sum + value, 0) / Math.max(1, dimensions);
            sourceRoles.push({
                masker: masker.role,
                masked: masked.role,
                spectralMasking: round(clamp01(overlap)),
                temporalMasking: round(clamp01(Math.min(masker.onsetDensity, masked.onsetDensity))),
            });
        }
    return { sourceRoles };
}

export function simultaneousMasking(matrix: PerceptualMaskingMatrix): {
    lowEndMuddiness: number;
    foregroundCompetition: number;
    total: number;
} {
    const low = matrix.sourceRoles.filter(
        (r) => ["kick", "bass"].includes(r.masker) && ["kick", "bass"].includes(r.masked),
    );
    const foreground = matrix.sourceRoles.filter(
        (r) => ["vocal", "lead"].includes(r.masker) && ["vocal", "lead"].includes(r.masked),
    );
    const mean = (rows: RoleMasking[]) =>
        rows.reduce((s, r) => s + r.spectralMasking * 0.7 + r.temporalMasking * 0.3, 0) / Math.max(1, rows.length);
    const lowEndMuddiness = clamp01(mean(low));
    const foregroundCompetition = clamp01(mean(foreground));
    return {
        lowEndMuddiness: round(lowEndMuddiness),
        foregroundCompetition: round(foregroundCompetition),
        total: round(clamp01(lowEndMuddiness * 0.5 + foregroundCompetition * 0.5)),
    };
}

export function perceptualMixClarity(
    state: PsychoacousticState,
    matrix: PerceptualMaskingMatrix,
): { clarityScore: number; rankCorrelationTarget: "subjective-clarity"; reasons: string[] } {
    const masking = simultaneousMasking(matrix);
    const clarityScore = clamp01(
        state.clarity * 0.25 +
            state.foregroundSeparation * 0.2 +
            state.transientDefinition * 0.14 +
            state.spatialSeparation * 0.14 +
            (1 - state.masking) * 0.1 +
            (1 - state.roughness) * 0.08 +
            (1 - masking.total) * 0.09,
    );
    const reasons = [
        masking.lowEndMuddiness > 0.55 && "low-end-masking",
        masking.foregroundCompetition > 0.55 && "foreground-competition",
        state.roughness > 0.65 && "roughness",
        state.transientDefinition < 0.4 && "weak-transients",
        state.spatialSeparation < 0.4 && "poor-spatial-separation",
    ].filter((v): v is string => Boolean(v));
    return { clarityScore: round(clarityScore), rankCorrelationTarget: "subjective-clarity", reasons };
}

export function psychoacousticGuardian(
    state: PsychoacousticState,
    matrix: PerceptualMaskingMatrix,
    floor = 0.6,
): { allowed: boolean; clarityScore: number; fallback: "none" | "reduce-overlap" | "isolate-role" | "structural-cut" } {
    const critic = perceptualMixClarity(state, matrix);
    const masking = simultaneousMasking(matrix);
    const fallback =
        critic.clarityScore >= floor
            ? "none"
            : masking.foregroundCompetition >= 0.65
              ? "isolate-role"
              : masking.lowEndMuddiness >= 0.6
                ? "reduce-overlap"
                : "structural-cut";
    return { allowed: critic.clarityScore >= floor, clarityScore: critic.clarityScore, fallback };
}
