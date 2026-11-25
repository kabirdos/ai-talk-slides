// "Leveling Up with AI" — an explorable world built from the talk's metro map.
import * as THREE from "three";
import "./world.css";
import { mulberry32, hashString } from "./noise";
import { buildWorldData, type Stop, type Road } from "./worldData";
import { buildTerrain, WATER_LEVEL } from "./terrain";
import { buildStations, PLAZA_R, type StationRuntime } from "./stations";
import { figure, walkPose, idlePose, box, sphere, cyl } from "./kit";

const BEAT = 6; // seconds per story beat
const WALK = 9;
const RUN = 18;

const params = new URLSearchParams(location.search);
const seedParam = params.get("seed") ?? "level-up";
const seed = /^\d+$/.test(seedParam) ? Number(seedParam) : hashString(seedParam);
const rand = mulberry32(seed);

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function main() {
  try {
    await document.fonts.load('800 40px "Space Grotesk"');
  } catch {
    /* fall back to system fonts */
  }
  const loading = $("loading");
  const setLoad = (t: string) => (loading.querySelector("p")!.textContent = t);
  setLoad("Laying out the metro lines…");
  await tick();

  const world = buildWorldData(rand);
  setLoad("Raising hills and carving the river…");
  await tick();
  const terrain = buildTerrain(world, rand);

  // ---------- Renderer & scene
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  $("app").appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const horizon = new THREE.Color("#cfe9f7");
  scene.background = horizon;
  scene.fog = new THREE.Fog(horizon, 160, 760);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1500, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: new THREE.Color("#4aa8e8") }, bottom: { value: horizon } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} ",
      fragmentShader: "uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y*1.6+0.05,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, pow(h,0.8)),1.0);} ",
    }),
  );
  scene.add(sky);

  scene.add(new THREE.HemisphereLight("#e8f4ff", "#7a8f5a", 1.1));
  const sun = new THREE.DirectionalLight("#fff4e0", 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 10; sc.far = 400;
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);

  scene.add(terrain.mesh, terrain.water, terrain.scatter);

  // Clouds
  const clouds = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, flatShading: true, transparent: true, opacity: 0.92 });
  for (let i = 0; i < 46; i++) {
    const c = new THREE.Group();
    const n = 3 + Math.floor(rand() * 4);
    for (let k = 0; k < n; k++) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(8 + rand() * 10, 0), cloudMat);
      s.position.set(k * 12 - n * 6, rand() * 5, rand() * 10);
      c.add(s);
    }
    c.position.set(world.bounds.minX + rand() * (world.bounds.maxX - world.bounds.minX), 110 + rand() * 50, world.bounds.minZ + rand() * (world.bounds.maxZ - world.bounds.minZ));
    clouds.add(c);
  }
  scene.add(clouds);

  setLoad("Building stations and staging the stories…");
  await tick();
  const stations = buildStations(world, terrain, scene);

  // ---------- Player
  const player = new THREE.Group();
  const hero = figure("#0ea5a4", { hair: "#3b2a1a" });
  const pack = box(0.45, 0.55, 0.25, "#f59e0b", 0);
  pack.position.set(0, 1.1, -0.28);
  hero.add(pack);
  const scarf = box(0.6, 0.12, 0.36, "#f43f5e", 0);
  scarf.position.y = 1.45;
  hero.add(scarf);
  player.add(hero);
  const lamp = sphere(0.12, new THREE.MeshStandardMaterial({ color: "#fde047", emissive: "#facc15", emissiveIntensity: 1.5 }), 0);
  lamp.position.set(0.6, 2.2, 0);
  player.add(lamp);
  const marker = cyl(0.9, 0.9, 0.05, new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.35 }), 24);
  player.add(marker);
  scene.add(player);

  const state = {
    x: world.spawn.x,
    z: world.spawn.z,
    y: 0,
    yaw: world.spawn.yaw,
    camYaw: world.spawn.yaw + Math.PI,
    camPitch: 0.42,
    camDist: 14,
    vy: 0,
    moving: 0,
    follow: null as null | { road: Road; idx: number },
  };
  state.y = terrain.groundAt(state.x, state.z);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 3000);

  // ---------- Input
  const keys = new Set<string>();
  let started = false;
  window.addEventListener("keydown", (e) => {
    if (!started) return;
    const k = e.key.toLowerCase();
    keys.add(k);
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) state.follow = null;
    if (k === "f") toggleFollow();
    if (k === "m") toggleMap();
    if (k === "r" && activeStation) storyStart = clock.elapsedTime;
    if (k === "escape" && mapOpen) toggleMap();
    if (k.startsWith("arrow") || k === " ") e.preventDefault();
  });
  window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener("blur", () => keys.clear());

  const canvas = renderer.domElement;
  let dragging = false, lastX = 0, lastY = 0;
  canvas.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch" && e.clientX < window.innerWidth * 0.4 && e.clientY > window.innerHeight * 0.45) return;
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    state.camYaw -= (e.clientX - lastX) * 0.005;
    state.camPitch = THREE.MathUtils.clamp(state.camPitch + (e.clientY - lastY) * 0.004, 0.08, 1.3);
    lastX = e.clientX; lastY = e.clientY;
  });
  canvas.addEventListener("pointerup", () => (dragging = false));
  canvas.addEventListener("wheel", (e) => {
    state.camDist = THREE.MathUtils.clamp(state.camDist + e.deltaY * 0.02, 6, 60);
  }, { passive: true });

  // Touch joystick
  const joy = { active: false, id: -1, ox: 0, oy: 0, dx: 0, dy: 0 };
  const stick = $("stick"), knob = $("knob");
  stick.addEventListener("pointerdown", (e) => {
    joy.active = true; joy.id = e.pointerId;
    const r = stick.getBoundingClientRect();
    joy.ox = r.left + r.width / 2; joy.oy = r.top + r.height / 2;
    stick.setPointerCapture(e.pointerId);
    state.follow = null;
  });
  stick.addEventListener("pointermove", (e) => {
    if (!joy.active || e.pointerId !== joy.id) return;
    let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy;
    const l = Math.hypot(dx, dy), max = 46;
    if (l > max) { dx *= max / l; dy *= max / l; }
    joy.dx = dx / max; joy.dy = dy / max;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  });
  const endJoy = () => { joy.active = false; joy.dx = joy.dy = 0; knob.style.transform = ""; };
  stick.addEventListener("pointerup", endJoy);
  stick.addEventListener("pointercancel", endJoy);
  $("btn-follow").addEventListener("click", () => toggleFollow());
  $("btn-map").addEventListener("click", () => toggleMap());
  $("btn-replay").addEventListener("click", () => (storyStart = clock.elapsedTime));

  // ---------- Discovery (per-viewer convenience only)
  const visited = new Set<string>();
  try {
    JSON.parse(localStorage.getItem("levelup-world-visited") ?? "[]").forEach((id: string) => visited.add(id));
  } catch { /* storage unavailable */ }
  const saveVisited = () => {
    try { localStorage.setItem("levelup-world-visited", JSON.stringify([...visited])); } catch { /* ignore */ }
  };

  // ---------- Follow the line
  function nextRoadFrom(stop: Stop, prefer: Road["line"]): Road | undefined {
    const out = world.roads.filter((r) => r.from === stop);
    return out.find((r) => r.line === prefer && !r.transfer) ?? out.find((r) => r.line === prefer) ?? out.find((r) => !r.transfer) ?? out[0];
  }
  function toggleFollow() {
    if (state.follow) { state.follow = null; updateFollowBtn(); return; }
    const near = terrain.nearestRoad(state.x, state.z);
    let road: Road | undefined;
    let idx = 0;
    const atStop = nearestStop();
    if (atStop.d < PLAZA_R + 2) {
      road = nextRoadFrom(atStop.stop, atStop.stop.line);
      idx = 0;
    } else if (near.road >= 0 && near.dist < 30) {
      road = world.roads[near.road];
      let best = Infinity;
      road.points.forEach((p, i) => {
        const d = (p.x - state.x) ** 2 + (p.z - state.z) ** 2;
        if (d < best) { best = d; idx = i; }
      });
    }
    if (road) state.follow = { road, idx };
    updateFollowBtn();
  }
  function updateFollowBtn() {
    $("btn-follow").classList.toggle("on", !!state.follow);
  }

  function nearestStop() {
    let best = Infinity, stop = world.stops[0];
    for (const s of world.stops) {
      const d = Math.hypot(s.x - state.x, s.z - state.z);
      if (d < best) { best = d; stop = s; }
    }
    return { stop, d: best };
  }

  // ---------- HUD
  const panel = $("story");
  const minimap = $("minimap") as unknown as HTMLCanvasElement;
  const mapCanvas = $("bigmap") as unknown as HTMLCanvasElement;
  let mapOpen = false;
  function toggleMap() {
    mapOpen = !mapOpen;
    $("map-overlay").classList.toggle("open", mapOpen);
    if (mapOpen) drawMap(mapCanvas, true);
  }
  const { minX, maxX, minZ, maxZ } = world.bounds;
  const mapView = { minX: -160, maxX: 1500, minZ: -460, maxZ: 520 };
  function toMap(c: HTMLCanvasElement, x: number, z: number) {
    const s = Math.min(c.width / (mapView.maxX - mapView.minX), c.height / (mapView.maxZ - mapView.minZ));
    const ox = (c.width - (mapView.maxX - mapView.minX) * s) / 2;
    const oy = (c.height - (mapView.maxZ - mapView.minZ) * s) / 2;
    return [ox + (x - mapView.minX) * s, oy + (z - mapView.minZ) * s, s] as const;
  }
  void minX; void maxX; void minZ; void maxZ;
  function drawMap(c: HTMLCanvasElement, big: boolean) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.clientWidth * dpr, h = c.clientHeight * dpr;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(250,248,240,0.96)";
    ctx.fillRect(0, 0, w, h);
    // river
    ctx.strokeStyle = "rgba(61,159,214,0.45)";
    ctx.lineWidth = (big ? 10 : 5) * dpr;
    ctx.lineCap = "round";
    ctx.beginPath();
    world.river.forEach((p, i) => { const [x, y] = toMap(c, p.x, p.z); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.stroke();
    for (const r of world.roads) {
      ctx.strokeStyle = r.line.color;
      ctx.lineWidth = (big ? 7 : 3.5) * dpr;
      ctx.lineJoin = "round";
      ctx.beginPath();
      r.points.forEach((p, i) => { const [x, y] = toMap(c, p.x, p.z); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.stroke();
    }
    ctx.font = `${(big ? 13 : 0) * dpr}px "Space Grotesk", system-ui`;
    for (const s of world.stops) {
      const [x, y] = toMap(c, s.x, s.z);
      ctx.beginPath();
      ctx.arc(x, y, (big ? 7 : 3.5) * dpr, 0, Math.PI * 2);
      ctx.fillStyle = visited.has(s.id) ? s.line.color : "#ffffff";
      ctx.fill();
      ctx.lineWidth = 2 * dpr;
      ctx.strokeStyle = "#111";
      ctx.stroke();
      if (big) {
        ctx.fillStyle = "#111";
        ctx.textAlign = "left";
        ctx.fillText(s.slide.title, x + 10 * dpr, y - 8 * dpr);
      }
    }
    if (big) {
      for (const l of world.landmarks) {
        const [x, y] = toMap(c, l.x, l.z);
        ctx.fillStyle = "#475569";
        ctx.textAlign = "center";
        ctx.font = `italic ${12 * dpr}px "Space Grotesk", system-ui`;
        ctx.fillText(l.label, x, y);
      }
      ctx.font = `${13 * dpr}px "Space Grotesk", system-ui`;
    }
    const [px, py] = toMap(c, state.x, state.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-state.yaw + Math.PI);
    ctx.fillStyle = "#e11d48";
    ctx.beginPath();
    const k = (big ? 11 : 7) * dpr;
    ctx.moveTo(0, -k); ctx.lineTo(k * 0.7, k * 0.7); ctx.lineTo(0, k * 0.3); ctx.lineTo(-k * 0.7, k * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  mapCanvas.addEventListener("click", (e) => {
    const r = mapCanvas.getBoundingClientRect();
    const dpr = mapCanvas.width / r.width;
    const mx = (e.clientX - r.left) * dpr, my = (e.clientY - r.top) * dpr;
    let best: Stop | null = null, bd = 18 * dpr;
    for (const s of world.stops) {
      const [x, y] = toMap(mapCanvas, s.x, s.z);
      const d = Math.hypot(x - mx, y - my);
      if (d < bd) { bd = d; best = s; }
    }
    if (best) {
      const st = stations.find((x) => x.stop === best)!;
      state.x = best.x + Math.sin(st.facing) * (PLAZA_R - 3);
      state.z = best.z + Math.cos(st.facing) * (PLAZA_R - 3);
      state.yaw = st.facing + Math.PI;
      state.camYaw = st.facing;
      state.follow = null;
      updateFollowBtn();
      toggleMap();
    }
  });

  let activeStation: StationRuntime | null = null;
  let storyStart = 0;
  let renderedKey = "";
  function renderPanel(st: StationRuntime, beat: number) {
    const s = st.stop.slide;
    const bullets = s.bullets ?? [];
    const beats = st.vignette.beats;
    const revealed = bullets.length === 0 ? 0 : beat >= beats ? bullets.length : Math.min(bullets.length, Math.ceil(((beat + 1) * bullets.length) / beats));
    const key = `${s.id}:${revealed}:${Math.min(beat, beats)}`;
    if (key === renderedKey) return;
    renderedKey = key;
    const lines = st.stop.lines.map((l) => `<span class="pill" style="--c:${l.color}">${l.name} · ${l.subtitle}</span>`).join("");
    const items = bullets.map((b, i) => `<li class="${i < revealed ? "on" : ""} ${i === revealed - 1 && beat < beats ? "now" : ""}">${esc(b)}</li>`).join("");
    const note = (s.subnodes ?? []).filter((n) => n.type === "note").map((n) => `<p class="note"><b>${esc(n.title)}:</b> ${esc(n.content ?? "")}</p>`).join("");
    const projects = st.stop.projects.map((p) => `<li>${p.url ? `<a href="${p.url}" target="_blank" rel="noopener">${esc(p.title)}</a>` : `<b>${esc(p.title)}</b>`} — ${esc(p.content ?? "")}</li>`).join("");
    const res = st.stop.resources.map((r) => `<a class="res" href="${r.url}" target="_blank" rel="noopener">${esc(r.title)}</a>`).join("");
    const dots = Array.from({ length: beats }, (_, i) => `<i class="${i <= beat ? "on" : ""}"></i>`).join("");
    panel.innerHTML = `
      <div class="lines">${lines}</div>
      <h2>${esc(s.title)}</h2>
      ${s.subtitle ? `<p class="sub">${esc(s.subtitle)}</p>` : ""}
      ${s.quote ? `<blockquote>${esc(s.quote)}</blockquote>` : ""}
      ${items ? `<ul>${items}</ul>` : ""}
      ${note}
      ${projects ? `<h3>Built along this stop</h3><ul class="proj">${projects}</ul>` : ""}
      ${res ? `<div class="resources">${res}</div>` : ""}
      <div class="beats">${dots}<button id="replay-inline">↺ replay story</button></div>`;
    panel.querySelector("#replay-inline")?.addEventListener("click", () => (storyStart = clock.elapsedTime));
  }

  // ---------- Start
  $("seed-label").textContent = seedParam;
  $("btn-newworld").addEventListener("click", () => {
    const s = Math.floor(Math.random() * 1e9);
    location.search = `?seed=${s}`;
  });
  loading.classList.add("hidden");
  $("intro").classList.remove("hidden");
  $("btn-start").addEventListener("click", () => {
    $("intro").classList.add("hidden");
    $("hud").classList.remove("hidden");
    started = true;
  });

  window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  // ---------- Loop
  const clock = new THREE.Clock();
  const tmpV = new THREE.Vector3();
  let mapTimer = 0;
  // expose for automated checks
  (window as unknown as { __world: unknown }).__world = { state, world, stations, renderer, start: () => $("btn-start").click() };

  renderer.setAnimationLoop(() => {
    const dt = Math.min(0.05, clock.getDelta());
    const T = clock.elapsedTime;

    // Movement
    let fx = 0, fz = 0;
    if (started) {
      if (keys.has("w") || keys.has("arrowup")) fz += 1;
      if (keys.has("s") || keys.has("arrowdown")) fz -= 1;
      if (keys.has("a") || keys.has("arrowleft")) fx -= 1;
      if (keys.has("d") || keys.has("arrowright")) fx += 1;
      fx += joy.dx; fz -= joy.dy;
    }
    const run = keys.has("shift") || Math.hypot(joy.dx, joy.dy) > 0.95;
    let mvx = 0, mvz = 0, speed = run ? RUN : WALK;
    if (state.follow) {
      const f = state.follow;
      const pts = f.road.points;
      while (f.idx < pts.length - 1 && Math.hypot(pts[f.idx].x - state.x, pts[f.idx].z - state.z) < 4) f.idx++;
      if (f.idx >= pts.length - 1 && Math.hypot(pts[pts.length - 1].x - state.x, pts[pts.length - 1].z - state.z) < 3) {
        // Arrived at the next stop: pause there so the story plays
        state.follow = null;
        updateFollowBtn();
      } else {
        const tgt = pts[Math.min(pts.length - 1, f.idx + 2)];
        mvx = tgt.x - state.x; mvz = tgt.z - state.z;
        const l = Math.hypot(mvx, mvz) || 1;
        mvx /= l; mvz /= l;
        speed = RUN;
      }
    } else if (fx || fz) {
      const l = Math.min(1, Math.hypot(fx, fz));
      const ang = Math.atan2(fx, fz);
      // camera forward = from camera to player
      const yaw = state.camYaw + Math.PI + ang * -1;
      mvx = Math.sin(yaw) * l; mvz = Math.cos(yaw) * l;
    }
    const moveLen = Math.hypot(mvx, mvz);
    if (moveLen > 0.01) {
      let nx = state.x + mvx * speed * dt;
      let nz = state.z + mvz * speed * dt;
      const gy = terrain.groundAt(nx, nz);
      if (gy < WATER_LEVEL - 0.6) { nx = state.x + mvx * speed * dt * 0.45; nz = state.z + mvz * speed * dt * 0.45; }
      state.x = THREE.MathUtils.clamp(nx, world.bounds.minX + 60, world.bounds.maxX - 60);
      state.z = THREE.MathUtils.clamp(nz, world.bounds.minZ + 60, world.bounds.maxZ - 60);
      const targetYaw = Math.atan2(mvx, mvz);
      let d = targetYaw - state.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      state.yaw += d * Math.min(1, dt * 12);
      state.moving = Math.min(1, state.moving + dt * 6);
      if (state.follow) {
        // gently swing the camera behind the player
        let cd = (state.yaw + Math.PI) - state.camYaw;
        cd = Math.atan2(Math.sin(cd), Math.cos(cd));
        state.camYaw += cd * dt * 1.5;
      }
    } else state.moving = Math.max(0, state.moving - dt * 6);

    const ground = Math.max(terrain.groundAt(state.x, state.z), WATER_LEVEL - 1.2);
    state.y += (ground - state.y) * Math.min(1, dt * 18);
    player.position.set(state.x, state.y, state.z);
    hero.rotation.y = state.yaw;
    if (state.moving > 0.05) walkPose(hero, T * (speed === RUN ? 16 : 11), state.moving);
    else idlePose(hero, T);
    lamp.position.set(Math.sin(T * 1.3) * 0.6 + 0.4, 2.3 + Math.sin(T * 2.6) * 0.15, Math.cos(T * 1.3) * 0.6);
    marker.visible = state.moving < 0.1;

    // Camera
    const cx = state.x + Math.sin(state.camYaw) * Math.cos(state.camPitch) * state.camDist;
    const cz = state.z + Math.cos(state.camYaw) * Math.cos(state.camPitch) * state.camDist;
    let cy = state.y + 1.6 + Math.sin(state.camPitch) * state.camDist;
    cy = Math.max(cy, terrain.groundAt(cx, cz) + 1.5);
    camera.position.lerp(tmpV.set(cx, cy, cz), Math.min(1, dt * 8));
    camera.lookAt(state.x, state.y + 1.8, state.z);

    sun.position.set(state.x + 80, state.y + 140, state.z + 50);
    sun.target.position.set(state.x, state.y, state.z);
    sky.position.copy(camera.position);
    clouds.children.forEach((c, i) => {
      c.position.x += dt * (2 + (i % 3));
      if (c.position.x > world.bounds.maxX + 200) c.position.x = world.bounds.minX - 200;
    });

    // Stations: who is active, update stories nearby
    const ns = nearestStop();
    const inPlaza = ns.d < PLAZA_R + 1;
    const st = inPlaza ? stations.find((s) => s.stop === ns.stop)! : null;
    if (st !== activeStation) {
      activeStation = st;
      storyStart = T;
      renderedKey = "";
      panel.classList.toggle("open", !!st);
      if (st && !visited.has(st.stop.id)) {
        visited.add(st.stop.id);
        saveVisited();
      }
    }
    for (const s of stations) {
      const d = Math.hypot(s.stop.x - state.x, s.stop.z - state.z);
      const near = d < 220;
      s.group.visible = d < 520;
      s.vignette.group.visible = near;
      if (!near) continue;
      const beats = s.vignette.beats;
      const cycle = (beats + 1) * BEAT;
      const local = s === activeStation ? T - storyStart : T + s.stop.index * 3.7;
      const tm = local % cycle;
      const phase = Math.min(beats, Math.floor(tm / BEAT));
      const p = (tm - phase * BEAT) / BEAT;
      s.vignette.update({ T: local, phase, p });
      if (s === activeStation) renderPanel(s, phase);
    }

    // HUD text
    if (started) {
      const near = terrain.nearestRoad(state.x, state.z);
      const road = near.road >= 0 && near.dist < 12 ? world.roads[near.road] : null;
      const where = st
        ? `<span class="dot" style="--c:${st.stop.line.color}"></span><b>${esc(st.stop.slide.title)}</b> station`
        : road
          ? `<span class="dot" style="--c:${road.line.color}"></span>On the <b>${road.line.name}</b> toward <b>${esc(road.to.slide.title)}</b> · ${Math.round(Math.hypot(road.to.x - state.x, road.to.z - state.z))} m`
          : `Wandering off the lines · nearest stop <b>${esc(ns.stop.slide.title)}</b> (${Math.round(ns.d)} m)`;
      const whereEl = $("where");
      if (whereEl.dataset.v !== where) { whereEl.innerHTML = where; whereEl.dataset.v = where; }
      $("progress").textContent = `${visited.size} / ${world.stops.length} stops explored`;
      mapTimer -= dt;
      if (mapTimer <= 0) { drawMap(minimap, false); mapTimer = 0.1; if (mapOpen) drawMap(mapCanvas, true); }
    }

    renderer.render(scene, camera);
  });
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
function tick() {
  return new Promise((r) => setTimeout(r, 20));
}

main().catch((e) => {
  console.error(e);
  const l = document.getElementById("loading");
  if (l) l.querySelector("p")!.textContent = "Something went wrong building the world: " + (e as Error).message;
});
