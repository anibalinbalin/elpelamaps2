import { describe, expect, it } from "vitest";
import type { FeatureCollection, Geometry } from "geojson";

import {
  geomanCollectionToParcels,
  parcelCollectionToGeoman,
} from "./parcel-serialization";
import type { ParcelCollection } from "./parcels";

const parcelFixture: ParcelCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        id: "lot-1",
        name: "Lot 1",
        areaSqMeters: 0,
        featureType: "parcel",
        label: "L1",
        description: "North lot",
        status: "reserved",
        priceUSD: 450000,
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-54.634, -34.824],
          [-54.633, -34.824],
          [-54.633, -34.823],
          [-54.634, -34.823],
          [-54.634, -34.824],
        ]],
      },
    },
    {
      type: "Feature",
      properties: {
        id: "road-1",
        name: "Main Road",
        areaSqMeters: 0,
        featureType: "road",
        roadWidth: 7,
        smoothed: true,
        originalCoords: [[[-54.634, -34.824], [-54.633, -34.823]]],
      },
      geometry: {
        type: "LineString",
        coordinates: [[-54.634, -34.824], [-54.633, -34.823]],
      },
    },
    {
      type: "Feature",
      properties: {
        id: "tree-1",
        name: "Existing Tree",
        areaSqMeters: 0,
        featureType: "tree",
        canopyRadius: 5,
        height: 9,
      },
      geometry: {
        type: "Point",
        coordinates: [-54.6335, -34.8235],
      },
    },
  ],
};

describe("parcelCollectionToGeoman", () => {
  it("adds Geoman shape metadata while keeping parcel properties", () => {
    const geoman = parcelCollectionToGeoman(parcelFixture);

    expect(geoman.features[0].id).toBe("lot-1");
    expect(geoman.features[0].properties?.shape).toBe("polygon");
    expect(geoman.features[1].properties?.shape).toBe("line");
    expect(geoman.features[2].properties?.shape).toBe("marker");
    expect(geoman.features[1].properties?.roadWidth).toBe(7);
  });
});

describe("geomanCollectionToParcels", () => {
  it("keeps optional parcel, road, water, building, and tree properties", () => {
    const geoman: FeatureCollection<Geometry> = {
      type: "FeatureCollection",
      features: [
        ...parcelCollectionToGeoman(parcelFixture).features,
        {
          type: "Feature",
          id: "pond-1",
          properties: { id: "pond-1", name: "Pond", shape: "polygon", featureType: "water" },
          geometry: parcelFixture.features[0].geometry,
        },
        {
          type: "Feature",
          id: "clubhouse-1",
          properties: {
            id: "clubhouse-1",
            name: "Clubhouse",
            shape: "polygon",
            featureType: "building",
            height: 8,
            floors: 2,
          },
          geometry: parcelFixture.features[0].geometry,
        },
      ],
    };

    const parcels = geomanCollectionToParcels(geoman);

    expect(parcels.features.find((f) => f.properties.id === "lot-1")?.properties)
      .toMatchObject({ label: "L1", description: "North lot", status: "reserved" });
    expect(parcels.features.find((f) => f.properties.id === "road-1")?.properties)
      .toMatchObject({ roadWidth: 7, smoothed: true });
    expect(parcels.features.find((f) => f.properties.id === "tree-1")?.properties)
      .toMatchObject({ canopyRadius: 5, height: 9 });
    expect(parcels.features.find((f) => f.properties.id === "pond-1")?.properties.featureType)
      .toBe("water");
    expect(parcels.features.find((f) => f.properties.id === "clubhouse-1")?.properties)
      .toMatchObject({ featureType: "building", height: 8, floors: 2 });
    expect(parcels.features.find((f) => f.properties.id === "pond-1")?.properties)
      .not.toHaveProperty("shape");
  });

  it("flattens MultiPolygon from Geoman polygon tool into Polygon", () => {
    const geoman: FeatureCollection<Geometry> = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          id: "poly-1",
          properties: { id: "poly-1", name: "Drawn Polygon", shape: "polygon", featureType: "parcel" },
          geometry: {
            type: "MultiPolygon",
            coordinates: [[[
              [-54.634, -34.824],
              [-54.633, -34.824],
              [-54.633, -34.823],
              [-54.634, -34.823],
              [-54.634, -34.824],
            ]]],
          },
        },
      ],
    };

    const parcels = geomanCollectionToParcels(geoman);

    expect(parcels.features).toHaveLength(1);
    expect(parcels.features[0].geometry.type).toBe("Polygon");
    expect(parcels.features[0].properties.id).toBe("poly-1");
    expect(parcels.features[0].properties.areaSqMeters).toBeGreaterThan(0);
  });

  it("prefers the saved parcel id over Geoman's internal feature id", () => {
    const geoman: FeatureCollection<Geometry> = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          id: "feature-4",
          properties: {
            gm_id: "feature-4",
            id: "lot-1",
            name: "Lot 1",
            shape: "polygon",
            featureType: "parcel",
          },
          geometry: parcelFixture.features[0].geometry,
        },
      ],
    };

    const parcels = geomanCollectionToParcels(geoman);

    expect(parcels.features[0].properties.id).toBe("lot-1");
    expect(parcels.features[0].properties).not.toHaveProperty("gm_id");
  });
});
