import { and, count, desc, eq, sql, sum } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { coinTransactions, InsertUser, rewardAttempts, users } from "../drizzle/schema";
import { DAILY_LINK_SOURCE, getRemainingWaitSeconds, REWARD_TIERS, type RewardTier } from "@shared/rewards";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function verifyPassword(password: string, stored: string) {
  const [salt, hex] = stored.split(":");
  if (!salt || !hex) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hex, "hex");
  return expected.length === candidate.length && timingSafeEqual(candidate, expected);
}

export async function createEmailUser(name: string, email: string, password: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, normalizedEmail)).limit(1);
  if (existing.length) return { ok: false as const, reason: "email_exists" as const };
  const openId = `email_${randomUUID()}`.slice(0, 64);
  await db.insert(users).values({ openId, name: name.trim(), email: normalizedEmail, passwordHash: hashPassword(password), loginMethod: "email" });
  const user = await getUserByOpenId(openId);
  return user ? { ok: true as const, user } : { ok: false as const, reason: "create_failed" as const };
}

export async function authenticateEmailUser(email: string, password: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const normalizedEmail = email.trim().toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
  if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) return null;
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
  return user;
}

export async function getCoinDashboard(userId: number) {
  const db = await getDb();
  if (!db) return { balance: 0, transactions: [], todayClaimed: false, todayClaimedByTier: { level1: false, level2: false, link4m: false, layma: false }, todayClaimsByTier: { level1: 0, level2: 0, link4m: 0, layma: 0 }, totalEarned: 0, totalClaims: 0, lastClaimAt: null };
  const dateKey = new Date().toISOString().slice(0, 10);
  const [user] = await db.select({ coinBalance: users.coinBalance }).from(users).where(eq(users.id, userId)).limit(1);
  const transactions = await db.select({ id: coinTransactions.id, amount: coinTransactions.amount, source: coinTransactions.source, createdAt: coinTransactions.createdAt }).from(coinTransactions).where(eq(coinTransactions.userId, userId)).orderBy(desc(coinTransactions.createdAt)).limit(10);
  const [todayLevel1] = await db.select({ id: coinTransactions.id }).from(coinTransactions).where(and(eq(coinTransactions.userId, userId), eq(coinTransactions.claimKey, `${DAILY_LINK_SOURCE}:level1:${dateKey}`))).limit(1);
  const [todayLevel2] = await db.select({ id: coinTransactions.id }).from(coinTransactions).where(and(eq(coinTransactions.userId, userId), eq(coinTransactions.claimKey, `${DAILY_LINK_SOURCE}:level2:${dateKey}`))).limit(1);
  const [todayLink4m] = await db.select({ id: coinTransactions.id }).from(coinTransactions).where(and(eq(coinTransactions.userId, userId), eq(coinTransactions.claimKey, `link4m:link4m:${dateKey}`))).limit(1);
  const todayRows = await db.select({ claimKey: coinTransactions.claimKey }).from(coinTransactions).where(and(eq(coinTransactions.userId, userId), sql`${coinTransactions.claimKey} LIKE ${`%:${dateKey}%`}`));
  const todayClaimsByTier = { level1: 0, level2: 0, link4m: 0, layma: 0 };
  todayRows.forEach(({ claimKey }) => {
    const tier = claimKey.split(":")[1] as keyof typeof todayClaimsByTier;
    if (tier in todayClaimsByTier) todayClaimsByTier[tier] += 1;
  });
  const [stats] = await db.select({ totalEarned: sum(coinTransactions.amount), totalClaims: count(coinTransactions.id) }).from(coinTransactions).where(eq(coinTransactions.userId, userId));
  return { balance: user?.coinBalance ?? 0, transactions, todayClaimed: Object.values(todayClaimsByTier).some(Boolean), todayClaimedByTier: { level1: todayClaimsByTier.level1 >= 4, level2: todayClaimsByTier.level2 >= 4, link4m: todayClaimsByTier.link4m >= 4, layma: todayClaimsByTier.layma >= 4 }, todayClaimsByTier, totalEarned: Number(stats?.totalEarned ?? 0), totalClaims: Number(stats?.totalClaims ?? 0), lastClaimAt: transactions[0]?.createdAt ?? null };
}

export async function startRewardAttempt(userId: number, tier: RewardTier) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const token = `${randomUUID()}-${randomUUID()}`;
  const [attempt] = await db.insert(rewardAttempts).values({ userId, tier, token }).$returningId();
  const returnUrl = process.env.REWARD_RETURN_URL || "https://lumenrewards-8fsahncj.manus.space";
  const callbackUrl = `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}reward_token=${encodeURIComponent(token)}`;
  const baseUrl = REWARD_TIERS[tier].url;
  const url = tier === "link4m"
    ? baseUrl.replace(/url=[^&]*/, `url=${encodeURIComponent(callbackUrl)}`)
    : `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}reward_token=${encodeURIComponent(token)}`;
  return { attemptId: attempt.id, token, tier, url, callbackUrl, reward: REWARD_TIERS[tier].reward };
}

export async function markRewardAttemptReturned(userId: number, token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [attempt] = await db.select().from(rewardAttempts).where(and(eq(rewardAttempts.userId, userId), eq(rewardAttempts.token, token))).limit(1);
  if (!attempt || attempt.completedAt) return { returned: false, reason: "invalid_attempt" as const };
  await db.update(rewardAttempts).set({ returnedAt: new Date() }).where(eq(rewardAttempts.id, attempt.id));
  const completion = await completeRewardAttempt(userId, token, true);
  return { ...completion, returned: true, reason: "returned" as const };
}

export async function cancelRewardAttempt(userId: number, token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(rewardAttempts).set({ completedAt: new Date() }).where(and(eq(rewardAttempts.userId, userId), eq(rewardAttempts.token, token), sql`${rewardAttempts.completedAt} IS NULL`));
  return { cancelled: true } as const;
}

export async function completeRewardAttempt(userId: number, token: string, verifiedExternally = false) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [attempt] = await db.select().from(rewardAttempts).where(and(eq(rewardAttempts.userId, userId), eq(rewardAttempts.token, token))).limit(1);
  const [user] = await db.select({ coinBalance: users.coinBalance }).from(users).where(eq(users.id, userId)).limit(1);
  if (!attempt) return { claimed: false, accepted: false, reason: "invalid_attempt" as const, balance: user?.coinBalance ?? 0 };
  if (attempt.completedAt) return { claimed: false, accepted: true, reason: "already_completed" as const, balance: user?.coinBalance ?? 0 };
  const retryAfterSeconds = getRemainingWaitSeconds(attempt.startedAt, Date.now(), REWARD_TIERS[attempt.tier].waitSeconds);
  if (!verifiedExternally && !attempt.returnedAt) return { claimed: false, accepted: false, reason: "not_returned" as const, balance: user?.coinBalance ?? 0 };
  if (retryAfterSeconds > 0 && !verifiedExternally) return { claimed: false, accepted: false, reason: "too_early" as const, retryAfterSeconds, balance: user?.coinBalance ?? 0 };
  const dateKey = new Date().toISOString().slice(0, 10);
  const source = attempt.tier === "link4m" ? "link4m" : attempt.tier === "layma" ? "layma" : DAILY_LINK_SOURCE;
  const existingToday = await db.select({ claimKey: coinTransactions.claimKey }).from(coinTransactions).where(and(eq(coinTransactions.userId, userId), sql`${coinTransactions.claimKey} LIKE ${`${source}:${attempt.tier}:${dateKey}:%`}`));
  if (existingToday.length >= 4) return { claimed: false, accepted: false, reason: "daily_limit" as const, balance: user?.coinBalance ?? 0 };
  const claimKey = `${source}:${attempt.tier}:${dateKey}:${existingToday.length + 1}`;
  const [existing] = await db.select({ id: coinTransactions.id }).from(coinTransactions).where(and(eq(coinTransactions.userId, userId), eq(coinTransactions.claimKey, claimKey))).limit(1);
  if (existing) {
    await db.update(rewardAttempts).set({ completedAt: new Date() }).where(eq(rewardAttempts.id, attempt.id));
    return { claimed: false, accepted: true, reason: "already_claimed_today" as const, balance: user?.coinBalance ?? 0 };
  }
  const amount = REWARD_TIERS[attempt.tier].reward;
  await db.transaction(async (tx) => {
    await tx.insert(coinTransactions).values({ userId, amount, source, claimKey });
    await tx.update(users).set({ coinBalance: sql`${users.coinBalance} + ${amount}` }).where(eq(users.id, userId));
    await tx.update(rewardAttempts).set({ completedAt: new Date() }).where(eq(rewardAttempts.id, attempt.id));
  });
  const [updatedUser] = await db.select({ coinBalance: users.coinBalance }).from(users).where(eq(users.id, userId)).limit(1);
  return { claimed: true, accepted: true, reason: "claimed" as const, balance: updatedUser?.coinBalance ?? amount, reward: amount };
}

export async function completeVerifiedRewardAttempt(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [attempt] = await db.select({ userId: rewardAttempts.userId }).from(rewardAttempts).where(eq(rewardAttempts.token, token)).limit(1);
  if (!attempt) return { claimed: false, accepted: false, reason: "invalid_attempt" as const, balance: 0 };
  return completeRewardAttempt(attempt.userId, token, true);
}

export async function getLeaderboard(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: users.id, name: users.name, coinBalance: users.coinBalance, createdAt: users.createdAt }).from(users).orderBy(desc(users.coinBalance), users.createdAt).limit(limit);
}

export async function getAdminOverview() {
  const db = await getDb();
  if (!db) return { metrics: { totalUsers: 0, totalCoins: 0, totalClaims: 0, openAttempts: 0, flaggedUsers: 0 }, claims: [], fraudSignals: [], attemptStats: { success: 0, failed: 0, open: 0, successRate: 0 } };
  const [userStats] = await db.select({ totalUsers: count(users.id), totalCoins: sum(users.coinBalance) }).from(users);
  const [claimStats] = await db.select({ totalClaims: count(coinTransactions.id) }).from(coinTransactions);
  const claims = await db.select({ id: coinTransactions.id, userId: coinTransactions.userId, userName: users.name, userEmail: users.email, amount: coinTransactions.amount, source: coinTransactions.source, claimKey: coinTransactions.claimKey, createdAt: coinTransactions.createdAt }).from(coinTransactions).innerJoin(users, eq(users.id, coinTransactions.userId)).orderBy(desc(coinTransactions.createdAt)).limit(40);
  const attempts = await db.select({ id: rewardAttempts.id, userId: rewardAttempts.userId, userName: users.name, userEmail: users.email, tier: rewardAttempts.tier, token: rewardAttempts.token, startedAt: rewardAttempts.startedAt, returnedAt: rewardAttempts.returnedAt, completedAt: rewardAttempts.completedAt }).from(rewardAttempts).innerJoin(users, eq(users.id, rewardAttempts.userId)).orderBy(desc(rewardAttempts.startedAt)).limit(150);
  const now = Date.now();
  const recent = attempts.filter((attempt) => now - new Date(attempt.startedAt).getTime() <= 15 * 60 * 1000);
  const counts = new Map<number, number>();
  recent.forEach((attempt) => counts.set(attempt.userId, (counts.get(attempt.userId) ?? 0) + 1));
  const incompleteCounts = new Map<number, number>();
  attempts.filter((attempt) => !attempt.completedAt && now - new Date(attempt.startedAt).getTime() <= 24 * 60 * 60 * 1000).forEach((attempt) => incompleteCounts.set(attempt.userId, (incompleteCounts.get(attempt.userId) ?? 0) + 1));
  const fraudSignals = attempts.filter((attempt) => (counts.get(attempt.userId) ?? 0) >= 4 || (incompleteCounts.get(attempt.userId) ?? 0) >= 3).slice(0, 30).map((attempt) => ({ id: attempt.id, userId: attempt.userId, userName: attempt.userName || "Lumen member", userEmail: attempt.userEmail || "", tier: attempt.tier, startedAt: attempt.startedAt, completed: Boolean(attempt.completedAt), signal: (counts.get(attempt.userId) ?? 0) >= 4 ? "Nhiều attempt trong 15 phút" : "Nhiều attempt chưa hoàn tất trong 24 giờ" }));
  const success = attempts.filter((attempt) => Boolean(attempt.completedAt && attempt.returnedAt)).length;
  const failed = attempts.filter((attempt) => Boolean(attempt.completedAt && !attempt.returnedAt)).length;
  const open = attempts.filter((attempt) => !attempt.completedAt).length;
  return { metrics: { totalUsers: Number(userStats?.totalUsers ?? 0), totalCoins: Number(userStats?.totalCoins ?? 0), totalClaims: Number(claimStats?.totalClaims ?? 0), openAttempts: open, flaggedUsers: new Set(fraudSignals.map((signal) => signal.userId)).size }, claims, fraudSignals, attemptStats: { success, failed, open, successRate: success + failed ? Math.round((success / (success + failed)) * 100) : 0 } };
}
