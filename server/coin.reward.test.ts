import { describe, expect, it } from "vitest";
import { COIN_REWARD, LINK_WAIT_SECONDS, REWARD_TIERS, resolveMissionLink } from "../client/src/lib/rewards";

describe("Link4Sub reward flow", () => {
  it("uses the configured level URLs", () => {
    expect(REWARD_TIERS.level1.url).toBe("https://link4sub.com/FhoKDghRKt");
    expect(REWARD_TIERS.level2.url).toBe("https://link4sub.com/CzJAqmN7dl");
    expect(REWARD_TIERS.link4m.url).toBe("https://link4m.co/st?api=6aaa2d910aef892dca0a0bf8&url=https://vexzstudio-jrsg.onrender.com/");
  });

  it("exposes positive rewards and a bounded completion wait", () => {
    expect(COIN_REWARD).toBe(14);
    expect(REWARD_TIERS.link4m.reward).toBe(14);
    expect(REWARD_TIERS.level2.reward).toBe(20);
    expect(REWARD_TIERS.level2.reward).toBeGreaterThan(REWARD_TIERS.level1.reward);
    expect(LINK_WAIT_SECONDS).toBeGreaterThan(0);
    expect(LINK_WAIT_SECONDS).toBeLessThanOrEqual(30);
  });

  it("resolves only the configured tier URLs", () => {
    expect(resolveMissionLink("level1")).toBe(REWARD_TIERS.level1.url);
    expect(resolveMissionLink("level2")).toBe(REWARD_TIERS.level2.url);
    expect(resolveMissionLink("link4m")).toBe(REWARD_TIERS.link4m.url);
  });
});
