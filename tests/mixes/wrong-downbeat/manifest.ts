import { goldenCase } from "../factory";

export default goldenCase({
    id: "wrong-downbeat",
    difficulty: "hard",
    description: "A deliberately shifted downbeat annotation exercises confidence-based restraint.",
    current: { id: "phase-a", title: "Ambiguous Pickup A", bpm: 120, camelot: "4A", energy: 0.7, danceability: 0.82, confidence: 0.44, downbeatOffset: 0.5 },
    next: { id: "phase-b", title: "Ambiguous Pickup B", bpm: 120, camelot: "4A", energy: 0.74, danceability: 0.84, confidence: 0.44, downbeatOffset: 0.5 },
    expected: {
        acceptableTypes: ["blend", "filter", "fade"],
        forbiddenTypes: ["bassdrop", "spinback", "roll", "riser", "acapella"],
        minNaturalness: 54,
        maxArtifactRisk: 45,
        maxCueErrorBeats: 8,
    },
    panelRating: 3.9,
    notes: "Do not commit to a high-impact drop while the one-beat is uncertain.",
});
