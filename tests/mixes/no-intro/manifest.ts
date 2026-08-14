import { goldenCase, section } from "../factory";

export default goldenCase({
    id: "no-intro",
    difficulty: "hard",
    description: "The incoming master starts immediately with full arrangement and no clean intro.",
    current: { id: "entry-a", title: "Outgoing Club", bpm: 126, camelot: "12A", energy: 0.78, danceability: 0.9, vocalness: 0.18 },
    next: {
        id: "entry-b", title: "Immediate Full Mix", bpm: 126, camelot: "12A", energy: 0.82, danceability: 0.9, vocalness: 0.58, introSec: 0,
        sections: [section("chorus", 0, 176, 0.84, 0.62, 0.9), section("outro", 176, 192, 0.5, 0.1, 0.6)],
    },
    expected: {
        acceptableTypes: ["bassdrop", "filter", "cut", "echo"],
        forbiddenTypes: ["acapella"],
        minNaturalness: 50,
        maxArtifactRisk: 58,
    },
    panelRating: 3.6,
    notes: "Avoid an exposed long overlap against the fully arranged first bar.",
});
