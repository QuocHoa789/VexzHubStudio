import type { ObjectId } from "mongodb";

export type UserRole = "user" | "admin";
export type RewardTier = "level1" | "level2" | "link4m" | "layma";

export interface User {
  _id?: ObjectId;
  id: number;
  openId: string;
  name: string | null;
  username: string | null;
  email: string | null;
  passwordHash: string | null;
  loginMethod: string | null;
  role: UserRole;
  coinBalance: number;
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
}

export type InsertUser = Partial<Omit<User, "id" | "createdAt" | "updatedAt">> & Pick<User, "openId">;

export interface CoinTransaction {
  _id?: ObjectId;
  id: number;
  userId: number;
  amount: number;
  source: string;
  claimKey: string;
  createdAt: Date;
}

export type InsertCoinTransaction = Omit<CoinTransaction, "id" | "createdAt"> & Partial<Pick<CoinTransaction, "createdAt">>;

export interface RewardAttempt {
  _id?: ObjectId;
  id: number;
  userId: number;
  tier: RewardTier;
  token: string;
  startedAt: Date;
  returnedAt: Date | null;
  completedAt: Date | null;
}

export type InsertRewardAttempt = Omit<RewardAttempt, "id" | "startedAt" | "returnedAt" | "completedAt"> & Partial<Pick<RewardAttempt, "startedAt" | "returnedAt" | "completedAt">>;
