import { goldenCase } from "../factory";

export default goldenCase({
    id: "house-house-easy",
    difficulty: "easy",
    description: "Stable, in-key club tracks with matching tempo and clean phrase exits.",
    current: { id: "house-a", title: "Deep House A", bpm: 124, camelot: "8A", energy: 0.76, danceability: 0.9 },
    next: { id: "house-b", title: "Deep House B", bpm: 125, camelot: "8A", energy: 0.8, danceability: 0.92 },
    expected: {
        acceptableTypes: ["blend", "bassdrop", "filter"],
        forbiddenTypes: ["cut", "spinback", "roll", "acapella"],
        minNaturalness: 68,
        maxArtifactRisk: 35,
        maxCueErrorBeats: 8,
    },
    panelRating: 4.7,
    notes: "Reference listeners prefer a long phrase blend or restrained bass swap.",
});
