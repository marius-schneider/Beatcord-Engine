import { goldenCase, section } from "../factory";

export default goldenCase({
    id: "long-outro",
    difficulty: "medium",
    description: "The outgoing record has a long, clean instrumental outro with multiple safe phrases.",
    current: {
        id: "outro-a", title: "Extended Outro", durationSec: 224, bpm: 122, camelot: "5A", energy: 0.65, danceability: 0.78, vocalness: 0.2,
        sections: [section("intro", 0, 16, 0.4, 0.05, 0.6), section("unknown", 16, 160, 0.72, 0.35, 0.78), section("outro", 160, 224, 0.42, 0.02, 0.55)],
    },
    next: { id: "outro-b", title: "Clean Entry House", bpm: 123, camelot: "5A", energy: 0.7, danceability: 0.82, vocalness: 0.12 },
    expected: {
        acceptableTypes: ["blend", "filter", "echo", "bassdrop"],
        forbiddenTypes: ["spinback", "roll", "acapella"],
        minNaturalness: 66,
        maxArtifactRisk: 35,
        maxCueErrorBeats: 4,
    },
    panelRating: 4.7,
    notes: "Exploit the clean outro and stay on its phrase grid.",
});
