import type { TransitionType } from "./transition-planner";

export type ResearchCategory =
    | "consumer-automix"
    | "open-source-dj"
    | "music-information-retrieval"
    | "time-stretching"
    | "source-separation"
    | "loudness-quality"
    | "harmonic-mixing"
    | "community-feedback"
    | "tutorial";

export type ResearchKind =
    | "official-docs"
    | "standard"
    | "paper"
    | "open-source"
    | "industry-report"
    | "community"
    | "tutorial";

export type ResearchTheme =
    | "beat-phrase"
    | "structure"
    | "confidence"
    | "stretch-quality"
    | "stem-safety"
    | "loudness-quality"
    | "harmonic-context"
    | "rescue-fallback"
    | "session-journey"
    | "user-control"
    | "perceptual-evaluation";

export interface ResearchSource {
    id: string;
    title: string;
    category: ResearchCategory;
    kind: ResearchKind;
    url: string;
    themes: ResearchTheme[];
    capabilities: string[];
    takeaway: string;
    caveat?: string;
}

export interface ResearchRegistry {
    version: 1;
    sources: readonly ResearchSource[];
    coverage: Record<ResearchTheme, string[]>;
}

export interface ResearchDecisionInput {
    transitionType: TransitionType;
    tempoRatio: number;
    usesStems: boolean;
    harmonicOverlap: boolean;
    fixedTimestampFallback: boolean;
    hasStructuredRegions: boolean;
    overrideApplied: boolean;
    rescueAvailable: boolean;
    journeyPlanned: boolean;
}

export interface ResearchDecisionProvenance {
    version: 1;
    sourceIds: string[];
    themes: ResearchTheme[];
    reasons: string[];
}

export const RESEARCH_SOURCES: readonly ResearchSource[] = [
    {
        id: "spotify-automix",
        title: "Spotify Song Transitions / Automix",
        category: "consumer-automix",
        kind: "official-docs",
        url: "https://support.spotify.com/de/article/tracks-transitions/",
        themes: ["beat-phrase", "rescue-fallback"],
        capabilities: ["downbeat-detection", "deadline-fallback"],
        takeaway: "Separate simple crossfade from beat-aware automix while keeping the UX simple.",
    },
    {
        id: "apple-automix",
        title: "Apple Music AutoMix",
        category: "consumer-automix",
        kind: "official-docs",
        url: "https://www.apple.com/de/apple-music/",
        themes: ["beat-phrase", "stretch-quality"],
        capabilities: ["half-double-time", "deterministic-plans"],
        takeaway: "Beat matching and time stretching can be consumer-facing without exposing engine complexity.",
    },
    {
        id: "spotify-mix-report",
        title: "Spotify Mix transition controls",
        category: "consumer-automix",
        kind: "industry-report",
        url: "https://www.theverge.com/news/761290/spotify-playlist-mix-audio-transition-feature",
        themes: ["user-control"],
        capabilities: ["priority-rules", "debug-overlay"],
        takeaway: "Automatic transitions benefit from optional waveform, EQ, effect and mix-point control.",
    },
    {
        id: "mixxx-auto-dj",
        title: "Mixxx User Manual — Auto DJ",
        category: "open-source-dj",
        kind: "official-docs",
        url: "https://manual.mixxx.org/2.6/en/chapters/djing_with_mixxx",
        themes: ["structure", "rescue-fallback"],
        capabilities: ["intro-outro-regions", "rescue-engine"],
        takeaway: "Intro and outro regions are more robust than one generic timestamp.",
    },
    {
        id: "essentia-rhythm-extractor",
        title: "Essentia RhythmExtractor2013",
        category: "music-information-retrieval",
        kind: "official-docs",
        url: "https://essentia.upf.edu/reference/streaming_RhythmExtractor2013.html",
        themes: ["beat-phrase", "confidence"],
        capabilities: ["downbeat-detection", "confidence-fusion"],
        takeaway: "Retain beat positions and confidence, not only one global BPM.",
    },
    {
        id: "librosa-recurrence",
        title: "librosa Recurrence Matrix",
        category: "music-information-retrieval",
        kind: "official-docs",
        url: "https://librosa.org/doc/0.10.2/generated/librosa.segment.recurrence_matrix.html",
        themes: ["structure"],
        capabilities: ["song-structure-graph", "moments-detection"],
        takeaway: "Repeated regions can provide graph edges for chorus-, verse- and moment-like structure.",
    },
    {
        id: "librosa-subsegment",
        title: "librosa Subsegment",
        category: "music-information-retrieval",
        kind: "official-docs",
        url: "https://librosa.org/doc/main/generated/librosa.segment.subsegment.html",
        themes: ["structure"],
        capabilities: ["song-structure-graph"],
        takeaway: "Hierarchical subdivision can refine already detected musical sections.",
    },
    {
        id: "mirex-structural-segmentation",
        title: "MIREX Structural Segmentation",
        category: "music-information-retrieval",
        kind: "standard",
        url: "https://music-ir.org/mirex/wiki/2021%3AStructural_Segmentation",
        themes: ["structure", "perceptual-evaluation"],
        capabilities: ["song-structure-graph", "regression-library"],
        takeaway: "Structure detection needs its own ground-truth evaluation.",
    },
    {
        id: "mirex-downbeat",
        title: "MIREX Audio Downbeat Estimation",
        category: "music-information-retrieval",
        kind: "standard",
        url: "https://music-ir.org/mirex/wiki/2026%3AAudio_Downbeat_Estimation",
        themes: ["beat-phrase", "confidence"],
        capabilities: ["downbeat-detection", "meter-confidence"],
        takeaway: "Downbeat estimation is a distinct task from ordinary beat tracking.",
    },
    {
        id: "ableton-warping",
        title: "Ableton Live Audio Clips, Tempo and Warping",
        category: "time-stretching",
        kind: "official-docs",
        url: "https://www.ableton.com/en/live-manual/11/audio-clips-tempo-and-warping/",
        themes: ["stretch-quality"],
        capabilities: ["compute-budget", "half-double-time"],
        takeaway: "Stretch mode and compute cost should depend on the audio material.",
    },
    {
        id: "demucs",
        title: "Demucs",
        category: "source-separation",
        kind: "open-source",
        url: "https://github.com/facebookresearch/demucs",
        themes: ["stem-safety"],
        capabilities: ["stem-quality-gate"],
        takeaway: "Separated drums, bass, vocals and accompaniment enable role-aware mixing.",
        caveat: "The original repository is archived; architecture and research remain useful references.",
    },
    {
        id: "demucs-paper",
        title: "Music Source Separation in the Waveform Domain",
        category: "source-separation",
        kind: "paper",
        url: "https://arxiv.org/abs/1911.13254",
        themes: ["stem-safety", "rescue-fallback"],
        capabilities: ["stem-quality-gate", "rescue-engine"],
        takeaway: "Separation artifacts and bleed require a quality gate and full-mix fallback.",
    },
    {
        id: "banquet",
        title: "Banquet — Beyond Four Stems",
        category: "source-separation",
        kind: "paper",
        url: "https://arxiv.org/abs/2406.18747",
        themes: ["stem-safety"],
        capabilities: ["stem-quality-gate"],
        takeaway: "Instrument-specific separation can support more flexible future transition roles.",
    },
    {
        id: "msst",
        title: "Music-Source-Separation-Training",
        category: "source-separation",
        kind: "paper",
        url: "https://arxiv.org/abs/2607.23395",
        themes: ["stem-safety", "perceptual-evaluation"],
        capabilities: ["stem-quality-gate", "objective-metrics"],
        takeaway: "Model comparisons should be systematic, reproducible and artifact-aware.",
    },
    {
        id: "ebu-r128",
        title: "EBU R128",
        category: "loudness-quality",
        kind: "standard",
        url: "https://tech.ebu.ch/fr/publications/r128",
        themes: ["loudness-quality"],
        capabilities: ["objective-metrics", "quality-guardian"],
        takeaway: "Integrated loudness, loudness range and true peak are more useful than peak normalization alone.",
        caveat: "Broadcast targets should not be copied unchanged to music streaming.",
    },
    {
        id: "ebu-tech-3343",
        title: "EBU Tech 3343 Practical Guidelines",
        category: "loudness-quality",
        kind: "standard",
        url: "https://tech.ebu.ch/publications/tech3343",
        themes: ["loudness-quality"],
        capabilities: ["objective-metrics", "quality-guardian"],
        takeaway: "Operational loudness measurement needs practical validation guidance.",
    },
    {
        id: "djstudio-harmonic",
        title: "DJ.Studio Harmonic Mixing",
        category: "harmonic-mixing",
        kind: "tutorial",
        url: "https://dj.studio/blog/harmonic-mixing",
        themes: ["harmonic-context"],
        capabilities: ["harmonic-bridges"],
        takeaway: "Key compatibility supports continuity and deliberate energy movement but is not an absolute rule.",
    },
    {
        id: "djstudio-compatible-keys",
        title: "DJ.Studio Compatible Keys",
        category: "harmonic-mixing",
        kind: "tutorial",
        url: "https://dj.studio/blog/compatible-keys",
        themes: ["harmonic-context"],
        capabilities: ["harmonic-bridges"],
        takeaway: "Camelot-like navigation provides explainable harmonic neighborhoods.",
    },
    {
        id: "beatmatch-automatic-dj",
        title: "r/Beatmatch — Automatic DJ software",
        category: "community-feedback",
        kind: "community",
        url: "https://www.reddit.com/r/Beatmatch/comments/pvpjg0/anyone_knows_about_any_automatic_dj_software_ai/",
        themes: ["structure", "rescue-fallback"],
        capabilities: ["song-structure-graph", "rescue-engine"],
        takeaway: "Unusual phrases and structures expose brittle Auto-DJ assumptions.",
    },
    {
        id: "beatmatch-automix-ai",
        title: "r/Beatmatch — Thoughts about Automix / AI",
        category: "community-feedback",
        kind: "community",
        url: "https://www.reddit.com/r/Beatmatch/comments/1dhkgwi",
        themes: ["beat-phrase", "session-journey"],
        capabilities: ["moments-detection", "energy-journey-rating"],
        takeaway: "A technically clean transition can still happen at the wrong musical moment.",
    },
    {
        id: "beatmatch-phrasing",
        title: "r/Beatmatch — Beatmatching, Phrasing & Transitions",
        category: "community-feedback",
        kind: "community",
        url: "https://www.reddit.com/r/Beatmatch/comments/1u73x0r/been_djing_for_a_month_i_can_do_clean_transitions/",
        themes: ["beat-phrase", "harmonic-context", "stem-safety"],
        capabilities: ["downbeat-detection", "harmonic-bridges", "stem-quality-gate"],
        takeaway: "Phrasing, EQ ownership, bass swaps and vocal clashes must be evaluated together.",
    },
    {
        id: "djay-automix-tutorial",
        title: "Algoriddim djay Pro AI Automix Tutorial",
        category: "tutorial",
        kind: "tutorial",
        url: "https://www.youtube.com/watch?v=_x8XZC74Flg",
        themes: ["user-control", "rescue-fallback"],
        capabilities: ["priority-rules", "transition-reasoning"],
        takeaway: "Automatic behavior should offer editable start points, end points and transition styles.",
    },
] as const;

export function researchRegistry(): ResearchRegistry {
    const themes = [
        "beat-phrase",
        "structure",
        "confidence",
        "stretch-quality",
        "stem-safety",
        "loudness-quality",
        "harmonic-context",
        "rescue-fallback",
        "session-journey",
        "user-control",
        "perceptual-evaluation",
    ] satisfies ResearchTheme[];
    return {
        version: 1,
        sources: RESEARCH_SOURCES,
        coverage: Object.fromEntries(
            themes.map((theme) => [
                theme,
                RESEARCH_SOURCES.filter((source) => source.themes.includes(theme)).map((source) => source.id),
            ]),
        ) as Record<ResearchTheme, string[]>,
    };
}

/** Select only the references relevant to one concrete Director decision. */
export function researchProvenanceForDecision(input: ResearchDecisionInput): ResearchDecisionProvenance {
    const sourceIds = new Set<string>(["essentia-rhythm-extractor", "mirex-downbeat", "beatmatch-phrasing"]);
    const reasons = ["beat, downbeat and phrase evidence shape every transition"];
    if (input.hasStructuredRegions) {
        sourceIds.add("mixxx-auto-dj");
        sourceIds.add("librosa-recurrence");
        reasons.push("structured intro/outro regions selected");
    }
    if (input.fixedTimestampFallback) reasons.push("musical boundary unavailable; safe timestamp fallback retained");
    if (Math.abs(input.tempoRatio - 1) > 0.001) {
        sourceIds.add("ableton-warping");
        reasons.push("material-aware time stretching applied");
    }
    if (input.usesStems || input.transitionType === "acapella") {
        sourceIds.add("demucs-paper");
        reasons.push("stem use requires artifact and bleed safeguards");
    }
    if (input.harmonicOverlap) {
        sourceIds.add("djstudio-harmonic");
        reasons.push("harmonic compatibility used as context");
    }
    if (input.overrideApplied) {
        sourceIds.add("spotify-mix-report");
        sourceIds.add("djay-automix-tutorial");
        reasons.push("explicit user control supersedes automatic preference within safety limits");
    }
    if (input.rescueAvailable) {
        sourceIds.add("mixxx-auto-dj");
        sourceIds.add("demucs-paper");
        reasons.push("full-mix and simple-transition rescue paths remain available");
    }
    if (input.journeyPlanned) {
        sourceIds.add("beatmatch-automix-ai");
        reasons.push("pair decision is evaluated inside the session journey");
    }
    const selected = RESEARCH_SOURCES.filter((source) => sourceIds.has(source.id));
    return {
        version: 1,
        sourceIds: selected.map((source) => source.id),
        themes: [...new Set(selected.flatMap((source) => source.themes))],
        reasons,
    };
}
