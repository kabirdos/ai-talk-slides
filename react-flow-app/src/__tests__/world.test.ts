import { describe, it, expect } from "vitest";
import { buildWorldData } from "../world/worldData";
import { mulberry32 } from "../world/noise";
import { hasBespokeStory } from "../world/vignettes";
import { slides } from "../data/slides";

describe("explorable world data", () => {
  const world = buildWorldData(mulberry32(42));

  it("turns every slide into a stop", () => {
    expect(world.stops.map((s) => s.id).sort()).toEqual(slides.map((s) => s.id).sort());
  });

  it("gives every stop a bespoke story animation", () => {
    for (const s of slides) expect(hasBespokeStory(s.id), s.id).toBe(true);
  });

  it("connects each line's stops with a road, in order", () => {
    for (const line of world.lines) {
      for (let i = 0; i < line.stops.length - 1; i++) {
        const road = world.roads.find((r) => r.from === line.stops[i] && r.to === line.stops[i + 1]);
        expect(road, `${line.id} ${i}`).toBeDefined();
        expect(road!.points.length).toBeGreaterThan(10);
      }
    }
  });

  it("splits into the two tracks after the Green Line and rejoins at the close", () => {
    const from = (id: string) => world.roads.filter((r) => r.from.id === id).map((r) => r.to.id);
    expect(from("slide-07").sort()).toEqual(["slide-08", "slide-16"]);
    expect(world.roads.some((r) => r.to.id === "slide-26" && r.from.id === "slide-25")).toBe(true);
    expect(world.roads.some((r) => r.to.id === "slide-26" && r.from.id === "slide-15b")).toBe(true);
  });

  it("is deterministic for a seed", () => {
    const again = buildWorldData(mulberry32(42));
    expect(again.stops.map((s) => [s.x, s.z])).toEqual(world.stops.map((s) => [s.x, s.z]));
  });
});
