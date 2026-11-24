/**
 * PCB background.
 *
 * The whole page is treated as one circuit board. An orthographic camera maps
 * 1 world unit to 1 CSS pixel, so board coordinates equal page coordinates and
 * the camera simply follows window.scrollY.
 *
 *  - Main bus: a copper trace running down the left side. It "fills" with
 *    current as you scroll; the fill front is damped for a smooth glide.
 *  - Branches: one per section. When the fill front reaches a branch, that
 *    section gets the class `is-live` and its data is pulled into view.
 *  - Decorative routing: bundles of parallel traces with 45 degree bends,
 *    vias and SMD footprints, routed around keepout zones (the sections) on an
 *    occupancy grid so nothing overlaps.
 *
 * Everything static lives in one merged BufferGeometry (one draw call) plus
 * one InstancedMesh for vias. Animation happens entirely in shaders, so the
 * CPU does almost nothing per frame.
 */
import {
  AdditiveBlending, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, InstancedMesh, Matrix4, Mesh, OrthographicCamera, PlaneGeometry, RingGeometry, Scene, ShaderMaterial, WebGLRenderer,
} from 'three';

type Pt = [number, number];
interface Rect { x: number; y: number; w: number; h: number }

const KIND = { TRACE: 0, PAD: 1, SILK: 2 } as const;

const PAL = {
  mask: '#0a2219',
  dim: '#1a4231',
  copper: '#c98a45',
  pad: '#d8a85e',
  hot: '#ffd391',
  silk: '#f2efe4',
};

/* ---------- small helpers ---------- */

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function perp(a: Pt, b: Pt): Pt {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  return [-dy / l, dx / l];
}

/** Occupancy grid used as a cheap router: a cell is either free or copper. */
class Grid {
  cols: number; rows: number; cell: number; data: Uint8Array;
  constructor(w: number, h: number, cell = 6) {
    this.cell = cell;
    this.cols = Math.ceil(w / cell) + 1;
    this.rows = Math.ceil(h / cell) + 1;
    this.data = new Uint8Array(this.cols * this.rows);
  }
  private each(pts: Pt[], r: number, fn: (i: number) => boolean | void) {
    const c = this.cell;
    for (let s = 0; s < pts.length - 1; s++) {
      const [x0, y0] = pts[s];
      const [x1, y1] = pts[s + 1];
      const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (c * 0.75)));
      for (let k = 0; k <= steps; k++) {
        const x = x0 + ((x1 - x0) * k) / steps;
        const y = y0 + ((y1 - y0) * k) / steps;
        const cx = Math.round(x / c);
        const cy = Math.round(y / c);
        const rr = Math.ceil(r / c);
        for (let j = -rr; j <= rr; j++) {
          for (let i = -rr; i <= rr; i++) {
            const gx = cx + i;
            const gy = cy + j;
            if (gx < 0 || gy < 0 || gx >= this.cols || gy >= this.rows) {
              if (fn(-1) === false) return false;
              continue;
            }
            if (fn(gy * this.cols + gx) === false) return false;
          }
        }
      }
    }
    return true;
  }
  free(pts: Pt[], r: number) {
    return this.each(pts, r, (i) => (i < 0 || this.data[i] ? false : true)) !== false;
  }
  mark(pts: Pt[], r: number) {
    this.each(pts, r, (i) => { if (i >= 0) this.data[i] = 1; });
  }
  markRect(r: Rect) {
    const c = this.cell;
    for (let y = Math.floor(r.y / c); y <= Math.ceil((r.y + r.h) / c); y++)
      for (let x = Math.floor(r.x / c); x <= Math.ceil((r.x + r.w) / c); x++)
        if (x >= 0 && y >= 0 && x < this.cols && y < this.rows) this.data[y * this.cols + x] = 1;
  }
}

/** Accumulates triangles for traces, pads and silkscreen into one geometry. */
class Builder {
  pos: number[] = []; dist: number[] = []; seed: number[] = []; kind: number[] = []; idx: number[] = [];
  n = 0;
  private v(x: number, y: number, d: number, s: number, k: number) {
    this.pos.push(x, -y, 0); this.dist.push(d); this.seed.push(s); this.kind.push(k); this.n++;
  }
  /** Polyline to a thick strip with mitred joins. */
  strip(pts: Pt[], width: number, seed: number, kind: number, d0 = 0) {
    if (pts.length < 2) return;
    const hw = width / 2;
    const base = this.n;
    let acc = d0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const a = i > 0 ? perp(pts[i - 1], p) : null;
      const b = i < pts.length - 1 ? perp(p, pts[i + 1]) : null;
      let mx: number, my: number, sc = 1;
      if (a && b) {
        mx = a[0] + b[0]; my = a[1] + b[1];
        const l = Math.hypot(mx, my) || 1; mx /= l; my /= l;
        sc = 1 / Math.max(0.35, mx * a[0] + my * a[1]);
      } else {
        const s = (a || b)!; mx = s[0]; my = s[1];
      }
      if (i > 0) acc += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
      this.v(p[0] + mx * hw * sc, p[1] + my * hw * sc, acc, seed, kind);
      this.v(p[0] - mx * hw * sc, p[1] - my * hw * sc, acc, seed, kind);
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const q = base + i * 2;
      this.idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2);
    }
  }
  rect(x: number, y: number, w: number, h: number, seed: number, kind: number) {
    const b = this.n;
    this.v(x, y, 0, seed, kind); this.v(x + w, y, 0, seed, kind);
    this.v(x, y + h, 0, seed, kind); this.v(x + w, y + h, 0, seed, kind);
    this.idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
  }
  outline(x: number, y: number, w: number, h: number, t: number, seed: number) {
    this.rect(x, y, w, t, seed, KIND.SILK);
    this.rect(x, y + h - t, w, t, seed, KIND.SILK);
    this.rect(x, y, t, h, seed, KIND.SILK);
    this.rect(x + w - t, y, t, h, seed, KIND.SILK);
  }
  geometry() {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute('aDist', new Float32BufferAttribute(this.dist, 1));
    g.setAttribute('aSeed', new Float32BufferAttribute(this.seed, 1));
    g.setAttribute('aKind', new Float32BufferAttribute(this.kind, 1));
    g.setIndex(this.idx);
    return g;
  }
}

/* ---------- shaders ---------- */

const common = /* glsl */ `
  uniform float uTime;
  uniform float uFill;
  uniform vec3 uMask, uDim, uCopper, uPad, uHot, uSilk;
  float litAt(float y) { return 1.0 - smoothstep(uFill - 50.0, uFill + 6.0, y); }
`;

const boardVert = /* glsl */ `
  attribute float aDist; attribute float aSeed; attribute float aKind;
  varying float vDist; varying float vSeed; varying float vKind; varying float vY;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vY = -wp.y; vDist = aDist; vSeed = aSeed; vKind = aKind;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const boardFrag = /* glsl */ `
  ${common}
  varying float vDist; varying float vSeed; varying float vKind; varying float vY;
  void main() {
    float lit = litAt(vY);
    vec3 col;
    if (vKind < 0.5) {
      col = mix(uDim, uCopper, lit * 0.9);
      // current pulses travelling along each trace (downstream = increasing dist)
      float speed = 120.0 + vSeed * 140.0;
      float period = 420.0 + vSeed * 600.0;
      float q = fract((vDist - uTime * speed) / period + vSeed * 13.0);
      col += uHot * pow(q, 22.0) * (0.25 + 0.75 * lit);
    } else if (vKind < 1.5) {
      col = mix(uDim * 1.25, uPad, 0.2 + 0.8 * lit);
    } else {
      col = mix(uMask, uSilk, 0.2 + 0.22 * lit);
    }
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const busVert = /* glsl */ `
  varying vec2 vUv; varying float vY;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vY = -wp.y; vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const busFrag = /* glsl */ `
  ${common}
  uniform float uGlow;
  varying vec2 vUv; varying float vY;
  void main() {
    float lit = litAt(vY);
    float across = 1.0 - abs(vUv.x * 2.0 - 1.0);
    float spark = exp(-abs(vY - uFill) / 26.0);
    if (uGlow > 0.5) {
      float a = pow(across, 3.0) * (lit * 0.28 + spark * 0.9);
      gl_FragColor = vec4(uHot * a, a);
      #include <colorspace_fragment>
    } else {
      vec3 col = mix(uDim * 1.15, uCopper * 1.08, lit);
      float q = fract((vY - uTime * 300.0) / 300.0);
      col += uHot * pow(q, 12.0) * lit * 0.55;
      col += uHot * spark * 1.3;
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }
  }
`;

const viaVert = /* glsl */ `
  varying float vY;
  void main() {
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vY = -wp.y;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const viaFrag = /* glsl */ `
  ${common}
  varying float vY;
  void main() {
    float lit = litAt(vY);
    gl_FragColor = vec4(mix(uDim * 1.3, uPad, 0.25 + 0.75 * lit), 1.0);
    #include <colorspace_fragment>
  }
`;

/* ---------- board generation ---------- */

interface Layout {
  W: number; H: number; busX: number;
  sections: { el: HTMLElement; rect: Rect; branchY: number }[];
  contentLeft: number; contentRight: number;
}

function measure(): Layout {
  const W = document.documentElement.clientWidth;
  const H = document.documentElement.scrollHeight;
  const els = Array.from(document.querySelectorAll<HTMLElement>('[data-node]'));
  const sy = window.scrollY;
  const sections = els.map((el) => {
    const r = el.getBoundingClientRect();
    const rect = { x: r.left, y: r.top + sy, w: r.width, h: r.height };
    const off = Number(el.dataset.padOffset || 40);
    return { el, rect, branchY: rect.y + off };
  });
  const contentLeft = sections.length ? Math.min(...sections.map((s) => s.rect.x)) : 24;
  const contentRight = sections.length ? Math.max(...sections.map((s) => s.rect.x + s.rect.w)) : W - 24;
  const busX = Math.max(10, Math.round(contentLeft - (W < 760 ? 10 : 46)));
  return { W, H, busX, sections, contentLeft, contentRight };
}

function generate(L: Layout) {
  const { W, H, busX } = L;
  const R = rng(20270501 + Math.round(W / 40));
  const grid = new Grid(W, H);
  const b = new Builder();
  const vias: { x: number; y: number; s: number }[] = [];
  const small = W < 760;

  // keepouts: every section plus a lane for the main bus
  for (const s of L.sections) grid.markRect({ x: s.rect.x - 14, y: s.rect.y - 14, w: s.rect.w + 28, h: s.rect.h + 28 });
  grid.markRect({ x: busX - 18, y: 0, w: 36, h: H });
  // fixed nav strip at the top
  grid.markRect({ x: 0, y: 0, w: W, h: 70 });

  // branches from the bus to each section's edge connector
  for (const s of L.sections) {
    const y = s.branchY;
    const ex = s.rect.x - 8;
    const pts: Pt[] = ex - busX > 60
      ? [[busX, y], [busX + 14, y], [busX + 26, y + 12], [ex, y + 12]]
      : [[busX, y + 12], [ex, y + 12]];
    b.strip(pts, 3.2, 0.5, KIND.TRACE, y);
    b.rect(ex - 2, y + 2, 9, 20, 0, KIND.PAD);
    vias.push({ x: busX, y: pts[0][1], s: 1.15 });
  }

  // decorative bundles
  const tw = small ? 2.4 : 3;
  const sp = small ? 8 : 10;

  const tryBundle = (axis: 'v' | 'h', region: Rect, maxLen: number) => {
    const k = 2 + Math.floor(R() * (small ? 3 : 5));
    const span = (k - 1) * sp;
    for (let attempt = 0; attempt < 6; attempt++) {
      // center polyline
      const pts: Pt[] = [];
      let x: number, y: number;
      if (axis === 'v') {
        x = region.x + 12 + R() * Math.max(1, region.w - span - 24);
        y = region.y + R() * Math.max(1, region.h - 200);
      } else {
        x = region.x + R() * Math.max(1, region.w - 200);
        y = region.y + 10 + R() * Math.max(1, region.h - span - 20);
      }
      pts.push([x, y]);
      let left = (0.4 + R() * 0.6) * maxLen;
      while (left > 0) {
        const run = 50 + R() * 240;
        if (axis === 'v') y += run; else x += run;
        pts.push([x, y]);
        left -= run;
        if (left <= 0) break;
        let d = (20 + R() * 80) * (R() < 0.5 ? -1 : 1);
        if (axis === 'v') {
          if (x + d < region.x + 8 || x + d + span > region.x + region.w - 8) d = -d;
          if (x + d < region.x + 8 || x + d + span > region.x + region.w - 8) continue;
          x += d; y += Math.abs(d);
        } else {
          if (y + d < region.y + 6 || y + d + span > region.y + region.h - 6) d = -d;
          if (y + d < region.y + 6 || y + d + span > region.y + region.h - 6) continue;
          y += d; x += Math.abs(d);
        }
        pts.push([x, y]);
        left -= Math.abs(d) * 1.41;
      }
      if (pts.length < 2) continue;

      // offset copies, staggered ends so the vias do not collide
      const lines: Pt[][] = [];
      for (let j = 0; j < k; j++) {
        const o = j * sp;
        const line: Pt[] = pts.map(([px, py]) => (axis === 'v' ? [px + o, py] : [px, py + o]) as Pt);
        const st = (j % 2) * 14;
        const first = line[0];
        const last = line[line.length - 1];
        if (axis === 'v') { line.unshift([first[0], first[1] - 10 - st]); line.push([last[0], last[1] + 10 + st]); }
        else { line.unshift([first[0] - 10 - st, first[1]]); line.push([last[0] + 10 + st, last[1]]); }
        lines.push(line);
      }
      if (!lines.every((l) => grid.free(l, sp * 0.45 + 2))) continue;
      const seed = R();
      for (const l of lines) {
        grid.mark(l, sp * 0.5 + 2);
        b.strip(l, tw, (seed + R() * 0.3) % 1, KIND.TRACE, l[0][1]);
        const e0 = l[0], e1 = l[l.length - 1];
        vias.push({ x: e0[0], y: e0[1], s: 1 }, { x: e1[0], y: e1[1], s: 1 });
      }
      return true;
    }
    return false;
  };

  // vertical bundles in the side margins
  const leftM: Rect = { x: 0, y: 70, w: Math.max(0, busX - 24), h: H - 70 };
  const rightM: Rect = { x: L.contentRight + 20, y: 70, w: Math.max(0, W - L.contentRight - 20), h: H - 70 };
  for (const m of [leftM, rightM]) {
    if (m.w < 50) continue;
    const tries = Math.round((H / 160) * Math.min(2.2, m.w / 140));
    for (let i = 0; i < tries; i++) tryBundle('v', m, 900);
  }
  // horizontal bundles in the gaps between sections
  const secs = [...L.sections].sort((a, c) => a.rect.y - c.rect.y);
  for (let i = 0; i < secs.length - 1; i++) {
    const top = secs[i].rect.y + secs[i].rect.h + 16;
    const bot = secs[i + 1].rect.y - 16;
    if (bot - top < 40) continue;
    const gap: Rect = { x: busX + 22, y: top, w: W - busX - 30, h: bot - top };
    for (let t = 0; t < (small ? 3 : 7); t++) tryBundle('h', gap, small ? 260 : 600);
  }

  // SMD footprints with silkscreen outlines where there is room
  const footprints = Math.round((H / 300) * (small ? 0.5 : 1.4));
  for (let i = 0; i < footprints * 4; i++) {
    const pick = R();
    const cx = R() * W;
    const cy = 80 + R() * (H - 120);
    const seed = R();
    if (pick < 0.55) {
      // 0805 passive: two pads
      const vert = R() < 0.5;
      const w = vert ? 10 : 22, h = vert ? 22 : 10;
      const box: Pt[] = [[cx - 4, cy - 4], [cx + w + 4, cy + h + 4]];
      if (!grid.free(box, 6)) continue;
      grid.mark(box, 8);
      if (vert) { b.rect(cx, cy, 10, 7, seed, KIND.PAD); b.rect(cx, cy + 15, 10, 7, seed, KIND.PAD); }
      else { b.rect(cx, cy, 7, 10, seed, KIND.PAD); b.rect(cx + 15, cy, 7, 10, seed, KIND.PAD); }
      b.outline(cx - 4, cy - 4, w + 8, h + 8, 1, seed);
    } else if (!small) {
      // SOIC-8
      const box: Pt[] = [[cx - 8, cy - 8], [cx + 52, cy + 56]];
      if (!grid.free(box, 8)) continue;
      grid.mark(box, 10);
      for (let p = 0; p < 4; p++) {
        b.rect(cx, cy + p * 13, 12, 6, seed, KIND.PAD);
        b.rect(cx + 32, cy + p * 13, 12, 6, seed, KIND.PAD);
      }
      b.outline(cx + 15, cy - 6, 14, 57, 1.2, seed);
      b.rect(cx + 18, cy - 2, 3, 3, seed, KIND.SILK);
    }
  }

  // mounting holes in the top corners
  if (!small) {
    vias.push({ x: 26, y: 96, s: 3.4 }, { x: W - 26, y: 96, s: 3.4 });
  }

  return { geo: b.geometry(), vias };
}

/* ---------- runtime ---------- */

export function startBoard(canvas: HTMLCanvasElement) {
  let layout = measure();
  let fill = 0;
  let renderer: WebGLRenderer | null = null;

  const live = new WeakSet<HTMLElement>();
  const reveal = () => {
    for (const s of layout.sections) {
      if (!live.has(s.el) && fill >= s.branchY) { live.add(s.el); s.el.classList.add('is-live'); }
    }
  };

  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch {
    renderer = null;
  }

  if (!renderer) {
    // No WebGL: keep the reveal behaviour, skip the board.
    document.documentElement.classList.add('no-webgl');
    const tick = () => {
      fill = Math.max(fill, window.scrollY + window.innerHeight * 0.8);
      reveal();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return;
  }

  const r = renderer;
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  r.setClearColor(PAL.mask, 1);

  const scene = new Scene();
  const cam = new OrthographicCamera(0, 1, 0, -1, -10, 10);

  const uniforms = {
    uTime: { value: 0 },
    uFill: { value: 0 },
    uMask: { value: new Color(PAL.mask) },
    uDim: { value: new Color(PAL.dim) },
    uCopper: { value: new Color(PAL.copper) },
    uPad: { value: new Color(PAL.pad) },
    uHot: { value: new Color(PAL.hot) },
    uSilk: { value: new Color(PAL.silk) },
  };

  const boardMat = new ShaderMaterial({ uniforms, vertexShader: boardVert, fragmentShader: boardFrag, side: DoubleSide });
  const busMat = new ShaderMaterial({ uniforms: { ...uniforms, uGlow: { value: 0 } }, vertexShader: busVert, fragmentShader: busFrag, side: DoubleSide });
  const glowMat = new ShaderMaterial({
    uniforms: { ...uniforms, uGlow: { value: 1 } }, vertexShader: busVert, fragmentShader: busFrag,
    transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide,
  });
  const viaMat = new ShaderMaterial({ uniforms, vertexShader: viaVert, fragmentShader: viaFrag, side: DoubleSide });
  const viaGeo = new RingGeometry(2.6, 5.4, 20);

  let board: Mesh | null = null;
  let viaMesh: InstancedMesh | null = null;
  const bus = new Mesh(new PlaneGeometry(1, 1), busMat);
  const glow = new Mesh(new PlaneGeometry(1, 1), glowMat);
  bus.renderOrder = 2; glow.renderOrder = 3;
  scene.add(bus, glow);

  const build = () => {
    layout = measure();
    const { geo, vias } = generate(layout);
    if (board) { board.geometry.dispose(); scene.remove(board); }
    if (viaMesh) { scene.remove(viaMesh); viaMesh.dispose(); }
    board = new Mesh(geo, boardMat);
    board.renderOrder = 1;
    scene.add(board);

    viaMesh = new InstancedMesh(viaGeo, viaMat, vias.length);
    const m = new Matrix4();
    vias.forEach((v, i) => {
      m.makeScale(v.s, v.s, 1).setPosition(v.x, -v.y, 0);
      viaMesh!.setMatrixAt(i, m);
    });
    viaMesh.renderOrder = 4;
    scene.add(viaMesh);

    // main bus spans from the top of the first section to the bottom of the last
    const first = layout.sections[0]?.branchY ?? 0;
    const lastS = layout.sections[layout.sections.length - 1];
    const end = lastS ? lastS.branchY + 12 : layout.H;
    const len = end - first + 40;
    bus.scale.set(5, len, 1); bus.position.set(layout.busX, -(first - 40 + len / 2), 0);
    glow.scale.set(40, len, 1); glow.position.copy(bus.position);
  };

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    r.setSize(w, h, false);
    cam.right = w; cam.bottom = -h;
    cam.updateProjectionMatrix();
  };

  let pending = 0;
  const schedule = () => {
    clearTimeout(pending);
    pending = window.setTimeout(build, 140);
  };

  resize();
  build();
  window.addEventListener('resize', () => { resize(); schedule(); });
  new ResizeObserver(schedule).observe(document.body);
  document.fonts?.ready.then(schedule);

  const t0 = performance.now();
  let last = t0;
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const sy = window.scrollY;
    const vh = window.innerHeight;
    // near the bottom of the page the fill front runs ahead so the last screen lights up too
    const ratio = sy / Math.max(1, layout.H - vh);
    const tail = Math.max(0, Math.min(1, (ratio - 0.85) / 0.15));
    const target = Math.min(layout.H, sy + vh * (0.62 + 0.38 * tail));
    // critically damped glide toward the target: smooth regardless of frame rate
    fill += (target - fill) * (1 - Math.exp(-dt * 4.5));
    uniforms.uFill.value = fill;
    uniforms.uTime.value = (now - t0) / 1000;
    cam.position.y = -sy;
    r.render(scene, cam);
    reveal();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
