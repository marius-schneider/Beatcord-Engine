import { goldenCase } from "../factory";

export default goldenCase({
    id: "pop-house-medium",
    difficulty: "medium",
    description: "Vocal pop into house at close tempo but a harmonically distant key.",
    current: { id: "pop-a", title: "Vocal Pop", bpm: 118, camelot: "3B", energy: 0.67, danceability: 0.72, vocalness: 0.72 },
    next: { id: "house-c", title: "House Instrumental", bpm: 122, camelot: "9A", energy: 0.79, danceability: 0.9, vocalness: 0.08 },
    expected: {
        acceptableTypes: ["filter", "echo", "cut", "gate"],
        forbiddenTypes: ["acapella", "spinback"],
        minNaturalness: 58,
        maxArtifactRisk: 45,
    },
    panelRating: 4.1,
    notes: "Mask the key change; avoid carrying the outgoing vocal into the new harmony.",
});
