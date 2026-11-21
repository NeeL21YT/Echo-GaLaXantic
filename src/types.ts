// Shared engine types (build_spec §5.1). World coordinates are metres, +y = north/forward.

export type Vec2 = { x: number; y: number };
export type Segment = { a: Vec2; b: Vec2; kind: 'wall' };
export type Pole = { c: Vec2; r: number; kind: 'pole' };
export type World = {
  segments: Segment[];
  poles: Pole[];
  exit?: { a: Vec2; b: Vec2 };
  bounds: { w: number; h: number };
};
// 0° = +y (forward/north), clockwise positive.
export type Pose = { p: Vec2; headingDeg: number };
export type Hit = {
  rayIndex: number;
  rayAngleDeg: number;
  relAzDeg: number;
  d: number;
  point: Vec2;
  cosTheta: number;
  reflectance: number;
};
export type EchoVoice = { delayS: number; gain: number; cutoffHz: number; azDeg: number; d: number };
