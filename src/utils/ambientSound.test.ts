import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AmbientSoundscape,
  BOSSA_NOVA_AUDIO_PATH,
  computeTargetMusicVolume,
  getDefaultMusicConfig,
} from './ambientSound';

test('getDefaultMusicConfig points to attached Bossa Nova m4a file and starts unmuted in loop', () => {
  const cfg = getDefaultMusicConfig();
  assert.equal(cfg.src, '/assets/aistudio/_BOSSA-NOVA-Instrumental_a5f00439.m4a');
  assert.equal(cfg.src, BOSSA_NOVA_AUDIO_PATH);
  assert.equal(cfg.loop, true);
  assert.equal(cfg.startMuted, false);
});

test('computeTargetMusicVolume returns 0 when muted and valid volume when active', () => {
  assert.equal(computeTargetMusicVolume(true, false), 0);
  assert.equal(computeTargetMusicVolume(true, true), 0);
  assert.ok(computeTargetMusicVolume(false, false) > 0.5);
  assert.ok(computeTargetMusicVolume(false, true) > 0.5);
});

test('AmbientSoundscape initializes unmuted by default and toggles mute state cleanly', () => {
  const player = new AmbientSoundscape();
  assert.equal(player.isMuted(), false);
  assert.equal(player.getAudioSrc(), BOSSA_NOVA_AUDIO_PATH);

  assert.equal(player.toggleMuted(), true);
  assert.equal(player.isMuted(), true);

  assert.equal(player.toggleMuted(), false);
  assert.equal(player.isMuted(), false);
  player.dispose();
});
