import { goldenCase } from "../factory";

export default goldenCase({
    id: "bad-stems",
    difficulty: "hard",
    description: "Dense vocal material models a pair whose separated stems failed quality gating.",
    current: { id: "stem-a", title: "Leaky Stem Source", bpm: 128, camelot: "7A", energy: 0.84, danceability: 0.9, vocalness: 0.82, complexity: 0.82 },
    next: { id: "stem-b", title: "Dense Vocal Target", bpm: 128, camelot: "7A", energy: 0.82, danceability: 0.88, vocalness: 0.78, complexity: 0.8 },
    expected: {
        acceptableTypes: ["bassdrop", "filter", "blend", "echo"],
        forbiddenTypes: ["acapella"],
        minNaturalness: 50,
        maxArtifactRisk: 62,
    },
    panelRating: 3.9,
    notes: "Stem-dependent acapella is forbidden; use full-mix-safe ownership instead.",
});
