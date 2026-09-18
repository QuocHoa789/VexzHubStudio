import { describe, expect, it } from "vitest";
import { getRemainingWaitSeconds, REWARD_TIERS } from "@shared/rewards";

describe("reward attempt verification", () => {
  it("rejects an attempt before the minimum dwell time", () => {
    const startedAt = 1_000_000;
    expect(getRemainingWaitSeconds(startedAt, startedAt + 3_000, REWARD_TIERS.level1.waitSeconds)).toBe(5);
    expect(getRemainingWaitSeconds(startedAt, startedAt + 8_000, REWARD_TIERS.level1.waitSeconds)).toBe(0);
  });

  it("keeps the two configured tiers distinct", () => {
    expect(REWARD_TIERS.level1.url).not.toBe(REWARD_TIERS.level2.url);
    expect(REWARD_TIERS.level2.reward).toBeGreaterThan(REWARD_TIERS.level1.reward);
  });

  it("includes the Layma mission", () => {
    expect(REWARD_TIERS.layma.url).toBe("https://layma.net/lzwmf4jvH");
    expect(REWARD_TIERS.layma.reward).toBe(14);
  });
});
