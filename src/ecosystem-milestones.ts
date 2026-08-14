export interface EcosystemMilestone {
    id: number;
    name: string;
    capabilities: readonly string[];
}

export const ECOSYSTEM_MILESTONES: readonly EcosystemMilestone[] = [
    {
        id: 21,
        name: "session-core",
        capabilities: [
            "canonical-session-state",
            "device-roles",
            "transfer-vs-remote",
            "handoff",
            "commit-safe-handoff",
            "state-revision-protocol",
            "offline-continuation",
            "recovery",
        ],
    },
    {
        id: 22,
        name: "cross-platform-system-integration",
        capabilities: [
            "apple-now-playing",
            "android-media3",
            "windows-media",
            "mpris",
            "web-media-session",
            "media-key-control",
        ],
    },
    {
        id: 23,
        name: "social",
        capabilities: [
            "friends",
            "music-relationship-graph",
            "presence",
            "privacy-matrix",
            "join-session",
            "invite",
            "couple-sessions",
            "group-sessions",
            "roles",
            "permissions",
        ],
    },
    {
        id: 24,
        name: "crowd-session-reliability",
        capabilities: [
            "authoritative-state",
            "revision-protocol",
            "client-resync",
            "request-fairness",
            "presence-awareness",
            "moderation",
            "offline-host-safety",
        ],
    },
    {
        id: 25,
        name: "discord",
        capabilities: [
            "rich-presence",
            "session-join",
            "session-invite",
            "request-links",
            "community-button",
            "privacy-controls",
            "adapter-circuit-breaker",
        ],
    },
    {
        id: 26,
        name: "companion-devices",
        capabilities: ["phone-remote", "watch-remote", "tv-experience", "car-experience", "haptics", "lyrics-display"],
    },
    {
        id: 27,
        name: "lyrics-karaoke",
        capabilities: [
            "timed-lyrics",
            "word-level-timing",
            "translations",
            "vocal-reduction",
            "karaoke-queue",
            "singer-roles",
            "tv-karaoke",
            "microphone-support",
            "optional-pitch-guidance",
        ],
    },
    {
        id: 28,
        name: "integrations-sdk",
        capabilities: [
            "event-bus",
            "observation-sdk",
            "control-sdk",
            "permissions",
            "plugin-sandbox",
            "local-realtime-protocol",
            "network-event-protocol",
            "external-context-api",
        ],
    },
    {
        id: 29,
        name: "gaming-home-streaming",
        capabilities: [
            "gaming-context-adapter",
            "semantic-home-events",
            "lighting-profiles",
            "obs-overlay",
            "streamer-safe-metadata",
            "external-context-ttl",
        ],
    },
    {
        id: 30,
        name: "session-memories",
        capabilities: [
            "session-recap",
            "shared-memories",
            "peak-moments",
            "discovery-recap",
            "replay-vibe",
            "memory-search",
            "memory-as-journey-seed",
        ],
    },
    {
        id: 31,
        name: "ux",
        capabilities: [
            "simple-experience-screen",
            "journey-ui",
            "queue-journey-separation",
            "why-this-song",
            "undo",
            "session-override-scope",
            "command-palette",
            "request-eta",
            "confidence-aware-ui",
        ],
    },
    {
        id: 32,
        name: "accessibility",
        capabilities: [
            "screen-reader",
            "keyboard",
            "voice",
            "rotary-watch",
            "reduced-motion",
            "high-contrast",
            "scalable-lyrics",
            "alternative-visual-music",
        ],
    },
];

export function milestoneProgress(
    id: number,
    implemented: ReadonlySet<string>,
): {
    id: number;
    complete: number;
    total: number;
    ratio: number;
    missing: string[];
} {
    const milestone = ECOSYSTEM_MILESTONES.find((item) => item.id === id);
    if (!milestone) return { id, complete: 0, total: 0, ratio: 0, missing: [] };
    const missing = milestone.capabilities.filter((capability) => !implemented.has(capability));
    const complete = milestone.capabilities.length - missing.length;
    return {
        id,
        complete,
        total: milestone.capabilities.length,
        ratio: complete / milestone.capabilities.length,
        missing,
    };
}

export const ECOSYSTEM_STATE_MODEL = ["music-state", "session-state", "social-state", "device-state"] as const;
export const ECOSYSTEM_EXPERIENCE_PROMISE =
    "My music is where I am, with the people I choose, and adapts to the situation.";
