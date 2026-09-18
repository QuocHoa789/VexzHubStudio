import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { authenticateEmailUser, createEmailUser, getAdminOverview, getCoinDashboard, completeRewardAttempt, cancelRewardAttempt, getLeaderboard, markRewardAttemptReturned, startRewardAttempt } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { sdk } from "./_core/sdk";

const rewardTierInput = z.object({ tier: z.enum(["level1", "level2", "link4m", "layma"]) });

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    signup: publicProcedure.input(z.object({ name: z.string().trim().min(2).max(80), username: z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9_]+$/), password: z.string().min(8).max(128) })).mutation(async ({ ctx, input }) => {
      let result;
      try {
        result = await createEmailUser(input.name, input.username, input.password);
      } catch (error) {
        console.error("[Auth] Signup failed:", error);
        return { ok: false as const, reason: "database_unavailable" as const };
      }
      if (!result.ok) return result;
      const token = await sdk.signSession({ openId: result.user.openId, appId: "local-email", name: result.user.name || input.name });
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: 1000 * 60 * 60 * 24 * 365 });
      return { ok: true as const };
    }),
    login: publicProcedure.input(z.object({ username: z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9_]+$/), password: z.string().min(8).max(128) })).mutation(async ({ ctx, input }) => {
      let user;
      try {
        user = await authenticateEmailUser(input.username, input.password);
      } catch (error) {
        console.error("[Auth] Login failed:", error);
        return { ok: false as const, reason: "database_unavailable" as const };
      }
      if (!user) return { ok: false as const, reason: "invalid_credentials" as const };
      const token = await sdk.signSession({ openId: user.openId, appId: "local-email", name: user.name || input.username });
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: 1000 * 60 * 60 * 24 * 365 });
      return { ok: true as const };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  rewards: router({
    dashboard: protectedProcedure.query(({ ctx }) => getCoinDashboard(ctx.user.id)),
    startAttempt: protectedProcedure
      .input(rewardTierInput)
      .mutation(({ ctx, input }) => startRewardAttempt(ctx.user.id, input.tier)),
    markReturned: protectedProcedure
      .input(z.object({ token: z.string().min(32).max(96) }))
      .mutation(({ ctx, input }) => markRewardAttemptReturned(ctx.user.id, input.token)),
    cancelAttempt: protectedProcedure
      .input(z.object({ token: z.string().min(32).max(96) }))
      .mutation(({ ctx, input }) => cancelRewardAttempt(ctx.user.id, input.token)),
    completeAttempt: protectedProcedure
      .input(z.object({ token: z.string().min(32).max(96) }))
      .mutation(({ ctx, input }) => completeRewardAttempt(ctx.user.id, input.token)),
    leaderboard: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).default(50) }).optional())
      .query(async ({ input }) => {
        const rows = await getLeaderboard(input?.limit ?? 50);
        return rows.map((row, index) => ({
          rank: index + 1,
          id: row.id,
          name: row.name || "Lumen member",
          coinBalance: row.coinBalance,
        }));
      }),
  }),
  admin: router({
    overview: adminProcedure.input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), tier: z.enum(["level1", "level2", "link4m", "layma"]).optional() }).optional()).query(({ input }) => getAdminOverview(input ?? {})),
  }),
});

export type AppRouter = typeof appRouter;
