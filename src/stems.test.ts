import { expect, test } from "bun:test";

import { cachedStems, getStems, stemsAvailable } from "./stems";

// These run WITHOUT ENABLE_STEMS / a Demucs venv, so they verify the graceful-off
// path: nothing throws, nothing blocks, and "no stems" is reported cleanly. (The
// real separation is covered by the manual spike, which needs the ~2GB venv.)

test("stemsAvailable is false when stems are disabled / not installed", () => {
    expect(stemsAvailable()).toBe(false);
});

test("getStems resolves to null when unavailable (never throws, never hangs)", async () => {
    const res = await getStems("nonexistent-id", "/tmp/does-not-exist.opus");
    expect(res).toBeNull();
});

test("cachedStems is null for an unknown track", () => {
    expect(cachedStems("totally-unknown-track-id")).toBeNull();
});
