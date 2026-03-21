import { describe, it, expect } from "vitest";
import {
  centroid,
  degToRad,
  distanceMeters,
  formatPrice,
  formatArea,
} from "./geo-utils";

describe("degToRad", () => {
  it("converts 180 degrees to PI", () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI);
  });
});

describe("centroid", () => {
  it("computes centroid of a square polygon", () => {
    const coords: [number, number][] = [
      [-54.634, -34.805],
      [-54.632, -34.805],
      [-54.632, -34.807],
      [-54.634, -34.807],
      [-54.634, -34.805],
    ];
    const [lon, lat] = centroid(coords);
    expect(lon).toBeCloseTo(-54.633);
    expect(lat).toBeCloseTo(-34.806);
  });
});

describe("distanceMeters", () => {
  it("estimates about 111 km per degree of latitude", () => {
    expect(distanceMeters([0, 0], [0, 1])).toBeCloseTo(111195, -2);
  });
});

describe("formatPrice", () => {
  it("formats 450000 as USD 450,000", () => {
    expect(formatPrice(450000)).toBe("USD 450,000");
  });
});

describe("formatArea", () => {
  it("formats 2500 as 2,500 m²", () => {
    expect(formatArea(2500)).toBe("2,500 m²");
  });
});
