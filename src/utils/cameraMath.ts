export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface SphericalView {
  radius: number;
  phi: number;
  theta: number;
  target: Vec3;
}

export interface OrbitControlState {
  target: Vec3;
  theta: number;
  phi: number;
  radius: number;
  dTheta: number;
  dPhi: number;
  dRad: number;
  minR: number;
  maxR: number;
  minPhi: number;
  maxPhi: number;
  auto: boolean;
}

export type ViewPresetName = 'aerea' | 'paseo' | 'laguna' | 'rooftop';

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function lerp(start: number, end: number, alpha: number): number {
  return start + (end - start) * alpha;
}

/**
 * Cubic ease-in-out curve used for camera transitions.
 */
export function easeInOutCubic(t: number): number {
  const clamped = clamp(t, 0, 1);
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

/**
 * Converts a Cartesian camera position and look-at target into spherical orbit coordinates.
 */
export function computeSphericalView(pos: Vec3, target: Vec3): SphericalView {
  const ox = pos.x - target.x;
  const oy = pos.y - target.y;
  const oz = pos.z - target.z;
  const r = Math.hypot(ox, oy, oz) || 1;
  return {
    radius: r,
    phi: Math.acos(clamp(oy / r, -1, 1)),
    theta: Math.atan2(ox, oz),
    target: { x: target.x, y: target.y, z: target.z },
  };
}

/**
 * Normalizes target theta so the camera rotates via the shortest angular arc from fromTheta.
 */
export function shortestAngleTarget(fromTheta: number, toTheta: number): number {
  let th = toTheta;
  while (th - fromTheta > Math.PI) th -= Math.PI * 2;
  while (th - fromTheta < -Math.PI) th += Math.PI * 2;
  return th;
}

/**
 * Predefined architectural viewpoints for Vila Capivaras.
 */
export const CAMERA_VIEWS: Record<ViewPresetName, SphericalView> = {
  aerea: computeSphericalView({ x: 78, y: 86, z: 92 }, { x: 0, y: 0, z: -6 }),
  paseo: computeSphericalView({ x: 0, y: 2.0, z: 13 }, { x: 0, y: 1.9, z: -32 }),
  laguna: computeSphericalView({ x: -16, y: 3.6, z: -84 }, { x: 2, y: 6, z: -16 }),
  rooftop: computeSphericalView({ x: 3, y: 10.8, z: 29.5 }, { x: 0, y: 2.5, z: -70 }),
};

/**
 * Steps the orbital camera state with damping and constraints, returning the Cartesian eye position.
 */
export function stepOrbitCamera(ctl: OrbitControlState): Vec3 {
  ctl.theta += ctl.dTheta;
  ctl.phi += ctl.dPhi;
  ctl.radius *= 1 + ctl.dRad;

  ctl.dTheta *= 0.85;
  ctl.dPhi *= 0.85;
  ctl.dRad *= 0.8;

  ctl.phi = clamp(ctl.phi, ctl.minPhi, ctl.maxPhi);
  ctl.radius = clamp(ctl.radius, ctl.minR, ctl.maxR);
  ctl.target.y = clamp(ctl.target.y, 0.3, 60);
  ctl.target.x = clamp(ctl.target.x, -160, 160);
  ctl.target.z = clamp(ctl.target.z, -160, 120);

  const sp = Math.sin(ctl.phi);
  return {
    x: ctl.target.x + ctl.radius * sp * Math.sin(ctl.theta),
    y: ctl.target.y + ctl.radius * Math.cos(ctl.phi),
    z: ctl.target.z + ctl.radius * sp * Math.cos(ctl.theta),
  };
}

/**
 * Computes compass needle rotation in degrees from camera world direction (dirX, dirZ).
 */
export function computeCompassDegrees(dirX: number, dirZ: number): number {
  return (Math.atan2(dirX, dirZ) * 180) / Math.PI + 180;
}
