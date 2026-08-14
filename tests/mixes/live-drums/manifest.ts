import { goldenCase } from "../factory";

export default goldenCase({
    id: "live-drums",
    difficulty: "hard",
    description: "Percussive live drums require transient-safe stretching and tolerant phrasing.",
    current: { id: "live-a", title: "Live Drums Funk", bpm: 118, camelot: "1A", energy: 0.79, danceability: 0.68, acousticness: 0.52, complexity: 0.72, confidence: 0.56 },
    next: { id: "live-b", title: "Live Drums Disco", bpm: 121, camelot: "1A", energy: 0.81, danceability: 0.76, acousticness: 0.42, complexity: 0.68, confidence: 0.56 },
    expected: {
        acceptableTypes: ["blend", "filter", "bassdrop"],
        forbiddenTypes: ["spinback", "roll", "riser", "acapella"],
        minNaturalness: 58,
        maxArtifactRisk: 48,
    },
    panelRating: 4.1,
    notes: "A restrained blend works when transient risk stays bounded.",
});
