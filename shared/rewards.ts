export const DAILY_LINK_REWARD = 25;
export const DAILY_LINK_SOURCE = "link4sub";
export const LINK_WAIT_SECONDS = 8;

export const LINK4SUB_LEVEL_1_URL = "https://link4sub.com/FhoKDghRKt";
export const LINK4SUB_LEVEL_2_URL = "https://link4sub.com/CzJAqmN7dl";
export const LINK4M_URL = "https://link4m.co/st?api=6aaa2d910aef892dca0a0bf8&url=https://lumen-dash-6t6qdyoe.manus.space/";

export type RewardTier = "level1" | "level2" | "link4m";

export const REWARD_TIERS: Record<RewardTier, { label: string; description: string; url: string; reward: number; waitSeconds: number }> = {
  level1: {
    label: "Cấp 1",
    description: "Nhiệm vụ tiêu chuẩn",
    url: LINK4SUB_LEVEL_1_URL,
    reward: 25,
    waitSeconds: LINK_WAIT_SECONDS,
  },
  level2: {
    label: "Cấp 2",
    description: "Nhiệm vụ nâng cao",
    url: LINK4SUB_LEVEL_2_URL,
    reward: 50,
    waitSeconds: LINK_WAIT_SECONDS,
  },
  link4m: {
    label: "Link4M",
    description: "Nhiệm vụ Link4M riêng",
    url: LINK4M_URL,
    reward: 25,
    waitSeconds: LINK_WAIT_SECONDS,
  },
};

export function getRemainingWaitSeconds(startedAt: Date | number, now = Date.now(), waitSeconds = LINK_WAIT_SECONDS) {
  const start = startedAt instanceof Date ? startedAt.getTime() : startedAt;
  return Math.max(0, Math.ceil(waitSeconds - (now - start) / 1000));
}
