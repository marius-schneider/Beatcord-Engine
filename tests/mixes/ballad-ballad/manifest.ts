import { goldenCase } from "../factory";

export default goldenCase({
    id: "ballad-ballad",
    difficulty: "easy",
    description: "Two sparse acoustic ballads whose full song endings must be respected.",
    current: { id: "ballad-a", title: "Acoustic Ballad A", bpm: 76, camelot: "2B", energy: 0.28, danceability: 0.2, acousticness: 0.9, vocalness: 0.55 },
    next: { id: "ballad-b", title: "Acoustic Ballad B", bpm: 72, camelot: "3B", energy: 0.25, danceability: 0.18, acousticness: 0.92, vocalness: 0.5 },
    expected: {
        acceptableTypes: ["fade", "echo", "blend"],
        forbiddenTypes: ["cut", "bassdrop", "gate", "spinback", "roll", "riser", "acapella"],
        minNaturalness: 65,
        maxArtifactRisk: 42,
    },
    panelRating: 4.6,
    notes: "Long gentle handoff; no show effect or hard entry.",
});
