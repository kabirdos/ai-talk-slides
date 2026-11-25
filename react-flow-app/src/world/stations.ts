// Roads, stations, signposts, landmarks: the built environment of the world.
import * as THREE from "three";
import type { WorldData, Road, Stop } from "./worldData";
import { imageFor, projectImage, IMG_BASE } from "./worldData";
import { box, cyl, label, textPlane, torus, mat } from "./kit";
import { buildVignette, type Vignette } from "./vignettes";
import type { Terrain } from "./terrain";

export const PLAZA_R = 17;
const ROAD_W = 7;

export interface StationRuntime {
  stop: Stop;
  group: THREE.Group;
  vignette: Vignette;
  facing: number; // yaw the stage faces
}

const loader = new THREE.TextureLoader();
function tex(url: string): THREE.Texture {
  const t = loader.load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function roadMesh(road: Road): THREE.Group {
  const g = new THREE.Group();
  const pts = road.points.filter(
    (p) => Math.hypot(p.x - road.from.x, p.z - road.from.z) > PLAZA_R - 1.5 && Math.hypot(p.x - road.to.x, p.z - road.to.z) > PLAZA_R - 1.5,
  );
  if (pts.length < 2) return g;
  const ribbon = (half: number, offset: number, lift: number, material: THREE.Material) => {
    const pos: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let tx = b.x - a.x, tz = b.z - a.z;
      const l = Math.hypot(tx, tz) || 1;
      tx /= l; tz /= l;
      const nx = -tz, nz = tx;
      const p = pts[i];
      pos.push(p.x + nx * (offset - half), p.h + lift, p.z + nz * (offset - half));
      pos.push(p.x + nx * (offset + half), p.h + lift, p.z + nz * (offset + half));
      if (i > 0) {
        const k = i * 2;
        idx.push(k - 2, k - 1, k, k - 1, k + 1, k);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, material);
    m.receiveShadow = true;
    return m;
  };
  const surface = new THREE.MeshStandardMaterial({
    color: new THREE.Color(road.line.color).lerp(new THREE.Color("#ffffff"), 0.18),
    roughness: 0.85,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  g.add(ribbon(ROAD_W / 2, 0, 0.06, surface));
  const edge = new THREE.MeshStandardMaterial({ color: "#fdfcf7", roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  g.add(ribbon(0.18, ROAD_W / 2 - 0.4, 0.08, edge));
  g.add(ribbon(0.18, -ROAD_W / 2 + 0.4, 0.08, edge));

  // Chevrons pointing along the direction of travel, lamp posts with line-coloured lanterns
  const chevGeo = new THREE.ShapeGeometry(
    new THREE.Shape([new THREE.Vector2(-1.1, -0.5), new THREE.Vector2(0, 0.6), new THREE.Vector2(1.1, -0.5), new THREE.Vector2(0.7, -0.5), new THREE.Vector2(0, 0.2), new THREE.Vector2(-0.7, -0.5)]),
  );
  chevGeo.rotateX(-Math.PI / 2);
  const chevMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.8, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const lantern = new THREE.MeshStandardMaterial({ color: road.line.color, emissive: road.line.color, emissiveIntensity: 0.9 });
  const chevM: THREE.Matrix4[] = [];
  const lampM: THREE.Matrix4[] = [];
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  let acc = 0;
  let lampSide = 1;
  let nextLamp = 14;
  for (let i = 1; i < pts.length - 1; i++) {
    acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    const dirx = pts[i + 1].x - pts[i - 1].x, dirz = pts[i + 1].z - pts[i - 1].z;
    const yaw = Math.atan2(dirx, dirz);
    if (Math.floor(acc / 9) !== Math.floor((acc - 2) / 9)) {
      q.setFromAxisAngle(up, yaw + Math.PI);
      chevM.push(new THREE.Matrix4().compose(new THREE.Vector3(pts[i].x, pts[i].h + 0.1, pts[i].z), q, one));
    }
    if (acc > nextLamp) {
      nextLamp += 26;
      lampSide *= -1;
      const nx = Math.cos(yaw) * lampSide, nz = -Math.sin(yaw) * lampSide;
      q.setFromAxisAngle(up, yaw);
      lampM.push(new THREE.Matrix4().compose(new THREE.Vector3(pts[i].x + nx * (ROAD_W / 2 + 1.1), pts[i].h, pts[i].z + nz * (ROAD_W / 2 + 1.1)), q, one));
    }
  }
  const inst = (geo: THREE.BufferGeometry, m: THREE.Material, list: THREE.Matrix4[], shadow = false) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(geo, m, list.length);
    list.forEach((mx, i) => im.setMatrixAt(i, mx));
    im.castShadow = shadow;
    g.add(im);
  };
  inst(chevGeo, chevMat, chevM);
  const postGeo = new THREE.CylinderGeometry(0.09, 0.12, 3.6, 6);
  postGeo.translate(0, 1.8, 0);
  const lanternGeo = new THREE.OctahedronGeometry(0.35);
  lanternGeo.translate(0, 3.9, 0);
  const flagGeo = new THREE.BoxGeometry(0.05, 0.9, 0.7);
  flagGeo.translate(0, 2.4, 0.38);
  inst(postGeo, mat("#334155"), lampM, true);
  inst(lanternGeo, lantern, lampM);
  inst(flagGeo, mat(road.line.color), lampM, true);
  return g;
}

function signpost(road: Road, terrain: Terrain): THREE.Group {
  // Find the first point outside the plaza
  const p = road.points.find((q) => Math.hypot(q.x - road.from.x, q.z - road.from.z) > PLAZA_R + 3) ?? road.points[0];
  const i = road.points.indexOf(p);
  const nxt = road.points[Math.min(road.points.length - 1, i + 3)];
  const yaw = Math.atan2(nxt.x - p.x, nxt.z - p.z);
  const g = new THREE.Group();
  g.add(cyl(0.1, 0.12, 3.2, "#5b4636", 6));
  const board = textPlane(`${road.line.name} → ${road.to.slide.title}`, 4.2, {
    bg: road.line.color, color: "#fff", font: '800 54px "Space Grotesk", system-ui', maxWidth: 1100, radius: 14,
  });
  board.position.set(0, 2.7, 0.15);
  g.add(board);
  const sideX = Math.cos(yaw) * (ROAD_W / 2 + 2.2), sideZ = -Math.sin(yaw) * (ROAD_W / 2 + 2.2);
  g.position.set(p.x + sideX, terrain.groundAt(p.x + sideX, p.z + sideZ), p.z + sideZ);
  g.rotation.y = yaw + Math.PI; // face travellers coming out of the plaza
  return g;
}

function lineArch(road: Road): THREE.Group {
  const pts = road.points;
  const p = pts.find((q) => Math.hypot(q.x - road.from.x, q.z - road.from.z) > PLAZA_R + 10) ?? pts[0];
  const i = pts.indexOf(p);
  const nxt = pts[Math.min(pts.length - 1, i + 3)];
  const yaw = Math.atan2(nxt.x - p.x, nxt.z - p.z);
  const g = new THREE.Group();
  const c = road.line.color;
  const half = ROAD_W / 2 + 1.2;
  [-half, half].forEach((x) => {
    const post = box(0.7, 6.5, 0.7, c);
    post.position.x = x;
    g.add(post);
  });
  const beam = box(ROAD_W + 3.4, 0.8, 0.8, c);
  beam.position.y = 6.5;
  g.add(beam);
  const sign = textPlane(`${road.line.name} · ${road.line.subtitle}`, ROAD_W + 2, { bg: "#ffffff", color: "#111", border: c, font: '800 60px "Space Grotesk", system-ui' });
  sign.position.set(0, 7.9, 0);
  g.add(sign);
  g.position.set(p.x, p.h, p.z);
  g.rotation.y = yaw;
  return g;
}

function stationSign(stop: Stop): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.12, 0.14, 4.6, "#334155", 8));
  stop.lines.forEach((l, i) => {
    const r = torus(1.05 - i * 0.22, 0.13, l.color);
    r.position.y = 4.9;
    g.add(r);
  });
  const name = textPlane(stop.slide.title, 4.4, {
    bg: "#0f172a", color: "#ffffff", font: '800 56px "Space Grotesk", system-ui', maxWidth: 1000, radius: 10,
  });
  name.position.set(0, 4.9, 0.2);
  g.add(name);
  return g;
}

export function buildStations(world: WorldData, terrain: Terrain, scene: THREE.Scene): StationRuntime[] {
  for (const road of world.roads) scene.add(roadMesh(road));
  for (const road of world.roads) scene.add(signpost(road, terrain));
  for (const line of world.lines) {
    const first = world.roads.find((r) => r.line === line && !r.transfer);
    if (first) scene.add(lineArch(first));
  }

  const stations: StationRuntime[] = [];
  for (const stop of world.stops) {
    const g = new THREE.Group();
    g.position.set(stop.x, stop.h, stop.z);
    scene.add(g);
    // Plaza
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(PLAZA_R, PLAZA_R + 0.6, 0.6, 48), mat("#ece6d8", { flatShading: false, roughness: 0.9 }));
    plaza.position.y = -0.18;
    plaza.receiveShadow = true;
    g.add(plaza);
    stop.lines.forEach((l, i) => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(PLAZA_R - 1.4 - i * 0.9, PLAZA_R - 0.7 - i * 0.9, 64), new THREE.MeshStandardMaterial({ color: l.color, polygonOffset: true, polygonOffsetFactor: -2 }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.13;
      g.add(ring);
    });

    // Which way does the story face? Toward where travellers arrive from.
    const inbound = world.roads.find((r) => r.to === stop && r.line === stop.line && !r.transfer) ?? world.roads.find((r) => r.to === stop);
    let facing: number;
    if (inbound) {
      const q = inbound.points[Math.max(0, inbound.points.length - 15)];
      facing = Math.atan2(q.x - stop.x, q.z - stop.z);
    } else {
      facing = Math.atan2(world.spawn.x - stop.x, world.spawn.z - stop.z);
    }
    const stage = new THREE.Group();
    stage.rotation.y = facing;
    g.add(stage);

    const vignette = buildVignette(stop.id, stop.line.color);
    vignette.group.position.set(0, 0.12, 0);
    vignette.group.scale.setScalar(1.7);
    stage.add(vignette.group);

    // Billboard with the slide's artwork, behind the story
    const bb = new THREE.Group();
    const frame = box(11.2, 6.6, 0.3, "#1f2937", 0);
    bb.add(frame);
    const img = new THREE.Mesh(new THREE.PlaneGeometry(10.6, 5.96), new THREE.MeshBasicMaterial({ map: tex(imageFor(stop.id)), toneMapped: false }));
    img.position.z = 0.17;
    bb.add(img);
    [-4, 4].forEach((x) => {
      const post = box(0.35, 6.2, 0.35, "#334155");
      post.position.set(x, -6.2, -0.1);
      bb.add(post);
    });
    bb.position.set(0, 6.2, -12.5);
    stage.add(bb);

    const sign = stationSign(stop);
    sign.position.set(PLAZA_R - 4, 0, 9);
    sign.rotation.y = -0.4;
    stage.add(sign);

    // Project kiosks (the slide's side-loop of real projects)
    stop.projects.forEach((pr, i) => {
      const k = new THREE.Group();
      const url = projectImage(pr.id);
      k.add(box(2.6, 1, 0.8, "#f8fafc"));
      if (url) {
        const pic = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), new THREE.MeshBasicMaterial({ map: tex(url), toneMapped: false }));
        pic.position.set(0, 2.2, 0.05);
        k.add(pic);
        const back = box(2.8, 1.8, 0.08, "#0f172a", 0);
        back.position.set(0, 1.3, 0);
        k.add(back);
      }
      const t = label(pr.title, { size: 0.35, bg: "#fff7ed" });
      t.position.y = 3.5;
      k.add(t);
      const side = i % 2 === 0 ? -1 : 1;
      const row = Math.floor(i / 2);
      k.position.set(side * (PLAZA_R - 4), 0, -3 - row * 4.5);
      k.rotation.y = -side * Math.PI / 2;
      stage.add(k);
    });

    stations.push({ stop, group: g, vignette, facing });
  }

  // Landmarks: the destinations and ports of the metro map
  for (const l of world.landmarks) {
    const gy = terrain.groundAt(l.x, l.z);
    const t = tex(`${IMG_BASE}${l.image}`);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, fog: true }));
    sp.scale.set(l.size, l.size * 0.75, 1);
    sp.position.set(l.x, gy + l.size * 0.38 + 2, l.z);
    scene.add(sp);
    const lab = label(l.label, { size: Math.max(1.6, l.size / 22), bg: "#0f172a", color: "#fff" });
    lab.position.set(l.x, gy + l.size * 0.78 + 4, l.z);
    scene.add(lab);
  }

  // River labels
  world.river.forEach((p, i) => {
    if (i % 9 !== 4) return;
    const lab = label("River of AI Disillusionment", { size: 1.4, bg: "rgba(14,116,144,0.85)", color: "#e0f2fe" });
    lab.position.set(p.x, 4, p.z);
    scene.add(lab);
  });

  return stations;
}
