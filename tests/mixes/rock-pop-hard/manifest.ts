import { goldenCase } from "../factory";

export default goldenCase({
    id: "rock-pop-hard",
    difficulty: "hard",
    description: "Live-feel rock into polished pop with a tempo and timbre discontinuity.",
    current: { id: "rock-a", title: "Live Rock Anthem", bpm: 132, camelot: "5B", energy: 0.82, danceability: 0.18, acousticness: 0.42, confidence: 0.72 },
    next: { id: "pop-b", title: "Modern Pop", bpm: 104, camelot: "11A", energy: 0.64, danceability: 0.7, vocalness: 0.62 },
    expected: {
        acceptableTypes: ["cut", "echo", "fade"],
        forbiddenTypes: ["blend", "bassdrop", "acapella"],
        minNaturalness: 50,
        maxArtifactRisk: 48,
    },
    panelRating: 3.8,
    notes: "A decisive boundary or ring-out is safer than stretching the live performance.",
});
