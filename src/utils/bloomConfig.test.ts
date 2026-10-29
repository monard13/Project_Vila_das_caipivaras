import test from 'node:test';
import assert from 'node:assert/strict';
import { computeBloomParams } from './bloomConfig';

test('computeBloomParams returns stronger warm glow and lower threshold at sunset', () => {
  const day = computeBloomParams(false, true);
  const sunset = computeBloomParams(true, true);

  assert.equal(day.enabled, true);
  assert.equal(sunset.enabled, true);
  assert.ok(sunset.strength > day.strength);
  assert.ok(sunset.radius > day.radius);
  assert.ok(sunset.threshold < day.threshold);
});

test('computeBloomParams zeroes strength when bloom is disabled', () => {
  const disabledDay = computeBloomParams(false, false);
  const disabledSunset = computeBloomParams(true, false);

  assert.equal(disabledDay.enabled, false);
  assert.equal(disabledDay.strength, 0);
  assert.equal(disabledSunset.enabled, false);
  assert.equal(disabledSunset.strength, 0);
});
