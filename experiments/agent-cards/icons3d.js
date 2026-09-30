// Renders each agent logo as a real 3D object (puffy bevelled extrusions,
// tubes and primitives under studio lighting). Every icon keeps its own
// scene; one shared WebGL renderer draws a frame into the card's 2D canvas
// at load, and only the hovered card keeps rendering while it animates.
// Shapes are authored in SVG coordinates (y down) inside a y-flipped group
// so they line up with the 2D drafts, unless a spec sets `flip: false`.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const SIZE = 560;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(SIZE, SIZE);
// Neutral keeps hues faithful (ACES pushed saturated blues toward violet).
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const pmrem = new THREE.PMREMGenerator(renderer);
const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// ───────── geometry helpers ─────────
const svg = new SVGLoader();
function shapesFromPath(d) {
  const data = svg.parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`);
  return data.paths.flatMap(p => SVGLoader.createShapes(p));
}
function roundedRect(x, y, w, h, r, shape = new THREE.Shape()) {
  r = Math.min(r, w / 2, h / 2);
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y); shape.absarc(x + w - r, y + r, r, -Math.PI / 2, 0);
  shape.lineTo(x + w, y + h - r); shape.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  shape.lineTo(x + r, y + h); shape.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  shape.lineTo(x, y + r); shape.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  return shape;
}
// A bevelled extrusion whose bevel is as deep as it is wide: the cross
// section becomes a rounded pillow, which is the soft "inflated" look. The
// bevel is inset, so the silhouette matches the shape exactly; keep `bevel`
// under half the narrowest width or the inset folds over itself.
function puff(shapes, { depth = 2, bevel = 6, seg = 16 } = {}) {
  let g = new THREE.ExtrudeGeometry(shapes, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
    bevelOffset: -bevel, bevelSegments: seg, curveSegments: 72,
  });
  g.translate(0, 0, -depth / 2);
  g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-3);
  g.computeVertexNormals();
  return g;
}
// Outward-bevel variant: safe on sharp tips (no inset inversion); the
// silhouette grows by `bevel`, which also rounds points.
function puffOut(shapes, { depth = 3, bevel = 3, seg = 12 } = {}) {
  let g = new THREE.ExtrudeGeometry(shapes, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
    bevelOffset: 0, bevelSegments: seg, curveSegments: 72,
  });
  g.translate(0, 0, -depth / 2);
  g.deleteAttribute('uv'); g = mergeVertices(g, 1e-3); g.computeVertexNormals();
  return g;
}
function ellipsoid(mat, [x, y, z], [sx, sy, sz], rotZ = 0) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), mat);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.z = rotZ;
  return m;
}
function tube(mat, pts, r, z = 0) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, zz = z]) => new THREE.Vector3(x, y, zz)));
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, r, 16, false), mat);
  for (const t of [0, 1]) { // round caps
    const cap = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
    cap.position.copy(curve.getPoint(t)); m.add(cap);
  }
  return m;
}
const deg = d => d * Math.PI / 180;
const smooth = (x, a, b) => THREE.MathUtils.smoothstep(x, a, b);
const wave = (t, f, ph = 0) => .5 + .5 * Math.sin(t * f + ph);

// Paints a colour ramp into a geometry (in its own space) along one axis, so
// a glossy object carries a light-to-deep gradient like the references.
function ramp(geo, c0, c1, axis = 'y', [lo, hi] = [null, null]) {
  geo.computeBoundingBox();
  const b = geo.boundingBox, min = lo ?? b.min[axis], max = hi ?? b.max[axis];
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  const a = new THREE.Color(c0), z = new THREE.Color(c1), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const v = axis === 'y' ? pos.getY(i) : axis === 'x' ? pos.getX(i) : pos.getZ(i);
    c.copy(a).lerp(z, smooth(v, min, max));
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
// A curved swoosh from base B to tip T, bowed toward the upper-left by
// `bend`, round at the base and tapering to a point: the wing feather.
function swoosh([bx, by], [tx, ty], W, bend, n = 64) {
  const dx = tx - bx, dy = ty - by, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
  const cx = (bx + tx) / 2 + nx * bend, cy = (by + ty) / 2 + ny * bend;
  const q = t => { const u = 1 - t; return [u * u * bx + 2 * u * t * cx + t * t * tx, u * u * by + 2 * u * t * cy + t * t * ty]; };
  const A = [], B = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, [x, y] = q(t), [xa, ya] = q(Math.max(t - .005, 0)), [xb, yb] = q(Math.min(t + .005, 1));
    const ex = xb - xa, ey = yb - ya, l = Math.hypot(ex, ey), mx = -ey / l, my = ex / l;
    const w = W * Math.pow(1 - t, 1.1) * (1 + .35 * Math.sin(Math.PI * t));
    A.push([x + mx * w, y + my * w]); B.push([x - mx * w, y - my * w]);
  }
  const s = new THREE.Shape();
  // base cap: a half circle joining the first offset points exactly
  const [x0, y0] = q(0), a0 = Math.atan2(B[0][1] - y0, B[0][0] - x0);
  s.absarc(x0, y0, W, a0, a0 - Math.PI, true); // round the back of the base, B side to A side
  A.forEach(p => s.lineTo(...p));
  B.slice().reverse().forEach(p => s.lineTo(...p));
  return s;
}
// A group whose origin is (x, y), holding children so they keep their place:
// rotating the group turns them about that point (a hinge or pivot).
function pivot(x, y, ...children) {
  const outer = new THREE.Group(); outer.position.set(x, y, 0);
  const inner = new THREE.Group(); inner.position.set(-x, -y, 0);
  inner.add(...children); outer.add(inner);
  return outer;
}
// A tube whose radius tapers from r0 to r1 along its length.
function taperTubeGeo(pts, r0, r1) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z = 0]) => new THREE.Vector3(x, y, z)));
  const T = 96, S = 32, geo = new THREE.TubeGeometry(curve, T, 1, S, false), pos = geo.attributes.position;
  const c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= T; i++) {
    curve.getPointAt(i / T, c); const r = r0 + (r1 - r0) * (i / T);
    for (let j = 0; j <= S; j++) { const k = i * (S + 1) + j; v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c); pos.setXYZ(k, v.x, v.y, v.z); }
  }
  geo.computeVertexNormals();
  return geo;
}

// ───────── materials ─────────
function phys(color, o = {}) {
  return new THREE.MeshPhysicalMaterial({
    color, roughness: .4, metalness: 0, clearcoat: .4, clearcoatRoughness: .3,
    envMapIntensity: 1, ...o,
  });
}
// Blue glass: deep and dark where the surface faces the viewer, brightening
// to a luminous azure where it turns away (edges, bevels), the way light
// reads through a thick glass letter. A Fresnel term is mixed into the
// physical material's final colour, so clearcoat highlights stay on top.
function glass(deep, rim, { power = 2.2, strength = .95, glow = .35, ...o } = {}) {
  const m = phys(deep, { roughness: .1, clearcoat: 1, clearcoatRoughness: .05, envMapIntensity: .55, ...o });
  const rimC = new THREE.Color(rim);
  m.onBeforeCompile = sh => {
    sh.uniforms.rimColor = { value: rimC };
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'uniform vec3 rimColor;\nvoid main() {')
      .replace('#include <opaque_fragment>', `
        float fres = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), ${power.toFixed(2)});
        outgoingLight = mix(outgoingLight, rimColor, fres * ${strength.toFixed(2)}) + rimColor * fres * ${glow.toFixed(2)};
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `glass-${rim}-${power}-${strength}-${glow}`;
  return m;
}

// ───────── the icons ─────────
// Each returns { group, tilt, fill, flip?, update?(p, t, dt), onEnter?() }.
// `p` is hover progress (0 at rest, eased to 1 while hovered), `t` seconds
// since the hover began. Every update is written so p = 0 is exactly the
// resting pose. `onEnter` fires when a hover starts from rest.
const icons = {
  claude() {
    const mat = phys('#ff5c0a', { roughness: .42, clearcoat: .3 });
    const g = new THREE.Group();
    const lens = [50, 43, 52, 45, 50, 42, 51, 44, 49, 43, 52, 46];
    const rays = lens.map((L, i) => {
      const m = new THREE.Mesh(puff(roundedRect(-6, -L, 12, L - 3, 6), { depth: 1, bevel: 5.6 }), mat);
      const arm = new THREE.Group(); arm.rotation.z = deg(i * 30 + 4); arm.position.z = (i % 2) * .6;
      arm.add(m); g.add(arm); return m;
    });
    g.add(ellipsoid(mat, [0, 0, 1], [11, 11, 7.5]));
    // hover: the burst turns and its rays breathe in a travelling wave
    let spin = 0;
    const update = (p, t, dt) => {
      spin += dt * p * 1.1; g.rotation.z = spin;
      rays.forEach((r, i) => { r.scale.y = 1 + p * .16 * Math.sin(t * 6 - i * .9); });
    };
    return { group: g, tilt: [deg(-8), deg(10)], fill: '#ff8a4a', update };
  },

  clawd() {
    // the Claude Code mascot: a blocky clay body on short legs with little
    // side arms and pixel eyes, shown straight on
    const clay = phys('#d97757', { roughness: .55, clearcoat: .15, clearcoatRoughness: .5 });
    const ink = phys('#1b1715', { roughness: .4 });
    const box = (w, h, d, r = 2.2) => new RoundedBoxGeometry(w, h, d, 5, r);
    const g = new THREE.Group();
    const body = new THREE.Group(); g.add(body);
    body.add(new THREE.Mesh(box(66, 44, 38, 3.2), clay));
    // legs: two pairs in front, two behind
    for (const z of [11, -11]) for (const x of [-25, -15, 15, 25]) {
      const leg = new THREE.Mesh(box(7.5, 18, 7.5, 1.6), clay); leg.position.set(x, -29, z); g.add(leg);
    }
    // arms hinged at the top inner edge of the shoulder
    const armGeo = box(11, 13, 16, 2); armGeo.translate(5.5, -6.5, 0);
    const right = new THREE.Group(); right.position.set(32, 2, 0); right.add(new THREE.Mesh(armGeo, clay)); body.add(right);
    const left = new THREE.Group(); left.position.set(-32, 2, 0); left.scale.x = -1; left.add(new THREE.Mesh(armGeo, clay)); body.add(left);
    // eyes: tall pixel blocks, plus happy "> <" chevrons that swap in
    const eyes = [-16, 16].map(x => { const e = new THREE.Mesh(box(6, 11, 3, 1), ink); e.position.set(x, 5, 19.2); body.add(e); return e; });
    const barGeo = box(8.6, 2.6, 2.4, .9);
    const chevrons = [-16, 16].map((x, i) => {
      const c = new THREE.Group(); c.position.set(x, 5, 19.4); c.scale.x = i === 0 ? 1 : -1; // ">" then "<"
      const a = Math.atan2(4, 6);
      const top = new THREE.Mesh(barGeo, ink); top.position.set(0, 2, 0); top.rotation.z = -a;
      const bot = new THREE.Mesh(barGeo, ink); bot.position.set(0, -2, 0); bot.rotation.z = a;
      c.add(top, bot); c.visible = false; body.add(c); return c;
    });
    const face = (happyL, happyR) => {
      [happyL, happyR].forEach((h, i) => { chevrons[i].visible = h; eyes[i].visible = !h; });
    };
    // each hover plays the next routine in turn
    const routines = ['wave', 'both', 'wink', 'hop'];
    let routine = routines.length - 1;
    const onEnter = () => { routine = (routine + 1) % routines.length; };
    const blinkAt = t => { const ph = t % 2.3; return ph > .9 && ph < 1.08 ? Math.sin((ph - .9) / .18 * Math.PI) : 0; };
    const update = (p, t) => {
      const on = p > .35, r = routines[routine];
      const waveR = r === 'wave' || r === 'both', waveL = r === 'both' || r === 'wink';
      right.rotation.z = p * (waveR ? 1.05 + .38 * Math.sin(t * 11) : .12 * Math.sin(t * 5.5));
      left.rotation.z = p * (waveL ? 1.05 + .38 * Math.sin(t * 11 + (r === 'both' ? Math.PI : 0)) : .12 * Math.sin(t * 5.5));
      // faces: happy squint for the wave and the hop, a one-eyed wink, and
      // ordinary blinking for the two-armed wave
      if (!on) face(false, false);
      else if (r === 'wave' || r === 'hop') face(true, true);
      else if (r === 'wink') face(false, true);
      else face(false, false);
      const b = r === 'both' && on ? blinkAt(t) : 0;
      eyes.forEach(e => { e.scale.y = 1 - .85 * b; });
      const hop = r === 'hop' ? 7 * Math.abs(Math.sin(t * 6)) : 1.6 * Math.abs(Math.sin(t * 5.5));
      g.position.y = p * hop;
      body.position.y = r === 'hop' ? -p * 1.5 * Math.pow(1 - Math.abs(Math.sin(t * 6)), 4) : 0; // squash on landing
    };
    return { group: g, tilt: [deg(4), 0], fill: '#ff9a6a', flip: false, update, onEnter };
  },

  codex() {
    // Three stadium loops at 0/60/120 degrees, woven as an alternating knot:
    // every 2D crossing is found, each loop alternates over/under along its
    // length, and the tube's depth rises and dips smoothly through them.
    const mat = phys('#f6f4f0', { roughness: .34, clearcoat: .55, clearcoatRoughness: .25 });
    const R = 7.6, N = 720;
    const base = roundedRect(-17, -42, 34, 84, 16.99).getSpacedPoints(N).slice(0, N);
    const loops = [0, 60, 120].map(a => {
      const c = Math.cos(deg(a)), sn = Math.sin(deg(a));
      return base.map(p => [p.x * c - p.y * sn, p.x * sn + p.y * c]);
    });
    // segment intersections between loops -> crossings with each loop's parameter
    const cross = loops.map(() => []);
    const hit = (a, b, c, d) => {
      const r = [b[0] - a[0], b[1] - a[1]], q = [d[0] - c[0], d[1] - c[1]];
      const den = r[0] * q[1] - r[1] * q[0]; if (Math.abs(den) < 1e-9) return null;
      const t = ((c[0] - a[0]) * q[1] - (c[1] - a[1]) * q[0]) / den;
      const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
      return t >= 0 && t < 1 && u >= 0 && u < 1 ? [t, u] : null;
    };
    const X = [];
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++)
      for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
        const h = hit(loops[i][a], loops[i][(a + 1) % N], loops[j][b], loops[j][(b + 1) % N]);
        if (h) { const x = { id: X.length, over: null, ends: [[i, (a + h[0]) / N], [j, (b + h[1]) / N]] }; X.push(x);
          cross[i].push({ x, s: (a + h[0]) / N, side: 0 }); cross[j].push({ x, s: (b + h[1]) / N, side: 1 }); }
      }
    cross.forEach(l => l.sort((m, n) => m.s - n.s));
    // alternate along each loop, propagating through shared crossings
    // (over === which side, 0 or 1, of the crossing is on top)
    const isOver = e => e.x.over === e.side;
    const queue = [[0, 0, true]], seen = new Set();
    while (queue.length) {
      const [li, k0, up] = queue.shift(); if (seen.has(li)) continue; seen.add(li);
      const L = cross[li];
      for (let k = 0; k < L.length; k++) {
        const e = L[(k0 + k) % L.length], want = k % 2 === 0 ? up : !up;
        if (e.x.over === null) {
          e.x.over = want ? e.side : 1 - e.side;
          const [oj] = e.x.ends[1 - e.side], other = cross[oj].findIndex(f => f.x === e.x);
          queue.push([oj, other, !want]);
        }
      }
    }
    const g = new THREE.Group();
    loops.forEach((pts, li) => {
      const zs = pts.map((_, a) => {
        const s0 = a / N; let z = 0;
        for (const e of cross[li]) {
          let d = Math.abs(s0 - e.s); d = Math.min(d, 1 - d);
          z += (isOver(e) ? 1 : -1) * R * 1.05 * Math.exp(-((d / .055) ** 2));
        }
        return z;
      });
      const curve = new THREE.CatmullRomCurve3(pts.map(([x, y], a) => new THREE.Vector3(x, y, zs[a])), true);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 720, R, 48, true), mat));
    });
    // hover: the knot turns slowly, like a rope being twisted
    let spin = 0;
    const update = (p, t, dt) => { spin += dt * p * .9; g.rotation.z = spin; g.rotation.x = p * .12 * Math.sin(t * 2); };
    return { group: g, tilt: [deg(6), deg(-8)], fill: '#ffffff', flip: false, update };
  },

  openclaw() {
    const red = phys('#f5301f', { roughness: .36, clearcoat: .55, clearcoatRoughness: .22 });
    const eye = phys('#080606', { roughness: .08, clearcoat: 1 });
    const g = new THREE.Group();
    // tail: ellipsoid segments along a curling spine, back to front
    const B = t => { const P = [[48, 58], [36, 58], [24, 66], [18, 80]]; const u = 1 - t;
      return [0, 1].map(k => u ** 3 * P[0][k] + 3 * u * u * t * P[1][k] + 3 * u * t * t * P[2][k] + t ** 3 * P[3][k]); };
    for (let i = 4; i >= 0; i--) {
      const t = .1 + i * .2, [x, y] = B(t), [x2, y2] = B(Math.min(t + .05, 1)), [x1, y1] = B(Math.max(t - .05, 0));
      g.add(ellipsoid(red, [x, y, 0], [6.6, 13.5 - 6 * t, (13.5 - 6 * t) * .8], Math.atan2(y2 - y1, x2 - x1)));
    }
    [[12, 86, 35], [19, 89, 80], [9, 79, 8]].forEach(([x, y, a]) => g.add(ellipsoid(red, [x, y, -1], [8, 4.3, 2.4], deg(a))));
    g.add(ellipsoid(red, [55, 49, 0], [20, 15.5, 13], deg(-28)));
    g.add(ellipsoid(red, [70, 41, 1], [9, 7.5, 8], deg(-28)));
    [[[46, 63], [42, 71], [37, 74]], [[52, 65], [50, 73], [46, 77]], [[58, 64], [59, 72], [57, 77]]]
      .forEach(pts => g.add(tube(red, pts, 1.7, -4)));
    const antennae = pivot(68, 35,
      tube(red, [[70, 36, 4], [68, 20, 6], [78, 8, 4], [100, 0, 0]], 1.15),
      tube(red, [[66, 35, 4], [60, 18, 5], [66, 2, 3], [84, -6, 0]], 1.05));
    g.add(antennae);
    // each claw: palm with the fixed finger, plus a hinged movable finger
    const palmGeo = puff(shapesFromPath('M1-9C10-17 20-16 26-9C28-5 29-2 27 0C33 2 40 5 44 8Q47 12 42 13C37 16 29 19 19 17C9 15 1 11-1 3C-2-2-1-6 1-9Z'), { depth: 6, bevel: 3.4, seg: 12 });
    const fingerGeo = puff(shapesFromPath('M18-12C26-20 40-18 46-9Q49-3 44-3C38-4 32-3 26-2C21-3 17-7 18-12Z'), { depth: 5, bevel: 3, seg: 12 });
    const fingers = [];
    const claw = (x, y, rot, s, z) => {
      const c = new THREE.Group(); c.position.set(x, y, z); c.rotation.z = deg(rot); c.scale.setScalar(s);
      c.add(new THREE.Mesh(palmGeo, red));
      const f = pivot(21, -8, new THREE.Mesh(fingerGeo, red)); c.add(f); fingers.push(f);
      return c;
    };
    g.add(tube(red, [[64, 46, 2], [72, 42, 3], [78, 38, 2]], 4.6));
    const upper = claw(77, 38, -28, 1.05, 1); g.add(upper);
    g.add(tube(red, [[64, 56, 5], [70, 61, 6], [76, 66, 5]], 5));
    const lower = claw(75, 66, 18, 1.12, 5); g.add(lower);
    g.add(ellipsoid(eye, [67.5, 40, 9.5], [3.4, 3.4, 3.4]));
    // hover: the claws snap open and shut, out of step, and the antennae sway
    const update = (p, t) => {
      fingers.forEach((f, i) => { f.rotation.z = p * (-.32 + .42 * Math.pow(wave(t, 7.5, i * 1.7), 2)); });
      upper.rotation.z = deg(-28) - p * .06 * Math.sin(t * 3.7);
      lower.rotation.z = deg(18) + p * .06 * Math.sin(t * 3.3 + 1);
      antennae.rotation.z = p * .1 * Math.sin(t * 2.4);
    };
    return { group: g, tilt: [deg(-10), deg(-8)], fill: '#ff6a58', update };
  },

  hermes() {
    const mat = glass('#ffffff', '#86d0ff', { vertexColors: true, power: 1.5, strength: .95, glow: .45, envMapIntensity: .4 });
    const g = new THREE.Group();
    // parallel swooshes, each hinged at its own base so the wing can flex
    const feathers = [
      [[22, 114], [118, 8], 14, -24, 0],
      [[46, 110], [124, 46], 9.5, -15, -4],
      [[60, 114], [124, 76], 8, -10, -8],
      [[72, 120], [118, 100], 6.5, -6, -12],
    ].map(([b, t, W, bend, z]) => {
      // deep at the base, brightening toward the tips
      const geo = ramp(puffOut(swoosh(b, t, W, bend), { depth: 5, bevel: 4 }), '#041a8c', '#2a7cff', 'x', [18, 126]);
      const m = new THREE.Mesh(geo, mat); m.position.z = z;
      const f = pivot(b[0], b[1], m); g.add(f); return f;
    });
    // hover: a wingbeat. The lower feathers fan open in a ripple that runs
    // down the wing, and the whole wing lifts a little on each stroke
    const update = (p, t) => {
      const beat = wave(t, 6.5);
      feathers.forEach((f, i) => { f.rotation.z = -p * (.03 * i + .09 * wave(t, 6.5, -i * .55)); });
      g.position.y = -p * 4 * beat;
    };
    return { group: g, tilt: [deg(-4), deg(12)], fill: '#78a8ff', update };
  },

  pi() {
    // round tubes throughout (torus bowl, capsule stem and stroke, sphere
    // dot): analytic surfaces with no bevel seams or faceted holes
    const graphite = phys('#3a3734', { roughness: .48, clearcoat: .4, clearcoatRoughness: .3 });
    const copper = phys('#c7865c', { roughness: .34, metalness: .35, clearcoat: .5, clearcoatRoughness: .25 });
    const dotMat = phys('#3b3835', { roughness: .3, clearcoat: .8, clearcoatRoughness: .15 });
    const g = new THREE.Group();
    const bowl = new THREE.Mesh(new THREE.TorusGeometry(20, 11.5, 72, 200), graphite); bowl.position.set(56, 60, 0); g.add(bowl);
    const stem = new THREE.Mesh(new THREE.CapsuleGeometry(11.5, 52, 24, 72), graphite); stem.position.set(36, 80, 0); g.add(stem);
    const i = new THREE.Mesh(new THREE.CapsuleGeometry(10.5, 22, 24, 72), copper); i.position.set(99.5, 76.5, 0); g.add(i);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(11.5, 72, 48), dotMat); dot.position.set(99.5, 34, 0); g.add(dot);
    // hover: the dot bounces on the i, squashing a touch as it lands
    const update = (p, t) => {
      const h = Math.abs(Math.sin(t * 4.2));
      dot.position.y = 34 - p * 12 * h;
      const squash = 1 - p * .12 * Math.pow(1 - h, 6);
      dot.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
    };
    return { group: g, tilt: [deg(-6), deg(-14)], fill: '#c59070', update };
  },

  kimi() {
    const mat = glass('#ffffff', '#72d2ff', { vertexColors: true, power: 1.4, strength: 1, glow: .55, envMapIntensity: .35, roughness: .06 });
    // one continuous K outline: stem, arm and leg share a single surface, so
    // every join is seamless; the ramp runs top (light) to bottom (deep)
    const geo = ramp(puff(shapesFromPath('M22 16H54V58L84 16H116L76 66L114 112H81L54 79V112H22Z'), { depth: 18, bevel: 6.5, seg: 14 }), '#2a62ff', '#030e5c', 'y', [16, 112]);
    const spin = pivot(68, 64, new THREE.Mesh(geo, mat));
    const g = new THREE.Group(); g.add(spin);
    // hover: the K turns back from its resting three-quarter angle to face
    // the viewer square on, reading as a proper K (the inner turn exactly
    // cancels the stage's resting yaw at p = 1)
    const update = p => { spin.rotation.y = -p * deg(26); };
    return { group: g, tilt: [deg(-6), deg(26)], fill: '#5b8cff', update };
  },

  deepseek() {
    // one smooth body: a sphere sculpted into a whale (round head, tapering
    // toward the tail) with the belly painted in, so there are no seams
    const skin = phys('#ffffff', { vertexColors: true, roughness: .28, clearcoat: .85, clearcoatRoughness: .15, envMapIntensity: .75 });
    const blueMat = phys('#0a74ff', { roughness: .26, clearcoat: .85, clearcoatRoughness: .15, emissive: '#0058ff', emissiveIntensity: .12, envMapIntensity: .75 });
    const eyeMat = phys('#06103a', { roughness: .08, clearcoat: 1 });
    const white = phys('#ffffff', { roughness: .2 });
    const cx = 54, cy = 70, rx = 42, ry = 30, rz = 25;
    const bodyGeo = new THREE.SphereGeometry(1, 128, 96), pos = bodyGeo.attributes.position;
    const col = new Float32Array(pos.count * 3), blue = new THREE.Color('#0a74ff'), belly = new THREE.Color('#eef4ff'), c = new THREE.Color();
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k), tail = smooth(x, -.1, 1);
      const X = cx + x * rx, Y = cy + y * ry * (1 - .4 * tail) - 10 * tail * tail, Z = z * rz * (1 - .35 * tail);
      pos.setXYZ(k, X, Y, Z);
      const line = cy + 9 + .1 * (X - cx); // belly boundary (SVG y is down)
      c.copy(blue).lerp(belly, smooth(Y, line - 2.5, line + 2.5));
      col.set([c.r, c.g, c.b], k * 3);
    }
    bodyGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    bodyGeo.computeVertexNormals();
    const g = new THREE.Group();
    g.add(new THREE.Mesh(bodyGeo, skin));
    // tail: a tapered stock rooted inside the body that bends (rather than
    // swinging rigidly) so its base never leaves the body; the flukes ride
    // on the tip
    const root = [76, 68], mid = [95, 48], tip = [102, 30];
    const rot = ([x, y], [ox, oy], a) => [ox + (x - ox) * Math.cos(a) - (y - oy) * Math.sin(a), oy + (x - ox) * Math.sin(a) + (y - oy) * Math.cos(a)];
    const stock = new THREE.Mesh(taperTubeGeo([root, mid, tip], 11, 4.4), blueMat); g.add(stock);
    const tipCap = new THREE.Mesh(new THREE.SphereGeometry(4.4, 24, 16), blueMat); g.add(tipCap);
    const flukes = pivot(tip[0], tip[1],
      ellipsoid(blueMat, [96, 21, 0], [11.5, 4.8, 3.2], deg(-128)),
      ellipsoid(blueMat, [111, 23, 0], [11.5, 4.8, 3.2], deg(-40)));
    g.add(flukes);
    const bend = a => {
      const m = rot(mid, root, a * .5), e = rot(tip, root, a);
      stock.geometry.dispose(); stock.geometry = taperTubeGeo([root, m, e], 11, 4.4);
      tipCap.position.set(e[0], e[1], 0);
      flukes.position.set(e[0], e[1], 0); flukes.rotation.z = a * 1.3;
    };
    bend(0);
    const eye = new THREE.Group(); eye.position.set(34, 62, 20.2);
    eye.add(ellipsoid(eyeMat, [0, 0, 0], [4.2, 4.2, 2.6]), ellipsoid(white, [-1.1, -1.3, 2.1], [1.1, 1.1, .6]));
    g.add(eye);
    // hover: a wink every couple of seconds while the tail wags
    const update = (p, t) => {
      bend(p * .26 * Math.sin(t * 7));
      const ph = t % 2.4, blink = ph > .25 && ph < .5 ? Math.sin((ph - .25) / .25 * Math.PI) : 0;
      eye.scale.y = 1 - .9 * blink * (p > .5 ? 1 : 0);
    };
    return { group: g, tilt: [deg(-8), deg(-14)], fill: '#a8c6ff', update };
  },

  local() {
    const g = new THREE.Group();
    const mk = (c, o) => phys(c, { roughness: .12, clearcoat: 1, clearcoatRoughness: .08, transparent: true, opacity: o, depthWrite: false, envMapIntensity: 1.4 });
    const slabGeo = puff(roundedRect(-34, -34, 68, 68, 12), { depth: 2, bevel: 2.4, seg: 8 });
    // resting close together; hover lifts them apart like a stack being fanned
    const slabs = [['#6f7078', .9], ['#b7bac2', .72], ['#e9ecf2', .62]].map(([c, o], i) => {
      const m = new THREE.Mesh(slabGeo, mk(c, o));
      m.rotation.set(deg(-62), 0, deg(45)); m.renderOrder = i; g.add(m); return m;
    });
    const rest = [-12, 0, 12], open = [-25, 0, 25];
    const update = (p, t) => {
      slabs.forEach((m, i) => { m.position.y = rest[i] + (open[i] - rest[i]) * p + p * 2 * Math.sin(t * 2.6 + i * 1.2); });
      g.rotation.y = p * .22 * Math.sin(t * 1.4);
    };
    update(0, 0);
    return { group: g, tilt: [0, 0], fill: '#ffffff', flip: false, update };
  },
};

// ───────── live stages ─────────
// Every icon keeps its own scene; one shared WebGL renderer draws whichever
// stage needs a frame and copies it into that card's 2D canvas. Only a
// hovered card renders continuously, so the page never holds more than one
// WebGL context however many cards it shows.
function stage(id) {
  const spec = icons[id]();
  const scene = new THREE.Scene();
  scene.environment = env; scene.environmentIntensity = .55;
  const root = new THREE.Group(), holder = new THREE.Group();
  if (spec.flip !== false) holder.scale.y = -1;
  holder.add(spec.group); root.add(holder);
  root.rotation.set(spec.tilt[0], spec.tilt[1], 0);
  scene.add(root);
  // frame the union of the resting and fully hovered poses so nothing clips
  const box = new THREE.Box3();
  for (const [p, t] of [[0, 0], [1, .2], [1, .6], [1, 1.1]]) { spec.update?.(p, t, 0); root.updateMatrixWorld(true); box.union(new THREE.Box3().setFromObject(root)); }
  spec.update?.(0, 0, 0);
  const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  root.position.sub(c);
  const fov = 22, cam = new THREE.PerspectiveCamera(fov, 1, 1, 5000);
  const r = Math.max(size.x, size.y) / 2 * 1.06;
  cam.position.set(0, 0, r / Math.tan(deg(fov / 2)) + size.z); cam.lookAt(0, 0, 0);
  // soft studio rig: key from upper-left, card-tinted fill from the planet
  // (lower-left), rim from behind
  const key = new THREE.DirectionalLight('#ffffff', 2.4); key.position.set(-1, 1.3, 1.5); scene.add(key);
  const fill = new THREE.DirectionalLight(spec.fill, .9); fill.position.set(-1.2, -1.1, .7); scene.add(fill);
  const rim = new THREE.DirectionalLight('#ffffff', 1.4); rim.position.set(1.3, .9, -1); scene.add(rim);
  scene.add(new THREE.HemisphereLight('#ffffff', spec.fill, .25));
  return { scene, cam, spec };
}
function draw(st, canvas) {
  renderer.setClearColor(0x000000, 0);
  renderer.render(st.scene, st.cam);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(renderer.domElement, 0, 0, canvas.width, canvas.height);
}

const reduce = matchMedia('(prefers-reduced-motion: reduce)');
for (const card of document.querySelectorAll('.agent-card')) {
  const id = card.dataset.agent;
  if (!icons[id]) continue;
  let st;
  try { st = stage(id); } catch (err) { console.error('3D icon failed for', id, err); continue; }
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = SIZE;
  card.querySelector('.icon').replaceChildren(canvas);
  draw(st, canvas);

  // hover animation: ease p toward the target, render while anything moves
  let p = 0, target = 0, t = 0, last = 0, running = false;
  const frame = now => {
    const dt = Math.min(.05, (now - last) / 1000 || 0); last = now;
    p += (target - p) * (1 - Math.exp(-dt * 7)); t += dt;
    const done = target === 0 && p < .003;
    if (done) p = 0;
    st.spec.update?.(p, t, dt); draw(st, canvas);
    if (done) { running = false; return; }
    requestAnimationFrame(frame);
  };
  const go = on => {
    if (reduce.matches || !st.spec.update) return;
    target = on ? 1 : 0;
    if (on && p < .05) { t = 0; st.spec.onEnter?.(); }
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
  };
  card.addEventListener('pointerenter', () => go(true));
  card.addEventListener('pointerleave', () => go(false));
  card.addEventListener('focus', () => go(true));
  card.addEventListener('blur', () => go(false));
}
