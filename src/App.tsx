/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { HudOverlay } from './components/HudOverlay';
import {
  buildVilaCapivarasScene,
  type VilaCapivarasSceneController,
} from './scene/buildVilaCapivarasScene';
import { AmbientSoundscape } from './utils/ambientSound';
import { computeBloomParams } from './utils/bloomConfig';
import {
  CAMERA_VIEWS,
  computeCompassDegrees,
  easeInOutCubic,
  lerp,
  shortestAngleTarget,
  stepOrbitCamera,
  type OrbitControlState,
  type SphericalView,
  type ViewPresetName,
} from './utils/cameraMath';

interface TweenState {
  active: boolean;
  t: number;
  dur: number;
  from: SphericalView;
  to: SphericalView;
}

const isSoftwareGl = (() => {
  if (typeof document === 'undefined') return false;
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return true;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
  const gpu = String(gl.getParameter(param));
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
})();

export default function App() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const needleRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const bloomPassRef = useRef<UnrealBloomPass | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneCtrlRef = useRef<VilaCapivarasSceneController | null>(null);
  const soundscapeRef = useRef<AmbientSoundscape | null>(null);
  const syncRenderRef = useRef<(() => void) | null>(null);
  const bloomEnabledRef = useRef(true);
  const sunsetRef = useRef(false);

  const [activeView, setActiveView] = useState<ViewPresetName | null>('aerea');
  const [sunset, setSunset] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [bloomEnabled, setBloomEnabled] = useState(true);
  const [soundMuted, setSoundMuted] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);
  const [hudCollapsed, setHudCollapsed] = useState(false);
  const [loaderState, setLoaderState] = useState<'visible' | 'fading' | 'hidden'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') return 'hidden';
    }
    return 'visible';
  });

  const ctlRef = useRef<OrbitControlState>({
    target: { x: 0, y: 1.5, z: -4 },
    theta: 0.62,
    phi: 0.98,
    radius: 118,
    dTheta: 0,
    dPhi: 0,
    dRad: 0,
    minR: 9,
    maxR: 340,
    minPhi: 0.12,
    maxPhi: 1.56,
    auto: true,
  });

  const tweenRef = useRef<TweenState>({
    active: false,
    t: 0,
    dur: 1.35,
    from: CAMERA_VIEWS.aerea,
    to: CAMERA_VIEWS.aerea,
  });

  useEffect(() => {
    const soundscape = new AmbientSoundscape();
    soundscapeRef.current = soundscape;
    soundscape.startDefaultPlayback();
    return () => {
      soundscape.dispose();
      soundscapeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || isSoftwareGl) {
      ctlRef.current.auto = false;
    }

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    stage.innerHTML = '';
    stage.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const camera = new THREE.PerspectiveCamera(
      46,
      window.innerWidth / window.innerHeight,
      0.5,
      2500,
    );
    cameraRef.current = camera;

    const sceneCtrl = buildVilaCapivarasScene(renderer, isSoftwareGl);
    sceneCtrlRef.current = sceneCtrl;
    sceneCtrl.setDaytime(false);

    // Post-processing pipeline: RenderPass -> UnrealBloomPass -> OutputPass
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(sceneCtrl.scene, camera);
    composer.addPass(renderPass);

    const initialBloom = computeBloomParams(false, true);
    const bloomResScale = isSoftwareGl ? 0.5 : 1;
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(
        Math.max(1, Math.floor(window.innerWidth * bloomResScale)),
        Math.max(1, Math.floor(window.innerHeight * bloomResScale)),
      ),
      initialBloom.strength,
      initialBloom.radius,
      initialBloom.threshold,
    );
    bloomPass.enabled = initialBloom.enabled;
    composer.addPass(bloomPass);

    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    composerRef.current = composer;
    bloomPassRef.current = bloomPass;

    if (!isSoftwareGl) {
      renderer.compile(sceneCtrl.scene, camera);
    }

    const _dir = new THREE.Vector3();
    const _right = new THREE.Vector3();
    const _up = new THREE.Vector3();

    function applyCamera() {
      const pos = stepOrbitCamera(ctlRef.current);
      camera.position.set(pos.x, pos.y, pos.z);
      camera.lookAt(
        ctlRef.current.target.x,
        ctlRef.current.target.y,
        ctlRef.current.target.z,
      );

      // Attenuate sprites and connector lines that are very close to the camera
      sceneCtrl.labelGroup.children.forEach((child) => {
        const anchorPos = child.userData?.anchorPos as THREE.Vector3 | undefined;
        if (!anchorPos) return;
        const dist = camera.position.distanceTo(anchorPos);
        const factor = dist < 24 ? Math.max(0, (dist - 14) / 10) : 1;
        if ((child as THREE.Sprite).isSprite) {
          ((child as THREE.Sprite).material as THREE.SpriteMaterial).opacity = factor;
        } else if ((child as THREE.Line).isLine) {
          ((child as THREE.Line).material as THREE.LineBasicMaterial).opacity =
            0.75 * factor;
        }
      });
    }

    function renderNow() {
      applyCamera();
      camera.getWorldDirection(_dir);
      if (needleRef.current) {
        const deg = computeCompassDegrees(_dir.x, _dir.z);
        needleRef.current.style.transform = `rotate(${deg}deg)`;
      }
      if (!bloomEnabledRef.current) {
        renderer.render(sceneCtrl.scene, camera);
      } else {
        composer.render();
      }
    }

    syncRenderRef.current = renderNow;

    function panBy(dx: number, dy: number) {
      const k = ctlRef.current.radius * 0.0012;
      _right.setFromMatrixColumn(camera.matrix, 0);
      _up.setFromMatrixColumn(camera.matrix, 1);
      ctlRef.current.target.x += -dx * k * _right.x + dy * k * _up.x;
      ctlRef.current.target.y += -dx * k * _right.y + dy * k * _up.y;
      ctlRef.current.target.z += -dx * k * _right.z + dy * k * _up.z;
    }

    const pointers = new Map<number, { x: number; y: number; btn: number }>();
    let lastPinch = 0;
    const el = renderer.domElement;
    el.style.touchAction = 'none';

    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    const onPointerDown = (e: PointerEvent) => {
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Ignore synthetic events without active pointerId
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, btn: e.button });
      ctlRef.current.auto = false;
      tweenRef.current.active = false;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      const p = pointers.get(e.pointerId)!;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (pointers.size === 1) {
        if (p.btn === 2 || p.btn === 1 || e.shiftKey) {
          panBy(dx, dy);
        } else {
          ctlRef.current.dTheta -= dx * 0.0035;
          ctlRef.current.dPhi -= dy * 0.0035;
        }
      } else if (pointers.size === 2) {
        const pts = [...pointers.values()];
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (lastPinch > 0) {
          ctlRef.current.dRad += (lastPinch - d) * 0.0018;
        }
        lastPinch = d;
        panBy(dx * 0.5, dy * 0.5);
      }
    };

    const endPointer = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) lastPinch = 0;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      ctlRef.current.auto = false;
      tweenRef.current.active = false;
      ctlRef.current.dRad += e.deltaY * 0.00045;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        setHudCollapsed((prev) => !prev);
      } else if (e.key === 'b' || e.key === 'B') {
        const nextBloom = !bloomEnabledRef.current;
        bloomEnabledRef.current = nextBloom;
        const bp = computeBloomParams(sunsetRef.current, nextBloom);
        bloomPass.enabled = bp.enabled;
        bloomPass.strength = bp.strength;
        bloomPass.radius = bp.radius;
        bloomPass.threshold = bp.threshold;
        renderer.toneMappingExposure = bp.exposure;
        setBloomEnabled(nextBloom);
        renderNow();
      } else if (e.key === 'm' || e.key === 'M') {
        if (soundscapeRef.current) {
          const nextMuted = soundscapeRef.current.toggleMuted();
          setSoundMuted(nextMuted);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        ctlRef.current.auto = false;
        ctlRef.current.dTheta += 0.03;
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        ctlRef.current.auto = false;
        ctlRef.current.dTheta -= 0.03;
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        ctlRef.current.auto = false;
        ctlRef.current.dRad -= 0.03;
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        ctlRef.current.auto = false;
        ctlRef.current.dRad += 0.03;
      }
    };

    el.addEventListener('contextmenu', onContextMenu);
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', endPointer);
    el.addEventListener('pointercancel', endPointer);
    el.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);

    const onResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      composer.setSize(width, height);
      bloomPass.resolution.set(
        Math.max(1, Math.floor(width * bloomResScale)),
        Math.max(1, Math.floor(height * bloomResScale)),
      );
      renderNow();
    };
    window.addEventListener('resize', onResize);

    let lastTime = performance.now();
    let frameId = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      const now = performance.now();
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, isSoftwareGl ? 0.25 : 0.05);
      const tw = tweenRef.current;
      const ctl = ctlRef.current;

      if (tw.active) {
        tw.t += dt / tw.dur;
        const k = easeInOutCubic(Math.min(tw.t, 1));
        ctl.radius = lerp(tw.from.radius, tw.to.radius, k);
        ctl.phi = lerp(tw.from.phi, tw.to.phi, k);
        ctl.theta = lerp(tw.from.theta, tw.to.theta, k);
        ctl.target.x = lerp(tw.from.target.x, tw.to.target.x, k);
        ctl.target.y = lerp(tw.from.target.y, tw.to.target.y, k);
        ctl.target.z = lerp(tw.from.target.z, tw.to.target.z, k);
        if (tw.t >= 1) tw.active = false;
      } else if (ctl.auto) {
        ctl.theta += dt * 0.045;
      }

      if (!reduceMotion) {
        sceneCtrl.waterTex.offset.x += dt * 0.008;
        sceneCtrl.waterTex.offset.y += dt * 0.004;
      }

      renderNow();

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    renderNow();
    tick();

    const fadeTimer = window.setTimeout(() => {
      setLoaderState((prev) => (prev === 'hidden' ? 'hidden' : 'fading'));
    }, 450);
    const removeTimer = window.setTimeout(() => {
      setLoaderState('hidden');
    }, 1100);
    const hintTimer = window.setTimeout(() => {
      setHintVisible(false);
    }, 9000);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
      clearTimeout(hintTimer);
      syncRenderRef.current = null;
      composerRef.current = null;
      bloomPassRef.current = null;
      el.removeEventListener('contextmenu', onContextMenu);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', endPointer);
      el.removeEventListener('pointercancel', endPointer);
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
      composer.dispose();
      sceneCtrl.dispose();
      renderer.dispose();
    };
  }, []);

  const handleSelectView = useCallback((name: ViewPresetName) => {
    const v = CAMERA_VIEWS[name];
    const ctl = ctlRef.current;
    const fromTheta = ctl.theta;
    const toTheta = shortestAngleTarget(fromTheta, v.theta);

    if (isSoftwareGl) {
      ctl.radius = v.radius;
      ctl.phi = v.phi;
      ctl.theta = toTheta;
      ctl.target = { ...v.target };
      ctl.dTheta = 0;
      ctl.dPhi = 0;
      ctl.dRad = 0;
      tweenRef.current.active = false;
      ctl.auto = false;
      setActiveView(name);
      syncRenderRef.current?.();
      return;
    }

    tweenRef.current = {
      active: true,
      t: 0,
      dur: 1.35,
      from: {
        radius: ctl.radius,
        phi: ctl.phi,
        theta: fromTheta,
        target: { ...ctl.target },
      },
      to: {
        radius: v.radius,
        phi: v.phi,
        theta: toTheta,
        target: { ...v.target },
      },
    };
    ctl.auto = false;
    setActiveView(name);
  }, []);

  const handleToggleSunset = useCallback(() => {
    const next = !sunsetRef.current;
    sunsetRef.current = next;
    sceneCtrlRef.current?.setDaytime(next);
    soundscapeRef.current?.setSunsetMode(next);
    if (bloomPassRef.current && rendererRef.current) {
      const bp = computeBloomParams(next, bloomEnabledRef.current);
      bloomPassRef.current.enabled = bp.enabled;
      bloomPassRef.current.strength = bp.strength;
      bloomPassRef.current.radius = bp.radius;
      bloomPassRef.current.threshold = bp.threshold;
      rendererRef.current.toneMappingExposure = bp.exposure;
    }
    setSunset(next);
    syncRenderRef.current?.();
  }, []);

  const handleToggleBloom = useCallback(() => {
    const next = !bloomEnabledRef.current;
    bloomEnabledRef.current = next;
    if (bloomPassRef.current && rendererRef.current) {
      const bp = computeBloomParams(sunsetRef.current, next);
      bloomPassRef.current.enabled = bp.enabled;
      bloomPassRef.current.strength = bp.strength;
      bloomPassRef.current.radius = bp.radius;
      bloomPassRef.current.threshold = bp.threshold;
      rendererRef.current.toneMappingExposure = bp.exposure;
    }
    setBloomEnabled(next);
    syncRenderRef.current?.();
  }, []);

  const handleToggleLabels = useCallback(() => {
    setShowLabels((prev) => {
      const next = !prev;
      if (sceneCtrlRef.current) {
        sceneCtrlRef.current.labelGroup.visible = next;
      }
      syncRenderRef.current?.();
      return next;
    });
  }, []);

  const handleToggleSound = useCallback(() => {
    if (!soundscapeRef.current) return;
    const nextMuted = soundscapeRef.current.toggleMuted();
    setSoundMuted(nextMuted);
  }, []);

  const handleExportPng = useCallback(() => {
    const renderer = rendererRef.current;
    const composer = composerRef.current;
    const sceneCtrl = sceneCtrlRef.current;
    const camera = cameraRef.current;
    if (!renderer || !sceneCtrl || !camera) return;

    if (!bloomEnabledRef.current || !composer) {
      renderer.render(sceneCtrl.scene, camera);
    } else {
      composer.render();
    }
    const a = document.createElement('a');
    a.download = 'vila-capivaras-rediseno.png';
    a.href = renderer.domElement.toDataURL('image/png');
    a.click();
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      const docEl = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };
      const req = docEl.requestFullscreen || docEl.webkitRequestFullscreen;
      if (req) {
        req.call(docEl).catch(() => {});
      }
    }
  }, []);

  const handleToggleHudCollapsed = useCallback(() => {
    setHudCollapsed((prev) => !prev);
  }, []);

  return (
    <main
      data-testid="vila-capivaras-app"
      data-view={activeView ?? 'custom'}
      data-daytime={sunset ? 'sunset' : 'day'}
      data-bloom={bloomEnabled ? 'on' : 'off'}
      data-bloom-strength={
        computeBloomParams(sunset, bloomEnabled).strength.toFixed(2)
      }
      data-labels={showLabels ? 'on' : 'off'}
      data-sound={soundMuted ? 'muted' : 'on'}
    >
      <div id="stage" ref={stageRef} data-testid="webgl-stage" />
      <HudOverlay
        activeView={activeView}
        sunset={sunset}
        showLabels={showLabels}
        bloomEnabled={bloomEnabled}
        soundMuted={soundMuted}
        hintVisible={hintVisible}
        loaderState={loaderState}
        hudCollapsed={hudCollapsed}
        needleRef={needleRef}
        onSelectView={handleSelectView}
        onToggleSunset={handleToggleSunset}
        onToggleLabels={handleToggleLabels}
        onToggleBloom={handleToggleBloom}
        onToggleSound={handleToggleSound}
        onExportPng={handleExportPng}
        onToggleFullscreen={handleToggleFullscreen}
        onToggleHudCollapsed={handleToggleHudCollapsed}
      />
    </main>
  );
}
