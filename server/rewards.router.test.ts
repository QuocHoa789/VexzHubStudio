import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("rewards router", () => {
  it("returns a bounded leaderboard for an authenticated user", async () => {
    const ctx: TrpcContext = {
      user: {
        id: 1,
        openId: "leaderboard-test-user",
        email: "leaderboard@example.com",
        name: "Leaderboard Test",
        loginMethod: "test",
        role: "user",
        coinBalance: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };

    const result = await appRouter.createCaller(ctx).rewards.leaderboard({ limit: 10 });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeLessThanOrEqual(10);
    if (result[0]) {
      expect(result[0]).toMatchObject({ rank: 1, id: expect.any(Number), coinBalance: expect.any(Number) });
    }
  });
});
