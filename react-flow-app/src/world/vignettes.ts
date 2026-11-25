// One animated diorama per metro stop. Each tells its slide's story in beats;
// the story panel reveals the slide's bullets in step with the beats.
import * as THREE from "three";
import {
  box, sphere, cyl, cone, torus, label, textPlane, figure, walkPose, idlePose,
  setOpacity, ownMat, at, popIn, seg, lerp, ease, clamp01, bubble, mat,
  type Figure,
} from "./kit";

export interface Beat {
  T: number; // seconds since the story started
  phase: number; // current beat (== beats means the finale)
  p: number; // 0..1 progress through the beat
}

export interface Vignette {
  group: THREE.Group;
  beats: number;
  update: (b: Beat) => void;
}

type Builder = (color: string) => Vignette;

const SKIN = ["#f1c9a5", "#c68e63", "#8d5a3b", "#f5d6b8"];
const HUMAN = "#0ea5a4"; // the explorer/hero colour inside stories

function moveFig(f: Figure, ax: number, az: number, bx: number, bz: number, p: number, T: number, speed = 9) {
  const e = clamp01(p);
  f.position.x = lerp(ax, bx, e);
  f.position.z = lerp(az, bz, e);
  if (e > 0 && e < 1) {
    f.rotation.y = Math.atan2(bx - ax, bz - az);
    walkPose(f, T * speed);
  } else idlePose(f, T);
}

function ring<T extends THREE.Object3D>(items: T[], r: number, y = 0) {
  items.forEach((it, i) => {
    const a = (i / items.length) * Math.PI * 2;
    it.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
  });
}

const V = (beats: number, group: THREE.Group, update: (b: Beat) => void): Vignette => ({ group, beats, update });

// ----------------------------------------------------------------------------
const builders: Record<string, Builder> = {
  // The Widening Gulf of Technology
  "slide-01": () => {
    const g = new THREE.Group();
    const laneA = box(13, 0.3, 2.2, "#d6cbb4");
    const laneB = box(13, 0.3, 2.2, "#d6cbb4");
    const chasm = box(13, 0.1, 1, "#1e1b2e", 0.02);
    g.add(laneA, laneB, chasm);
    const slow = figure("#64748b");
    const fast = figure(HUMAN, { hair: "#3b2a1a" });
    g.add(slow, fast);
    const icons = [
      label("🔥 fire", { size: 0.5 }), label("🚲 bicycle", { size: 0.5 }),
      label("🚗 car", { size: 0.5 }), label("🌐 Internet", { size: 0.5 }),
    ];
    icons.forEach((ic, i) => { ic.position.set(-4.5 + i * 3, 3.2, -1.6); g.add(ic); });
    const orb = sphere(0.35, ownMat("#a78bfa", { emissive: "#7c3aed", emissiveIntensity: 0.8 }));
    g.add(orb);
    const aiTag = label("AI", { size: 0.5, bg: "#7c3aed", color: "#fff" });
    g.add(aiTag);
    let xs = -6, xf = -6;
    let last = 0;
    return V(3, g, ({ T, phase, p }) => {
      const dt = Math.min(0.1, Math.max(0, T - last));
      last = T;
      const gap = phase === 0 ? 0.3 : phase === 1 ? lerp(0.3, 3, ease(p)) : 3;
      laneA.position.z = -1.1 - gap / 2;
      laneB.position.z = 1.1 + gap / 2;
      chasm.scale.z = gap;
      icons.forEach((ic, i) => {
        const on = phase > 0 || p * 4 > i;
        ic.visible = on;
        ic.position.z = laneA.position.z;
      });
      const techLevel = phase === 0 ? Math.min(4, Math.floor(p * 4) + 1) : 4;
      const vSlow = phase >= 2 ? 1.2 : 1.6 + techLevel * 0.5;
      const vFast = phase >= 2 ? 7 : 1.6 + techLevel * 0.5;
      xs += vSlow * dt;
      xf += vFast * dt;
      if (xs > 6) xs = -6;
      if (xf > 6) xf = -6;
      slow.position.set(xs, 0.3, laneB.position.z);
      fast.position.set(xf, 0.3, laneA.position.z);
      slow.rotation.y = fast.rotation.y = Math.PI / 2;
      walkPose(slow, T * 4 * (vSlow / 2));
      walkPose(fast, T * 4 * Math.min(3, vFast / 2));
      const showAI = phase >= 1;
      orb.visible = aiTag.visible = showAI;
      orb.position.set(xf + 0.5, 2.3 + Math.sin(T * 4) * 0.1, laneA.position.z);
      aiTag.position.set(xf + 0.5, 3, laneA.position.z);
    });
  },

  // Mental Models Through Use
  "slide-02": () => {
    const g = new THREE.Group();
    const f = figure(HUMAN, { hair: "#3b2a1a" });
    g.add(f);
    const book = box(0.5, 0.35, 0.08, "#b45309");
    book.position.set(0, 1.1, 0.45);
    g.add(book);
    const hammer = new THREE.Group();
    hammer.add(cyl(0.04, 0.04, 0.7, "#7c4a1e"), at(box(0.3, 0.15, 0.15, "#64748b"), 0, 0.7, 0));
    f.userData.armR.add(hammer);
    hammer.position.set(0, -0.6, 0.1);
    hammer.rotation.x = Math.PI / 2;
    const cloud = new THREE.Group();
    [[-0.6, 0], [0, 0.25], [0.6, 0], [0, -0.15]].forEach(([x, y]) => {
      const s = sphere(0.7, ownMat("#ffffff", { transparent: true, opacity: 0.85 }));
      s.position.set(x, y, -0.3);
      cloud.add(s);
    });
    cloud.position.set(0, 3.6, 0);
    g.add(cloud);
    const modelMat = ownMat("#38bdf8", { wireframe: true });
    const model = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), modelMat);
    model.position.set(0, 3.7, 0.6);
    g.add(model);
    const blocks: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
      const b = box(0.6, 0.4, 0.6, ["#f59e0b", "#ef4444", "#22c55e", "#3b82f6", "#a855f7", "#14b8a6"][i]);
      b.position.set(1.4 + (i % 3) * 0.62, Math.floor(i / 3) * 0.42, 0.3);
      g.add(b);
      blocks.push(b);
    }
    const readTag = label("reading about it…", { size: 0.35 });
    readTag.position.set(-1.8, 2.6, 0);
    const useTag = label("using it!", { size: 0.35, bg: "#dcfce7" });
    useTag.position.set(2.5, 2.6, 0);
    g.add(readTag, useTag);
    return V(2, g, ({ T, phase, p }) => {
      model.rotation.y = T * 0.6;
      idlePose(f, T);
      if (phase === 0) {
        book.visible = true;
        hammer.visible = false;
        f.rotation.y = 0;
        f.userData.armL.rotation.x = f.userData.armR.rotation.x = -1.1;
        modelMat.wireframe = true;
        modelMat.opacity = 0.35 + Math.sin(T * 2) * 0.1;
        modelMat.transparent = true;
        model.scale.setScalar(0.7);
        blocks.forEach((b) => (b.visible = false));
        readTag.visible = true;
        useTag.visible = false;
      } else {
        book.visible = false;
        hammer.visible = true;
        f.rotation.y = Math.PI / 2;
        const swing = Math.max(0, Math.sin(T * 7));
        f.userData.armR.rotation.x = -swing * 1.6;
        const built = phase === 1 ? Math.floor(p * 7) : 6;
        blocks.forEach((b, i) => {
          b.visible = i < built;
        });
        const solid = phase === 1 ? p : 1;
        modelMat.wireframe = solid < 0.5;
        modelMat.opacity = lerp(0.4, 1, solid);
        modelMat.emissive.set("#0ea5e9");
        modelMat.emissiveIntensity = solid * 0.4;
        model.scale.setScalar(lerp(0.7, 1.1, solid));
        readTag.visible = false;
        useTag.visible = true;
      }
    });
  },

  // New Tech, Old Mental Model
  "slide-03": () => {
    const g = new THREE.Group();
    const bar = textPlane("🔍  Search the web…", 6, { bg: "#ffffff", border: "#cbd5e1", radius: 60, font: '500 64px system-ui, sans-serif' });
    bar.position.set(0, 3.4, -1.5);
    g.add(bar);
    const f = figure(HUMAN, { hair: "#3b2a1a" });
    f.position.set(-3, 0, 0.5);
    g.add(f);
    const say = bubble("ChatGPT = a better Google?", 0.4);
    say.position.set(-3, 2.6, 0.5);
    g.add(say);
    const cards: THREE.Mesh[] = [];
    const texts = ["Answer: Paris", "Answer: 1969", "Source: 'Smith 2019'", "Answer: 42 km"];
    texts.forEach((t) => {
      const c = textPlane(t, 2.2, { bg: "#f8fafc", border: "#94a3b8", font: '600 56px system-ui, sans-serif' });
      g.add(c);
      cards.push(c);
    });
    const bad = cards[2];
    const halluc = label("⚠ hallucination: made-up source", { size: 0.32, bg: "#fee2e2", color: "#991b1b" });
    halluc.position.set(2.4, 3.2, 0.2);
    g.add(halluc);
    const insight = label("A reasoning engine, not a search engine", { size: 0.38, bg: "#fef9c3" });
    insight.position.set(0, 4.6, -1.5);
    g.add(insight);
    return V(2, g, ({ T, phase, p }) => {
      idlePose(f, T);
      f.userData.armR.rotation.x = -0.8 + Math.sin(T * 12) * 0.1;
      say.visible = phase === 0;
      cards.forEach((c, i) => {
        const appear = phase === 0 ? seg(p, i * 0.18, i * 0.18 + 0.25) : 1;
        c.position.set(1.4 + (i % 2) * 2.4, 0.9 + Math.floor(i / 2) * 1.0 + (1 - appear) * 2.5, 0);
        setOpacity(c, appear);
      });
      const glitch = phase >= 1;
      (bad.material as THREE.MeshBasicMaterial).color.set(glitch && Math.sin(T * 20) > 0 ? "#fca5a5" : "#ffffff");
      bad.position.x += glitch ? Math.sin(T * 40) * 0.05 : 0;
      halluc.visible = glitch;
      insight.visible = phase >= 2 || (phase === 1 && p > 0.5);
    });
  },

  // From Savant to Digital Employee
  "slide-04": () => {
    const g = new THREE.Group();
    const pedestal = cyl(0.8, 1, 1.2, "#e7e5e4");
    pedestal.position.set(0, 0, -1.5);
    const robe = cone(0.7, 1.4, "#6d28d9");
    robe.position.set(0, 1.2, -1.5);
    const sage = sphere(0.45, ownMat("#c4b5fd", { emissive: "#7c3aed", emissiveIntensity: 0.6 }));
    sage.position.set(0, 2.9, -1.5);
    g.add(pedestal, robe, sage);
    const advice = ["“Here's some advice…”", "“In theory, you should…”", "“Have you considered…”"].map((t) => bubble(t, 0.32));
    advice.forEach((a) => g.add(a));
    const lead = figure(HUMAN, { hair: "#3b2a1a" });
    lead.position.set(-3, 0, 1.5);
    g.add(lead);
    const flag = new THREE.Group();
    flag.add(cyl(0.03, 0.03, 1.4, "#334155"));
    const cloth = box(0.6, 0.4, 0.02, "#f59e0b");
    cloth.position.set(0.3, 1.2, 0);
    flag.add(cloth);
    lead.userData.armR.add(flag);
    flag.position.set(0, -0.6, 0);
    const badge = label("Team Lead", { size: 0.32, bg: "#fde68a" });
    g.add(badge);
    const bots = [0, 1, 2].map(() => figure("#cbd5e1", { bot: true, scale: 0.8 }));
    bots.forEach((b) => g.add(b));
    const boxes = bots.map(() => box(0.4, 0.4, 0.4, "#b45309"));
    boxes.forEach((b) => g.add(b));
    const done = box(1.4, 0.4, 1, "#a16207");
    done.position.set(3.5, 0, 0);
    g.add(done);
    return V(3, g, ({ T, phase, p }) => {
      const savant = phase === 0;
      robe.visible = sage.visible = pedestal.visible = savant || (phase === 1 && p < 0.2);
      sage.position.y = 2.9 + Math.sin(T * 2) * 0.15;
      advice.forEach((a, i) => {
        const k = ((T * 0.6 + i / 3) % 1);
        a.visible = savant;
        a.position.set(Math.sin(i * 2) * 1.8, 3.2 + k * 2, -1.5);
        a.material.opacity = 1 - k;
      });
      idlePose(lead, T);
      flag.visible = badge.visible = phase >= 2;
      badge.position.set(lead.position.x, 2.4, lead.position.z);
      done.visible = phase >= 1;
      bots.forEach((b, i) => {
        b.visible = phase >= 1;
        boxes[i].visible = phase === 1;
        if (phase === 1) {
          const k = (T * 0.35 + i / 3) % 1;
          const go = k < 0.5;
          const q = go ? k * 2 : (1 - k) * 2;
          b.position.set(lerp(-1.5, 2.8, q), 0, -0.8 + i * 0.9);
          b.rotation.y = go ? Math.PI / 2 : -Math.PI / 2;
          walkPose(b, T * 10);
          boxes[i].position.set(b.position.x, go ? 1.15 : -5, b.position.z + 0.3);
        } else if (phase >= 2) {
          const q = phase === 2 ? ease(p) : 1;
          lead.position.x = lerp(-3, 1, q);
          b.position.set(lead.position.x - 1.2 - i * 0.9, 0, 1.5 + (i - 1) * 0.6);
          b.rotation.y = Math.PI / 2;
          if (q < 1) walkPose(b, T * 9); else idlePose(b, T);
        }
      });
      if (phase >= 2 && p < 1 && phase === 2) {
        lead.rotation.y = Math.PI / 2;
        walkPose(lead, T * 9);
      } else lead.rotation.y = 0;
    });
  },

  // Mapping the Journey
  "slide-05": () => {
    const g = new THREE.Group();
    const steps: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
      const s = box(1.2, 0.45 * (i + 1), 1.6, i % 2 ? "#bbf7d0" : "#86efac");
      s.position.set(-3 + i * 1.2, 0, -0.5);
      g.add(s);
      steps.push(s);
    }
    const cards = Array.from({ length: 24 }, (_, i) =>
      textPlane(["video", "tweet", "paper", "course", "podcast", "tool"][i % 6], 0.9, { bg: ["#fef08a", "#bfdbfe", "#fecaca", "#ddd6fe", "#bbf7d0", "#fed7aa"][i % 6], font: "700 60px system-ui" }),
    );
    cards.forEach((c) => g.add(c));
    const nums = steps.map((_, i) => label(String(i + 1), { size: 0.45, bg: "#166534", color: "#fff" }));
    nums.forEach((n, i) => { n.position.set(-3 + i * 1.2, 0.45 * (i + 1) + 0.5, 0.3); g.add(n); });
    const f = figure(HUMAN, { hair: "#3b2a1a", scale: 0.8 });
    g.add(f);
    const guide = sphere(0.22, ownMat("#fde047", { emissive: "#facc15", emissiveIntensity: 1 }));
    g.add(guide);
    const stepTop = (i: number) => 0.45 * (i + 1);
    return V(4, g, ({ T, phase, p }) => {
      // cards: chaos (0,1) → ordered (2,3)
      cards.forEach((c, i) => {
        const a = i * 1.7 + T * (0.6 + (i % 5) * 0.15);
        const chaos = new THREE.Vector3(Math.cos(a) * (2 + (i % 4)), 1.5 + ((i * 7) % 5) * 0.6 + Math.sin(T + i), Math.sin(a) * (2 + (i % 3)));
        const slot = i % 6;
        const order = new THREE.Vector3(-3 + slot * 1.2, stepTop(slot) + 1.2 + Math.floor(i / 6) * 0.25, -1.4);
        const k = phase < 2 ? 0 : phase === 2 ? ease(p * 1.5) : 1;
        c.position.lerpVectors(chaos, order, k);
        c.rotation.set(k < 1 ? a : 0, k < 1 ? a * 0.7 : 0, 0);
        c.visible = phase !== 1 || i % 3 === 0;
      });
      nums.forEach((n) => (n.visible = phase >= 2));
      guide.visible = phase === 3;
      if (phase === 0) {
        f.position.set(-4.5, 0, 0.8);
        f.rotation.y = 0;
        idlePose(f, T);
        f.userData.armL.rotation.z = 0.5 + Math.sin(T * 6) * 0.3;
        f.userData.armR.rotation.z = -0.5 - Math.sin(T * 6) * 0.3;
      } else if (phase === 1) {
        // skip from step 0 to step 4 and fall back
        f.rotation.y = Math.PI / 2;
        const jump = seg(p, 0.1, 0.45);
        const fall = seg(p, 0.55, 0.85);
        const x = lerp(lerp(-3, 1.8, jump), -4.2, fall);
        const yJ = lerp(stepTop(0), stepTop(4), jump) + Math.sin(jump * Math.PI) * 1.5;
        f.position.set(x, fall > 0 ? lerp(stepTop(4), 0, fall) : yJ, -0.5);
        f.rotation.z = fall > 0 ? fall * 1.4 : 0;
        idlePose(f, T);
      } else if (phase === 2) {
        f.rotation.z = 0;
        f.position.set(-4.4, 0, 0.6);
        f.rotation.y = 0.4;
        idlePose(f, T);
      } else {
        f.rotation.z = 0;
        const k = phase === 3 ? clamp01(p * 1.2) * 5 : 5;
        const i = Math.min(5, Math.floor(k));
        const fr = k - i;
        const ni = Math.min(5, i + 1);
        f.rotation.y = Math.PI / 2;
        f.position.set(lerp(-3 + i * 1.2, -3 + ni * 1.2, fr), lerp(stepTop(i), stepTop(ni), fr) + Math.sin(fr * Math.PI) * 0.3, -0.5);
        if (k < 5) walkPose(f, T * 8); else idlePose(f, T);
        guide.position.set(f.position.x + 0.9, f.position.y + 2, f.position.z);
      }
    });
  },

  // What It Takes
  "slide-06": () => {
    const g = new THREE.Group();
    const f = figure(HUMAN, { hair: "#3b2a1a" });
    g.add(f);
    const q = label("What does it mean to be “technical”?", { size: 0.36 });
    q.position.set(-2.5, 3, 0.6);
    g.add(q);
    const hats = ["coder?", "engineer?", "math genius?", "IT person?"].map((t) => label(t, { size: 0.32, bg: "#e0e7ff" }));
    hats.forEach((h) => g.add(h));
    const wallLabel = label("RESISTANCE TO CHANGE", { size: 0.42, bg: "#fecaca", color: "#7f1d1d" });
    wallLabel.position.set(0.6, 3.6, 0);
    g.add(wallLabel);
    const bricks: { m: THREE.Mesh; home: THREE.Vector3; vel: THREE.Vector3 }[] = [];
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 6; c++) {
        const m = box(0.58, 0.5, 0.5, r % 2 ? "#b91c1c" : "#dc2626");
        const home = new THREE.Vector3(0.6, r * 0.52, -1.5 + c * 0.6 + (r % 2) * 0.3);
        m.position.copy(home);
        g.add(m);
        bricks.push({ m, home, vel: new THREE.Vector3(1 + Math.random() * 3, 2 + Math.random() * 3, (Math.random() - 0.5) * 4) });
      }
    const path = box(5, 0.06, 1.4, ownMat("#fde68a", { emissive: "#f59e0b", emissiveIntensity: 0 }));
    path.position.set(3.8, 0, 0);
    g.add(path);
    return V(2, g, ({ T, phase, p }) => {
      q.visible = phase === 0;
      hats.forEach((h, i) => {
        const k = (T * 0.4 + i / 4) % 1;
        h.visible = phase === 0;
        h.position.set(-2.5 + Math.sin(i * 1.7) * 1.2, 2 + k * 1.6, 0.6);
        h.material.opacity = Math.sin(k * Math.PI);
      });
      wallLabel.visible = phase >= 1 && p < 0.55;
      const push = phase >= 1 ? seg(p, 0, 0.4) : 0;
      const crumble = phase >= 1 ? clamp01((p - 0.45) / 0.4) : 0;
      if (phase === 0) {
        f.position.set(-2.5, 0, 0.6);
        f.rotation.y = 0;
        idlePose(f, T);
      } else {
        f.rotation.y = Math.PI / 2;
        f.position.set(lerp(-2.5, -0.1, push) + (crumble > 0 ? crumble * 5 : 0), 0, 0);
        if (push < 1 || crumble > 0) walkPose(f, T * 8, push < 1 ? 1 : 0.8);
        f.userData.armL.rotation.x = f.userData.armR.rotation.x = push >= 1 && crumble === 0 ? -1.5 : f.userData.armL.rotation.x;
      }
      bricks.forEach(({ m, home, vel }) => {
        const t = crumble * 1.4;
        m.position.set(home.x + vel.x * t, Math.max(0, home.y + vel.y * t - 4.9 * t * t), home.z + vel.z * t);
        m.rotation.set(vel.z * t, 0, -vel.x * t);
        m.visible = crumble < 0.98;
      });
      (path.material as THREE.MeshStandardMaterial).emissiveIntensity = crumble * 0.8;
    });
  },

  // Avoidance
  "slide-07": () => {
    const g = new THREE.Group();
    const f = figure(HUMAN, { hair: "#3b2a1a" });
    g.add(f);
    const say = bubble("“This won't affect my job.”", 0.4);
    g.add(say);
    const wave = new THREE.Mesh(
      new THREE.TorusGeometry(2.4, 0.9, 8, 24, Math.PI),
      ownMat("#38bdf8", { transparent: true, opacity: 0.85 }),
    );
    wave.rotation.y = Math.PI / 2;
    g.add(wave);
    const waveTag = label("AI", { size: 0.6, bg: "#0369a1", color: "#fff" });
    g.add(waveTag);
    const fear = new THREE.Group();
    const blob = sphere(1, ownMat("#1f1235", { transparent: true, opacity: 0.8 }));
    blob.scale.set(1, 1.4, 1);
    fear.add(blob);
    [-0.35, 0.35].forEach((x) => {
      const e = sphere(0.12, ownMat("#fde047", { emissive: "#fde047", emissiveIntensity: 1 }), 0);
      e.position.set(x, 0.5, 0.9);
      fear.add(e);
    });
    g.add(fear);
    const fearTag = label("fear", { size: 0.35, bg: "#312e81", color: "#e0e7ff" });
    g.add(fearTag);
    const lift = box(2, 0.3, 2, "#a3e635");
    g.add(lift);
    const higher = label("think at a higher level", { size: 0.36, bg: "#ecfccb" });
    g.add(higher);
    return V(2, g, ({ T, phase, p }) => {
      const wx = phase === 0 ? lerp(-7, -3.5, p) : lerp(-3.5, 7, ease(p));
      wave.position.set(wx, 0, 0);
      waveTag.position.set(wx, 3.6, 0);
      if (phase === 0) {
        f.position.set(0.5, 0, 0);
        f.rotation.y = Math.PI / 2; // facing away from the wave
        idlePose(f, T);
        f.userData.armL.rotation.x = f.userData.armR.rotation.x = -2.6; // hands over eyes
        say.visible = true;
        say.position.set(1.6, 2.6, 0);
        const grow = ease(p);
        fear.visible = fearTag.visible = true;
        fear.scale.setScalar(lerp(0.3, 1.3, grow));
        fear.position.set(-1.2, 1.2 * fear.scale.y, -1.2);
        fearTag.position.set(-1.2, 1.2 + 2.6 * fear.scale.y, -1.2);
        lift.position.set(0.5, 0, 0);
        higher.visible = false;
      } else {
        say.visible = false;
        const rise = seg(p, 0.05, 0.35);
        f.rotation.y = -Math.PI / 2 * (1 - rise) + Math.PI / 2 * 0 + (rise > 0 ? -Math.PI / 2 : 0);
        idlePose(f, T);
        lift.position.set(0.5, rise * 3.4, 0);
        f.position.set(0.5, rise * 3.4 + 0.3, 0);
        f.rotation.y = -Math.PI / 2;
        fear.scale.setScalar(lerp(1.3, 0.01, seg(p, 0.1, 0.5)));
        fear.visible = fearTag.visible = fear.scale.x > 0.05;
        fearTag.position.set(-1.2, 1.2 + 2.6 * fear.scale.y, -1.2);
        higher.visible = rise > 0.9;
        higher.position.set(0.5, 6.3, 0);
      }
    });
  },

  // AI = Portal to Internet Research
  "slide-08": (color) => {
    const g = new THREE.Group();
    const portal = torus(1.8, 0.25, ownMat(color, { emissive: color, emissiveIntensity: 0.6 }));
    portal.position.set(0, 2.4, -1);
    g.add(portal);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.7, 32), ownMat("#c7d2fe", { emissive: "#6366f1", emissiveIntensity: 0.6, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
    disc.position.copy(portal.position);
    g.add(disc);
    const qs = Array.from({ length: 5 }, () => label("?", { size: 0.6, bg: "#fef3c7" }));
    const as = Array.from({ length: 5 }, (_, i) => label(["summary", "explanation", "ideas", "answer", "outline"][i], { size: 0.35, bg: "#dcfce7" }));
    [...qs, ...as].forEach((q) => g.add(q));
    const f = figure(HUMAN, { hair: "#3b2a1a" });
    f.position.set(-3, 0, 1.2);
    f.rotation.y = 0.8;
    g.add(f);
    const tips = label("✍ prompt basics: be specific · give context · say the format", { size: 0.32, bg: "#e0e7ff", maxWidth: 1400 });
    tips.position.set(0, 5, -1);
    g.add(tips);
    const crowd = Array.from({ length: 10 }, (_, i) => figure(["#f87171", "#60a5fa", "#fbbf24", "#a78bfa", "#34d399"][i % 5], { skin: SKIN[i % 4], scale: 0.75 }));
    crowd.forEach((c, i) => {
      const a = Math.PI * 0.15 + (i / 9) * Math.PI * 0.7;
      c.position.set(Math.cos(a) * 4.2, 0, Math.sin(a) * 2.6 + 0.5);
      c.rotation.y = Math.atan2(-c.position.x, -1 - c.position.z);
      g.add(c);
    });
    return V(3, g, ({ T, phase, p }) => {
      portal.rotation.z = T * 0.8;
      idlePose(f, T);
      qs.forEach((q, i) => {
        const k = (T * 0.5 + i / 5) % 1;
        q.position.set(lerp(-3, 0, k), lerp(2.5, 2.4, k) + Math.sin(k * Math.PI) * 0.8, lerp(1.2, -1, k));
        q.material.opacity = 1 - k * k;
      });
      as.forEach((a, i) => {
        const k = (T * 0.5 + i / 5 + 0.1) % 1;
        a.position.set(lerp(0, 3 + (i % 2), k), 2.4 + Math.sin(k * Math.PI) * 1.2 + (i % 3) * 0.3, lerp(-1, 1.5, k));
        a.material.opacity = Math.sin(k * Math.PI);
      });
      tips.visible = phase >= 1;
      crowd.forEach((c, i) => {
        const on = phase >= 2 && (phase > 2 || p * 10 > i);
        c.visible = on;
        if (on) idlePose(c, T + i);
      });
    });
  },

  // AI as Thought Partner
  "slide-09": () => {
    const g = new THREE.Group();
    const table = box(3, 0.9, 1.4, "#a16207");
    g.add(table);
    const f = figure(HUMAN, { hair: "#3b2a1a" });
    f.position.set(-2.2, 0, 0);
    f.rotation.y = Math.PI / 2;
    const bot = figure("#cbd5e1", { bot: true });
    bot.position.set(2.2, 0, 0);
    bot.rotation.y = -Math.PI / 2;
    g.add(f, bot);
    const docs = ["PDF", "DOC", "IMG", "LAB RESULTS"].map((t, i) => textPlane(t, 0.8, { bg: ["#fecaca", "#bfdbfe", "#fde68a", "#bbf7d0"][i], font: "800 60px system-ui" }));
    docs.forEach((d) => { d.rotation.x = -Math.PI / 2; g.add(d); });
    const talk = [
      bubble("My test results say…", 0.3), bubble("Here's what that could mean…", 0.3),
      bubble("What should I ask my doctor?", 0.3), bubble("Three good questions…", 0.3),
    ];
    talk.forEach((t) => g.add(t));
    const models = [["ChatGPT", "#10a37f"], ["Gemini", "#4285f4"], ["Claude", "#d97757"]].map(([n, c]) => {
      const grp = new THREE.Group();
      const s = sphere(0.3, ownMat(c, { emissive: c, emissiveIntensity: 0.5 }));
      const l = label(n, { size: 0.28 });
      l.position.y = 0.6;
      grp.add(s, l);
      g.add(grp);
      return grp;
    });
    return V(3, g, ({ T, phase, p }) => {
      idlePose(f, T);
      idlePose(bot, T + 1);
      docs.forEach((d, i) => {
        const k = phase === 0 ? clamp01(p * 4 - i * 0.8) : 1;
        d.visible = k > 0;
        d.position.set(lerp(-1.4, 0.9, k), 0.95 + Math.sin(k * Math.PI) * 1.2, -0.4 + i * 0.25);
      });
      talk.forEach((t, i) => {
        const active = phase >= 1 && Math.floor((T * 0.7) % 4) === i;
        t.visible = active;
        t.position.set(i % 2 ? 2.2 : -2.2, 2.6, 0.3);
      });
      models.forEach((m, i) => {
        m.visible = phase >= 2;
        const sel = Math.floor(T * 0.8) % 3 === i;
        m.position.set(1.2 + i * 0.9, sel ? 2.6 : 1.6, -1.2);
        m.scale.setScalar(sel ? 1.2 : 0.8);
      });
    });
  },

  // Using AI Tools
  "slide-11": () => {
    const g = new THREE.Group();
    const bench = box(9, 0.9, 1.6, "#92400e");
    bench.position.z = -0.5;
    g.add(bench);
    const gauge = new THREE.Group();
    gauge.add(torus(0.7, 0.08, "#475569", Math.PI));
    const needle = box(0.06, 0.65, 0.06, "#111", 0.32);
    gauge.add(needle);
    const gl = label("reliability", { size: 0.25 });
    gl.position.y = -0.3;
    gauge.add(gl);
    gauge.position.set(0, 3.6, -1);
    g.add(gauge);
    const tools: THREE.Group[] = [];
    const mk = (name: string, build: (t: THREE.Group) => void, x: number) => {
      const t = new THREE.Group();
      build(t);
      const l = label(name, { size: 0.28 });
      l.position.y = 1.9;
      t.add(l);
      t.position.set(x, 0.9, -0.5);
      g.add(t);
      tools.push(t);
      return t;
    };
    const lines: THREE.Mesh[] = [];
    mk("Wispr Flow · voice", (t) => {
      t.add(cyl(0.18, 0.18, 0.5, "#334155", 10, 0.6), cyl(0.04, 0.04, 0.6, "#64748b"));
      for (let i = 0; i < 3; i++) {
        const w = torus(0.35 + i * 0.2, 0.025, ownMat("#38bdf8", { transparent: true }), Math.PI * 0.6);
        w.position.y = 0.85;
        w.rotation.z = -Math.PI * 0.3;
        t.add(w);
        lines.push(w);
      }
    }, -3);
    const noteLines: THREE.Mesh[] = [];
    mk("Granola · meeting notes", (t) => {
      const pad = box(0.9, 0.05, 1.1, "#fefce8");
      t.add(pad);
      for (let i = 0; i < 5; i++) {
        const l = box(0.7, 0.02, 0.06, "#64748b");
        l.position.set(0, 0.06, -0.4 + i * 0.2);
        t.add(l);
        noteLines.push(l);
      }
    }, -1);
    mk("Obsidian · Markdown", (t) => {
      const md = textPlane("# notes\n- idea\n- link", 1, { bg: "#ede9fe", align: "left", font: "700 56px monospace" });
      md.position.y = 0.6;
      t.add(md);
    }, 1);
    mk("Figma · Canva · Notion · Slack", (t) => {
      ["#f24e1e", "#00c4cc", "#111111", "#4a154b"].forEach((c, i) => {
        const tile = box(0.38, 0.38, 0.1, c);
        tile.position.set(-0.45 + (i % 2) * 0.45 + 0.22, 0.25 + Math.floor(i / 2) * 0.45, 0);
        t.add(tile);
      });
    }, 3.2);
    const f = figure(HUMAN, { hair: "#3b2a1a" });
    f.position.set(0, 0, 1.2);
    f.rotation.y = Math.PI;
    g.add(f);
    return V(5, g, ({ T, phase, p }) => {
      const unreliable = phase <= 3;
      needle.rotation.z = unreliable ? Math.sin(T * 7) * 1.2 : lerp(1.2, -0.9, 0.3);
      if (phase === 0) needle.rotation.z = Math.sin(T * 9) * 1.4;
      tools.forEach((t, i) => {
        const active = phase === i + 1 || phase === 5;
        t.position.y = 0.9 + (active ? 0.3 + Math.sin(T * 3) * 0.08 : 0);
        t.visible = phase === 0 ? p * 4 > i : true;
      });
      lines.forEach((l, i) => ((l.material as THREE.MeshStandardMaterial).opacity = phase === 1 ? 0.5 + Math.sin(T * 6 - i) * 0.5 : 0.2));
      noteLines.forEach((l, i) => (l.scale.x = phase === 2 ? clamp01(p * 6 - i) : 1));
      const target = phase === 0 ? 0 : phase <= 4 ? -3 + (phase - 1) * 2.07 : 0;
      f.position.x = lerp(f.position.x, target, 0.05);
      idlePose(f, T);
      void p;
    });
  },

  // Context Management (non-technical)
  "slide-10": (color) => {
    const g = new THREE.Group();
    const tank = box(2.6, 2.6, 1.6, ownMat("#e0f2fe", { transparent: true, opacity: 0.3 }));
    tank.position.set(-1.6, 0, 0);
    g.add(tank);
    const tl = label("context", { size: 0.32 });
    tl.position.set(-1.6, 3.1, 0);
    g.add(tl);
    const blocks = Array.from({ length: 9 }, (_, i) => {
      const b = textPlane(["# Goal", "- audience", "- tone", "## Facts", "- data", "- dates", "## Draft", "- intro", "- ending"][i], 1.1, { bg: ["#fde68a", "#e0e7ff", "#e0e7ff", "#bbf7d0", "#e0e7ff", "#e0e7ff", "#fecaca", "#e0e7ff", "#e0e7ff"][i], font: "700 56px monospace", align: "left" });
      g.add(b);
      return b;
    });
    const folder = new THREE.Group();
    folder.add(box(2.4, 1.8, 0.3, color), at(box(1, 0.3, 0.3, color), -0.7, 1.8, 0));
    const fl = label("Project", { size: 0.35, bg: "#dbeafe" });
    fl.position.set(0, 2.5, 0.3);
    folder.add(fl);
    folder.position.set(2.2, 0, -0.6);
    g.add(folder);
    const checks = Array.from({ length: 3 }, () => label("✓ reliable", { size: 0.3, bg: "#dcfce7" }));
    checks.forEach((c, i) => { c.position.set(-2.5 + i * 2.5, 4 + (i % 2) * 0.4, 0.5); g.add(c); });
    return V(4, g, ({ T, phase, p }) => {
      blocks.forEach((b, i) => {
        const fall = phase === 0 ? clamp01(p * 3 - i * 0.2) : 1;
        const messy = new THREE.Vector3(-1.6 + Math.sin(i * 2.3) * 0.8, 0.3 + (i % 4) * 0.5, Math.cos(i * 1.7) * 0.4);
        const neat = new THREE.Vector3(-1.6, 0.3 + i * 0.27, 0.2);
        const inFolder = new THREE.Vector3(2.2, 0.2 + i * 0.17, -0.3);
        let pos = messy.clone();
        let rot = i * 0.9;
        if (phase === 1) { pos = messy.lerp(neat, ease(p * 1.3)); rot = lerp(rot, 0, ease(p * 1.3)); }
        if (phase >= 2) {
          const k = phase === 2 ? ease(p * 1.3 - i * 0.05) : 1;
          pos = neat.lerp(inFolder, k);
          rot = 0;
        }
        b.position.set(pos.x, pos.y + (1 - fall) * 4, pos.z);
        b.rotation.set(0, 0, phase === 0 ? rot : rot);
        b.visible = fall > 0;
      });
      folder.visible = phase >= 2;
      checks.forEach((c, i) => {
        c.visible = phase >= 3 && p * 3 > i - 0.5 || phase === 4;
        c.position.y = 4 + Math.sin(T * 2 + i) * 0.1;
      });
    });
  },

  // AI-Powered Browsing
  "slide-12": (color) => {
    const g = new THREE.Group();
    const frame = box(7, 4.4, 0.2, "#e2e8f0");
    frame.position.set(0, 0.6, -1.5);
    g.add(frame);
    const top = box(7, 0.5, 0.25, "#94a3b8");
    top.position.set(0, 4.5, -1.5);
    g.add(top);
    const tabs = ["Gemini in Chrome", "Atlas", "Claude extension"].map((t, i) => {
      const tab = textPlane(t, 2, { bg: "#f1f5f9", font: "600 52px system-ui" });
      tab.position.set(-2.2 + i * 2.2, 5.05, -1.35);
      g.add(tab);
      return tab;
    });
    const fields = Array.from({ length: 4 }, (_, i) => {
      const fld = box(3.2, 0.45, 0.05, "#ffffff");
      fld.position.set(-1, 1.3 + i * 0.75, -1.35);
      g.add(fld);
      return fld;
    });
    const fills = fields.map((fld) => {
      const fill = box(3, 0.3, 0.05, ownMat(color, { emissive: color, emissiveIntensity: 0.3 }));
      fill.position.copy(fld.position);
      fill.position.z += 0.04;
      g.add(fill);
      return fill;
    });
    const btn = box(1.6, 0.6, 0.1, "#22c55e");
    btn.position.set(2, 1.4, -1.35);
    g.add(btn);
    const cursor = cone(0.18, 0.45, "#111", 3);
    cursor.rotation.z = Math.PI * 0.85;
    g.add(cursor);
    const wb = label("the browser is the modern workbench", { size: 0.34, bg: "#e0f2fe" });
    wb.position.set(0, 6, -1.5);
    g.add(wb);
    const f = figure(HUMAN, { hair: "#3b2a1a" });
    f.position.set(-4.4, 0, 0.5);
    f.rotation.y = 0.6;
    g.add(f);
    const sparkle = label("✦", { size: 0.7, bg: "rgba(0,0,0,0)", color: "#4285f4" });
    g.add(sparkle);
    return V(4, g, ({ T, phase, p }) => {
      idlePose(f, T);
      tabs.forEach((t, i) => ((t.material as THREE.MeshBasicMaterial).color.set(phase === i + 1 ? "#bfdbfe" : "#ffffff")));
      wb.visible = phase === 0 || phase === 4;
      sparkle.visible = phase === 1;
      sparkle.position.set(2.6, 3.4 + Math.sin(T * 3) * 0.2, -1.2);
      // the agent cursor fills fields and clicks the button
      const k = phase >= 2 ? (phase === 2 ? p * 0.5 : phase === 3 ? 0.5 + p * 0.5 : 1) : 0;
      const step = Math.min(4, Math.floor(k * 5));
      const fr = k * 5 - step;
      const target = step < 4 ? fields[step].position : btn.position;
      cursor.visible = phase >= 2;
      cursor.position.set(target.x + (step < 4 ? lerp(-1.2, 1.4, fr) : 0), target.y - 0.1, -1.1);
      fills.forEach((fl, i) => {
        const v = i < step ? 1 : i === step ? fr : 0;
        fl.scale.x = Math.max(0.001, phase >= 2 ? v : 0);
        fl.position.x = fields[i].position.x - 1.5 * (1 - fl.scale.x);
      });
      btn.scale.setScalar(step === 4 && phase <= 3 ? 1 + Math.sin(T * 12) * 0.1 : 1);
    });
  },

  // Creating Media with AI
  "slide-13": () => {
    const g = new THREE.Group();
    const easel = new THREE.Group();
    const legs = [-0.8, 0.8].map((x) => { const l = box(0.1, 3, 0.1, "#78350f"); l.position.x = x; return l; });
    easel.add(...legs);
    easel.position.set(-2, 0, -1);
    g.add(easel);
    const pixels: { m: THREE.Mesh; tx: number; ty: number }[] = [];
    const W = 8, H = 6;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const sky = y > 2;
        let c = sky ? "#93c5fd" : "#4ade80";
        if (sky && Math.hypot(x - 5.5, y - 4.5) < 1.3) c = "#facc15";
        if (!sky && y === 2 && x > 1 && x < 5) c = "#94a3b8";
        if (y === 3 && x > 2 && x < 4) c = "#94a3b8";
        const m = box(0.28, 0.28, 0.08, c);
        g.add(m);
        pixels.push({ m, tx: -2 - 1.1 + x * 0.3, ty: 1.4 + y * 0.3 });
      }
    const film = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const fr = box(1, 0.75, 0.05, ["#1f2937", "#fbbf24", "#1f2937", "#60a5fa", "#1f2937", "#f472b6"][i % 6]);
      fr.position.x = i * 1.1;
      film.add(fr);
    }
    film.position.set(1, 3.2, -1);
    g.add(film);
    const vtag = label("🎬 video", { size: 0.3 });
    vtag.position.set(3.5, 4.1, -1);
    g.add(vtag);
    const f = figure(HUMAN, { hair: "#3b2a1a" });
    f.position.set(1.5, 0, 1);
    g.add(f);
    const want = bubble("I want: 🌄 sunrise over hills", 0.3);
    want.position.set(1.5, 2.6, 1);
    g.add(want);
    const tries = ["try 1: 🌃", "try 2: 🏙", "try 3: 🌄 ✓"].map((t, i) => label(t, { size: 0.32, bg: i === 2 ? "#dcfce7" : "#fee2e2" }));
    tries.forEach((t, i) => { t.position.set(3 + i * 0.1, 1 + i * 0.6, 0.5); g.add(t); });
    return V(3, g, ({ T, phase, p }) => {
      idlePose(f, T);
      pixels.forEach(({ m, tx, ty }, i) => {
        const k = phase === 0 ? clamp01(p * 2.2 - (i / pixels.length)) : 1;
        m.position.set(lerp(tx + Math.sin(i) * 3, tx, ease(k)), lerp(ty + 4 + (i % 5), ty, ease(k)), -0.9);
        m.visible = k > 0;
      });
      film.visible = vtag.visible = phase >= 1;
      film.position.x = 1 - ((T * 0.8) % 1.1);
      want.visible = tries[0].visible = phase >= 2;
      tries.forEach((t, i) => (t.visible = phase >= 2 && (phase > 2 || p * 3 > i)));
    });
  },

  // AI for Automation
  "slide-14": (color) => {
    const g = new THREE.Group();
    const board = box(10, 0.15, 5, "#f1f5f9");
    g.add(board);
    const nodeDefs: [string, number, number, string, number][] = [
      ["New email", -4, 1, "#ff4a00", 0], ["Save to sheet", -1.5, 1, "#ff4a00", 0],
      ["Filter", -1.5, -1, "#ea4b71", 1], ["Notify team", 1, -1.5, "#ea4b71", 1],
      ["🧠 AI summarize", 1, 1, "#7c3aed", 2], ["Post update", 3.8, 0, "#7c3aed", 2],
    ];
    const nodes = nodeDefs.map(([t, x, z, c]) => {
      const n = new THREE.Group();
      n.add(box(1.8, 0.6, 1, c));
      const l = label(t, { size: 0.28 });
      l.position.y = 1.1;
      n.add(l);
      n.position.set(x, 0.15, z);
      g.add(n);
      return n;
    });
    const links: [number, number, number][] = [[0, 1, 0], [0, 2, 1], [2, 3, 1], [1, 4, 2], [4, 5, 2], [3, 5, 2]];
    const pipes = links.map(([a, b]) => {
      const A = nodes[a].position, B = nodes[b].position;
      const len = A.distanceTo(B);
      const m = box(len, 0.08, 0.12, "#94a3b8");
      m.position.set((A.x + B.x) / 2, 0.45, (A.z + B.z) / 2);
      m.rotation.y = -Math.atan2(B.z - A.z, B.x - A.x);
      g.add(m);
      return m;
    });
    const packets = links.map(() => {
      const s = sphere(0.16, ownMat(color, { emissive: color, emissiveIntensity: 0.8 }), 0);
      g.add(s);
      return s;
    });
    const names = ["Zapier", "n8n", "Gumloop"].map((n) => label(n, { size: 0.4, bg: "#fff7ed" }));
    names.forEach((n, i) => { n.position.set(-3 + i * 3.2, 3, -2.2); g.add(n); });
    const code = label("{ if (x) { fetch(...) } }", { size: 0.4, bg: "#111827", color: "#a5f3fc", font: "600 64px monospace" });
    code.position.set(0, 4.4, -2.4);
    g.add(code);
    const noCode = label("no code to look at — just boxes and arrows", { size: 0.32, bg: "#dcfce7" });
    noCode.position.set(0, 4.4, -2.2);
    g.add(noCode);
    return V(4, g, ({ T, phase, p }) => {
      const stage = Math.min(2, phase);
      nodes.forEach((n, i) => (n.visible = nodeDefs[i][4] <= stage));
      links.forEach(([a, b, s], i) => {
        const vis = s <= stage;
        pipes[i].visible = packets[i].visible = vis;
        const k = (T * 0.6 + i * 0.13) % 1;
        packets[i].position.lerpVectors(nodes[a].position, nodes[b].position, k);
        packets[i].position.y = 0.65;
      });
      names.forEach((n, i) => (n.visible = i <= stage));
      code.visible = phase === 3 && p < 0.4;
      noCode.visible = phase === 3 && p >= 0.4 || phase === 4;
      setOpacity(code, phase === 3 ? 1 - p * 2.5 : 0);
    });
  },

  // Natural Language Software Tools
  "slide-15": () => {
    const g = new THREE.Group();
    const f = figure(HUMAN, { hair: "#3b2a1a" });
    f.position.set(-3.2, 0, 0.8);
    f.rotation.y = 0.9;
    g.add(f);
    const say = bubble("“Make me a wedding website with an RSVP form”", 0.3);
    say.position.set(-3.2, 2.7, 0.8);
    g.add(say);
    const parts: { m: THREE.Object3D; to: THREE.Vector3 }[] = [];
    const add = (m: THREE.Object3D, x: number, y: number, z: number) => { g.add(m); parts.push({ m, to: new THREE.Vector3(x, y, z) }); };
    add(box(3, 0.4, 2, "#e2e8f0"), 1.5, 0, -0.5);
    add(box(2.6, 1.6, 1.8, "#fdf2f8"), 1.5, 0.4, -0.5);
    const roof = cone(2.1, 1.2, "#f472b6", 4);
    roof.rotation.y = Math.PI / 4;
    add(roof, 1.5, 2, -0.5);
    add(textPlane("RSVP", 0.9, { bg: "#fbcfe8", font: "800 64px system-ui" }), 1.5, 1.2, 0.42);
    const syntax = ["</>", "{ }", ";", "=>"].map((s) => label(s, { size: 0.4, bg: "#111827", color: "#f9a8d4", font: "700 64px monospace" }));
    syntax.forEach((s) => g.add(s));
    const sandbox = torus(3.2, 0.12, "#fbbf24");
    sandbox.rotation.x = -Math.PI / 2;
    sandbox.position.set(1.5, 0.1, -0.5);
    g.add(sandbox);
    const play = label("playground: try things!", { size: 0.32, bg: "#fef9c3" });
    play.position.set(1.5, 4, -0.5);
    g.add(play);
    const limit = label("⚠ a limit — and that's part of the learning", { size: 0.3, bg: "#ffedd5" });
    limit.position.set(1.5, 4.6, -0.5);
    g.add(limit);
    return V(4, g, ({ T, phase, p }) => {
      idlePose(f, T);
      say.visible = phase === 0;
      parts.forEach(({ m, to }, i) => {
        const k = phase === 0 ? clamp01(p * 2 - i * 0.25) : 1;
        m.position.set(lerp(-2.5, to.x, ease(k)), to.y + Math.sin(k * Math.PI) * 2.5, lerp(0.8, to.z, ease(k)));
        m.visible = k > 0;
      });
      syntax.forEach((s, i) => {
        s.visible = phase === 1;
        const k = (p * 1.5 + i * 0.2) % 1;
        s.position.set(-1 + i * 1.2, 1 + k * 4, 1.2);
        s.material.opacity = 1 - k;
      });
      sandbox.visible = play.visible = phase === 2;
      sandbox.rotation.z = T;
      const roofPart = parts[2];
      if (phase === 3) {
        const wob = seg(p, 0.1, 0.5);
        const fall = seg(p, 0.5, 0.8);
        roofPart.m.rotation.z = Math.sin(T * 14) * 0.12 * wob + fall * 1.2;
        roofPart.m.position.x = roofPart.to.x + fall * 1.8;
        roofPart.m.position.y = roofPart.to.y - fall * 2;
      } else {
        roofPart.m.rotation.z = 0;
      }
      limit.visible = phase === 3 && p > 0.5 || phase === 4;
    });
  },

  // Claude Co-work
  "slide-15b": () => {
    const g = new THREE.Group();
    const desk = box(4, 0.9, 1.4, "#e2e8f0");
    g.add(desk);
    const screen = box(2.2, 1.4, 0.1, "#0f172a");
    screen.position.set(0, 1.2, -0.4);
    g.add(screen);
    const rows = Array.from({ length: 6 }, (_, i) => {
      const r = box(1.8, 0.1, 0.02, ownMat(i % 2 ? "#38bdf8" : "#a3e635", { emissive: i % 2 ? "#38bdf8" : "#a3e635", emissiveIntensity: 0.8 }));
      r.position.set(0, 1.4 + 1.1 - i * 0.18, -0.33);
      g.add(r);
      return r;
    });
    const human = figure(HUMAN, { hair: "#3b2a1a" });
    human.position.set(-0.9, 0, 1.1);
    human.rotation.y = Math.PI;
    const bot = figure("#93c5fd", { bot: true });
    bot.position.set(0.9, 0, 1.1);
    bot.rotation.y = Math.PI;
    g.add(human, bot);
    const doc = textPlane("report.docx", 0.7, { bg: "#fff", font: "700 48px system-ui" });
    g.add(doc);
    const tag = label("working side by side on your computer", { size: 0.32, bg: "#e0f2fe" });
    tag.position.set(0, 3.6, 0);
    g.add(tag);
    const xfer = label("Transfer to the Technical Line →", { size: 0.3, bg: "#ffedd5" });
    xfer.position.set(0, 4.3, 0);
    g.add(xfer);
    return V(2, g, ({ T, phase, p }) => {
      idlePose(human, T);
      idlePose(bot, T + 2);
      human.userData.armR.rotation.x = -1.2 + Math.sin(T * 14) * 0.15;
      bot.userData.armL.rotation.x = -1.2 + Math.sin(T * 14 + 1) * 0.15;
      rows.forEach((r, i) => (r.scale.x = Math.max(0.01, clamp01(((T * 0.5) % 1.5) * 6 - i))));
      const k = (T * 0.4) % 1;
      doc.position.set(lerp(-0.9, 0.9, Math.sin(k * Math.PI * 2) * 0.5 + 0.5), 1.0 + Math.sin(k * Math.PI * 4) * 0.2 + 0.4, 0.4);
      doc.rotation.x = -Math.PI / 2.5;
      xfer.visible = phase >= 1;
      void p;
    });
  },

  // Command Line Interface
  "slide-16": (color) => {
    const g = new THREE.Group();
    const term = box(6.5, 4, 0.3, "#0b1020");
    term.position.set(0, 0.5, -1.6);
    g.add(term);
    const linesTxt = ["$ claude \"tidy my downloads folder\"", "> reading 214 files…", "> making folders: photos/ docs/ music/", "$ cd projects", "$ ls", "$ pwd"];
    const lines = linesTxt.map((t, i) => {
      const m = textPlane(t, 5.8, { bg: "rgba(0,0,0,0)", color: i < 3 ? "#a5f3fc" : "#86efac", font: "600 52px monospace", align: "left", pad: 6 });
      m.position.set(0, 4 - i * 0.55, -1.42);
      m.scale.x = 1;
      g.add(m);
      return m;
    });
    const tree = new THREE.Group();
    const folders: THREE.Mesh[] = [];
    const fpos = [[0, 0], [-1.6, -1.2], [0, -1.2], [1.6, -1.2], [-2.2, -2.4], [-1, -2.4], [1, -2.4], [2.2, -2.4]];
    fpos.forEach(([x, y]) => {
      const m = box(0.8, 0.5, 0.5, ownMat("#fbbf24", { emissive: color, emissiveIntensity: 0 }));
      m.position.set(x, y + 3.2, 0.6);
      tree.add(m);
      folders.push(m);
    });
    tree.position.set(0, 0, 0.5);
    tree.scale.setScalar(0.8);
    g.add(tree);
    const keys = ["cd", "ls", "pwd"].map((k) => {
      const kg = new THREE.Group();
      kg.add(box(0.9, 0.35, 0.9, "#e5e7eb"));
      const l = label(k, { size: 0.4, bg: "rgba(0,0,0,0)", font: "800 64px monospace" });
      l.position.y = 0.6;
      kg.add(l);
      g.add(kg);
      return kg;
    });
    return V(3, g, ({ T, phase, p }) => {
      lines.forEach((l, i) => {
        const show = phase === 0 ? (i < 3 && p * 3 > i) : phase === 1 ? i < 3 : phase >= 2 ? i < 3 || (phase > 2 || p * 3 > i - 3) : false;
        l.visible = show;
      });
      tree.visible = phase >= 1;
      const lit = phase === 1 ? Math.floor(p * folders.length * 1.2) : folders.length;
      folders.forEach((f, i) => ((f.material as THREE.MeshStandardMaterial).emissiveIntensity = i <= lit ? 0.6 + Math.sin(T * 4 + i) * 0.2 : 0));
      keys.forEach((k, i) => {
        k.visible = phase >= 2 && (phase > 2 || p * 3 > i);
        k.position.set(-1.6 + i * 1.6, 0.2 + Math.max(0, Math.sin(T * 5 + i * 2)) * 0.25, 2);
      });
    });
  },

  // Using Git and GitHub
  "slide-18": (color) => {
    const g = new THREE.Group();
    const main = box(9, 0.1, 0.2, "#475569");
    main.position.y = 1;
    g.add(main);
    const commits = Array.from({ length: 6 }, (_, i) => {
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.32), ownMat(color, { emissive: color, emissiveIntensity: 0.4 }));
      c.position.set(-4 + i * 1.6, 1.05, 0);
      c.castShadow = true;
      g.add(c);
      return c;
    });
    const branch = box(3.2, 0.1, 0.2, "#a855f7");
    branch.position.set(0, 1, 1.4);
    g.add(branch);
    const branchCommits = [0, 1].map((i) => {
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), ownMat("#c084fc", { emissive: "#a855f7", emissiveIntensity: 0.4 }));
      c.position.set(-0.8 + i * 1.6, 1.05, 1.4);
      g.add(c);
      return c;
    });
    const bad = box(0.6, 0.6, 0.6, ownMat("#ef4444", { emissive: "#ef4444", emissiveIntensity: 0.5 }));
    g.add(bad);
    const rewind = label("⏪ rewind to a snapshot", { size: 0.32, bg: "#fee2e2" });
    rewind.position.set(2, 3, 0);
    g.add(rewind);
    const cloud = new THREE.Group();
    [[-0.8, 0], [0, 0.3], [0.8, 0], [0, -0.1]].forEach(([x, y]) => { const s = sphere(0.8, "#f1f5f9"); s.position.set(x, y, 0); cloud.add(s); });
    const gl = label("GitHub", { size: 0.4, bg: "#111827", color: "#fff" });
    gl.position.y = 1.3;
    cloud.add(gl);
    cloud.position.set(0, 5, -1.5);
    g.add(cloud);
    const net = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.5, 8, 5), ownMat("#fbbf24", { wireframe: true }));
    net.rotation.x = -Math.PI / 2;
    net.position.set(3, 0.4, 1.4);
    g.add(net);
    const bot = figure("#cbd5e1", { bot: true, scale: 0.8 });
    bot.position.set(3, 3.2, 1.4);
    g.add(bot);
    const dropped = box(0.4, 0.4, 0.4, "#ef4444");
    g.add(dropped);
    const f = figure(HUMAN, { hair: "#3b2a1a" });
    f.position.set(-4.5, 0, 2);
    f.rotation.y = 0.5;
    g.add(f);
    const learn = label("take the time to really get it", { size: 0.3, bg: "#ecfccb" });
    learn.position.set(-4.5, 2.6, 2);
    g.add(learn);
    return V(5, g, ({ T, phase, p }) => {
      idlePose(f, T);
      commits.forEach((c, i) => {
        c.rotation.y = T + i;
        c.visible = phase > 0 || p * 6 > i;
      });
      branch.visible = phase >= 1;
      branchCommits.forEach((c, i) => {
        c.visible = phase >= 1;
        const merge = phase === 1 ? seg(p, 0.6, 1) : phase > 1 ? 1 : 0;
        c.position.z = lerp(1.4, 0.4, merge);
        c.position.x = -0.8 + i * 1.6;
      });
      bad.visible = phase === 1 && p < 0.55;
      bad.position.set(4.6, 1.05, 0);
      rewind.visible = phase === 1 && p < 0.55;
      cloud.visible = phase >= 2;
      if (phase === 2) {
        commits.forEach((c, i) => {
          const k = clamp01(p * 2 - i * 0.15);
          c.position.y = 1.05 + Math.sin(k * Math.PI) * 3;
        });
      } else commits.forEach((c) => (c.position.y = 1.05));
      net.visible = bot.visible = phase === 3;
      idlePose(bot, T);
      dropped.visible = phase === 3;
      const d = (p * 2) % 1;
      dropped.position.set(3, Math.max(0.6, 3 - d * d * 6), 1.4);
      learn.visible = phase >= 4;
    });
  },

  // Agents and AI Coding
  "slide-19": (color) => {
    const g = new THREE.Group();
    const chat = box(2.4, 3, 0.15, "#1e293b");
    chat.position.set(-2.4, 0.6, -1.5);
    const editor = box(3.4, 3, 0.15, "#0f172a");
    editor.position.set(0.7, 0.6, -1.5);
    g.add(chat, editor);
    const ide = label("IDE = Integrated Development Environment", { size: 0.3, bg: "#ffedd5" });
    ide.position.set(-0.8, 4.6, -1.5);
    g.add(ide);
    const chatLines = Array.from({ length: 5 }, (_, i) => {
      const b = box(i % 2 ? 1.6 : 1.2, 0.25, 0.02, i % 2 ? "#fb923c" : "#e2e8f0");
      b.position.set(-2.4 + (i % 2 ? 0.2 : -0.3), 3.3 - i * 0.5, -1.4);
      g.add(b);
      return b;
    });
    const codeLines = Array.from({ length: 8 }, (_, i) => {
      const w = 1 + ((i * 7) % 5) * 0.4;
      const b = box(w, 0.14, 0.02, ownMat(["#a5f3fc", "#86efac", "#fde68a", "#f9a8d4"][i % 4], { emissive: "#334155" }));
      b.position.set(-0.6 + w / 2, 3.4 - i * 0.33, -1.4);
      g.add(b);
      return b;
    });
    const antigrav = figure(HUMAN, { hair: "#3b2a1a" });
    antigrav.position.set(-4.4, 0, 1);
    g.add(antigrav);
    const ag = label("Anti-Gravity: easiest place to start", { size: 0.28, bg: "#e0f2fe" });
    g.add(ag);
    const loopNames = ["writes", "sees result", "adjusts", "improves"];
    const pads = loopNames.map((n) => {
      const pg = new THREE.Group();
      pg.add(cyl(0.5, 0.5, 0.15, "#fed7aa"));
      const l = label(n, { size: 0.28 });
      l.position.y = 0.6;
      pg.add(l);
      g.add(pg);
      return pg;
    });
    ring(pads, 1.6);
    pads.forEach((pd) => { pd.position.x += 3; pd.position.z += 1.4; });
    const orb = sphere(0.25, ownMat(color, { emissive: color, emissiveIntensity: 1 }));
    g.add(orb);
    const tower = Array.from({ length: 6 }, (_, i) => {
      const b = box(0.7 - i * 0.07, 0.3, 0.7 - i * 0.07, ["#fdba74", "#fb923c", "#f97316", "#ea580c", "#c2410c", "#9a3412"][i]);
      b.position.set(3, i * 0.3, 1.4);
      g.add(b);
      return b;
    });
    const zap = label("⚡ fast feedback", { size: 0.32, bg: "#fef9c3" });
    zap.position.set(-0.8, 2, -1);
    g.add(zap);
    return V(5, g, ({ T, phase, p }) => {
      ide.visible = phase === 0;
      antigrav.visible = ag.visible = phase === 1;
      antigrav.position.y = 0.4 + Math.sin(T * 2) * 0.3;
      ag.position.set(-4.4, 3 + antigrav.position.y, 1);
      idlePose(antigrav, T);
      chatLines.forEach((l, i) => (l.visible = phase >= 2 && (phase > 2 || p * 5 > i)));
      codeLines.forEach((l, i) => (l.visible = phase >= 2 && (phase > 2 || p * 8 > i)));
      zap.visible = phase === 3;
      zap.position.y = 2 + Math.sin(T * 10) * 0.1;
      const loopOn = phase >= 4;
      pads.forEach((pd) => (pd.visible = loopOn));
      orb.visible = loopOn;
      const a = T * 2;
      orb.position.set(3 + Math.cos(a) * 1.6, 0.9, 1.4 + Math.sin(a) * 1.6);
      const laps = phase === 4 ? Math.floor(p * 7) : 6;
      tower.forEach((b, i) => (b.visible = loopOn && i < laps));
      pads.forEach((pd, i) => (pd.scale.setScalar(Math.floor(((a / (Math.PI * 2)) * 4) % 4) === i ? 1.25 : 1)));
    });
  },

  // Modes and Workflows
  "slide-20": () => {
    const g = new THREE.Group();
    const names = ["Plan", "Build", "Test", "Review", "Deploy", "Bug Fix"];
    const cols = ["#60a5fa", "#f97316", "#22c55e", "#a855f7", "#ef4444", "#eab308"];
    const pads = names.map((n, i) => {
      const pg = new THREE.Group();
      pg.add(cyl(0.7, 0.8, 0.2, cols[i]));
      const l = label(n, { size: 0.36 });
      l.position.y = 0.7;
      pg.add(l);
      g.add(pg);
      return pg;
    });
    ring(pads, 3.2);
    const shapes = [
      new THREE.SphereGeometry(0.45, 16, 12), new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.ConeGeometry(0.5, 0.9, 6),
      new THREE.TorusGeometry(0.4, 0.15, 8, 20), new THREE.OctahedronGeometry(0.55), new THREE.DodecahedronGeometry(0.5),
    ];
    const modelMat = ownMat("#fff", { emissive: "#fff", emissiveIntensity: 0.4 });
    const model = new THREE.Mesh(shapes[0], modelMat);
    model.castShadow = true;
    g.add(model);
    const one = label("one model, many modes", { size: 0.34, bg: "#fff7ed" });
    one.position.set(0, 3.6, 0);
    g.add(one);
    const sdlc = label("a real software development lifecycle", { size: 0.32, bg: "#ecfccb" });
    sdlc.position.set(0, 4.3, 0);
    g.add(sdlc);
    const scribble = new THREE.Mesh(new THREE.TorusKnotGeometry(0.5, 0.06, 80, 6, 3, 7), ownMat("#94a3b8"));
    scribble.position.set(-5.2, 1.6, 1.5);
    g.add(scribble);
    const free = label("freeform chat", { size: 0.28, bg: "#f1f5f9" });
    free.position.set(-5.2, 2.7, 1.5);
    g.add(free);
    return V(5, g, ({ T, phase, p }) => {
      pads.forEach((pd, i) => (pd.visible = phase > 0 || p * 6 > i));
      const travel = phase >= 1;
      model.visible = travel;
      const speed = 0.5;
      const k = (T * speed) % 6;
      const i = Math.floor(k);
      const fr = ease((k - i) * 1.6 - 0.3);
      const A = pads[i].position, B = pads[(i + 1) % 6].position;
      model.position.set(lerp(A.x, B.x, fr), 1.4 + Math.sin(fr * Math.PI) * 0.8, lerp(A.z, B.z, fr));
      model.rotation.y = T;
      const shapeIdx = phase >= 2 ? (fr > 0.5 ? (i + 1) % 6 : i) : 0;
      model.geometry = shapes[shapeIdx];
      modelMat.color.set(phase >= 2 ? cols[shapeIdx] : "#ffffff");
      modelMat.emissive.set(modelMat.color);
      one.visible = phase === 1 || phase === 2;
      sdlc.visible = phase >= 3;
      scribble.visible = free.visible = phase >= 4;
      scribble.rotation.y = T * 2;
    });
  },

  // Meta Level Meta Thinking
  "slide-20b": () => {
    const g = new THREE.Group();
    const cols = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"];
    const frames = cols.map((c, i) => {
      const s = 4.6 * Math.pow(0.72, i);
      const fr = new THREE.Group();
      const t = 0.12;
      [[0, s / 2, s, t], [0, -s / 2, s, t], [s / 2, 0, t, s], [-s / 2, 0, t, s]].forEach(([x, y, w, h]) => {
        const m = box(w, h, 0.1, ownMat(c, { emissive: c, emissiveIntensity: 0.3 }), 0);
        m.position.set(x, y, 0);
        fr.add(m);
      });
      fr.position.set(0, 3, -1.5 - i * 0.25);
      g.add(fr);
      return fr;
    });
    const figs = [1, 0.7, 0.49].map((s, i) => {
      const f = figure(HUMAN, { hair: "#3b2a1a", scale: s });
      f.position.set(-1.5 + i * 1.3, 0, 2 - i * 1.2);
      f.rotation.y = Math.PI;
      g.add(f);
      return f;
    });
    const t1 = label("thinking about how you think", { size: 0.34, bg: "#fae8ff" });
    t1.position.set(0, 6.2, -1.5);
    const t2 = label("…about how you think about AI", { size: 0.3, bg: "#fae8ff" });
    t2.position.set(0, 6.9, -1.5);
    g.add(t1, t2);
    return V(2, g, ({ T, phase, p }) => {
      frames.forEach((fr, i) => {
        fr.rotation.z = Math.sin(T * 0.5 + i * 0.4) * 0.15 * i;
        fr.scale.setScalar(1 + Math.sin(T * 1.2 - i * 0.6) * 0.05);
      });
      figs.forEach((f, i) => {
        idlePose(f, T + i);
        f.visible = phase >= 1 || p * 3 > i;
        f.userData.head.rotation.x = -0.3;
      });
      t1.visible = true;
      t2.visible = phase >= 1;
    });
  },

  // Using AI to Go Live
  "slide-21": (color) => {
    const g = new THREE.Group();
    const db = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const c = cyl(0.8, 0.8, 0.5, "#3ecf8e");
      c.position.y = i * 0.6;
      db.add(c);
    }
    const dbl = label("Supabase · database", { size: 0.3 });
    dbl.position.y = 2.4;
    db.add(dbl);
    db.position.set(-3.5, 0, -0.5);
    g.add(db);
    const pad = new THREE.Group();
    const tri = cone(0.9, 0.5, "#111111", 3);
    pad.add(tri);
    const pl = label("Vercel · hosting", { size: 0.3 });
    pl.position.y = 1.4;
    pad.add(pl);
    pad.position.set(0, 0, -0.5);
    g.add(pad);
    const globe = new THREE.Group();
    globe.add(sphere(0.9, "#60a5fa", 2));
    const orbit = sphere(0.25, "#f6821f");
    globe.add(orbit);
    const dl = label("Cloudflare · domains & DNS", { size: 0.3 });
    dl.position.y = 1.7;
    globe.add(dl);
    globe.position.set(3.5, 1.2, -0.5);
    g.add(globe);
    const cables = [[-3.5, 0], [0, 3.5]].map(([a, b]) => {
      const m = box(3.5, 0.08, 0.08, ownMat(color, { emissive: color, emissiveIntensity: 0.6 }));
      m.position.set((a + b) / 2, 0.3, -0.5);
      g.add(m);
      return m;
    });
    const bot = figure("#cbd5e1", { bot: true, scale: 0.8 });
    g.add(bot);
    const mcp = label("AI deploys via MCP servers & CLI tools", { size: 0.3, bg: "#ffedd5" });
    mcp.position.set(0, 3.6, -0.5);
    g.add(mcp);
    const rocket = new THREE.Group();
    rocket.add(cyl(0.2, 0.25, 0.9, "#f8fafc"), at(cone(0.2, 0.4, "#ef4444"), 0, 0.9, 0));
    const flame = cone(0.18, 0.5, ownMat("#f59e0b", { emissive: "#f59e0b", emissiveIntensity: 1 }));
    flame.rotation.x = Math.PI;
    flame.position.y = 0;
    rocket.add(flame);
    g.add(rocket);
    const f = figure(HUMAN, { hair: "#3b2a1a" });
    f.position.set(-1.5, 0, 2);
    f.rotation.y = Math.PI * 0.85;
    g.add(f);
    const notebook = box(0.4, 0.05, 0.5, "#fde68a");
    g.add(notebook);
    const learn = label("learn as the AI does it — don't just press buttons", { size: 0.28, bg: "#ecfccb", maxWidth: 1100 });
    learn.position.set(-1.5, 3, 2);
    g.add(learn);
    const live = label("🌐 LIVE", { size: 0.5, bg: "#22c55e", color: "#fff" });
    live.position.set(0, 5.4, -0.5);
    g.add(live);
    return V(5, g, ({ T, phase, p }) => {
      db.visible = true;
      db.children.forEach((c, i) => (c.visible = phase > 0 || p * 3 > i || i === 3));
      pad.visible = phase >= 1;
      globe.visible = phase >= 2;
      globe.rotation.y = T * 0.6;
      orbit.position.set(Math.cos(T * 2) * 1.2, 0.3, Math.sin(T * 2) * 1.2);
      cables.forEach((c, i) => (c.visible = phase >= 3 && (phase > 3 || p * 2 > i)));
      bot.visible = mcp.visible = phase === 3;
      bot.position.set(lerp(-3, 3, (T * 0.2) % 1), 0, 0.6);
      bot.rotation.y = Math.PI / 2;
      walkPose(bot, T * 9);
      f.visible = notebook.visible = learn.visible = phase >= 4;
      idlePose(f, T);
      f.userData.armL.rotation.x = f.userData.armR.rotation.x = -1;
      notebook.position.set(-1.5, 1.05, 1.6);
      const launch = phase >= 4 ? seg(p, 0.3, 1) : 0;
      rocket.visible = phase >= 4;
      rocket.position.set(0, 0.5 + launch * launch * 8, -0.5);
      flame.visible = launch > 0;
      flame.scale.y = 1 + Math.sin(T * 30) * 0.3;
      live.visible = launch > 0.7;
    });
  },

  // Customizing the Harness
  "slide-22": (color) => {
    const g = new THREE.Group();
    const bot = figure("#cbd5e1", { bot: true, scale: 1.6 });
    g.add(bot);
    const glow = ownMat(color, { emissive: color, emissiveIntensity: 0 });
    const core = sphere(0.18, glow);
    core.position.set(0, 1.25, 0.2);
    bot.add(core);
    const carts = ["skill: slides.md", "skill: testing.md", "skill: deploy.md"].map((t) => {
      const c = textPlane(t, 1.5, { bg: "#ffedd5", font: "700 52px monospace" });
      g.add(c);
      return c;
    });
    const cmds = ["/review", "/deploy", "/plan"].map((t) => {
      const b = new THREE.Group();
      b.add(cyl(0.5, 0.55, 0.25, "#1f2937"));
      const l = label(t, { size: 0.3, bg: "#111827", color: "#fdba74", font: "700 64px monospace" });
      l.position.y = 0.6;
      b.add(l);
      g.add(b);
      return b;
    });
    cmds.forEach((c, i) => c.position.set(-3 + i * 1.3, 0, 2));
    const minis = Array.from({ length: 3 }, () => figure("#cbd5e1", { bot: true, scale: 0.5 }));
    minis.forEach((m) => g.add(m));
    const scroll = textPlane("CLAUDE.md\n• use TypeScript\n• run tests first\n• be concise", 2, { bg: "#fef9c3", font: "700 52px monospace", align: "left" });
    scroll.position.set(0, 4.6, -0.2);
    g.add(scroll);
    const bell = cone(0.4, 0.5, "#eab308", 10);
    bell.position.set(3, 2.2, 0);
    g.add(bell);
    const bl = label("hook: on save →", { size: 0.28 });
    bl.position.set(3, 3.1, 0);
    g.add(bl);
    const lamps = Array.from({ length: 4 }, (_, i) => {
      const l = sphere(0.18, ownMat("#64748b", { emissive: "#22c55e", emissiveIntensity: 0 }));
      l.position.set(3.6 + i * 0.5, 1.5 - i * 0.3, 0);
      g.add(l);
      return l;
    });
    return V(5, g, ({ T, phase, p }) => {
      idlePose(bot, T);
      carts.forEach((c, i) => {
        const k = phase === 0 ? clamp01(p * 3 - i) : 1;
        c.visible = phase === 0 && k < 1;
        c.position.set(lerp(-3 + i * 3, 0, ease(k)), lerp(4, 2.6, ease(k)), 0.5);
      });
      glow.emissiveIntensity = phase === 0 ? clamp01(p * 1.2) : 0.9;
      cmds.forEach((c, i) => {
        c.visible = phase >= 1;
        const press = phase === 1 && Math.floor(T * 1.5) % 3 === i;
        c.children[0].scale.y = press ? 0.4 : 1;
      });
      minis.forEach((m, i) => {
        m.visible = phase >= 2;
        const k = phase === 2 ? clamp01(p * 2 - i * 0.3) : 1;
        const a = (i / 3) * Math.PI * 2 + T * 0.3;
        m.position.set(Math.cos(a) * lerp(0.2, 2.6, k), 0, Math.sin(a) * lerp(0.2, 2.6, k) - 0.5);
        m.rotation.y = -a;
        walkPose(m, T * 10);
      });
      scroll.visible = phase >= 3;
      scroll.scale.y = phase === 3 ? Math.max(0.01, ease(p * 2)) : 1;
      bell.visible = bl.visible = phase >= 4;
      bell.rotation.z = phase >= 4 ? Math.sin(T * 12) * 0.3 : 0;
      lamps.forEach((l, i) => {
        l.visible = phase >= 4;
        (l.material as THREE.MeshStandardMaterial).emissiveIntensity = ((T * 2) % 2) * 2 > i ? 1 : 0;
      });
    });
  },

  // Context Engineering
  "slide-23": () => {
    const g = new THREE.Group();
    const bot = figure("#cbd5e1", { bot: true, scale: 1.2 });
    bot.position.set(-2.5, 0, 0.5);
    g.add(bot);
    const tankMat = ownMat("#bae6fd", { transparent: true, opacity: 0.25 });
    const tank = box(2.4, 3, 1.4, tankMat);
    tank.position.set(1, 0, -0.5);
    g.add(tank);
    const tl = label("context window", { size: 0.3 });
    tl.position.set(1, 3.5, -0.5);
    g.add(tl);
    const items = Array.from({ length: 22 }, (_, i) => {
      const b = box(0.5, 0.3, 0.5, ["#fde68a", "#bfdbfe", "#fecaca", "#bbf7d0", "#ddd6fe"][i % 5]);
      g.add(b);
      return b;
    });
    const confused = label("??? I forgot the goal", { size: 0.3, bg: "#fee2e2" });
    const amnesia = label("New session. Who are you?", { size: 0.3, bg: "#f1f5f9" });
    g.add(confused, amnesia);
    const cab = new THREE.Group();
    cab.add(box(1.2, 2, 1, "#64748b"));
    [0.4, 1.1, 1.7].forEach((y) => { const d = box(1, 0.5, 0.05, "#94a3b8"); d.position.set(0, y - 0.25, 0.52); cab.add(d); });
    const cl = label("files · notes.md · database", { size: 0.28 });
    cl.position.y = 2.6;
    cab.add(cl);
    cab.position.set(4, 0, -0.5);
    g.add(cab);
    const reset = new THREE.Group();
    reset.add(cyl(0.45, 0.5, 0.3, "#334155"), at(cyl(0.35, 0.35, 0.2, "#ef4444"), 0, 0.3, 0));
    const rl = label("reset session", { size: 0.28, bg: "#fee2e2" });
    rl.position.y = 1;
    reset.add(rl);
    reset.position.set(-1, 0, 2);
    g.add(reset);
    return V(5, g, ({ T, phase, p }) => {
      idlePose(bot, T);
      let count = 6;
      if (phase === 0) count = Math.floor(lerp(0, 9, p));
      if (phase === 1) count = Math.floor(lerp(9, 22, p));
      if (phase === 2) count = p < 0.2 ? 22 : 0;
      if (phase === 3) count = 0;
      if (phase === 4) count = p < 0.4 ? 18 : 5;
      items.forEach((b, i) => {
        b.visible = i < count;
        const inTank = i < 18;
        const col = i % 4, row = Math.floor(i / 8), lay = Math.floor((i % 8) / 4);
        if (inTank) b.position.set(0.25 + col * 0.5, 0.15 + row * 0.33 + lay * 0.01, -0.8 + lay * 0.6);
        else {
          const k = (T * 0.8 + i * 0.3) % 1;
          b.position.set(2.2 + k * 1.2, Math.max(0.15, 3 - k * k * 4), -0.5 + (i % 2) * 0.6);
        }
      });
      if (phase === 3) {
        items.forEach((b, i) => {
          if (i < 8) {
            b.visible = true;
            const k = clamp01(p * 2 - i * 0.1);
            b.position.set(lerp(1, 4, k), lerp(1, 0.8 + (i % 3) * 0.6, k) + Math.sin(k * Math.PI), -0.5);
          }
        });
      }
      tankMat.color.set(phase === 1 && p > 0.4 ? "#fecaca" : "#bae6fd");
      confused.visible = phase === 1 && p > 0.5;
      confused.position.set(-2.5, 3, 0.5);
      bot.rotation.y = confused.visible ? Math.sin(T * 8) * 0.4 : 0;
      amnesia.visible = phase === 2 && p > 0.25;
      amnesia.position.set(-2.5, 3, 0.5);
      cab.visible = phase >= 3;
      reset.visible = phase >= 4;
      reset.children[1].position.y = phase === 4 && p > 0.35 && p < 0.45 ? 0.15 : 0.3;
    });
  },

  // Parallel Agents and Sub-agent Orchestration
  "slide-24": (color) => {
    const g = new THREE.Group();
    const podium = cyl(0.8, 1, 0.8, "#1f2937");
    podium.position.set(0, 0, 2.2);
    g.add(podium);
    const lead = figure(HUMAN, { hair: "#3b2a1a" });
    lead.position.set(0, 0.8, 2.2);
    lead.rotation.y = Math.PI;
    g.add(lead);
    const baton = cyl(0.02, 0.02, 0.6, "#fff");
    lead.userData.armR.add(baton);
    baton.position.set(0, -0.6, 0.2);
    baton.rotation.x = Math.PI / 2;
    const desks = [-4.2, -1.4, 1.4, 4.2].map((x) => {
      const d = new THREE.Group();
      d.add(box(1.8, 0.8, 1, "#e5e7eb"));
      const bot = figure("#cbd5e1", { bot: true, scale: 0.75 });
      bot.position.set(0, 0, -0.9);
      d.add(bot);
      const tree = new THREE.Group();
      [[0, 0], [-0.25, -0.3], [0.25, -0.3]].forEach(([tx, ty]) => {
        const n = box(0.18, 0.18, 0.18, color);
        n.position.set(tx, 1.8 + ty, 0.5);
        tree.add(n);
      });
      d.add(tree);
      d.position.set(x, 0, -1.4);
      g.add(d);
      return { d, bot, tree };
    });
    const tools = ["Git worktrees", "Conductor.build", "Beads"].map((t) => label(t, { size: 0.3, bg: "#ffedd5" }));
    tools.forEach((t, i) => { t.position.set(-3 + i * 3, 4, -1.4); g.add(t); });
    const answers = desks.map(() => {
      const s = sphere(0.18, ownMat("#fde047", { emissive: "#facc15", emissiveIntensity: 1 }), 0);
      g.add(s);
      return s;
    });
    const coord = label("you're coordinating, not executing", { size: 0.32, bg: "#ecfccb" });
    coord.position.set(0, 3.6, 2.2);
    g.add(coord);
    return V(5, g, ({ T, phase, p }) => {
      idlePose(lead, T);
      lead.userData.armR.rotation.x = -1.2 + Math.sin(T * 4) * 0.5;
      desks.forEach(({ d, bot, tree }, i) => {
        d.visible = phase > 0 || p * 4 > i;
        idlePose(bot, T + i);
        bot.userData.armL.rotation.x = bot.userData.armR.rotation.x = -1.3 + Math.sin(T * 14 + i) * 0.15;
        tree.visible = phase >= 1;
      });
      tools.forEach((t, i) => (t.visible = phase === 1 ? i === 0 : phase === 2));
      answers.forEach((a, i) => {
        a.visible = phase >= 3;
        const k = (T * 0.5 + i * 0.25) % 1;
        const from = desks[i].d.position;
        a.position.set(lerp(from.x, 0, k), 1.5 + Math.sin(k * Math.PI) * 1.5, lerp(from.z, 2.2, k));
      });
      coord.visible = phase >= 4;
    });
  },

  // Swarms and Infrastructure
  "slide-25": (color) => {
    const g = new THREE.Group();
    const N = 60;
    const swarm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), ownMat(color, { emissive: color, emissiveIntensity: 0.5 }), N);
    g.add(swarm);
    const moon = sphere(0.7, ownMat("#f8fafc", { emissive: "#e2e8f0", emissiveIntensity: 0.6 }));
    g.add(moon);
    const night = label("overnight: one agent after another (the “Ralph Wiggum” loop)", { size: 0.28, bg: "#1e1b4b", color: "#e0e7ff", maxWidth: 1200 });
    night.position.set(0, 5.6, -1);
    g.add(night);
    const door = box(1.2, 2, 0.3, "#1e293b");
    door.position.set(3, 0, -1);
    g.add(door);
    const queue = Array.from({ length: 5 }, () => figure("#cbd5e1", { bot: true, scale: 0.6 }));
    queue.forEach((q) => g.add(q));
    const coins = Array.from({ length: 10 }, (_, i) => {
      const c = cyl(0.4, 0.4, 0.12, "#facc15", 16);
      c.position.set(-4, i * 0.13, 1.5);
      g.add(c);
      return c;
    });
    const price = label("$100–200+/month in tokens", { size: 0.3, bg: "#fef9c3" });
    price.position.set(-4, 2.2, 1.5);
    g.add(price);
    const servers = Array.from({ length: 3 }, (_, i) => {
      const s = new THREE.Group();
      [[-0.5, 0], [0, 0.2], [0.5, 0]].forEach(([x, y]) => { const c = sphere(0.5, "#e2e8f0"); c.position.set(x, y, 0); s.add(c); });
      const rack = box(0.7, 0.8, 0.5, "#334155");
      rack.position.y = -0.9;
      s.add(rack);
      const led = sphere(0.07, ownMat("#22c55e", { emissive: "#22c55e", emissiveIntensity: 1 }), 0);
      led.position.set(0.2, -0.5, 0.26);
      s.add(led);
      s.position.set(-2 + i * 2.2, 4.4, -2);
      g.add(s);
      return s;
    });
    const vps = label("VPS: agents running in the cloud 24/7", { size: 0.28, bg: "#e0f2fe" });
    vps.position.set(0, 6.4, -2);
    g.add(vps);
    const m4 = new THREE.Matrix4();
    return V(5, g, ({ T, phase, p }) => {
      const show = phase === 0 ? Math.floor(p * N) + 1 : N;
      for (let i = 0; i < N; i++) {
        const a = i * 2.39 + T * (0.5 + (i % 7) * 0.08);
        const r = 1.5 + (i % 5) * 0.4;
        const y = 1.5 + Math.sin(T * 1.3 + i) * 0.8 + (i % 3) * 0.4;
        const s = i < show ? 1 : 0.0001;
        m4.makeScale(s, s, s).setPosition(Math.cos(a) * r, y, Math.sin(a) * r * 0.6);
        swarm.setMatrixAt(i, m4);
      }
      swarm.instanceMatrix.needsUpdate = true;
      moon.visible = night.visible = door.visible = phase === 1;
      moon.position.set(-3 + p * 6, 5 + Math.sin(p * Math.PI) * 1.2, -3);
      queue.forEach((q, i) => {
        q.visible = phase === 1;
        const k = (T * 0.25 + i / 5) % 1;
        q.position.set(lerp(-2, 3, k), 0, -0.4);
        q.rotation.y = Math.PI / 2;
        walkPose(q, T * 8);
      });
      coins.forEach((c, i) => (c.visible = phase >= 2 && (phase > 2 || p * 10 > i)));
      price.visible = phase >= 2;
      servers.forEach((s, i) => {
        s.visible = phase >= 3;
        s.position.y = 4.4 + Math.sin(T + i) * 0.15;
        ((s.children[4] as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity = Math.sin(T * 6 + i) > 0 ? 1 : 0.1;
      });
      vps.visible = phase >= 3;
      swarm.position.y = phase >= 4 ? Math.sin(T) * 0.3 : 0;
    });
  },

  // The Only Way Forward Is Through
  "slide-26": (color) => {
    const g = new THREE.Group();
    const arch = torus(2.6, 0.45, ownMat(color, { emissive: color, emissiveIntensity: 0.4 }), Math.PI);
    arch.position.set(0, 0, -0.5);
    g.add(arch);
    const glowDisc = new THREE.Mesh(new THREE.CircleGeometry(2.2, 32, 0, Math.PI), ownMat("#f5d0fe", { emissive: "#e879f9", emissiveIntensity: 0.8, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    glowDisc.position.set(0, 0, -0.5);
    g.add(glowDisc);
    const f = figure(HUMAN, { hair: "#3b2a1a" });
    g.add(f);
    const orb = sphere(0.22, ownMat("#fde047", { emissive: "#facc15", emissiveIntensity: 1 }));
    g.add(orb);
    const lv = label("Use AI as your learning tool!", { size: 0.34, bg: "#fae8ff" });
    lv.position.set(0, 5, -0.5);
    g.add(lv);
    const others = Array.from({ length: 6 }, (_, i) => figure(["#f87171", "#60a5fa", "#fbbf24", "#34d399", "#a78bfa", "#fb923c"][i], { skin: SKIN[i % 4], scale: 0.85 }));
    others.forEach((o) => g.add(o));
    const line = box(0.1, 0.05, 6, "#ffffff");
    line.position.set(3.5, 0.03, 0);
    g.add(line);
    const nobody = label("it's changing so fast, no one is that far ahead", { size: 0.3, bg: "#ecfccb", maxWidth: 1200 });
    nobody.position.set(3.5, 3.2, 0);
    g.add(nobody);
    return V(2, g, ({ T, phase, p }) => {
      glowDisc.material.opacity = 0.45 + Math.sin(T * 2) * 0.15;
      if (phase === 0) {
        moveFig(f, 0, 4, 0, -4, (p * 1.2) % 1, T);
        f.rotation.y = Math.PI;
        const through = f.position.z < -0.5;
        orb.position.set(f.position.x + 0.6, 2.2 + Math.sin(T * 4) * 0.1, f.position.z);
        f.scale.setScalar(through ? 1.15 : 1);
        lv.visible = true;
        others.forEach((o) => (o.visible = false));
        nobody.visible = line.visible = false;
        f.visible = true;
      } else {
        lv.visible = false;
        f.visible = false;
        orb.position.set(3.5, 2.4 + Math.sin(T * 3) * 0.2, 0);
        line.visible = nobody.visible = true;
        others.forEach((o, i) => {
          o.visible = true;
          const x = 1 + ((T * 0.6 + i * 0.13) % 1) * 0.15 + i * 0.25 + p * 1.2;
          o.position.set(Math.min(3.3, x), 0, -2.4 + i * 0.9);
          o.rotation.y = Math.PI / 2;
          walkPose(o, T * 7 + i);
        });
      }
    });
  },
};

/** Fallback used if a slide has no bespoke story (e.g. new slides added later). */
function fallback(color: string): Vignette {
  const g = new THREE.Group();
  const orb = sphere(0.6, ownMat(color, { emissive: color, emissiveIntensity: 0.6 }));
  orb.position.y = 2;
  g.add(orb);
  const f = figure(HUMAN, { hair: "#3b2a1a" });
  f.position.set(-1.5, 0, 0.5);
  g.add(f);
  return V(2, g, ({ T }) => {
    orb.position.y = 2 + Math.sin(T * 2) * 0.3;
    orb.rotation.y = T;
    idlePose(f, T);
  });
}

export function buildVignette(slideId: string, color: string): Vignette {
  const b = builders[slideId];
  return b ? b(color) : fallback(color);
}

export function hasBespokeStory(slideId: string): boolean {
  return slideId in builders;
}

export const _unused = { mat, popIn };
