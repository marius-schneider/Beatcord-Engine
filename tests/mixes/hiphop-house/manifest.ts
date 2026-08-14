import { goldenCase } from "../factory";

export default goldenCase({
    id: "hiphop-house",
    difficulty: "hard",
    description: "Hip-hop groove into four-on-the-floor house with different rhythmic ownership.",
    current: { id: "hiphop-a", title: "Hip Hop Rap Cut", bpm: 92, camelot: "7A", energy: 0.74, danceability: 0.72, vocalness: 0.78 },
    next: { id: "house-d", title: "House Club Tool", bpm: 124, camelot: "8A", energy: 0.84, danceability: 0.94, vocalness: 0.05 },
    expected: {
        acceptableTypes: ["cut", "filter", "spinback", "roll", "echo"],
        forbiddenTypes: ["blend", "acapella"],
        minNaturalness: 50,
        maxArtifactRisk: 52,
    },
    panelRating: 4,
    notes: "Use a clear rhythmic punctuation; a long full-mix overlap sounds unstable.",
});
