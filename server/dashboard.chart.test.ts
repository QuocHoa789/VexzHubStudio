import { describe, expect, it } from "vitest";
import { chartPath } from "../client/src/lib/chart";

describe("Lumen dashboard chart helpers", () => {
  it("maps the first and last data points to the chart bounds", () => {
    expect(chartPath([20, 60, 100])).toBe("M0.0 220.0 L380.0 110.0 L760.0 0.0");
  });

  it("keeps a custom chart size proportional", () => {
    expect(chartPath([20, 60, 100], 100, 300)).toBe("M0.0 100.0 L150.0 50.0 L300.0 0.0");
  });
});
