import { goldenCase } from "../factory";

export default goldenCase({
    id: "unstable-tempo",
    difficulty: "hard",
    description: "Low-confidence tempo estimates represent a drifting source performance.",
    current: { id: "drift-a", title: "Tempo Drift Live", bpm: 116, camelot: "9B", energy: 0.62, danceability: 0.58, acousticness: 0.5, confidence: 0.28 },
    next: { id: "steady-b", title: "Steady Pop", bpm: 120, camelot: "9B", energy: 0.66, danceability: 0.7, confidence: 0.86 },
    expected: {
        acceptableTypes: ["fade", "blend", "echo"],
        forbiddenTypes: ["bassdrop", "gate", "spinback", "roll", "riser", "acapella"],
        minNaturalness: 50,
        maxArtifactRisk: 48,
    },
    panelRating: 3.8,
    notes: "Prefer elastic-free continuity over brittle beat locking.",
});
