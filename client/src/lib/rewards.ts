import { LINK_WAIT_SECONDS, REWARD_TIERS, type RewardTier } from "@shared/rewards";

export { LINK_WAIT_SECONDS, REWARD_TIERS };
export const COIN_REWARD = REWARD_TIERS.level1.reward;

export function resolveMissionLink(tier: RewardTier = "level1") {
  return REWARD_TIERS[tier].url;
}
