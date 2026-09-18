import { describe, expect, it } from "vitest";
import { signLink4SubPostback, verifyLink4SubPostback } from "./link4sub";

describe("Link4Sub postback signature", () => {
  it("accepts the signature generated for the same token and secret", () => {
    const signature = signLink4SubPostback("attempt-token", "test-secret");
    expect(verifyLink4SubPostback("attempt-token", signature, "test-secret")).toBe(true);
  });

  it("rejects a changed token or secret", () => {
    const signature = signLink4SubPostback("attempt-token", "test-secret");
    expect(verifyLink4SubPostback("changed-token", signature, "test-secret")).toBe(false);
    expect(verifyLink4SubPostback("attempt-token", signature, "wrong-secret")).toBe(false);
  });
});
