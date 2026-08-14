import { goldenCase, section } from "../factory";

export default goldenCase({
    id: "vocal-clash",
    difficulty: "hard",
    description: "Both tracks expose lead vocals and hooks around the nominal handoff.",
    current: {
        id: "vocal-a", title: "Vocal Hook A", bpm: 120, camelot: "6A", energy: 0.72, danceability: 0.8, vocalness: 0.95,
        sections: [section("intro", 0, 16, 0.4, 0.4, 0.5), section("chorus", 16, 176, 0.78, 0.98, 0.8), section("outro", 176, 192, 0.65, 0.92, 0.65)],
    },
    next: {
        id: "vocal-b", title: "Vocal Hook B", bpm: 121, camelot: "6A", energy: 0.76, danceability: 0.82, vocalness: 0.96,
        sections: [section("chorus", 0, 176, 0.8, 0.99, 0.82), section("outro", 176, 192, 0.5, 0.5, 0.5)],
    },
    expected: {
        acceptableTypes: ["bassdrop", "filter", "echo", "cut"],
        forbiddenTypes: ["acapella"],
        minNaturalness: 48,
        maxArtifactRisk: 64,
    },
    panelRating: 3.7,
    notes: "Foreground ownership must be handed off, never stacked as an acapella.",
});
