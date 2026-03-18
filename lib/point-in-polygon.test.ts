import { describe, it, expect } from "vitest";
import { pointInPolygon } from "./point-in-polygon";

describe("pointInPolygon", () => {
  const square: [number, number][] = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
    [0, 0],
  ];

  it("returns true for point inside", () => {
    expect(pointInPolygon([5, 5], square)).toBe(true);
  });

  it("returns false for point outside", () => {
    expect(pointInPolygon([15, 5], square)).toBe(false);
  });

  it("returns false for point far outside", () => {
    expect(pointInPolygon([-5, -5], square)).toBe(false);
  });
});
