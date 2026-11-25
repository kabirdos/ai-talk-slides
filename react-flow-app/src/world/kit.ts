// Small toolkit of low-poly props, figures and text used to stage each story.
import * as THREE from "three";

const matCache = new Map<string, THREE.MeshStandardMaterial>();
export function mat(color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  const k = color + JSON.stringify(opts);
  let m = matCache.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, flatShading: true, ...opts });
    matCache.set(k, m);
  }
  return m;
}
/** A material that is safe to animate (not shared). */
export function ownMat(color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.6, flatShading: true, ...opts });
}

function shadow<T extends THREE.Object3D>(o: T): T {
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
  return o;
}

export function box(w: number, h: number, d: number, color: string | THREE.Material, y = h / 2): THREE.Mesh {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, y, 0);
  return shadow(new THREE.Mesh(g, typeof color === "string" ? mat(color) : color));
}
export function sphere(r: number, color: string | THREE.Material, detail = 1): THREE.Mesh {
  return shadow(new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), typeof color === "string" ? mat(color) : color));
}
export function cyl(rt: number, rb: number, h: number, color: string | THREE.Material, seg = 10, y = h / 2): THREE.Mesh {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  g.translate(0, y, 0);
  return shadow(new THREE.Mesh(g, typeof color === "string" ? mat(color) : color));
}
export function cone(r: number, h: number, color: string | THREE.Material, seg = 8): THREE.Mesh {
  const g = new THREE.ConeGeometry(r, h, seg);
  g.translate(0, h / 2, 0);
  return shadow(new THREE.Mesh(g, typeof color === "string" ? mat(color) : color));
}
export function torus(r: number, tube: number, color: string | THREE.Material, arc = Math.PI * 2): THREE.Mesh {
  return shadow(new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 32, arc), typeof color === "string" ? mat(color) : color));
}

// ---------- Text ----------
export interface TextOpts {
  color?: string;
  bg?: string;
  font?: string;
  size?: number; // world height of one line
  pad?: number;
  border?: string;
  radius?: number;
  maxWidth?: number; // in px, wraps
  align?: CanvasTextAlign;
}

export function textCanvas(text: string, o: TextOpts = {}): HTMLCanvasElement {
  const fontPx = 64;
  const font = o.font ?? `700 ${fontPx}px "Space Grotesk", "Segoe UI", system-ui, sans-serif`;
  const pad = o.pad ?? 24;
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  ctx.font = font;
  const words = text.split(" ");
  const lines: string[] = [];
  const maxW = o.maxWidth ?? 99999;
  for (const para of text.split("\n")) {
    let cur = "";
    for (const w of para.split(" ")) {
      const t = cur ? cur + " " + w : w;
      if (ctx.measureText(t).width > maxW && cur) {
        lines.push(cur);
        cur = w;
      } else cur = t;
    }
    lines.push(cur);
  }
  void words;
  const lh = fontPx * 1.2;
  const w = Math.ceil(Math.max(...lines.map((l) => ctx.measureText(l).width)) + pad * 2);
  const h = Math.ceil(lines.length * lh + pad * 2 - fontPx * 0.2);
  c.width = w;
  c.height = h;
  if (o.bg) {
    ctx.fillStyle = o.bg;
    const r = o.radius ?? 24;
    ctx.beginPath();
    ctx.roundRect(2, 2, w - 4, h - 4, r);
    ctx.fill();
    if (o.border) {
      ctx.lineWidth = 6;
      ctx.strokeStyle = o.border;
      ctx.stroke();
    }
  }
  ctx.font = font;
  ctx.fillStyle = o.color ?? "#111";
  ctx.textBaseline = "top";
  ctx.textAlign = o.align ?? "center";
  lines.forEach((l, i) => {
    const x = (o.align ?? "center") === "center" ? w / 2 : pad;
    ctx.fillText(l, x, pad + i * lh);
  });
  return c;
}

/** Camera-facing text label. */
export function label(text: string, o: TextOpts = {}): THREE.Sprite {
  const c = textCanvas(text, { bg: "rgba(255,255,255,0.92)", ...o });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  const size = o.size ?? 0.6;
  const lines = Math.max(1, Math.round((c.height - 40) / 77));
  const hWorld = size * lines + size * 0.6;
  sp.scale.set((c.width / c.height) * hWorld, hWorld, 1);
  return sp;
}

/** Flat text panel (a plane), e.g. a card or a screen. */
export function textPlane(text: string, width: number, o: TextOpts = {}): THREE.Mesh {
  const c = textCanvas(text, { bg: "#ffffff", ...o });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const h = (width * c.height) / c.width;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(width, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }),
  );
  return m;
}

export function setOpacity(o: THREE.Object3D, a: number) {
  o.traverse((c) => {
    const m = (c as THREE.Mesh).material as THREE.Material | undefined;
    if (m) {
      m.transparent = true;
      m.opacity = a;
    }
  });
  o.visible = a > 0.01;
}

// ---------- Figures ----------
export interface Figure extends THREE.Group {
  userData: {
    armL: THREE.Object3D;
    armR: THREE.Object3D;
    legL: THREE.Object3D;
    legR: THREE.Object3D;
    head: THREE.Object3D;
    body: THREE.Object3D;
  };
}

/** A friendly low-poly person (or bot when `bot` is true). */
export function figure(color: string, opts: { skin?: string; bot?: boolean; scale?: number; hair?: string } = {}): Figure {
  const g = new THREE.Group() as Figure;
  const skin = opts.skin ?? "#f1c9a5";
  const body = box(0.55, 0.7, 0.32, color, 0);
  body.position.y = 0.75;
  g.add(body);
  const head = opts.bot ? box(0.42, 0.38, 0.38, "#dfe7ef", 0.19) : sphere(0.22, skin, 1);
  head.position.y = opts.bot ? 1.47 : 1.68;
  if (opts.bot) {
    const eye = box(0.3, 0.08, 0.02, "#38bdf8", 0);
    eye.position.set(0, 0.22, 0.2);
    head.add(eye);
    const ant = cyl(0.015, 0.015, 0.2, "#94a3b8");
    ant.position.y = 0.38;
    head.add(ant);
    const bulb = sphere(0.05, "#f97316", 0);
    bulb.position.y = 0.6;
    head.add(bulb);
  } else if (opts.hair) {
    const hair = sphere(0.235, opts.hair, 1);
    hair.scale.set(1, 0.7, 1);
    hair.position.set(0, 0.07, -0.03);
    head.add(hair);
  }
  g.add(head);
  const limb = (x: number, y: number, len: number, w: number, c: string) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const m = box(w, len, w, c, -len / 2);
    pivot.add(m);
    g.add(pivot);
    return pivot;
  };
  const armL = limb(-0.36, 1.42, 0.62, 0.15, opts.bot ? "#cbd5e1" : color);
  const armR = limb(0.36, 1.42, 0.62, 0.15, opts.bot ? "#cbd5e1" : color);
  const legL = limb(-0.14, 0.78, 0.76, 0.18, opts.bot ? "#94a3b8" : "#334155");
  const legR = limb(0.14, 0.78, 0.76, 0.18, opts.bot ? "#94a3b8" : "#334155");
  g.userData = { armL, armR, legL, legR, head, body };
  if (opts.scale) g.scale.setScalar(opts.scale);
  return g;
}

export function walkPose(f: Figure, t: number, amount = 1) {
  const s = Math.sin(t) * 0.7 * amount;
  f.userData.armL.rotation.x = s;
  f.userData.armR.rotation.x = -s;
  f.userData.legL.rotation.x = -s;
  f.userData.legR.rotation.x = s;
  f.userData.body.position.y = 0.75 + Math.abs(Math.cos(t)) * 0.05 * amount;
}
export function idlePose(f: Figure, t: number) {
  walkPose(f, 0, 0);
  f.userData.armL.rotation.z = 0.08 + Math.sin(t * 1.5) * 0.03;
  f.userData.armR.rotation.z = -0.08 - Math.sin(t * 1.5) * 0.03;
}

// ---------- Motion helpers ----------
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const ease = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
export const easeOutBack = (x: number) => {
  const t = clamp01(x);
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const lerp = THREE.MathUtils.lerp;
/** 0→1 over [a,b] of a cycle time. */
export const seg = (t: number, a: number, b: number) => ease((t - a) / (b - a));

export function popIn(o: THREE.Object3D, p: number, base = 1) {
  const s = p <= 0 ? 0.0001 : easeOutBack(p) * base;
  o.scale.setScalar(s);
  o.visible = p > 0;
}

/** Thought / speech bubble with text */
export function bubble(text: string, size = 0.45, bg = "#ffffff", color = "#111") {
  return label(text, { bg, color, size, border: "#111", radius: 40, maxWidth: 900 });
}

export function at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T {
  o.position.set(x, y, z);
  return o;
}
