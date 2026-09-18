import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(role: "admin" | "user"): TrpcContext {
  return {
    user: {
      id: role === "admin" ? 1 : 2,
      openId: `${role}-test-user`,
      email: `${role}@example.com`,
      name: role === "admin" ? "Admin Test" : "Member Test",
      loginMethod: "test",
      role,
      coinBalance: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("admin overview", () => {
  it("rejects non-admin accounts", async () => {
    await expect(appRouter.createCaller(context("user")).admin.overview()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns operational metrics for admins", async () => {
    const result = await appRouter.createCaller(context("admin")).admin.overview();
    expect(result).toHaveProperty("metrics.totalUsers");
    expect(Array.isArray(result.claims)).toBe(true);
    expect(Array.isArray(result.fraudSignals)).toBe(true);
  });
});
