"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(callback: () => void) {
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

/** Returns the live, server-safe reduced-motion preference. */
function useReducedMotion() {
  return React.useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(reducedMotionQuery).matches,
    () => false,
  );
}

/**
 * A value the field moves to. A plain number is where it is, at once. A tween
 * says where it goes: from `from` (or wherever it is now) to `to`, after
 * `delay` ms, over `duration` ms. A new tween starts whenever the value given
 * changes, so a host walks the field by handing it the next value.
 */
export type BloomFieldValue =
  | number
  | {
      to: number;
      from?: number;
      /** Milliseconds before it starts moving. Defaults to 0. */
      delay?: number;
      /** Milliseconds it takes. Defaults to 0, which is a jump. */
      duration?: number;
      /** `"out"` decelerates; `"in-out"` eases both ends. Defaults to `"in-out"`. */
      easing?: "out" | "in-out";
    };

/** A point of light inside the field, such as one per choice on offer. */
export interface BloomFieldLight {
  /** Across the field, 0 (left) to 1 (right). */
  x: number;
  /** Down the field, 0 (top) to 1 (bottom). */
  y: number;
  /** Any CSS colour a canvas understands. */
  color: string;
  /**
   * How much it stands out: 0 is resting, 1 is pointed at, 2 is chosen. It
   * travels there over 300 ms, so a host only says which.
   */
  emphasis?: number;
}

/** The default palette: magenta, violet, amber, blue and lilac. */
const bloomFieldColors = Object.freeze([
  "#e2457a",
  "#8d5ad8",
  "#f09a4a",
  "#4b6cf0",
  "#b06ad8",
] as const);

export interface BloomFieldProps extends Omit<
  React.ComponentProps<"div">,
  "children"
> {
  /**
   * How far the colour reaches: about 0.1 is a small orb, 1 fills the field
   * and more floods past its edges. Defaults to 1.
   */
  spread?: BloomFieldValue;
  /** How much of the light is let through, 0 (black) to 1. Defaults to 1. */
  fade?: BloomFieldValue;
  /** Where the colour is centred across the field, 0 to 1. Defaults to 0.5. */
  x?: BloomFieldValue;
  /** Where the colour is centred down the field, 0 to 1. Defaults to 0.5. */
  y?: BloomFieldValue;
  /** A colour every bloom leans toward, by `tintAmount`. */
  tint?: string;
  /** How far the blooms lean toward `tint`, 0 to 1. Defaults to 0. */
  tintAmount?: BloomFieldValue;
  /** Up to three points of light drawn over the wash. */
  lights?: readonly BloomFieldLight[];
  /**
   * Fires a ring of light from (`rippleX`, `rippleY`) each time it changes.
   * Pass a counter. Nothing is drawn under reduced motion.
   */
  ripple?: number;
  /** Where a ripple starts across the field, 0 to 1. Defaults to 0.5. */
  rippleX?: number;
  /** Where a ripple starts down the field, 0 to 1. Defaults to 0.5. */
  rippleY?: number;
  /** Up to five CSS colours for the blooms. */
  colors?: readonly string[];
  /**
   * How much of the ground is see-through, 0 (all ground) to 1 (only the
   * blooms are drawn, over whatever is behind the field). At 1 the field is a
   * glow lying on the page rather than a surface. Defaults to 0.
   */
  clear?: BloomFieldValue;
  /** The colour behind the blooms. Defaults to a near-black violet. */
  ground?: string;
  /** How fast the blooms drift. Defaults to 0.3. */
  speed?: number;
  /**
   * Whether the blooms keep drifting once every value has arrived. Defaults
   * to true. Off, the field stops drawing as soon as it settles, which is what
   * a test that must leave nothing running wants.
   */
  ambient?: boolean;
  /** Drawing resolution as a share of the CSS size. Defaults to 0.7. */
  resolution?: number;
}

type Tween = {
  key: string;
  from: number;
  to: number;
  start: number;
  duration: number;
  easing: "out" | "in-out";
  /** Taken from the current value when the tween first runs. */
  fromCurrent: boolean;
};

type Channel =
  | "spread"
  | "fade"
  | "x"
  | "y"
  | "tint"
  | "clear"
  | "l0"
  | "l1"
  | "l2";
const CHANNELS: readonly Channel[] = [
  "spread",
  "fade",
  "x",
  "y",
  "tint",
  "clear",
  "l0",
  "l1",
  "l2",
];
const LIGHT_CHANNELS = ["l0", "l1", "l2"] as const;
const DEFAULTS: Record<Channel, number> = {
  spread: 1,
  fade: 1,
  x: 0.5,
  y: 0.5,
  tint: 0,
  clear: 0,
  l0: 0,
  l1: 0,
  l2: 0,
};
const EMPHASIS_MS = 300;
const RIPPLE_SECONDS = 2;

function valueKey(value: BloomFieldValue | undefined) {
  return value === undefined ? "" : JSON.stringify(value);
}

function ease(easing: "out" | "in-out", x: number) {
  if (easing === "out") return 1 - (1 - x) ** 3;
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

/** Where a tween is at `now`, and whether it has arrived. */
function sample(tween: Tween, current: number, now: number) {
  if (tween.fromCurrent) {
    tween.from = current;
    tween.fromCurrent = false;
  }
  if (tween.duration <= 0) {
    const arrived = now >= tween.start;
    return { value: arrived ? tween.to : tween.from, done: arrived };
  }
  const x = Math.min(1, Math.max(0, (now - tween.start) / tween.duration));
  return {
    value: tween.from + (tween.to - tween.from) * ease(tween.easing, x),
    done: x >= 1,
  };
}

const VERTEX = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";

/*
 * Five soft blooms drift about a centre and are blended by weight, so where
 * they overlap the colour is mixed rather than stacked. `spread` scales both
 * how far they wander and how large each one is, which is what lets one
 * value be a small orb, a full wash, and a flood past the edges.
 */
const FRAGMENT = `
precision highp float;
uniform vec2 uRes; uniform float uT;
uniform vec4 uWash; uniform vec4 uTint; uniform vec3 uGround;
uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform vec3 uC4;
uniform vec4 uL0; uniform vec4 uL1; uniform vec4 uL2;
uniform vec3 uLc0; uniform vec3 uLc1; uniform vec3 uLc2;
uniform vec4 uRip; uniform float uClear;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}
vec3 pal(int i){if(i==0)return uC0;if(i==1)return uC1;if(i==2)return uC2;if(i==3)return uC3;return uC4;}
vec3 light(vec2 uv,float asp,vec4 L,vec3 c){
  if(L.w<0.)return vec3(0.);
  vec2 d=vec2((uv.x-L.x)*asp,uv.y-L.y);float r2=dot(d,d);
  float hover=clamp(L.z,0.,1.),pick=clamp(L.z-1.,0.,1.);
  float bob=.5+.5*sin(uT*1.6+L.x*9.);
  float core=exp(-r2/(.00018+pick*.00025));
  float halo=exp(-r2/(.006+hover*.01+pick*.022+bob*.002));
  return c*halo*(.5+hover*.6+pick*.6)+vec3(1.)*core*.85;
}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  float asp=uRes.x/uRes.y;
  vec2 q=vec2((uv.x-uWash.x)*asp,uv.y-uWash.y);
  float g=uWash.z;
  vec3 acc=vec3(0.);float ws=0.;
  for(int i=0;i<5;i++){
    float k=float(i);
    vec2 c=vec2(sin(uT*(.7+k*.13)+k*1.7)*.42*asp,cos(uT*(.6+k*.11)+k*2.3)*.36)*mix(.1,1.,clamp(g,0.,1.));
    float r=mix(.06,.55,clamp(g,0.,1.4))*(1.+.15*sin(uT*1.3+k*2.));
    vec3 pc=mix(pal(i),uTint.rgb,uTint.a*(.55+.45*sin(k*1.9)));
    float w=exp(-dot(q-c,q-c)/(r*r));
    acc+=pc*w;ws+=w;
  }
  vec3 mesh=acc/max(ws,1e-3);
  float cover=clamp(ws*mix(1.8,1.1,clamp(g,0.,1.)),0.,1.);
  // Premultiplied: where no bloom covers it, a clear ground lets through
  // whatever is behind the field.
  float alpha=mix(1.-uClear,1.,cover);
  vec3 col=mix(uGround*(1.-uClear),mesh,cover);
  col+=.05*smoothstep(.55,1.,noise(uv*3.+uT*.15))*alpha;
  col*=uWash.w;
  col+=light(uv,asp,uL0,uLc0)+light(uv,asp,uL1,uLc1)+light(uv,asp,uL2,uLc2);
  if(uRip.w>0.){
    vec2 d=vec2((uv.x-uRip.x)*asp,uv.y-uRip.y);
    col+=vec3(1.,.96,1.)*exp(-pow((length(d)-uRip.z*.75)/.045,2.))*exp(-uRip.z*1.5)*uRip.w*.6;
  }
  col+=(hash(gl_FragCoord.xy+fract(uT)*91.)-.5)*.035*alpha;
  col=max(col,0.);
  gl_FragColor=vec4(col,max(alpha,min(1.,max(col.r,max(col.g,col.b)))));
}`;

/** A CSS colour as 0–1 RGB, read back through a 1×1 canvas. */
function rgb(
  color: string | undefined,
  fallback: [number, number, number],
): [number, number, number] {
  if (!color) return fallback;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return fallback;
  context.fillStyle = "#000";
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}

type Uniforms = Record<string, WebGLUniformLocation | null>;

function createProgram(gl: WebGLRenderingContext) {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
  };
  const vertex = compile(gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const position = gl.getAttribLocation(program, "p");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const uniforms: Uniforms = {};
  for (const name of [
    "uRes",
    "uT",
    "uWash",
    "uTint",
    "uGround",
    "uC0",
    "uC1",
    "uC2",
    "uC3",
    "uC4",
    "uL0",
    "uL1",
    "uL2",
    "uLc0",
    "uLc1",
    "uLc2",
    "uRip",
    "uClear",
  ])
    uniforms[name] = gl.getUniformLocation(program, name);
  return {
    uniforms,
    dispose() {
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      gl.deleteBuffer(buffer);
    },
  };
}

/** While a value is moving, every frame; once only the blooms drift, 30 a second. */
const AMBIENT_FRAME_MS = 1000 / 30;

/**
 * A living wash of colour drawn in WebGL: soft blooms that drift and blend,
 * which a host can gather into a small orb, spread to fill the field, or
 * flood past its edges. Points of light can sit over it — one per choice on
 * offer, brightening when pointed at and when chosen — and a ring of light can
 * be sent through it. It is a backdrop: decorative, inert to the pointer and
 * hidden from assistive technology.
 *
 * Hosts move it by handing it new values, as numbers to jump or tweens to
 * travel; `data-settled` is set once every value has arrived, which is what a
 * test should wait on. It stops drawing while off screen or in a hidden page.
 * Under reduced motion every value jumps and nothing drifts: one still frame
 * per change, and no ripple. Without WebGL it is the ground colour.
 *
 * With `clear` the ground turns see-through, so the blooms lie on whatever is
 * behind the field as a glow; tween it back to 0 and the field becomes a
 * surface again.
 */
function BloomField({
  spread = DEFAULTS.spread,
  fade = DEFAULTS.fade,
  x = DEFAULTS.x,
  y = DEFAULTS.y,
  tint,
  tintAmount = DEFAULTS.tint,
  lights,
  ripple,
  clear = DEFAULTS.clear,
  rippleX = 0.5,
  rippleY = 0.5,
  colors = bloomFieldColors,
  ground = "#06050c",
  speed = 0.3,
  ambient = true,
  resolution = 0.7,
  className,
  style,
  ...props
}: BloomFieldProps) {
  const reducedMotion = useReducedMotion();
  const root = React.useRef<HTMLDivElement>(null);
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const current = React.useRef<Record<Channel, number>>({ ...DEFAULTS });
  const tweens = React.useRef<Partial<Record<Channel, Tween>>>({});
  const wake = React.useRef<() => void>(() => {});
  const rippleAt = React.useRef<number | undefined>(undefined);
  const lastRipple = React.useRef(ripple);
  const shown = (lights ?? []).slice(0, 3);
  const given: Record<Channel, BloomFieldValue> = {
    spread,
    fade,
    x,
    y,
    tint: tintAmount,
    clear,
    l0: { to: shown[0]?.emphasis ?? 0, duration: EMPHASIS_MS, easing: "out" },
    l1: { to: shown[1]?.emphasis ?? 0, duration: EMPHASIS_MS, easing: "out" },
    l2: { to: shown[2]?.emphasis ?? 0, duration: EMPHASIS_MS, easing: "out" },
  };
  const keys = CHANNELS.map((channel) => valueKey(given[channel])).join("|");
  // What the draw loop reads that is not a tween. Kept in a ref so a change
  // to any of it redraws without tearing the renderer down.
  const scene = React.useRef({ tint, lights: shown, rippleX, rippleY });
  scene.current = { tint, lights: shown, rippleX, rippleY };
  const lightKey = JSON.stringify(
    shown.map((light) => [light.x, light.y, light.color]),
  );

  // A changed value becomes a new tween, started now. A value that has not
  // changed keeps the tween it already has, so a re-render mid-flight does
  // not restart it.
  React.useLayoutEffect(() => {
    const now = performance.now();
    for (const channel of CHANNELS) {
      const value = given[channel];
      const key = valueKey(value);
      const running = tweens.current[channel];
      if (running?.key === key) {
        // Asked to stop moving mid-flight: what is still travelling arrives now.
        if (reducedMotion) {
          running.start = Math.min(running.start, now);
          running.duration = 0;
        }
        continue;
      }
      if (typeof value === "number") {
        tweens.current[channel] = {
          key,
          from: value,
          to: value,
          start: now,
          duration: 0,
          easing: "in-out",
          fromCurrent: false,
        };
        current.current[channel] = value;
      } else {
        const moving = !reducedMotion;
        tweens.current[channel] = {
          key,
          from: value.from ?? current.current[channel],
          to: value.to,
          start: moving ? now + Math.max(0, value.delay ?? 0) : now,
          duration: moving ? Math.max(0, value.duration ?? 0) : 0,
          easing: value.easing ?? "in-out",
          fromCurrent: value.from === undefined,
        };
      }
    }
    root.current?.removeAttribute("data-settled");
    wake.current();
    // `keys` stands for every value; `given` is rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, reducedMotion]);

  // A new ripple count fires a ring; the count it mounted with does not, and
  // neither does a count it has already seen.
  React.useLayoutEffect(() => {
    if (ripple === undefined || ripple === lastRipple.current) return;
    lastRipple.current = ripple;
    if (reducedMotion) return;
    rippleAt.current = performance.now();
    root.current?.removeAttribute("data-settled");
    wake.current();
  }, [ripple, reducedMotion]);

  // Anything else that changes the picture redraws it.
  React.useLayoutEffect(() => {
    wake.current();
  }, [tint, lightKey, rippleX, rippleY]);

  const palette = colors.slice(0, 5).join("|");
  React.useEffect(() => {
    const element = canvas.current;
    const host = root.current;
    if (!element || !host) return;
    const gl = element.getContext("webgl", {
      antialias: false,
      alpha: true,
      premultipliedAlpha: true,
      depth: false,
    });
    // Without WebGL the field is its ground colour, which never moves.
    if (!gl) {
      host.setAttribute("data-fallback", "true");
      host.setAttribute("data-settled", "true");
      return;
    }
    const blooms = palette.split("|");
    const fixed = {
      ground: rgb(ground, [0.02, 0.02, 0.05]),
      colors: [0, 1, 2, 3, 4].map((index) =>
        rgb(blooms[index % blooms.length], [0.55, 0.35, 0.85]),
      ),
    };
    let program = createProgram(gl);
    let frame = 0;
    let lastDraw = 0;
    let visible = true;
    let pageShown = document.visibilityState !== "hidden";
    const born = performance.now();
    let colorKey = "";
    let resolved = { tint: [0, 0, 0] as number[], lights: [] as number[][] };

    const size = () => {
      const scale =
        Math.max(0.1, Math.min(2, resolution)) *
        Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(1, Math.round(host.clientWidth * scale));
      const height = Math.max(1, Math.round(host.clientHeight * scale));
      if (element.width === width && element.height === height) return false;
      element.width = width;
      element.height = height;
      return true;
    };

    const draw = (now: number, drifting: boolean) => {
      if (!program) return;
      const u = program.uniforms;
      const live = scene.current;
      const nextColorKey = JSON.stringify([
        live.tint,
        live.lights.map((light) => light.color),
      ]);
      if (nextColorKey !== colorKey) {
        colorKey = nextColorKey;
        resolved = {
          tint: rgb(live.tint, [1, 1, 1]),
          lights: live.lights.map((light) => rgb(light.color, [1, 1, 1])),
        };
      }
      const values = current.current;
      gl.viewport(0, 0, element.width, element.height);
      gl.uniform2f(u.uRes, element.width, element.height);
      gl.uniform1f(u.uT, drifting ? ((now - born) / 1000) * speed : 0);
      // The API reads y down the field; the drawing reads it up.
      gl.uniform4f(u.uWash, values.x, 1 - values.y, values.spread, values.fade);
      gl.uniform4f(
        u.uTint,
        resolved.tint[0],
        resolved.tint[1],
        resolved.tint[2],
        live.tint ? values.tint : 0,
      );
      gl.uniform3fv(u.uGround, fixed.ground);
      gl.uniform1f(u.uClear, Math.min(1, Math.max(0, values.clear)));
      fixed.colors.forEach((color, index) =>
        gl.uniform3fv(u[`uC${index}`], color),
      );
      LIGHT_CHANNELS.forEach((channel, index) => {
        const light = live.lights[index];
        if (light)
          gl.uniform4f(
            u[`uL${index}`],
            light.x,
            1 - light.y,
            values[channel],
            1,
          );
        else gl.uniform4f(u[`uL${index}`], 0, 0, 0, -1);
        gl.uniform3fv(u[`uLc${index}`], resolved.lights[index] ?? [1, 1, 1]);
      });
      const age =
        rippleAt.current === undefined
          ? RIPPLE_SECONDS
          : (now - rippleAt.current) / 1000;
      gl.uniform4f(
        u.uRip,
        live.rippleX,
        1 - live.rippleY,
        age,
        age < RIPPLE_SECONDS ? 1 : 0,
      );
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const tick = (now: number) => {
      frame = 0;
      let moving = false;
      for (const channel of CHANNELS) {
        const tween = tweens.current[channel];
        if (!tween) continue;
        const { value, done } = sample(tween, current.current[channel], now);
        current.current[channel] = value;
        if (!done) moving = true;
      }
      const rippling =
        rippleAt.current !== undefined &&
        (now - rippleAt.current) / 1000 < RIPPLE_SECONDS;
      if (!moving && !rippling) host.setAttribute("data-settled", "true");
      const drifting = ambient && !reducedMotion;
      if (
        moving ||
        rippling ||
        lastDraw === 0 ||
        now - lastDraw >= AMBIENT_FRAME_MS
      ) {
        draw(now, drifting);
        lastDraw = now;
      }
      if ((moving || rippling || drifting) && visible && pageShown)
        frame = requestAnimationFrame(tick);
    };
    const start = () => {
      if (frame || !visible || !pageShown) return;
      lastDraw = 0;
      frame = requestAnimationFrame(tick);
    };
    wake.current = start;

    const resize = new ResizeObserver(() => {
      if (size()) start();
    });
    resize.observe(host);
    const seen = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (visible) start();
    });
    seen.observe(host);
    const onVisibility = () => {
      pageShown = document.visibilityState !== "hidden";
      if (pageShown) start();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const onLost = (event: Event) => {
      event.preventDefault();
      program = null;
    };
    const onRestored = () => {
      program = createProgram(gl);
      colorKey = "";
      start();
    };
    element.addEventListener("webglcontextlost", onLost);
    element.addEventListener("webglcontextrestored", onRestored);
    size();
    start();
    return () => {
      cancelAnimationFrame(frame);
      wake.current = () => {};
      resize.disconnect();
      seen.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      element.removeEventListener("webglcontextlost", onLost);
      element.removeEventListener("webglcontextrestored", onRestored);
      program?.dispose();
      // The context itself lives until the canvas is collected; shrinking the
      // canvas gives its drawing memory back now. A later run sizes it again.
      element.width = element.height = 1;
    };
  }, [palette, ground, speed, ambient, resolution, reducedMotion]);

  return (
    <div
      ref={root}
      aria-hidden="true"
      data-slot="bloom-field"
      className={cn(
        "pointer-events-none relative overflow-hidden data-[fallback]:bg-[var(--nessa-bloom-field-ground)]",
        className,
      )}
      style={
        {
          "--nessa-bloom-field-ground": ground,
          ...style,
        } as React.CSSProperties
      }
      {...props}
    >
      <canvas ref={canvas} className="absolute inset-0 block size-full" />
    </div>
  );
}

export { BloomField, bloomFieldColors };
