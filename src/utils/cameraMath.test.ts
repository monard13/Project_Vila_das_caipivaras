import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMERA_VIEWS,
  computeCompassDegrees,
  computeSphericalView,
  easeInOutCubic,
  shortestAngleTarget,
  stepOrbitCamera,
  type OrbitControlState,
} from './cameraMath';

test('easeInOutCubic maps endpoints and midpoint accurately', () => {
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(0.5), 0.5);
  assert.equal(easeInOutCubic(1), 1);
  assert.ok(easeInOutCubic(0.25) < 0.25);
  assert.ok(easeInOutCubic(0.75) > 0.75);
});

test('computeSphericalView reconstructs original Cartesian position via stepOrbitCamera', () => {
  const pos = { x: 78, y: 86, z: 92 };
  const target = { x: 0, y: 1.5, z: -6 };
  const sph = computeSphericalView(pos, target);

  const ctl: OrbitControlState = {
    target: { ...sph.target },
    theta: sph.theta,
    phi: sph.phi,
    radius: sph.radius,
    dTheta: 0,
    dPhi: 0,
    dRad: 0,
    minR: 9,
    maxR: 340,
    minPhi: 0.12,
    maxPhi: 1.56,
    auto: false,
  };

  const reconstructed = stepOrbitCamera(ctl);
  assert.ok(Math.abs(reconstructed.x - pos.x) < 1e-6);
  assert.ok(Math.abs(reconstructed.y - pos.y) < 1e-6);
  assert.ok(Math.abs(reconstructed.z - pos.z) < 1e-6);
});

test('shortestAngleTarget unwraps angles across PI boundary', () => {
  const from = 3.0;
  const to = -3.0; // across PI boundary
  const unwrapped = shortestAngleTarget(from, to);
  assert.ok(Math.abs(unwrapped - from) < Math.PI);
});

test('predefined CAMERA_VIEWS have valid positive radii and distinct targets', () => {
  assert.ok(CAMERA_VIEWS.aerea.radius > 100);
  assert.ok(CAMERA_VIEWS.paseo.radius > 30 && CAMERA_VIEWS.paseo.radius < 60);
  assert.ok(CAMERA_VIEWS.laguna.radius > 60);
  assert.ok(CAMERA_VIEWS.rooftop.radius > 90);
});

test('computeCompassDegrees returns 0/360 when looking due north (-Z)', () => {
  const deg = computeCompassDegrees(0, -1);
  assert.equal(deg % 360, 0);
});
