import { goldenCase } from "../factory";

export default goldenCase({
    id: "bpm-half-double",
    difficulty: "medium",
    description: "Equivalent 64/128 BPM grids must reconcile as half/double time.",
    current: { id: "half-a", title: "Half Time Electronic", bpm: 64, camelot: "10A", energy: 0.76, danceability: 0.78 },
    next: { id: "double-b", title: "Double Time Electronic", bpm: 128, camelot: "10A", energy: 0.8, danceability: 0.86 },
    expected: {
        acceptableTypes: ["blend", "bassdrop", "filter"],
        forbiddenTypes: ["cut", "spinback", "roll", "acapella"],
        minNaturalness: 66,
        maxArtifactRisk: 38,
    },
    panelRating: 4.5,
    notes: "Treat the tempi as equivalent and preserve the bar relationship.",
});
