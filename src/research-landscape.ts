export type ResearchLandscapeDomain =
    | "adaptive-game-music"
    | "radio-automation"
    | "recommendation-systems"
    | "music-information-retrieval"
    | "realtime-audio"
    | "consumer-mixing";

export interface ResearchLandscapeEntry {
    domain: ResearchLandscapeDomain;
    contribution: string;
    beatcordDecision: string;
}

export interface SecondDepthResearchLandscape {
    version: 1;
    thesis: string;
    separation: readonly ["experience-intent", "musical-journey", "performance-style"];
    domains: readonly ResearchLandscapeEntry[];
}

export const SECOND_DEPTH_RESEARCH: SecondDepthResearchLandscape = {
    version: 1,
    thesis: "Experience, musical journey and mixing style are separate control dimensions.",
    separation: ["experience-intent", "musical-journey", "performance-style"],
    domains: [
        {
            domain: "adaptive-game-music",
            contribution: "Layered, stateful music can adapt continuously without interrupting narrative flow.",
            beatcordDecision: "Model session evolution separately from pair-level transition effects.",
        },
        {
            domain: "radio-automation",
            contribution: "Reliable scheduling requires early safe plans and deterministic fallbacks.",
            beatcordDecision: "Keep an executable transition available before expensive analysis finishes.",
        },
        {
            domain: "recommendation-systems",
            contribution: "The next item affects diversity and satisfaction beyond the immediate pair.",
            beatcordDecision: "Score route consequences over a multi-track horizon.",
        },
        {
            domain: "music-information-retrieval",
            contribution: "Beat, downbeat, structure, timbre and confidence form one musical representation.",
            beatcordDecision: "Share analysis evidence and preserve uncertainty per task.",
        },
        {
            domain: "realtime-audio",
            contribution: "Deadlines and commit points are part of correctness, not operational details.",
            beatcordDecision: "Separate speculative, prepared and committed transition states.",
        },
        {
            domain: "consumer-mixing",
            contribution: "Simple experiences can hide advanced technical controls while retaining user agency.",
            beatcordDecision: "Derive performance style automatically but allow a bounded explicit override.",
        },
    ],
};
