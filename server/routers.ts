import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getAdminOverview, getCoinDashboard, completeRewardAttempt, getLeaderboard, markRewardAttemptReturned, startRewardAttempt } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";

const rewardTierInput = z.object({ tier: z.enum(["level1", "level2", "link4m"]) });

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
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
    overview: adminProcedure.query(() => getAdminOverview()),
  }),
});

export type AppRouter = typeof appRouter;
