/** @responsibility Builds each agent's 3D figure as a Three.js scene and draws it through one shared WebGL renderer. Loaded on demand by AgentFigure, so Three.js is only fetched by a page that shows a figure. */

import * as THREE from "three"
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js"
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js"

/** The agents that have a figure. */
export type AgentFigureKind = "claude" | "codex" | "local"

/**
 * A figure's pose at hover progress `p` (0 at rest, 1 fully lively) and `t`
 * seconds since it came alive. Every update leaves p = 0 exactly at rest.
 */
type Update = (p: number, t: number, dt: number) => void

interface Spec {
  group: THREE.Group
  /** Rotation about x and y, in radians, so the figure reads in depth. */
  tilt: [number, number]
  /** The colour of the fill light, picked up in the figure's shadows. */
  fill: string
  /** Shapes are authored y-down, as in SVG, unless this is false. */
  flip?: boolean
  update: Update
}

/** Pixels each side the shared renderer draws at; figures scale it down. */
export const FIGURE_SIZE = 320

const deg = (d: number) => (d * Math.PI) / 180

function roundedRect(x: number, y: number, w: number, h: number, r: number) {
  const shape = new THREE.Shape()
  r = Math.min(r, w / 2, h / 2)
  shape.moveTo(x + r, y)
  shape.lineTo(x + w - r, y)
  shape.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false)
  shape.lineTo(x + w, y + h - r)
  shape.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false)
  shape.lineTo(x + r, y + h)
  shape.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false)
  shape.lineTo(x, y + r)
  shape.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false)
  return shape
}

/**
 * A bevelled extrusion whose bevel is as deep as it is wide, so the cross
 * section is a rounded pillow: the soft, inflated look. The bevel is inset,
 * so the outline matches the shape; keep it under half the narrowest width.
 */
function puff(shape: THREE.Shape, depth: number, bevel: number, segments = 16) {
  let geometry: THREE.BufferGeometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: segments,
    curveSegments: 72,
  })
  geometry.translate(0, 0, -depth / 2)
  geometry.deleteAttribute("uv")
  geometry = mergeVertices(geometry, 1e-3)
  geometry.computeVertexNormals()
  return geometry
}

function phys(color: string, options: THREE.MeshPhysicalMaterialParameters = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.4,
    metalness: 0,
    clearcoat: 0.4,
    clearcoatRoughness: 0.3,
    envMapIntensity: 1,
    ...options,
  })
}

/** Claude: a burst of twelve soft rays that turns and breathes when lively. */
function claude(): Spec {
  const material = phys("#ff5c0a", { roughness: 0.42, clearcoat: 0.3 })
  const group = new THREE.Group()
  const lengths = [50, 43, 52, 45, 50, 42, 51, 44, 49, 43, 52, 46]
  const rays = lengths.map((length, index) => {
    const ray = new THREE.Mesh(puff(roundedRect(-6, -length, 12, length - 3, 6), 1, 5.6), material)
    const arm = new THREE.Group()
    arm.rotation.z = deg(index * 30 + 4)
    arm.position.z = (index % 2) * 0.6
    arm.add(ray)
    group.add(arm)
    return ray
  })
  const core = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), material)
  core.position.set(0, 0, 1)
  core.scale.set(11, 11, 7.5)
  group.add(core)
  let spin = 0
  const update: Update = (p, t, dt) => {
    spin += dt * p * 1.1
    group.rotation.z = spin
    rays.forEach((ray, index) => {
      ray.scale.y = 1 + p * 0.16 * Math.sin(t * 6 - index * 0.9)
    })
  }
  return { group, tilt: [deg(-8), deg(10)], fill: "#ff8a4a", update }
}

/**
 * Codex: three stadium loops at 0, 60 and 120 degrees, woven as a knot.
 * Every crossing is found, each loop alternates over and under along its
 * length, and the tube rises and dips smoothly through them.
 */
function codex(): Spec {
  const material = phys("#f6f4f0", { roughness: 0.34, clearcoat: 0.55, clearcoatRoughness: 0.25 })
  const group = new THREE.Group()
  codexTubes ??= weaveCodex()
  for (const tube of codexTubes) group.add(new THREE.Mesh(tube, material))
  let spin = 0
  const update: Update = (p, t, dt) => {
    spin += dt * p * 0.9
    group.rotation.z = spin
    group.rotation.x = p * 0.12 * Math.sin(t * 2)
  }
  return { group, tilt: [deg(6), deg(-8)], fill: "#ffffff", flip: false, update }
}

/**
 * The knot's three tubes, built once per page: finding every crossing is the
 * costly part of any figure, and its answer never changes. Marked shared so a
 * figure's teardown leaves them for the next one.
 */
let codexTubes: THREE.TubeGeometry[] | null = null

function weaveCodex(): THREE.TubeGeometry[] {
  const radius = 7.6
  const count = 720
  const base = roundedRect(-17, -42, 34, 84, 16.99).getSpacedPoints(count).slice(0, count)
  const loops = [0, 60, 120].map((angle) => {
    const c = Math.cos(deg(angle))
    const s = Math.sin(deg(angle))
    return base.map((point) => [point.x * c - point.y * s, point.x * s + point.y * c] as const)
  })
  type Crossing = { over: number | null; ends: [[number, number], [number, number]] }
  type Mark = { x: Crossing; s: number; side: 0 | 1 }
  const marks: Mark[][] = loops.map(() => [])
  const hit = (
    a: readonly number[],
    b: readonly number[],
    c: readonly number[],
    d: readonly number[],
  ) => {
    const r = [b[0] - a[0], b[1] - a[1]]
    const q = [d[0] - c[0], d[1] - c[1]]
    const den = r[0] * q[1] - r[1] * q[0]
    if (Math.abs(den) < 1e-9) return null
    const t = ((c[0] - a[0]) * q[1] - (c[1] - a[1]) * q[0]) / den
    const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den
    return t >= 0 && t < 1 && u >= 0 && u < 1 ? [t, u] : null
  }
  for (let i = 0; i < 3; i++)
    for (let j = i + 1; j < 3; j++)
      for (let a = 0; a < count; a++)
        for (let b = 0; b < count; b++) {
          const h = hit(loops[i][a], loops[i][(a + 1) % count], loops[j][b], loops[j][(b + 1) % count])
          if (!h) continue
          const x: Crossing = {
            over: null,
            ends: [
              [i, (a + h[0]) / count],
              [j, (b + h[1]) / count],
            ],
          }
          marks[i].push({ x, s: (a + h[0]) / count, side: 0 })
          marks[j].push({ x, s: (b + h[1]) / count, side: 1 })
        }
  marks.forEach((list) => list.sort((m, n) => m.s - n.s))
  // Alternate along each loop, carrying the choice through shared crossings.
  const queue: [number, number, boolean][] = [[0, 0, true]]
  const seen = new Set<number>()
  while (queue.length) {
    const [loop, start, up] = queue.shift()!
    if (seen.has(loop)) continue
    seen.add(loop)
    const list = marks[loop]
    for (let k = 0; k < list.length; k++) {
      const mark = list[(start + k) % list.length]
      const want = k % 2 === 0 ? up : !up
      if (mark.x.over !== null) continue
      mark.x.over = want ? mark.side : 1 - mark.side
      const [other] = mark.x.ends[1 - mark.side]
      queue.push([other, marks[other].findIndex((m) => m.x === mark.x), !want])
    }
  }
  return loops.map((points, loop) => {
    const depths = points.map((_, a) => {
      const s0 = a / count
      let z = 0
      for (const mark of marks[loop]) {
        let d = Math.abs(s0 - mark.s)
        d = Math.min(d, 1 - d)
        z += (mark.x.over === mark.side ? 1 : -1) * radius * 1.05 * Math.exp(-((d / 0.055) ** 2))
      }
      return z
    })
    const curve = new THREE.CatmullRomCurve3(
      points.map(([x, y], a) => new THREE.Vector3(x, y, depths[a])),
      true,
    )
    const tube = new THREE.TubeGeometry(curve, 720, radius, 48, true)
    tube.userData.shared = true
    return tube
  })
}

/** Local AI: three glass slabs, close at rest, fanned apart when lively. */
function local(): Spec {
  const group = new THREE.Group()
  const glass = (color: string, opacity: number) =>
    phys(color, {
      roughness: 0.12,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      transparent: true,
      opacity,
      depthWrite: false,
      envMapIntensity: 1.4,
    })
  const slab = puff(roundedRect(-34, -34, 68, 68, 12), 2, 2.4, 8)
  const slabs = (
    [
      ["#6f7078", 0.9],
      ["#b7bac2", 0.72],
      ["#e9ecf2", 0.62],
    ] as const
  ).map(([color, opacity], index) => {
    const mesh = new THREE.Mesh(slab, glass(color, opacity))
    mesh.rotation.set(deg(-62), 0, deg(45))
    mesh.renderOrder = index
    group.add(mesh)
    return mesh
  })
  const rest = [-12, 0, 12]
  const open = [-25, 0, 25]
  const update: Update = (p, t) => {
    slabs.forEach((mesh, index) => {
      mesh.position.y =
        rest[index] + (open[index] - rest[index]) * p + p * 2 * Math.sin(t * 2.6 + index * 1.2)
    })
    group.rotation.y = p * 0.22 * Math.sin(t * 1.4)
  }
  update(0, 0, 0)
  return { group, tilt: [0, 0], fill: "#ffffff", flip: false, update }
}

const builders: Record<AgentFigureKind, () => Spec> = { claude, codex, local }

let shared: { renderer: THREE.WebGLRenderer; environment: THREE.Texture } | null = null

/**
 * One renderer for every figure on the page, so a page never holds more than
 * one WebGL context however many figures it shows. Null without WebGL.
 */
function renderer() {
  if (shared) return shared
  try {
    const instance = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    instance.setPixelRatio(1)
    instance.setSize(FIGURE_SIZE, FIGURE_SIZE)
    // Neutral keeps hues faithful; ACES pushes saturated blues toward violet.
    instance.toneMapping = THREE.NeutralToneMapping
    instance.outputColorSpace = THREE.SRGBColorSpace
    const environment = new THREE.PMREMGenerator(instance).fromScene(new RoomEnvironment(), 0.04).texture
    const context = { renderer: instance, environment }
    // A lost context is gone for good here: the next figure builds a new one.
    instance.domElement.addEventListener("webglcontextlost", () => {
      if (shared === context) shared = null
    })
    shared = context
    return shared
  } catch {
    return null
  }
}

/** A figure ready to draw: pose it, then copy a frame into a 2D canvas. */
export interface Figure {
  pose: Update
  /** False once the renderer it was built on is gone; build it again. */
  draw: (canvas: HTMLCanvasElement) => boolean
  /** Give back what it holds on the GPU. */
  dispose: () => void
}

/** Builds the figure for an agent, framed so no pose clips. Null without WebGL. */
export function createFigure(kind: AgentFigureKind): Figure | null {
  const context = renderer()
  if (!context) return null
  const spec = builders[kind]()
  const scene = new THREE.Scene()
  scene.environment = context.environment
  scene.environmentIntensity = 0.55
  const root = new THREE.Group()
  const holder = new THREE.Group()
  if (spec.flip !== false) holder.scale.y = -1
  holder.add(spec.group)
  root.add(holder)
  root.rotation.set(spec.tilt[0], spec.tilt[1], 0)
  scene.add(root)
  // Frame the union of the resting and lively poses so nothing clips.
  const box = new THREE.Box3()
  for (const [p, t] of [
    [0, 0],
    [1, 0.2],
    [1, 0.6],
    [1, 1.1],
  ]) {
    spec.update(p, t, 0)
    root.updateMatrixWorld(true)
    box.union(new THREE.Box3().setFromObject(root))
  }
  spec.update(0, 0, 0)
  const size = box.getSize(new THREE.Vector3())
  root.position.sub(box.getCenter(new THREE.Vector3()))
  const fov = 22
  const camera = new THREE.PerspectiveCamera(fov, 1, 1, 5000)
  const reach = (Math.max(size.x, size.y) / 2) * 1.06
  camera.position.set(0, 0, reach / Math.tan(deg(fov / 2)) + size.z)
  camera.lookAt(0, 0, 0)
  // A soft studio rig: key from the upper left, a tinted fill from the lower
  // left, and a rim from behind.
  const key = new THREE.DirectionalLight("#ffffff", 2.4)
  key.position.set(-1, 1.3, 1.5)
  const fill = new THREE.DirectionalLight(spec.fill, 0.9)
  fill.position.set(-1.2, -1.1, 0.7)
  const rim = new THREE.DirectionalLight("#ffffff", 1.4)
  rim.position.set(1.3, 0.9, -1)
  scene.add(key, fill, rim, new THREE.HemisphereLight("#ffffff", spec.fill, 0.25))
  return {
    pose: spec.update,
    draw(canvas) {
      if (shared !== context) return false
      context.renderer.setClearColor(0x000000, 0)
      context.renderer.render(scene, camera)
      const target = canvas.getContext("2d")
      if (!target) return true
      target.clearRect(0, 0, canvas.width, canvas.height)
      target.drawImage(context.renderer.domElement, 0, 0, canvas.width, canvas.height)
      return true
    },
    dispose() {
      scene.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return
        if (!node.geometry.userData.shared) node.geometry.dispose()
        const materials = Array.isArray(node.material) ? node.material : [node.material]
        for (const material of materials) material.dispose()
      })
    },
  }
}
