// Turns the presentation's slides + metro map topology into world data:
// every metro line becomes a road, every stop becomes a district.
import { sections, slides, resources } from "../data/slides";
import type { SlideContent, Resource, SubnodeContent } from "../types/presentation";
import { METRO_LINE_COLORS } from "../types/presentation";

export interface LineDef {
  id: string; // section id
  name: string; // "RED LINE"
  subtitle: string;
  color: string;
  stops: Stop[];
}

export interface Stop {
  id: string;
  slide: SlideContent;
  line: LineDef;
  index: number; // position on its line
  x: number;
  z: number;
  h: number; // ground height (filled in by terrain)
  lines: LineDef[]; // every line touching this stop (junctions have several)
  resources: Resource[];
  projects: SubnodeContent[];
}

export interface RoadPoint {
  x: number;
  z: number;
  h: number;
}

export interface Road {
  id: string;
  line: LineDef;
  from: Stop;
  to: Stop;
  transfer: boolean;
  points: RoadPoint[];
  length: number;
}

const LINE_META: Record<string, { name: string; subtitle: string }> = {
  intro: { name: "RED LINE", subtitle: "The Widening Gulf" },
  understanding: { name: "YELLOW LINE", subtitle: "Understanding AI" },
  mapping: { name: "GREEN LINE", subtitle: "Mapping the Journey" },
  "levels-nontech": { name: "BLUE LINE", subtitle: "Non-Technical Track" },
  "levels-tech": { name: "ORANGE LINE", subtitle: "Technical Track" },
  closing: { name: "PURPLE LINE", subtitle: "The Way Forward" },
};

// Transfers between lines, mirroring the metro map's inter-section edges.
// The road takes the colour of the `line` it belongs to.
const TRANSFERS: { from: string; to: string; line: string }[] = [
  { from: "intro", to: "understanding", line: "understanding" },
  { from: "understanding", to: "mapping", line: "mapping" },
  { from: "mapping", to: "levels-nontech", line: "levels-nontech" },
  { from: "mapping", to: "levels-tech", line: "levels-tech" },
  { from: "levels-nontech", to: "levels-tech", line: "levels-tech" },
  { from: "levels-nontech", to: "closing", line: "levels-nontech" },
  { from: "levels-tech", to: "closing", line: "levels-tech" },
];

export interface LandmarkDef {
  id: string;
  label: string;
  image: string;
  x: number;
  z: number;
  size: number;
}

export interface WorldData {
  lines: LineDef[];
  stops: Stop[];
  roads: Road[];
  landmarks: LandmarkDef[];
  river: { x: number; z: number }[];
  spawn: { x: number; z: number; yaw: number };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export const IMG_BASE = "world/img/";

/** Base layout of each line as a function of stop index, before jitter. */
function layoutFor(lineId: string, i: number, n: number): [number, number] {
  const t = n > 1 ? i / (n - 1) : 0;
  switch (lineId) {
    case "intro":
      return [-10 + i * 78, 40 - i * 10];
    case "understanding":
      return [150 + i * 78, 10 + Math.sin(i * 1.3) * 30];
    case "mapping":
      return [300 + i * 72, -10 + Math.sin(i * 1.1 + 1) * 28];
    case "levels-nontech": {
      // A big arc to the north
      const a = ((170 + t * 220) * Math.PI) / 180;
      return [700 + Math.cos(a) * 250, -175 + Math.sin(a) * 205];
    }
    case "levels-tech": {
      // A big arc to the south
      const a = ((206 - t * 236) * Math.PI) / 180;
      return [985 + Math.cos(a) * 235, 235 + Math.sin(a) * 225];
    }
    case "closing":
      return [1270, 15];
    default:
      return [0, 0];
  }
}

export function buildWorldData(rand: () => number): WorldData {
  const lines: LineDef[] = sections.map((s) => ({
    id: s.id,
    name: LINE_META[s.id]?.name ?? s.title.toUpperCase(),
    subtitle: LINE_META[s.id]?.subtitle ?? s.title,
    color: METRO_LINE_COLORS[s.id as keyof typeof METRO_LINE_COLORS] ?? "#888",
    stops: [],
  }));
  const lineById = new Map(lines.map((l) => [l.id, l]));
  const stops: Stop[] = [];

  for (const line of lines) {
    const lineSlides = slides.filter((s) => s.sectionId === line.id);
    lineSlides.forEach((slide, i) => {
      const [bx, bz] = layoutFor(line.id, i, lineSlides.length);
      const jitter = line.id === "closing" ? 0 : 14;
      const stop: Stop = {
        id: slide.id,
        slide,
        line,
        index: i,
        x: bx + (rand() - 0.5) * jitter,
        z: bz + (rand() - 0.5) * jitter,
        h: 0,
        lines: [line],
        resources: resources.filter((r) => r.slideId === slide.id),
        projects: (slide.subnodes ?? []).filter((s) => s.type === "resource"),
      };
      line.stops.push(stop);
      stops.push(stop);
    });
  }

  const roads: Road[] = [];
  const addRoad = (line: LineDef, from: Stop, to: Stop, transfer: boolean) => {
    roads.push({
      id: `${from.id}->${to.id}`,
      line,
      from,
      to,
      transfer,
      points: meander(from, to, rand),
      length: 0,
    });
    if (!from.lines.includes(line)) from.lines.push(line);
    if (!to.lines.includes(line)) to.lines.push(line);
  };

  for (const line of lines) {
    for (let i = 0; i < line.stops.length - 1; i++) {
      addRoad(line, line.stops[i], line.stops[i + 1], false);
    }
  }
  for (const t of TRANSFERS) {
    const a = lineById.get(t.from)!;
    const b = lineById.get(t.to)!;
    const line = lineById.get(t.line)!;
    addRoad(line, a.stops[a.stops.length - 1], b.stops[0], true);
  }
  for (const r of roads) {
    let len = 0;
    for (let i = 1; i < r.points.length; i++) {
      len += Math.hypot(r.points[i].x - r.points[i - 1].x, r.points[i].z - r.points[i - 1].z);
    }
    r.length = len;
  }

  const landmarks: LandmarkDef[] = [
    { id: "port-curiosity", label: "Port of Curiosity", image: "landmark-port-curiosity.png", x: -120, z: 10, size: 46 },
    { id: "port-no-fear", label: "Port of No Fear", image: "landmark-port-no-fear.png", x: 60, z: -170, size: 46 },
    { id: "port-necessity", label: "Port of Necessity", image: "landmark-port-necessity.png", x: 240, z: 190, size: 46 },
    { id: "doomtown", label: "AI Takeover Doomtown", image: "landmark-doomtown.png", x: 420, z: 420, size: 80 },
    { id: "slop-factory", label: "AI Slop Factory", image: "landmark-slop-factory.png", x: 720, z: -500, size: 80 },
    { id: "empowerment", label: "City of AI Empowerment", image: "landmark-empowerment-city.png", x: 1420, z: 10, size: 90 },
  ];

  // The River of AI Disillusionment runs diagonally across the land.
  const river: { x: number; z: number }[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    river.push({
      x: -260 + t * 1880,
      z: -560 + t * 1100 + Math.sin(t * 9) * 60,
    });
  }

  return {
    lines,
    stops,
    roads,
    landmarks,
    river,
    spawn: { x: -52, z: 46, yaw: Math.PI / 2 },
    bounds: { minX: -300, maxX: 1650, minZ: -620, maxZ: 620 },
  };
}

/** A gently winding road between two stops (Catmull-Rom through jittered control points). */
function meander(a: Stop, b: Stop, rand: () => number): RoadPoint[] {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz);
  const nx = -dz / len;
  const nz = dx / len;
  const ctrl: [number, number][] = [[a.x, a.z]];
  const mids = Math.max(1, Math.round(len / 60));
  const wiggle = Math.min(22, len * 0.12);
  for (let k = 1; k <= mids; k++) {
    const t = k / (mids + 1);
    const off = (rand() - 0.5) * 2 * wiggle;
    ctrl.push([a.x + dx * t + nx * off, a.z + dz * t + nz * off]);
  }
  ctrl.push([b.x, b.z]);
  // Extend endpoints for Catmull-Rom
  const pts = [
    [2 * ctrl[0][0] - ctrl[1][0], 2 * ctrl[0][1] - ctrl[1][1]],
    ...ctrl,
    [2 * ctrl[ctrl.length - 1][0] - ctrl[ctrl.length - 2][0], 2 * ctrl[ctrl.length - 1][1] - ctrl[ctrl.length - 2][1]],
  ];
  const out: RoadPoint[] = [];
  for (let s = 1; s < pts.length - 2; s++) {
    const p0 = pts[s - 1], p1 = pts[s], p2 = pts[s + 1], p3 = pts[s + 2];
    const segLen = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const steps = Math.max(2, Math.ceil(segLen / 2));
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const t2 = t * t, t3 = t2 * t;
      const f = (q0: number, q1: number, q2: number, q3: number) =>
        0.5 * (2 * q1 + (-q0 + q2) * t + (2 * q0 - 5 * q1 + 4 * q2 - q3) * t2 + (-q0 + 3 * q1 - 3 * q2 + q3) * t3);
      out.push({ x: f(p0[0], p1[0], p2[0], p3[0]), z: f(p0[1], p1[1], p2[1], p3[1]), h: 0 });
    }
  }
  out.push({ x: b.x, z: b.z, h: 0 });
  return out;
}

export function imageFor(slideId: string): string {
  return `${IMG_BASE}${slideId}.jpg`;
}

const PROJECT_IMAGES: Record<string, string> = {
  "subnode-14-craigdossantos": "project-01-craigdossantos",
  "subnode-18-secretgame": "project-02-secret-game",
  "subnode-20-freestyleflow": "project-03-freestyle-flow",
  "subnode-15-ourweunion": "project-04-ourweunion",
  "subnode-18-dialoguedojo": "project-05-dialogue-dojo",
  "subnode-21-instantbook": "project-06-instant-book",
  "subnode-23-youtubesummary": "project-07-youtube-summary",
  "subnode-23-videosum": "project-08-video-sum",
  "subnode-24-quota": "project-09-usequota",
  "subnode-23-stefsbirthday": "project-10-stefsbirthday",
  "subnode-24-presentation": "project-11-presentation",
};

export function projectImage(id: string): string | undefined {
  const f = PROJECT_IMAGES[id];
  return f ? `${IMG_BASE}${f}.jpg` : undefined;
}
