import { MongoClient, type ClientSession, type Collection, type Db } from "mongodb";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { ENV } from "./_core/env";
import { DAILY_LINK_SOURCE, getRemainingWaitSeconds, REWARD_TIERS, type RewardTier } from "@shared/rewards";
import type { CoinTransaction, InsertUser, RewardAttempt, User } from "../drizzle/schema";

let client: MongoClient | null = null;
let database: Db | null = null;
let indexesReady: Promise<void> | null = null;

async function ensureIndexes(db: Db) {
  await Promise.all([
    db.collection<User>("users").createIndex({ openId: 1 }, { unique: true }),
    db.collection<User>("users").createIndex({ username: 1 }, { unique: true, sparse: true }),
    db.collection<CoinTransaction>("coinTransactions").createIndex({ userId: 1, claimKey: 1 }, { unique: true }),
    db.collection<RewardAttempt>("rewardAttempts").createIndex({ token: 1 }, { unique: true }),
    db.collection<RewardAttempt>("rewardAttempts").createIndex({ userId: 1, startedAt: -1 }),
  ]);
}

export async function getDb(): Promise<Db | null> {
  if (database) return database;
  if (!process.env.MONGODB_URI) {
    console.warn("[Database] MONGODB_URI is not configured");
    return null;
  }
  try {
    client ??= new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    database = client.db(process.env.MONGODB_DB || "vexzhubstudio");
    indexesReady ??= ensureIndexes(database);
    await indexesReady;
    return database;
  } catch (error) {
    console.warn("[Database] Failed to connect to MongoDB:", error);
    client = null;
    database = null;
    indexesReady = null;
    return null;
  }
}

const users = (db: Db) => db.collection<User>("users");
const coinTransactions = (db: Db) => db.collection<CoinTransaction>("coinTransactions");
const rewardAttempts = (db: Db) => db.collection<RewardAttempt>("rewardAttempts");

async function nextId(db: Db, name: string, session?: ClientSession) {
  const result = await db.collection<{ _id: string; value: number }>("counters").findOneAndUpdate(
    { _id: name },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: "after", session },
  );
  return result?.value ?? 1;
}

function toUser(document: User | null): User | undefined {
  if (!document) return undefined;
  return document;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  const now = new Date();
  const set: Partial<User> = { updatedAt: now, lastSignedIn: user.lastSignedIn ?? now };
  for (const field of ["name", "email", "loginMethod", "role"] as const) {
    if (user[field] !== undefined) set[field] = user[field] as never;
  }
  if (user.openId === ENV.ownerOpenId && user.role === undefined) set.role = "admin";
  await users(db).updateOne(
    { openId: user.openId },
    { $set: set, $setOnInsert: { id: await nextId(db, "users"), openId: user.openId, coinBalance: 0, createdAt: now, role: set.role ?? "user", name: user.name ?? null, username: user.username ?? null, email: user.email ?? null, passwordHash: user.passwordHash ?? null, loginMethod: user.loginMethod ?? null } },
    { upsert: true },
  );
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  return db ? toUser(await users(db).findOne({ openId })) : undefined;
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

export async function createEmailUser(name: string, username: string, password: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const normalizedUsername = username.trim().toLowerCase();
  if (await users(db).findOne({ username: normalizedUsername }, { projection: { id: 1 } })) return { ok: false as const, reason: "username_exists" as const };
  const now = new Date();
  const openId = `email_${randomUUID()}`.slice(0, 64);
  const user: User = { id: await nextId(db, "users"), openId, name: name.trim(), username: normalizedUsername, email: null, passwordHash: hashPassword(password), loginMethod: "username", role: "user", coinBalance: 0, createdAt: now, updatedAt: now, lastSignedIn: now };
  await users(db).insertOne(user);
  return { ok: true as const, user };
}

export async function authenticateEmailUser(username: string, password: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const user = await users(db).findOne({ username: username.trim().toLowerCase() });
  if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) return null;
  await users(db).updateOne({ id: user.id }, { $set: { lastSignedIn: new Date(), updatedAt: new Date() } });
  return user;
}

const emptyDashboard = { balance: 0, transactions: [], todayClaimed: false, todayClaimedByTier: { level1: false, level2: false, link4m: false, layma: false }, todayClaimsByTier: { level1: 0, level2: 0, link4m: 0, layma: 0 }, totalEarned: 0, totalClaims: 0, lastClaimAt: null };

export async function getCoinDashboard(userId: number) {
  const db = await getDb();
  if (!db) return emptyDashboard;
  const dateKey = new Date().toISOString().slice(0, 10);
  const user = await users(db).findOne({ id: userId }, { projection: { coinBalance: 1 } });
  const transactions = await coinTransactions(db).find({ userId }).sort({ createdAt: -1 }).limit(10).project({ id: 1, amount: 1, source: 1, createdAt: 1 }).toArray();
  const todayRows = await coinTransactions(db).find({ userId, claimKey: { $regex: `:${dateKey}` } }).project({ claimKey: 1 }).toArray();
  const todayClaimsByTier = { level1: 0, level2: 0, link4m: 0, layma: 0 };
  todayRows.forEach(({ claimKey }) => { const tier = claimKey.split(":")[1] as keyof typeof todayClaimsByTier; if (tier in todayClaimsByTier) todayClaimsByTier[tier] += 1; });
  const stats = await coinTransactions(db).aggregate<{ totalEarned: number; totalClaims: number }>([{ $match: { userId } }, { $group: { _id: null, totalEarned: { $sum: "$amount" }, totalClaims: { $sum: 1 } } }]).next();
  return { balance: user?.coinBalance ?? 0, transactions, todayClaimed: Object.values(todayClaimsByTier).some(Boolean), todayClaimedByTier: { level1: todayClaimsByTier.level1 >= 4, level2: todayClaimsByTier.level2 >= 4, link4m: todayClaimsByTier.link4m >= 4, layma: todayClaimsByTier.layma >= 4 }, todayClaimsByTier, totalEarned: stats?.totalEarned ?? 0, totalClaims: stats?.totalClaims ?? 0, lastClaimAt: transactions[0]?.createdAt ?? null };
}

export async function startRewardAttempt(userId: number, tier: RewardTier) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const token = `${randomUUID()}-${randomUUID()}`;
  const attempt: RewardAttempt = { id: await nextId(db, "rewardAttempts"), userId, tier, token, startedAt: new Date(), returnedAt: null, completedAt: null };
  await rewardAttempts(db).insertOne(attempt);
  const returnUrl = process.env.REWARD_RETURN_URL || "https://lumenrewards-8fsahncj.manus.space";
  const callbackUrl = `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}reward_token=${encodeURIComponent(token)}`;
  const baseUrl = REWARD_TIERS[tier].url;
  const url = tier === "link4m" ? baseUrl.replace(/url=[^&]*/, `url=${encodeURIComponent(callbackUrl)}`) : `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}reward_token=${encodeURIComponent(token)}`;
  return { attemptId: attempt.id, token, tier, url, callbackUrl, reward: REWARD_TIERS[tier].reward };
}

export async function markRewardAttemptReturned(userId: number, token: string) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const attempt = await rewardAttempts(db).findOne({ userId, token }); const user = await users(db).findOne({ id: userId }, { projection: { coinBalance: 1 } });
  if (!attempt) return { returned: false, reason: "invalid_attempt" as const, accepted: false, balance: user?.coinBalance ?? 0 };
  if (attempt.completedAt) return { returned: Boolean(attempt.returnedAt), reason: "already_completed" as const, accepted: Boolean(attempt.returnedAt), claimed: false, reward: REWARD_TIERS[attempt.tier].reward, balance: user?.coinBalance ?? 0 };
  return { returned: false, reason: "provider_confirmation_required" as const, accepted: false, claimed: false, reward: REWARD_TIERS[attempt.tier].reward, balance: user?.coinBalance ?? 0 };
}

export async function cancelRewardAttempt(userId: number, token: string) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  await rewardAttempts(db).updateOne({ userId, token, completedAt: null }, { $set: { completedAt: new Date() } });
  return { cancelled: true } as const;
}

export async function completeRewardAttempt(userId: number, token: string, verifiedExternally = false) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const attempt = await rewardAttempts(db).findOne({ userId, token }); const user = await users(db).findOne({ id: userId }, { projection: { coinBalance: 1 } });
  if (!attempt) return { claimed: false, accepted: false, reason: "invalid_attempt" as const, balance: user?.coinBalance ?? 0 };
  if (attempt.completedAt) return { claimed: false, accepted: true, reason: "already_completed" as const, balance: user?.coinBalance ?? 0 };
  const retryAfterSeconds = getRemainingWaitSeconds(attempt.startedAt, Date.now(), REWARD_TIERS[attempt.tier].waitSeconds);
  if (!verifiedExternally && !attempt.returnedAt) return { claimed: false, accepted: false, reason: "not_returned" as const, balance: user?.coinBalance ?? 0 };
  if (retryAfterSeconds > 0 && !verifiedExternally) return { claimed: false, accepted: false, reason: "too_early" as const, retryAfterSeconds, balance: user?.coinBalance ?? 0 };
  const dateKey = new Date().toISOString().slice(0, 10); const source = attempt.tier === "link4m" ? "link4m" : attempt.tier === "layma" ? "layma" : DAILY_LINK_SOURCE;
  const existingToday = await coinTransactions(db).find({ userId, claimKey: { $regex: `^${source}:${attempt.tier}:${dateKey}:` } }).toArray();
  if (existingToday.length >= 4) return { claimed: false, accepted: false, reason: "daily_limit" as const, balance: user?.coinBalance ?? 0 };
  const claimKey = `${source}:${attempt.tier}:${dateKey}:${existingToday.length + 1}`;
  const amount = REWARD_TIERS[attempt.tier].reward; const session = client?.startSession();
  try {
    const operation = async (activeSession?: ClientSession) => {
      if (await coinTransactions(db).findOne({ userId, claimKey }, { session: activeSession })) return false;
      const id = await nextId(db, "coinTransactions", activeSession);
      await coinTransactions(db).insertOne({ id, userId, amount, source, claimKey, createdAt: new Date() }, { session: activeSession });
      await users(db).updateOne({ id: userId }, { $inc: { coinBalance: amount }, $set: { updatedAt: new Date() } }, { session: activeSession });
      await rewardAttempts(db).updateOne({ id: attempt.id }, { $set: { completedAt: new Date() } }, { session: activeSession });
      return true;
    };
    const claimed = session ? await session.withTransaction(() => operation(session)) : await operation();
    if (!claimed) return { claimed: false, accepted: true, reason: "already_claimed_today" as const, balance: user?.coinBalance ?? 0 };
  } finally { await session?.endSession(); }
  const updatedUser = await users(db).findOne({ id: userId }, { projection: { coinBalance: 1 } });
  return { claimed: true, accepted: true, reason: "claimed" as const, balance: updatedUser?.coinBalance ?? amount, reward: amount };
}

export async function completeVerifiedRewardAttempt(token: string) {
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const attempt = await rewardAttempts(db).findOne({ token }, { projection: { id: 1, userId: 1 } });
  if (!attempt) return { claimed: false, accepted: false, reason: "invalid_attempt" as const, balance: 0 };
  await rewardAttempts(db).updateOne({ id: attempt.id, completedAt: null }, { $set: { returnedAt: new Date() } });
  return completeRewardAttempt(attempt.userId, token, true);
}

export async function getLeaderboard(limit = 20) {
  const db = await getDb(); if (!db) return [];
  return users(db).find({}, { projection: { id: 1, name: 1, coinBalance: 1, createdAt: 1 } }).sort({ coinBalance: -1, createdAt: 1 }).limit(limit).toArray();
}

export async function getAdminOverview(filters: { date?: string; tier?: RewardTier } = {}) {
  const db = await getDb();
  if (!db) return { metrics: { totalUsers: 0, totalCoins: 0, totalClaims: 0, openAttempts: 0, flaggedUsers: 0 }, claims: [], fraudSignals: [], attemptStats: { success: 0, failed: 0, open: 0, successRate: 0 } };
  const [allUsers, allClaims, claims, attempts] = await Promise.all([users(db).find({}, { projection: { coinBalance: 1 } }).toArray(), coinTransactions(db).countDocuments(), coinTransactions(db).find().sort({ createdAt: -1 }).limit(500).toArray(), rewardAttempts(db).find().sort({ startedAt: -1 }).limit(500).toArray()]);
  const userIds = Array.from(new Set([...claims.map(c => c.userId), ...attempts.map(a => a.userId)]));
  const userMap = new Map((await users(db).find({ id: { $in: userIds } }).toArray()).map(u => [u.id, u]));
  const tierForClaim = (claim: CoinTransaction): RewardTier => claim.source === "link4m" ? "link4m" : claim.source === "layma" ? "layma" : claim.claimKey.split(":")[1] as RewardTier;
  const matches = (date: Date, tier?: RewardTier, rowTier?: RewardTier) => (!filters.date || date.toISOString().slice(0, 10) === filters.date) && (!filters.tier || rowTier === filters.tier);
  const filteredClaims = claims.filter(c => matches(c.createdAt, filters.tier, tierForClaim(c))).map(c => ({ id: c.id, userId: c.userId, userName: userMap.get(c.userId)?.name ?? null, userEmail: userMap.get(c.userId)?.email ?? null, amount: c.amount, source: c.source, claimKey: c.claimKey, createdAt: c.createdAt }));
  const filteredAttempts = attempts.filter(a => matches(a.startedAt, filters.tier, a.tier)); const now = Date.now(); const recent = filteredAttempts.filter(a => now - a.startedAt.getTime() <= 15 * 60 * 1000); const counts = new Map<number, number>(); recent.forEach(a => counts.set(a.userId, (counts.get(a.userId) ?? 0) + 1)); const incompleteCounts = new Map<number, number>(); filteredAttempts.filter(a => !a.completedAt && now - a.startedAt.getTime() <= 24 * 60 * 60 * 1000).forEach(a => incompleteCounts.set(a.userId, (incompleteCounts.get(a.userId) ?? 0) + 1));
  const fraudSignals = filteredAttempts.filter(a => (counts.get(a.userId) ?? 0) >= 4 || (incompleteCounts.get(a.userId) ?? 0) >= 3).slice(0, 30).map(a => ({ id: a.id, userId: a.userId, userName: userMap.get(a.userId)?.name || "Lumen member", userEmail: userMap.get(a.userId)?.email || "", tier: a.tier, startedAt: a.startedAt, completed: Boolean(a.completedAt), signal: (counts.get(a.userId) ?? 0) >= 4 ? "Nhiều attempt trong 15 phút" : "Nhiều attempt chưa hoàn tất trong 24 giờ" }));
  const success = filteredAttempts.filter(a => Boolean(a.completedAt && a.returnedAt)).length; const failed = filteredAttempts.filter(a => Boolean(a.completedAt && !a.returnedAt)).length; const open = filteredAttempts.filter(a => !a.completedAt).length;
  return { metrics: { totalUsers: allUsers.length, totalCoins: allUsers.reduce((sum, u) => sum + u.coinBalance, 0), totalClaims: filters.date || filters.tier ? filteredClaims.length : allClaims, openAttempts: open, flaggedUsers: new Set(fraudSignals.map(s => s.userId)).size }, claims: filteredClaims.slice(0, 40), fraudSignals, attemptStats: { success, failed, open, successRate: success + failed ? Math.round((success / (success + failed)) * 100) : 0 } };
}
