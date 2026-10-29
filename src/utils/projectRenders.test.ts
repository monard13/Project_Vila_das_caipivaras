import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROJECT_RENDERS,
  getRenderById,
  getRenderForView,
  getNextRenderId,
  getPrevRenderId,
} from './projectRenders';

test('PROJECT_RENDERS replaces old lagoon image with the 2 new Lagoa images and keeps pasagem and terraso', () => {
  assert.equal(PROJECT_RENDERS.length, 4);
  assert.equal(
    PROJECT_RENDERS[0].imageUrl,
    '/assets/aistudio/Lagoa_f88fe289.jpg',
  );
  assert.equal(
    PROJECT_RENDERS[1].imageUrl,
    '/assets/aistudio/Lagoa2_9326774f.jpg',
  );
  assert.equal(
    PROJECT_RENDERS[2].imageUrl,
    '/assets/aistudio/Vila_caipivaras_pasagem_35fc67ff.jpg',
  );
  assert.equal(
    PROJECT_RENDERS[3].imageUrl,
    '/assets/aistudio/Terraso_f020d851.jpg',
  );
  assert.equal(
    PROJECT_RENDERS.some((r) => r.imageUrl.includes('Vila_Caipivaras_Real')),
    false,
  );
  assert.equal(
    PROJECT_RENDERS.some((r) => r.imageUrl.includes('Vila_caipivaras_terraso')),
    false,
  );
});

test('getNextRenderId and getPrevRenderId cycle cleanly through all 4 renders', () => {
  assert.equal(getNextRenderId('lagoa'), 'lagoa2');
  assert.equal(getNextRenderId('lagoa2'), 'pasagem');
  assert.equal(getNextRenderId('pasagem'), 'terraso');
  assert.equal(getNextRenderId('terraso'), 'lagoa');

  assert.equal(getPrevRenderId('lagoa'), 'terraso');
  assert.equal(getPrevRenderId('terraso'), 'pasagem');
  assert.equal(getPrevRenderId('pasagem'), 'lagoa2');
  assert.equal(getPrevRenderId('lagoa2'), 'lagoa');
});

test('getRenderById and getRenderForView resolve matching camera presets', () => {
  assert.equal(getRenderById('lagoa').cameraView, 'laguna');
  assert.equal(getRenderById('lagoa2').cameraView, 'laguna');
  assert.equal(getRenderById('pasagem').cameraView, 'paseo');
  assert.equal(getRenderForView('laguna')?.id, 'lagoa');
  assert.equal(getRenderForView('rooftop')?.id, 'terraso');
});
