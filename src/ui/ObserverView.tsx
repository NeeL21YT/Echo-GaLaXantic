// Top-down Canvas 2D view for sighted spectators (§9.1). World +y is up on screen, so y is flipped here only.
import { useEffect, useRef } from 'react';
import { MAX_RANGE_M, OBSERVER, RAY_COUNT, RAY_STEP_DEG } from '../config';
import { spokenNumber } from '../levels/feedback';
import { makeVoice } from '../engine/echoBuilder';
import { dirFromHeading } from '../engine/geometry';
import type { Hit, Pose, Vec2, World } from '../types';

type Props = {
  world: World | null;
  pose: Pose;
  hits: Hit[];
  /** Pose the hits were cast from (the player may have moved since). */
  rayPose: Pose | null;
  shotId: number;
  hideWorld?: boolean;
};

const ACCENT = '#7CF5FF';
const WALL = '#e8e8e8';

type View = { s: number; ox: number; oy: number; mid: Vec2 };

function worldBounds(world: World | null, pose: Pose): { min: Vec2; max: Vec2 } {
  const pts: Vec2[] = [pose.p];
  if (world) {
    for (const seg of world.segments) pts.push(seg.a, seg.b);
    for (const pole of world.poles) pts.push(pole.c);
    if (world.exit) pts.push(world.exit.a, world.exit.b);
  }
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { min: { x: Math.min(...xs), y: Math.min(...ys) }, max: { x: Math.max(...xs), y: Math.max(...ys) } };
}

function makeView(world: World | null, pose: Pose, w: number, h: number): View {
  const { min, max } = worldBounds(world, pose);
  const spanX = Math.max(max.x - min.x, 1);
  const spanY = Math.max(max.y - min.y, 1);
  const fit = Math.min((w - 2 * OBSERVER.marginPx) / spanX, (h - 2 * OBSERVER.marginPx) / spanY);
  // 60 px/m by spec; shrink only when the world wouldn't fit the panel.
  const s = Math.max(1, Math.min(OBSERVER.pxPerM, fit));
  return { s, ox: w / 2, oy: h / 2, mid: { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2 } };
}

const toScreen = (v: View, p: Vec2): [number, number] => [v.ox + (p.x - v.mid.x) * v.s, v.oy - (p.y - v.mid.y) * v.s];

function draw(ctx: CanvasRenderingContext2D, props: Props, w: number, h: number, progress: number) {
  const { world, pose, hits, rayPose, hideWorld } = props;
  const view = makeView(world, pose, w, h);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);

  if (world && !hideWorld) {
    ctx.strokeStyle = WALL;
    ctx.lineWidth = OBSERVER.wallPx;
    ctx.lineCap = 'round';
    for (const seg of world.segments) {
      ctx.beginPath();
      ctx.moveTo(...toScreen(view, seg.a));
      ctx.lineTo(...toScreen(view, seg.b));
      ctx.stroke();
    }
    ctx.fillStyle = WALL;
    for (const pole of world.poles) {
      const [x, y] = toScreen(view, pole.c);
      ctx.beginPath();
      ctx.arc(x, y, Math.max(pole.r * view.s, 2), 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  if (rayPose && !hideWorld && progress > 0) {
    const byRay = new Map<number, Hit>();
    let maxGain = 0;
    const gains = new Map<number, number>();
    for (const hit of hits) {
      byRay.set(hit.rayIndex, hit);
      const g = makeVoice(hit.d, hit.relAzDeg, hit.reflectance, hit.cosTheta, 1).gain;
      gains.set(hit.rayIndex, g);
      maxGain = Math.max(maxGain, g);
    }
    const origin = toScreen(view, rayPose.p);
    const reach = progress * MAX_RANGE_M;
    ctx.lineWidth = 1;
    for (let i = 0; i < RAY_COUNT; i++) {
      const hit = byRay.get(i);
      const dir = dirFromHeading(rayPose.headingDeg + i * RAY_STEP_DEG);
      const len = Math.min(reach, hit ? hit.d : MAX_RANGE_M);
      const end = toScreen(view, { x: rayPose.p.x + dir.x * len, y: rayPose.p.y + dir.y * len });
      ctx.globalAlpha = hit ? OBSERVER.hitRayAlpha : OBSERVER.escapedAlpha * (1 - progress / 2);
      ctx.strokeStyle = ACCENT;
      ctx.beginPath();
      ctx.moveTo(...origin);
      ctx.lineTo(...end);
      ctx.stroke();
      if (hit && reach >= hit.d) {
        const g = maxGain > 0 ? (gains.get(i) ?? 0) / maxGain : 0;
        ctx.globalAlpha = Math.max(OBSERVER.minHitAlpha, g);
        ctx.fillStyle = ACCENT;
        ctx.beginPath();
        ctx.arc(end[0], end[1], OBSERVER.hitDotPx, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // Player: a triangle pointing along the heading.
  const size = OBSERVER.playerSizeM;
  const fwd = dirFromHeading(pose.headingDeg);
  const right = { x: fwd.y, y: -fwd.x };
  const p = pose.p;
  const tip = { x: p.x + fwd.x * size, y: p.y + fwd.y * size };
  const bl = { x: p.x - fwd.x * size * 0.6 - right.x * size * 0.6, y: p.y - fwd.y * size * 0.6 - right.y * size * 0.6 };
  const br = { x: p.x - fwd.x * size * 0.6 + right.x * size * 0.6, y: p.y - fwd.y * size * 0.6 + right.y * size * 0.6 };
  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.moveTo(...toScreen(view, tip));
  ctx.lineTo(...toScreen(view, bl));
  ctx.lineTo(...toScreen(view, br));
  ctx.closePath();
  ctx.fill();
}

export function ObserverView(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const progressRef = useRef(0);

  // Redraw on any prop change or resize, keeping the canvas sharp on high-DPI screens.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const redraw = () => {
      const dpr = window.devicePixelRatio || 1;
      const { clientWidth: w, clientHeight: h } = canvas;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(ctx, propsRef.current, w, h, progressRef.current);
    };
    redraw();
    const ro = new ResizeObserver(redraw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [props.world, props.pose, props.hits, props.rayPose, props.hideWorld]);

  // Animate the rays outward for each new click.
  useEffect(() => {
    if (props.shotId === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      progressRef.current = Math.min(1, (now - t0) / OBSERVER.rayAnimMs);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        draw(ctx, propsRef.current, canvas.clientWidth, canvas.clientHeight, progressRef.current);
      }
      if (progressRef.current < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [props.shotId]);

  const summary =
    props.rayPose && !props.hideWorld
      ? `Observer view. ${spokenNumber(props.hits.length)} of ${spokenNumber(RAY_COUNT)} rays returned an echo.`
      : 'Observer view.';

  return <canvas ref={canvasRef} className="observer-canvas" role="img" aria-label={summary} />;
}
