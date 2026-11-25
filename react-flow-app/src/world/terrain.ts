// Procedural terrain: rolling valleys along the metro lines, mountains away from
// them, the River of AI Disillusionment, and scattered trees and rocks.
import * as THREE from "three";
import { createNoise2D, fbm } from "./noise";
import type { WorldData, RoadPoint } from "./worldData";

export const WATER_LEVEL = -2.2;
const STEP = 3.5;
const ROAD_HALF = 3.6;
const PLAZA_R = 19;

interface RoadSample {
  x: number;
  z: number;
  h: number;
  road: number; // index into world.roads
}

export interface Terrain {
  mesh: THREE.Mesh;
  water: THREE.Mesh;
  scatter: THREE.Group;
  groundAt: (x: number, z: number) => number;
  nearestRoad: (x: number, z: number) => { dist: number; road: number; sample: RoadSample | null };
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export function buildTerrain(world: WorldData, rand: () => number): Terrain {
  const nA = createNoise2D(rand);
  const nB = createNoise2D(rand);
  const nC = createNoise2D(rand);

  const low = (x: number, z: number) =>
    fbm(nA, x / 240, z / 240, 4) * 8 + fbm(nB, x / 55, z / 55, 3) * 1.4 + 1.5;
  const mountain = (x: number, z: number) => {
    const r = 1 - Math.abs(fbm(nC, x / 260, z / 260, 5));
    return r * r * 55;
  };

  // --- Road heights: gentle, smoothed, always above water (causeways over the river)
  const floorH = WATER_LEVEL + 1.4;
  for (const stop of world.stops) stop.h = Math.max(floorH, low(stop.x, stop.z));
  world.roads.forEach((road) => {
    const raw = road.points.map((p) => Math.max(floorH, low(p.x, p.z)));
    const n = raw.length;
    const W = 12;
    road.points.forEach((p: RoadPoint, i) => {
      let s = 0, c = 0;
      for (let k = Math.max(0, i - W); k <= Math.min(n - 1, i + W); k++) { s += raw[k]; c++; }
      let h = s / c;
      // Blend into the plaza heights at both ends
      const dA = Math.hypot(p.x - road.from.x, p.z - road.from.z);
      const dB = Math.hypot(p.x - road.to.x, p.z - road.to.z);
      h = THREE.MathUtils.lerp(road.from.h, h, smooth(PLAZA_R - 2, PLAZA_R + 26, dA));
      h = THREE.MathUtils.lerp(road.to.h, h, smooth(PLAZA_R - 2, PLAZA_R + 26, dB));
      p.h = h;
    });
  });

  // --- Spatial hash of road samples
  const CELL = 16;
  const grid = new Map<number, RoadSample[]>();
  const key = (cx: number, cz: number) => (cx + 1000) * 4096 + (cz + 1000);
  world.roads.forEach((road, ri) => {
    for (const p of road.points) {
      const k = key(Math.floor(p.x / CELL), Math.floor(p.z / CELL));
      let arr = grid.get(k);
      if (!arr) grid.set(k, (arr = []));
      arr.push({ x: p.x, z: p.z, h: p.h, road: ri });
    }
  });
  const nearestRoad = (x: number, z: number, reach = 2) => {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    let best = Infinity;
    let bs: RoadSample | null = null;
    for (let i = -reach; i <= reach; i++)
      for (let j = -reach; j <= reach; j++) {
        const arr = grid.get(key(cx + i, cz + j));
        if (!arr) continue;
        for (const s of arr) {
          const d = (s.x - x) ** 2 + (s.z - z) ** 2;
          if (d < best) { best = d; bs = s; }
        }
      }
    return { dist: bs ? Math.sqrt(best) : 999, road: bs ? bs.road : -1, sample: bs };
  };

  const riverDist = (x: number, z: number) => {
    let best = Infinity;
    const r = world.river;
    for (let i = 0; i < r.length - 1; i++) {
      const ax = r[i].x, az = r[i].z, bx = r[i + 1].x, bz = r[i + 1].z;
      const vx = bx - ax, vz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
      const d = (x - ax - vx * t) ** 2 + (z - az - vz * t) ** 2;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  };

  const { minX, maxX, minZ, maxZ } = world.bounds;
  const cols = Math.ceil((maxX - minX) / STEP) + 1;
  const rows = Math.ceil((maxZ - minZ) / STEP) + 1;
  const heights = new Float32Array(cols * rows);
  const walk = new Float32Array(cols * rows);
  const colors = new Float32Array(cols * rows * 3);
  const positions = new Float32Array(cols * rows * 3);

  const cGrass = new THREE.Color("#7fb35a");
  const cGrass2 = new THREE.Color("#a6c95f");
  const cForest = new THREE.Color("#4f8a46");
  const cSand = new THREE.Color("#e3d29b");
  const cRock = new THREE.Color("#8f8a80");
  const cSnow = new THREE.Color("#f4f6f8");
  const cDirt = new THREE.Color("#c9b083");
  const tmp = new THREE.Color();

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = minX + c * STEP;
      const z = minZ + r * STEP;
      const nr = nearestRoad(x, z, 3);
      let stopD = Infinity, stopH = 0;
      for (const s of world.stops) {
        const d = Math.hypot(s.x - x, s.z - z);
        if (d < stopD) { stopD = d; stopH = s.h; }
      }
      const access = Math.min(nr.dist, stopD);
      let h = low(x, z) + mountain(x, z) * smooth(35, 200, access);
      // Raise the far edges into a ring of hills
      const edge = Math.min(x - minX, maxX - x, z - minZ, maxZ - z);
      h += (1 - smooth(0, 160, edge)) * 40;
      // River carve
      const rd = riverDist(x, z);
      const carve = 1 - smooth(7, 26, rd);
      h = THREE.MathUtils.lerp(h, WATER_LEVEL - 3.2, carve);
      // Flatten for roads and plazas
      let w = h;
      if (nr.sample) {
        const f = 1 - smooth(ROAD_HALF + 0.8, ROAD_HALF + 10, nr.dist);
        h = THREE.MathUtils.lerp(h, nr.sample.h - 0.25, f);
        w = nr.dist < ROAD_HALF + 0.5 ? nr.sample.h + 0.12 : h;
      }
      const pf = 1 - smooth(PLAZA_R, PLAZA_R + 14, stopD);
      h = THREE.MathUtils.lerp(h, stopH - 0.1, pf);
      if (stopD < PLAZA_R) w = stopH + 0.12;
      else if (!(nr.dist < ROAD_HALF + 0.5)) w = h;

      const idx = r * cols + c;
      heights[idx] = h;
      walk[idx] = Math.max(w, h);
      positions[idx * 3] = x;
      positions[idx * 3 + 1] = h;
      positions[idx * 3 + 2] = z;

      // Colour
      const g = (nB(x / 30, z / 30) + 1) / 2;
      tmp.copy(cGrass).lerp(cGrass2, g * 0.7);
      tmp.lerp(cForest, Math.max(0, nA(x / 90, z / 90)) * 0.7);
      if (h < WATER_LEVEL + 1.1) tmp.lerp(cSand, smooth(WATER_LEVEL + 1.1, WATER_LEVEL + 0.2, h));
      if (h > 14) tmp.lerp(cRock, smooth(14, 26, h));
      if (h > 38) tmp.lerp(cSnow, smooth(38, 46, h));
      if (nr.dist < ROAD_HALF + 4) tmp.lerp(cDirt, (1 - smooth(ROAD_HALF, ROAD_HALF + 4, nr.dist)) * 0.8);
      colors[idx * 3] = tmp.r;
      colors[idx * 3 + 1] = tmp.g;
      colors[idx * 3 + 2] = tmp.b;
    }
  }

  const indices: number[] = [];
  for (let r = 0; r < rows - 1; r++)
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
      indices.push(a, d, b, b, d, e);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }),
  );
  mesh.receiveShadow = true;

  const sample = (arr: Float32Array, x: number, z: number) => {
    const fx = (x - minX) / STEP, fz = (z - minZ) / STEP;
    const c = Math.max(0, Math.min(cols - 2, Math.floor(fx)));
    const r = Math.max(0, Math.min(rows - 2, Math.floor(fz)));
    const tx = Math.min(1, Math.max(0, fx - c)), tz = Math.min(1, Math.max(0, fz - r));
    const a = arr[r * cols + c], b = arr[r * cols + c + 1];
    const d = arr[(r + 1) * cols + c], e = arr[(r + 1) * cols + c + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (d * (1 - tx) + e * tx) * tz;
  };
  const groundAt = (x: number, z: number) => sample(walk, x, z);
  const heightAt = (x: number, z: number) => sample(heights, x, z);

  // --- Water
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(maxX - minX + 400, maxZ - minZ + 400, 1, 1),
    new THREE.MeshStandardMaterial({ color: "#3d9fd6", roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.82 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set((minX + maxX) / 2, WATER_LEVEL, (minZ + maxZ) / 2);

  // --- Scatter: trees, rocks, flowers
  const scatter = new THREE.Group();
  const treeSpots: { x: number; z: number; h: number; s: number; kind: number }[] = [];
  const rockSpots: { x: number; z: number; h: number; s: number }[] = [];
  const flowerSpots: { x: number; z: number; h: number }[] = [];
  const blocked = (x: number, z: number, roadPad: number, plazaPad: number) => {
    if (nearestRoad(x, z).dist < roadPad) return true;
    if (Math.hypot(world.spawn.x - x, world.spawn.z - z) < 30) return true;
    for (const s of world.stops) if (Math.hypot(s.x - x, s.z - z) < plazaPad) return true;
    for (const l of world.landmarks) if (Math.hypot(l.x - x, l.z - z) < l.size * 0.35) return true;
    return false;
  };
  for (let i = 0; i < 9000 && treeSpots.length < 3800; i++) {
    const x = minX + 40 + rand() * (maxX - minX - 80);
    const z = minZ + 40 + rand() * (maxZ - minZ - 80);
    const h = heightAt(x, z);
    if (h < WATER_LEVEL + 0.8 || h > 34) continue;
    const density = (nA(x / 120, z / 120) + 1) / 2;
    if (rand() > density * 1.2) continue;
    if (blocked(x, z, 9, 30)) continue;
    treeSpots.push({ x, z, h, s: 0.7 + rand() * 0.9, kind: h > 16 || rand() < 0.45 ? 0 : 1 });
  }
  for (let i = 0; i < 1200; i++) {
    const x = minX + rand() * (maxX - minX);
    const z = minZ + rand() * (maxZ - minZ);
    const h = heightAt(x, z);
    if (blocked(x, z, 7, 26)) continue;
    rockSpots.push({ x, z, h, s: 0.4 + rand() * (h > 12 ? 3 : 1.2) });
  }
  for (let i = 0; i < 5000; i++) {
    const road = world.roads[Math.floor(rand() * world.roads.length)];
    const p = road.points[Math.floor(rand() * road.points.length)];
    const a = rand() * Math.PI * 2, d = 6 + rand() * 26;
    const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
    const h = heightAt(x, z);
    if (h < WATER_LEVEL + 0.5 || blocked(x, z, 5, 22)) continue;
    flowerSpots.push({ x, z, h });
  }

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const place = (mesh: THREE.InstancedMesh, i: number, x: number, y: number, z: number, s: number, sy = s, rot = 0) => {
    q.setFromAxisAngle(up, rot);
    m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, sy, s));
    mesh.setMatrixAt(i, m4);
  };

  const pines = treeSpots.filter((t) => t.kind === 0);
  const rounds = treeSpots.filter((t) => t.kind === 1);
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 2.4, 6);
  trunkGeo.translate(0, 1.2, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: "#7a5636", flatShading: true }), treeSpots.length);
  const pineGeo = new THREE.ConeGeometry(2, 5.5, 7);
  pineGeo.translate(0, 4.6, 0);
  const pineMesh = new THREE.InstancedMesh(pineGeo, new THREE.MeshStandardMaterial({ color: "#ffffff", flatShading: true }), pines.length);
  const roundGeo = new THREE.IcosahedronGeometry(2.4, 0);
  roundGeo.translate(0, 4, 0);
  const roundMesh = new THREE.InstancedMesh(roundGeo, new THREE.MeshStandardMaterial({ color: "#ffffff", flatShading: true }), rounds.length);
  const pineCols = ["#2f6b3f", "#3b7a47", "#2a5e3a"].map((c) => new THREE.Color(c));
  const roundCols = ["#5d9b45", "#77ad4b", "#8fbf55", "#d9a441", "#c8693d"].map((c) => new THREE.Color(c));
  treeSpots.forEach((t, i) => place(trunks, i, t.x, t.h - 0.2, t.z, t.s));
  pines.forEach((t, i) => {
    place(pineMesh, i, t.x, t.h - 0.2, t.z, t.s, t.s * (0.9 + rand() * 0.4), rand() * 6);
    pineMesh.setColorAt(i, pineCols[Math.floor(rand() * pineCols.length)]);
  });
  rounds.forEach((t, i) => {
    place(roundMesh, i, t.x, t.h - 0.2, t.z, t.s, t.s, rand() * 6);
    roundMesh.setColorAt(i, roundCols[Math.floor(rand() * (rand() < 0.15 ? roundCols.length : 3))]);
  });

  const rockMesh = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ color: "#9a958c", flatShading: true }),
    rockSpots.length,
  );
  rockSpots.forEach((r, i) => place(rockMesh, i, r.x, r.h, r.z, r.s, r.s * 0.7, rand() * 6));

  const flowerGeo = new THREE.ConeGeometry(0.18, 0.5, 5);
  flowerGeo.translate(0, 0.25, 0);
  const flowerMesh = new THREE.InstancedMesh(flowerGeo, new THREE.MeshStandardMaterial({ color: "#ffffff" }), flowerSpots.length);
  const flowerCols = ["#f8e45c", "#f28cb1", "#ffffff", "#b98cf2", "#f2a65a"].map((c) => new THREE.Color(c));
  flowerSpots.forEach((f, i) => {
    place(flowerMesh, i, f.x, f.h, f.z, 1);
    flowerMesh.setColorAt(i, flowerCols[i % flowerCols.length]);
  });

  for (const m of [trunks, pineMesh, roundMesh, rockMesh]) {
    m.castShadow = true;
    m.receiveShadow = true;
    scatter.add(m);
  }
  scatter.add(flowerMesh);

  return { mesh, water, scatter, groundAt, nearestRoad: (x, z) => nearestRoad(x, z, 2) };
}
