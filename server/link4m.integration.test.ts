import { describe, expect, it } from "vitest";
import { REWARD_TIERS } from "@shared/rewards";

describe("Link4Sub integration", () => {
  it("uses both configured Link4Sub short links", () => {
    expect(REWARD_TIERS.level1.url).toBe("https://link4sub.com/FhoKDghRKt");
    expect(REWARD_TIERS.level2.url).toBe("https://link4sub.com/CzJAqmN7dl");
  });
});
