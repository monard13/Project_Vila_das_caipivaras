export const BOSSA_NOVA_AUDIO_PATH =
  '/assets/aistudio/_BOSSA-NOVA-Instrumental_a5f00439.m4a';

export interface MusicPlayerConfig {
  src: string;
  defaultVolume: number;
  sunsetVolume: number;
  loop: boolean;
  startMuted: boolean;
}

export function getDefaultMusicConfig(): MusicPlayerConfig {
  return {
    src: BOSSA_NOVA_AUDIO_PATH,
    defaultVolume: 0.65,
    sunsetVolume: 0.6,
    loop: true,
    startMuted: false,
  };
}

export function computeTargetMusicVolume(
  muted: boolean,
  isSunset: boolean,
  cfg: MusicPlayerConfig = getDefaultMusicConfig(),
): number {
  if (muted) return 0;
  return isSunset ? cfg.sunsetVolume : cfg.defaultVolume;
}

/**
 * Controller that plays the attached Bossa Nova instrumental audio file
 * (/assets/aistudio/_BOSSA-NOVA-Instrumental_a5f00439.m4a) in a continuous loop,
 * starting enabled by default and unlocking automatically on first user gesture if needed.
 */
export class AmbientSoundscape {
  private audio: HTMLAudioElement | null = null;
  private muted: boolean;
  private sunset = false;
  private readonly cfg: MusicPlayerConfig;
  private unlockHandler: (() => void) | null = null;

  constructor(cfg: MusicPlayerConfig = getDefaultMusicConfig()) {
    this.cfg = cfg;
    this.muted = cfg.startMuted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public getAudioSrc(): string {
    return this.cfg.src;
  }

  public startDefaultPlayback(): void {
    this.ensureAudioElement();
    this.applyPlaybackState();
  }

  public setMuted(mute: boolean): boolean {
    this.muted = mute;
    this.ensureAudioElement();
    this.applyPlaybackState();
    return this.muted;
  }

  public toggleMuted(): boolean {
    return this.setMuted(!this.muted);
  }

  public setSunsetMode(isSunset: boolean): void {
    this.sunset = isSunset;
    if (this.audio) {
      this.audio.volume = computeTargetMusicVolume(
        this.muted,
        this.sunset,
        this.cfg,
      );
    }
  }

  private ensureAudioElement(): void {
    if (this.audio || typeof window === 'undefined' || typeof Audio === 'undefined') {
      return;
    }
    const audio = new Audio(this.cfg.src);
    audio.loop = this.cfg.loop;
    audio.preload = 'auto';
    audio.volume = computeTargetMusicVolume(this.muted, this.sunset, this.cfg);
    this.audio = audio;
  }

  private applyPlaybackState(): void {
    if (!this.audio) return;
    this.audio.muted = this.muted;
    this.audio.volume = computeTargetMusicVolume(
      this.muted,
      this.sunset,
      this.cfg,
    );

    if (!this.muted) {
      const playPromise = this.audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // Browser autoplay policy blocked initial unmuted play; unlock on first user interaction
          this.registerGestureUnlock();
        });
      }
    } else {
      this.removeGestureUnlock();
      this.audio.pause();
    }
  }

  private registerGestureUnlock(): void {
    if (this.unlockHandler || typeof window === 'undefined') return;
    const unlock = () => {
      if (!this.muted && this.audio) {
        this.audio.muted = false;
        this.audio.volume = computeTargetMusicVolume(
          this.muted,
          this.sunset,
          this.cfg,
        );
        this.audio.play().catch(() => {});
      }
      this.removeGestureUnlock();
    };
    this.unlockHandler = unlock;
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    window.addEventListener('wheel', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
  }

  private removeGestureUnlock(): void {
    if (!this.unlockHandler || typeof window === 'undefined') return;
    window.removeEventListener('pointerdown', this.unlockHandler);
    window.removeEventListener('keydown', this.unlockHandler);
    window.removeEventListener('wheel', this.unlockHandler);
    window.removeEventListener('touchstart', this.unlockHandler);
    this.unlockHandler = null;
  }

  public dispose(): void {
    this.removeGestureUnlock();
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }
  }
}
