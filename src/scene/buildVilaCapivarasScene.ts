import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PROJECT_RENDERS } from '../utils/projectRenders';

export const PALETTE = {
  oceano: 0x0e3a53,
  teal: 0x17798a,
  dorado: 0xd9a441,
  arena: 0xf3ecdd,
  negro: 0x23272b,
  negro2: 0x1b1f23,
  blancoCanopy: 0xf4f2ec,
  cartela: 0xf7f5ef,
  maderaSlat: 0x7a4e2c,
  madera: 0x8a5a36,
  maderaClara: 0xa9773f,
  vidrio: 0x7fb0bc,
  vidrioOscuro: 0x2e5560,
  piedra: 0xcbc2ac,
  asfalto: 0x43484c,
  acera: 0xc9c2b2,
  clay: 0xc06a4c,
  olive: 0x7a8450,
  verde: 0x5e7d4a,
  verdeOscuro: 0x3f5c36,
  tronco: 0x6e4e2e,
  agua: 0x2e7d8c,
} as const;

export interface VilaCapivarasSceneController {
  scene: THREE.Scene;
  waterTex: THREE.CanvasTexture;
  labelGroup: THREE.Group;
  renderBoardsGroup: THREE.Group;
  setDaytime: (evening: boolean) => void;
  dispose: () => void;
}

function createSeededRandom(seed = 19830429): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildVilaCapivarasScene(
  renderer: THREE.WebGLRenderer,
  isSoftwareGl: boolean,
  onTextureLoaded?: () => void,
): VilaCapivarasSceneController {
  const rng = createSeededRandom(20261029);
  const scene = new THREE.Scene();
  const maxAnisotropy = Math.min(renderer.capabilities.getMaxAnisotropy() || 4, 8);

  // Studio environment reflection for realistic glass, water, and dark steel frames
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envRenderTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRenderTarget.texture;
  scene.environmentIntensity = 0.35;
  pmremGenerator.dispose();

  const matCache: Record<string, THREE.MeshStandardMaterial> = {};
  const createdTextures: THREE.Texture[] = [];

  function mat(
    color: number,
    rough = 0.9,
    metal = 0.0,
    opts: {
      transparent?: boolean;
      opacity?: number;
      emissive?: number;
      ei?: number;
    } = {},
  ): THREE.MeshStandardMaterial {
    const key =
      color +
      '_' +
      rough +
      '_' +
      metal +
      '_' +
      (opts.transparent ? opts.opacity : 1) +
      '_' +
      (opts.emissive || 0) +
      '_' +
      (opts.ei || 0);
    if (!matCache[key]) {
      const params: THREE.MeshStandardMaterialParameters = {
        color,
        roughness: rough,
        metalness: metal,
      };
      if (opts.transparent) {
        params.transparent = true;
        params.opacity = opts.opacity ?? 1;
      }
      if (opts.emissive !== undefined) {
        params.emissive = new THREE.Color(opts.emissive);
        params.emissiveIntensity = opts.ei ?? 0.4;
      }
      matCache[key] = new THREE.MeshStandardMaterial(params);
    }
    return matCache[key];
  }

  function box(
    w: number,
    h: number,
    d: number,
    material: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
    cast = true,
    recv = true,
  ): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = cast && !isSoftwareGl;
    m.receiveShadow = recv && !isSoftwareGl;
    return m;
  }

  function cyl(
    rt: number,
    rb: number,
    h: number,
    material: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
    seg = 10,
    cast = true,
  ): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
    m.position.set(x, y, z);
    m.castShadow = cast && !isSoftwareGl;
    m.receiveShadow = !isSoftwareGl;
    return m;
  }

  function plane(
    w: number,
    d: number,
    material: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
    recv = true,
  ): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = recv && !isSoftwareGl;
    return m;
  }

  function canvasTex(
    w: number,
    h: number,
    draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
    repX = 1,
    repY = 1,
  ): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    draw(ctx, w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repX, repY);
    t.anisotropy = maxAnisotropy;
    createdTextures.push(t);
    return t;
  }

  function noise(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    alpha: number,
    n = 1400,
  ) {
    ctx.globalAlpha = alpha;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = rng() > 0.5 ? '#ffffff' : '#000000';
      ctx.fillRect(rng() * w, rng() * h, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- Cielo, luces, niebla ---------- */
  function skyTexture(top: string, mid: string, bottom: string) {
    return canvasTex(16, 512, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, top);
      g.addColorStop(0.55, mid);
      g.addColorStop(1, bottom);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
  }

  const skyDay = skyTexture('#7fbbdf', '#bcdcee', '#eef4ec');
  const skySunset = skyTexture('#2f4d6b', '#d9825e', '#f6c98a');
  const skyMat = new THREE.MeshBasicMaterial({
    map: skyDay,
    side: THREE.BackSide,
    fog: false,
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(1100, 24, 14), skyMat);
  scene.add(skyDome);

  const hemi = new THREE.HemisphereLight(0xdfeef7, 0x8a7a5c, 0.85);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff2df, 1.35);
  sun.position.set(65, 95, -35);
  sun.castShadow = !isSoftwareGl;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -130;
  sun.shadow.camera.right = 130;
  sun.shadow.camera.top = 130;
  sun.shadow.camera.bottom = -130;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 400;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xcfe3ec, 0.28);
  fill.position.set(-70, 40, 60);
  scene.add(fill);

  scene.fog = new THREE.Fog(0xdcecf2, 240, 900);

  /* ---------- Terreno base ---------- */
  const grassTex = canvasTex(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#7c9159';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) {
        ctx.fillStyle = ['#71874f', '#87a067', '#6d8350', '#8fa571'][i % 4];
        ctx.fillRect(rng() * w, rng() * h, 3, 3);
      }
    },
    60,
    60,
  );
  const groundMat = new THREE.MeshStandardMaterial({
    map: grassTex,
    roughness: 1,
    color: 0xffffff,
  });
  const ground = plane(1400, 1400, groundMat);
  ground.position.y = -0.02;
  scene.add(ground);

  /* ---------- Lagoa das Capivaras (norte) ---------- */
  const waterTex = canvasTex(
    512,
    512,
    (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#2a7787');
      g.addColorStop(0.6, '#2f8496');
      g.addColorStop(1, '#256b7b');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = '#bfe3e8';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 46; i++) {
        ctx.beginPath();
        const y = rng() * h;
        ctx.moveTo(rng() * w * 0.3, y);
        ctx.bezierCurveTo(
          w * 0.4,
          y + 6,
          w * 0.6,
          y - 6,
          w * (0.7 + rng() * 0.3),
          y + 2,
        );
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
    3,
    3,
  );
  const waterMat = new THREE.MeshStandardMaterial({
    map: waterTex,
    roughness: 0.16,
    metalness: 0.06,
    color: 0xffffff,
  });
  const water = plane(320, 110, waterMat, 0, 0.03, -100.5);
  scene.add(water);

  const sandMat = mat(0xd8c9a3, 1);
  scene.add(plane(320, 4.5, sandMat, 0, 0.045, -46.6));

  [
    [-118, -49, 26],
    [-58, -47.5, 20],
    [12, -48.5, 24],
    [86, -47, 22],
    [140, -50, 30],
  ].forEach((p) => {
    const cape = new THREE.Mesh(
      new THREE.CircleGeometry(p[2] * 0.5, 22),
      groundMat,
    );
    cape.rotation.x = -Math.PI / 2;
    cape.scale.set(1.7, 0.65, 1);
    cape.position.set(p[0], 0.05, p[1]);
    cape.receiveShadow = !isSoftwareGl;
    scene.add(cape);
  });

  const reedMat = mat(0x5f7f43, 1);
  for (let i = 0; i < 26; i++) {
    const x = -120 + rng() * 240;
    if (Math.abs(x) < 34 && rng() < 0.5) continue;
    const r = cyl(
      0.06,
      0.1,
      1.2 + rng() * 0.9,
      reedMat,
      x,
      0.6,
      -45.6 - rng() * 1.8,
      5,
    );
    scene.add(r);
  }
  for (let i = 0; i < 14; i++) {
    const x = -150 + i * 23;
    scene.add(
      box(20, 5 + rng() * 3, 7, mat(0x46603c, 1), x, 2.6, -134, false, false),
    );
  }

  /* ---------- Vías ---------- */
  const asphaltMat = mat(PALETTE.asfalto, 0.95);
  const aceraMat = new THREE.MeshStandardMaterial({
    map: canvasTex(
      128,
      128,
      (ctx, w, h) => {
        ctx.fillStyle = '#c9c2b2';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(90,84,70,.35)';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, w - 2, h - 2);
        noise(ctx, w, h, 0.05, 300);
      },
      14,
      3,
    ),
    roughness: 1,
    color: 0xffffff,
  });

  scene.add(plane(190, 9, asphaltMat, 0, 0.012, -33.5));
  scene.add(plane(190, 3, aceraMat, 0, 0.02, -27.5));

  const dashMat = mat(0xede7d4, 0.8);
  for (let x = -92; x <= 92; x += 8) {
    if (Math.abs(x) < 5) continue;
    scene.add(box(3.4, 0.02, 0.28, dashMat, x, 0.03, -33.5, false));
  }
  for (let i = 0; i < 7; i++) {
    scene.add(box(1.1, 0.02, 7.6, dashMat, -4.2 + i * 1.4, 0.032, -33.5, false));
  }

  [
    [-1, -50],
    [1, 50],
  ].forEach(([s, cx]) => {
    scene.add(plane(6, 78, asphaltMat, cx, 0.012, -1));
    scene.add(plane(2, 78, aceraMat, cx - s * 4, 0.02, -1));
    scene.add(plane(2, 78, aceraMat, cx + s * 4, 0.02, -1));
    for (let z = -32; z <= 34; z += 8) {
      scene.add(box(0.26, 0.02, 3.4, dashMat, cx, 0.03, z, false));
    }
  });

  /* Orla: paseo de madera + palmeras junto a la laguna */
  const deckTex = canvasTex(
    256,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = '#9a6a3e';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(60,38,18,.55)';
      ctx.lineWidth = 2;
      for (let y = 0; y <= h; y += 12) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      noise(ctx, w, h, 0.06, 260);
    },
    22,
    1,
  );
  const deckMatShared = new THREE.MeshStandardMaterial({
    map: deckTex,
    roughness: 0.9,
    color: 0xffffff,
  });
  scene.add(plane(150, 3.6, deckMatShared, 0, 0.05, -40.1));

  /* ---------- Superficies del predio ---------- */
  const plazaTex = canvasTex(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#e6dfc9';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(120,110,86,.4)';
      ctx.lineWidth = 1.6;
      for (let y = 0; y <= h; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      for (let x = 0; x <= w; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      noise(ctx, w, h, 0.05, 300);
    },
    4,
    3,
  );
  const plazaMatShared = new THREE.MeshStandardMaterial({
    map: plazaTex,
    roughness: 0.95,
    color: 0xffffff,
  });
  scene.add(plane(18, 12, plazaMatShared, 0, 0.03, -20));

  const paseoTex = canvasTex(
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#e9e2cc';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#17798A';
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      for (let y = -40; y < h + 40; y += 64) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 8) {
          const yy = y + Math.sin(x / 40) * 14;
          if (x === 0) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      noise(ctx, w, h, 0.05, 400);
    },
    1.6,
    3,
  );
  scene.add(
    plane(
      18,
      30,
      new THREE.MeshStandardMaterial({
        map: paseoTex,
        roughness: 0.95,
        color: 0xffffff,
      }),
      0,
      0.03,
      1,
    ),
  );
  scene.add(plane(28, 6, plazaMatShared, 0, 0.028, 13));
  scene.add(plane(18, 6, plazaMatShared, -18, 0.028, -11));
  scene.add(plane(18, 6, plazaMatShared, 18, 0.028, -11));

  scene.add(plane(6, 9, groundMat, 0, 0.05, -7));
  scene.add(plane(6, 8, groundMat, 0, 0.05, 9));

  const borderMat = mat(PALETTE.piedra, 0.9);
  [
    [0, -7, 6, 9],
    [0, 9, 6, 8],
  ].forEach((b) => {
    scene.add(box(b[2] + 0.3, 0.22, 0.3, borderMat, b[0], 0.11, b[1] - b[3] / 2, false));
    scene.add(box(b[2] + 0.3, 0.22, 0.3, borderMat, b[0], 0.11, b[1] + b[3] / 2, false));
    scene.add(box(0.3, 0.22, b[3], borderMat, b[0] - b[2] / 2, 0.11, b[1], false));
    scene.add(box(0.3, 0.22, b[3], borderMat, b[0] + b[2] / 2, 0.11, b[1], false));
  });

  const fuente = new THREE.Group();
  fuente.add(cyl(1.7, 1.85, 0.5, mat(PALETTE.piedra, 0.85), 0, 0.25, 0, 20));
  const aguaFuente = new THREE.Mesh(
    new THREE.CircleGeometry(1.45, 20),
    new THREE.MeshStandardMaterial({
      color: PALETTE.agua,
      roughness: 0.15,
      emissive: PALETTE.teal,
      emissiveIntensity: 0.18,
    }),
  );
  aguaFuente.rotation.x = -Math.PI / 2;
  aguaFuente.position.y = 0.42;
  fuente.add(aguaFuente);
  fuente.add(cyl(0.16, 0.2, 0.9, mat(PALETTE.piedra, 0.85), 0, 0.85, 0, 10));
  fuente.position.set(0, 0, 1.3);
  scene.add(fuente);

  /* ---------- Estacionamientos (alas este / oeste) ---------- */
  function parkingTexture() {
    return canvasTex(256, 672, (ctx, w, h) => {
      ctx.fillStyle = '#3f4448';
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 0.05, 500);
      ctx.strokeStyle = '#d8d4c8';
      ctx.lineWidth = 3;
      const stallPx = h / 16.8;
      const depth = w * (5.5 / 16);
      for (let i = 0; i <= 16; i++) {
        const y = i * stallPx;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(depth, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(w - depth, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(60,110,150,.85)';
      ctx.fillRect(2, h * 0.5 - stallPx, depth - 4, stallPx - 3);
    });
  }

  const wingGeo = new THREE.PlaneGeometry(16, 42);
  const parkingMat = new THREE.MeshStandardMaterial({
    map: parkingTexture(),
    roughness: 0.96,
    color: 0xffffff,
  });
  [[-37], [37]].forEach(([cx]) => {
    const p = new THREE.Mesh(wingGeo, parkingMat);
    p.rotation.x = -Math.PI / 2;
    p.position.set(cx, 0.025, -1);
    p.receiveShadow = !isSoftwareGl;
    scene.add(p);
    scene.add(plane(4, 6, asphaltMat, cx < 0 ? -46 : 46, 0.022, -1));
  });

  const hedgeMat = mat(0x4f6b3d, 1);
  [
    [-37, -23.4],
    [37, -23.4],
    [-37, 20.6],
    [37, 20.6],
  ].forEach((p) => scene.add(box(15.6, 1, 1, hedgeMat, p[0], 0.5, p[1])));
  scene.add(box(88, 1.1, 0.9, hedgeMat, 0, 0.55, 25.9));

  /* =====================================================================
     ARQUITECTURA — lenguaje strip center: negro + madera + canopy blanco
     ===================================================================== */
  function slatsTexture() {
    return canvasTex(128, 256, (ctx, w, h) => {
      ctx.fillStyle = '#7A4E2C';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = ['#8F5E37', '#6E4426', '#835431'][i % 3];
        ctx.fillRect(rng() * w, rng() * h, 3, 10);
      }
      ctx.strokeStyle = 'rgba(40,22,8,.7)';
      ctx.lineWidth = 2;
      for (let x = 0; x <= w; x += 14) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
    });
  }

  const slatsTex = slatsTexture();
  const slatsMat = new THREE.MeshStandardMaterial({
    map: slatsTex,
    roughness: 0.85,
    color: 0xffffff,
  });
  const soffitMat = new THREE.MeshStandardMaterial({
    map: slatsTex,
    roughness: 0.9,
    color: 0xffffff,
  });
  const steelMat = mat(PALETTE.negro, 0.45, 0.55);
  const frameMat = mat(PALETTE.negro2, 0.4, 0.45);
  const canopyMat = mat(PALETTE.blancoCanopy, 0.85);
  const wallMatA = mat(0xf1ede2, 0.9);
  const woodMat = mat(PALETTE.madera, 0.8);
  const woodMat2 = mat(PALETTE.maderaClara, 0.8);

  const glassMat = new THREE.MeshStandardMaterial({
    color: PALETTE.vidrio,
    roughness: 0.1,
    metalness: 0.25,
    transparent: true,
    opacity: 0.52,
    side: THREE.DoubleSide,
  });
  const glassNight = new THREE.MeshStandardMaterial({
    color: 0xffe9b8,
    roughness: 0.3,
    emissive: 0xffc868,
    emissiveIntensity: 0.0,
    transparent: true,
    opacity: 0.85,
  });
  const darkGlass = new THREE.MeshStandardMaterial({
    color: PALETTE.vidrioOscuro,
    roughness: 0.18,
    metalness: 0.25,
  });

  const glowWindows: THREE.Mesh[] = [];
  const gymGlows: THREE.MeshStandardMaterial[] = [];
  const signGlows: THREE.MeshStandardMaterial[] = [];

  function tenantSignMat(names: string[], wPx = 1280, big = false) {
    const H = big ? 230 : 120;
    const tex = canvasTex(wPx, H, (ctx, w, h) => {
      ctx.fillStyle = '#F7F5EF';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(27,31,35,.18)';
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (big) {
        ctx.fillStyle = '#1B1F23';
        ctx.font = '800 118px Calibri, sans-serif';
        ctx.fillText(names[0], w / 2, h * 0.42);
        if (names[1]) {
          ctx.fillStyle = '#D9A441';
          ctx.font = '700 52px Calibri, sans-serif';
          ctx.fillText(names[1], w / 2, h * 0.8);
        }
      } else {
        const seg = w / names.length;
        ctx.fillStyle = '#1B1F23';
        ctx.font = '700 58px Calibri, sans-serif';
        names.forEach((n, i) => {
          ctx.fillText(n, seg * (i + 0.5), h / 2 + 2);
          if (i > 0) {
            ctx.fillStyle = '#D9A441';
            ctx.fillRect(seg * i - 2, h * 0.22, 4, h * 0.56);
            ctx.fillStyle = '#1B1F23';
          }
        });
      }
    });
    const m = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.6,
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveMap: tex,
      emissiveIntensity: 0,
    });
    signGlows.push(m);
    return m;
  }

  function steelRail(len: number, x: number, y: number, z: number, ry = 0) {
    const g = new THREE.Group();
    g.add(box(len, 0.06, 0.06, steelMat, 0, 1.02, 0, false));
    g.add(box(len, 0.04, 0.04, steelMat, 0, 0.68, 0, false));
    g.add(box(len, 0.04, 0.04, steelMat, 0, 0.34, 0, false));
    const n = Math.max(2, Math.round(len / 1.15));
    for (let i = 0; i <= n; i++) {
      g.add(box(0.05, 1.02, 0.05, steelMat, -len / 2 + i * (len / n), 0.51, 0, false));
    }
    g.position.set(x, y, z);
    g.rotation.y = ry;
    return g;
  }

  function pergola(
    w: number,
    d: number,
    x: number,
    y: number,
    z: number,
    matUse: THREE.Material = woodMat,
  ) {
    const g = new THREE.Group();
    g.add(box(w, 0.14, 0.14, matUse, 0, 0, -d / 2));
    g.add(box(w, 0.14, 0.14, matUse, 0, 0, d / 2));
    const n = Math.max(3, Math.round(w / 0.9));
    for (let i = 0; i <= n; i++) {
      g.add(box(0.1, 0.06, d + 0.5, matUse, -w / 2 + i * (w / n), 0.12, 0));
    }
    g.position.set(x, y, z);
    return g;
  }

  function umbrella(x: number, z: number, colorHex = 0xf3ecdd) {
    const g = new THREE.Group();
    g.add(cyl(0.05, 0.05, 2.1, woodMat, 0, 1.05, 0, 6));
    const coneMat = mat(colorHex, 0.85, 0, {}).clone();
    coneMat.side = THREE.DoubleSide;
    const top = new THREE.Mesh(
      new THREE.ConeGeometry(1.35, 0.55, 10, 1, true),
      coneMat,
    );
    top.position.y = 2.25;
    top.castShadow = !isSoftwareGl;
    g.add(top);
    g.position.set(x, 0, z);
    return g;
  }

  /* ---- Bloque C/D: PB locales vidriados + cartela + PA flats (madera)
         coronado por gran canopy blanco volado ---- */
  function buildBlock(cfg: {
    x: number;
    z: number;
    w: number;
    d: number;
    shops?: number;
    signMat: THREE.Material;
    rotationY?: number;
  }) {
    const g = new THREE.Group();
    const GF = 4.2;
    const UF = 3.4;
    const s = -1;
    const fz = (s * cfg.d) / 2;

    g.add(box(cfg.w, GF, cfg.d - 1.4, wallMatA, 0, GF / 2, -s * 0.7));
    g.add(box(cfg.w, 0.35, cfg.d - 1.2, frameMat, 0, 0.17, -s * 0.7));
    const glass = box(
      cfg.w - 0.9,
      GF - 1.0,
      0.12,
      glassMat,
      0,
      (GF - 1.0) / 2 + 0.35,
      fz - s * 0.35,
      false,
    );
    g.add(glass);
    const glassWarm = box(
      cfg.w - 0.9,
      GF - 1.0,
      0.1,
      glassNight,
      0,
      (GF - 1.0) / 2 + 0.35,
      fz - s * 0.55,
      false,
      false,
    );
    g.add(glassWarm);
    glowWindows.push(glassWarm);

    const nMod = cfg.shops || 3;
    for (let i = 0; i <= nMod; i++) {
      const px = -cfg.w / 2 + i * (cfg.w / nMod);
      g.add(box(0.22, GF, 0.22, frameMat, px, GF / 2, fz - s * 0.3));
      g.add(
        box(
          0.18,
          GF + UF + 0.55,
          0.18,
          steelMat,
          px,
          (GF + UF + 0.55) / 2,
          fz + s * 1.5,
        ),
      );
    }

    g.add(box(cfg.w + 0.6, 0.32, cfg.d + 2.6, canopyMat, 0, GF + 0.16, s * 0.6));
    const brd = s * (0.6 + (cfg.d + 2.6) / 2) - s * 0.16;
    const signG = new THREE.Mesh(
      new THREE.PlaneGeometry(cfg.w + 0.2, 0.95),
      cfg.signMat,
    );
    signG.position.set(0, GF - 0.32, brd + s * 0.06);
    signG.rotation.y = Math.PI;
    signG.castShadow = false;
    g.add(signG);
    g.add(box(cfg.w + 0.3, 0.99, 0.1, frameMat, 0, GF - 0.32, brd, false));

    const setback = 1.9;
    const upperD = cfg.d - setback;
    g.add(
      box(
        cfg.w,
        UF,
        upperD,
        slatsMat,
        0,
        GF + 0.35 + UF / 2,
        (-s * setback) / 2,
      ),
    );
    const nWin = Math.max(3, Math.round(cfg.w / 4));
    for (let i = 0; i < nWin; i++) {
      const px = -cfg.w / 2 + (i + 0.5) * (cfg.w / nWin);
      g.add(
        box(
          2.3,
          2.5,
          0.1,
          frameMat,
          px,
          GF + 0.35 + 1.4,
          fz - s * (setback - 0.0),
          false,
        ),
      );
      g.add(
        box(
          2.0,
          2.2,
          0.1,
          darkGlass,
          px,
          GF + 0.35 + 1.35,
          fz - s * (setback - 0.06),
          false,
        ),
      );
      const winWarm = box(
        2.0,
        2.2,
        0.08,
        glassNight,
        px,
        GF + 0.35 + 1.35,
        fz - s * (setback + 0.08),
        false,
        false,
      );
      g.add(winWarm);
      glowWindows.push(winWarm);
    }

    g.add(steelRail(cfg.w - 0.2, 0, GF + 0.35, fz - s * 0.15));
    g.add(
      pergola(
        cfg.w * 0.42,
        setback - 0.2,
        -cfg.w * 0.22,
        GF + 0.35 + UF - 0.1,
        fz - (s * setback) / 2,
        woodMat2,
      ),
    );

    const cw = cfg.w + 3.2;
    const cd = upperD + 3.4;
    g.add(
      box(
        cw,
        0.5,
        cd,
        canopyMat,
        0,
        GF + 0.35 + UF + 0.42,
        (-s * setback) / 2,
      ),
    );
    g.add(
      box(
        cw - 0.2,
        0.05,
        cd - 0.2,
        soffitMat,
        0,
        GF + 0.35 + UF + 0.15,
        (-s * setback) / 2,
        false,
      ),
    );

    g.position.set(cfg.x, 0, cfg.z);
    if (cfg.rotationY !== undefined) {
      g.rotation.y = cfg.rotationY;
    }
    scene.add(g);
    return g;
  }

  /* ---- Restaurante ancla: salón vidriado + cartela + rooftop; losa blanca volada ---- */
  function buildAnchor(cfg: {
    x: number;
    z: number;
    w: number;
    d: number;
    signMat: THREE.Material;
  }) {
    const g = new THREE.Group();
    const GF = 4.4;
    const s = -1;
    const fz = (s * cfg.d) / 2;
    g.add(box(cfg.w, GF, cfg.d - 1.2, wallMatA, 0, GF / 2, -s * 0.6));
    g.add(box(cfg.w, 0.32, cfg.d - 1.0, frameMat, 0, 0.16, -s * 0.6));

    const glass = box(
      cfg.w - 1.0,
      GF - 0.9,
      0.12,
      glassMat,
      0,
      (GF - 0.9) / 2 + 0.3,
      fz - s * 0.3,
      false,
    );
    g.add(glass);
    const warm = box(
      cfg.w - 1.0,
      GF - 0.9,
      0.1,
      glassNight,
      0,
      (GF - 0.9) / 2 + 0.3,
      fz - s * 0.5,
      false,
      false,
    );
    g.add(warm);
    glowWindows.push(warm);

    const glassS = box(
      cfg.w - 2,
      GF - 1.4,
      0.12,
      glassMat,
      0,
      (GF - 1.4) / 2 + 0.3,
      -fz + s * 0.3,
      false,
    );
    g.add(glassS);
    for (let i = 0; i <= 4; i++) {
      const px = -cfg.w / 2 + i * (cfg.w / 4);
      g.add(box(0.24, GF, 0.24, frameMat, px, GF / 2, fz - s * 0.25));
    }

    g.add(box(cfg.w + 2.6, 0.45, cfg.d + 2.6, canopyMat, 0, GF + 0.22, 0));
    g.add(box(cfg.w + 2.4, 0.05, cfg.d + 2.4, soffitMat, 0, GF - 0.02, 0, false));

    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(cfg.w * 0.72, 1.0),
      cfg.signMat,
    );
    sign.position.set(0, GF - 0.42, fz + s * 1.46);
    sign.rotation.y = Math.PI;
    g.add(sign);
    g.add(
      box(
        cfg.w * 0.72 + 0.2,
        1.04,
        0.1,
        frameMat,
        0,
        GF - 0.42,
        fz + s * 1.4,
        false,
      ),
    );

    g.add(steelRail(cfg.w - 0.2, 0, GF + 0.45, fz + s * 0.1));
    g.add(steelRail(cfg.w - 0.2, 0, GF + 0.45, -fz - s * 0.1));
    g.add(steelRail(cfg.d - 0.2, -cfg.w / 2 + 0.1, GF + 0.45, 0, Math.PI / 2));
    g.add(steelRail(cfg.d - 0.2, cfg.w / 2 - 0.1, GF + 0.45, 0, Math.PI / 2));

    const deck = plane(cfg.w - 0.6, cfg.d - 0.6, deckMatShared);
    deck.position.set(0, GF + 0.46, 0);
    g.add(deck);

    g.add(pergola(cfg.w * 0.5, cfg.d * 0.55, -cfg.w * 0.18, GF + 3.0, s * 0.5));
    const pw = cfg.w * 0.25;
    const pd = cfg.d * 0.275;
    [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ].forEach((q) => {
      g.add(
        box(
          0.14,
          2.55,
          0.14,
          steelMat,
          -cfg.w * 0.18 + q[0] * pw,
          GF + 0.45 + 1.28,
          s * 0.5 + q[1] * pd,
        ),
      );
    });

    const u1 = umbrella(cfg.w * 0.26, s * 1.6, PALETTE.dorado);
    u1.position.y = GF + 0.45;
    g.add(u1);
    const u2 = umbrella(-cfg.w * 0.05, s * 2.4, 0xf3ecdd);
    u2.position.y = GF + 0.45;
    g.add(u2);
    const u3 = umbrella(0, 0, 0xf3ecdd);
    u3.position.set(cfg.w * 0.3, GF + 0.45, -s * 2.2);
    g.add(u3);

    for (let i = 0; i < 4; i++) {
      const t = cyl(
        0.5,
        0.5,
        0.06,
        woodMat2,
        -cfg.w * 0.3 + i * (cfg.w * 0.2),
        GF + 0.83,
        (i % 2 ? -1.8 : 1.8) * s,
        10,
        false,
      );
      g.add(t);
      g.add(
        cyl(
          0.06,
          0.08,
          0.72,
          woodMat,
          t.position.x,
          GF + 0.45 + 0.36,
          t.position.z,
          6,
          false,
        ),
      );
    }

    g.position.set(cfg.x, 0, cfg.z);
    scene.add(g);
    return g;
  }

  /* ---- Bloque E: PB locales + P2 GIMNASIO vidriado + ROOFTOP fitness ---- */
  function buildGymBlock(cfg: {
    x: number;
    z: number;
    w: number;
    d: number;
    shops?: number;
    signMat: THREE.Material;
    gymSignMat: THREE.Material;
  }) {
    const g = new THREE.Group();
    const GF = 4.2;
    const UF2 = 4.0;
    const s = -1;
    const fz = (s * cfg.d) / 2;

    g.add(box(cfg.w, GF, cfg.d - 1.4, wallMatA, 0, GF / 2, -s * 0.7));
    g.add(box(cfg.w, 0.35, cfg.d - 1.2, frameMat, 0, 0.17, -s * 0.7));
    const glass = box(
      cfg.w - 0.9,
      GF - 1.0,
      0.12,
      glassMat,
      0,
      (GF - 1.0) / 2 + 0.35,
      fz - s * 0.35,
      false,
    );
    g.add(glass);
    const glassWarm = box(
      cfg.w - 0.9,
      GF - 1.0,
      0.1,
      glassNight,
      0,
      (GF - 1.0) / 2 + 0.35,
      fz - s * 0.55,
      false,
      false,
    );
    g.add(glassWarm);
    glowWindows.push(glassWarm);

    const nMod = cfg.shops || 4;
    for (let i = 0; i <= nMod; i++) {
      const px = -cfg.w / 2 + i * (cfg.w / nMod);
      g.add(box(0.22, GF, 0.22, frameMat, px, GF / 2, fz - s * 0.3));
      g.add(
        box(0.18, GF + 0.7, 0.18, steelMat, px, (GF + 0.7) / 2, fz + s * 1.5),
      );
    }

    g.add(box(cfg.w + 0.6, 0.32, cfg.d + 2.6, canopyMat, 0, GF + 0.16, s * 0.6));
    const brd = s * (0.6 + (cfg.d + 2.6) / 2) - s * 0.16;
    const signG = new THREE.Mesh(
      new THREE.PlaneGeometry(cfg.w + 0.2, 0.95),
      cfg.signMat,
    );
    signG.position.set(0, GF - 0.32, brd + s * 0.06);
    signG.rotation.y = Math.PI;
    g.add(signG);
    g.add(box(cfg.w + 0.3, 0.99, 0.1, frameMat, 0, GF - 0.32, brd, false));

    /* P2: caja de vidrio del gimnasio (muro cortina, perfiles negros) */
    const w2 = cfg.w - 2;
    const d2 = cfg.d - 1.5;
    const y0 = GF + 0.35;
    const ceil = y0 + UF2;
    g.add(box(w2, 0.2, d2, frameMat, 0, y0 + 0.1, 0));
    const floorIn = plane(w2 - 0.6, d2 - 0.6, mat(0x2b3136, 0.9));
    floorIn.position.set(0, y0 + 0.22, 0);
    g.add(floorIn);

    (
      [
        [0, -d2 / 2, w2, 0],
        [0, d2 / 2, w2, Math.PI],
        [-w2 / 2, 0, d2, Math.PI / 2],
        [w2 / 2, 0, d2, -Math.PI / 2],
      ] as [number, number, number, number][]
    ).forEach((f) => {
      const gl = new THREE.Mesh(
        new THREE.PlaneGeometry(f[2] - 0.2, UF2 - 0.5),
        glassMat,
      );
      gl.position.set(f[0], y0 + UF2 / 2, f[1]);
      gl.rotation.y = f[3];
      g.add(gl);

      const coldMat = new THREE.MeshStandardMaterial({
        color: 0xdfeff6,
        transparent: true,
        opacity: 0.8,
        emissive: 0xcfe6f2,
        emissiveIntensity: 0,
        side: THREE.DoubleSide,
      });
      const cold = new THREE.Mesh(
        new THREE.PlaneGeometry(f[2] - 0.2, UF2 - 0.5),
        coldMat,
      );
      const ix = f[0] === 0 ? 0 : f[0] < 0 ? 0.12 : -0.12;
      const iz = f[1] === 0 ? 0 : f[1] < 0 ? 0.12 : -0.12;
      cold.position.set(f[0] + ix, y0 + UF2 / 2, f[1] + iz);
      cold.rotation.y = f[3];
      g.add(cold);
      gymGlows.push(coldMat);

      const nP = Math.round(f[2] / 2.4);
      for (let i = 0; i <= nP; i++) {
        const off = -f[2] / 2 + 0.1 + i * ((f[2] - 0.2) / nP);
        const p =
          Math.abs(f[1]) > 0.1
            ? box(0.14, UF2, 0.14, frameMat, off, y0 + UF2 / 2, f[1], false)
            : box(0.14, UF2, 0.14, frameMat, f[0], y0 + UF2 / 2, off, false);
        g.add(p);
      }
    });

    [
      [-w2 / 2, -d2 / 2],
      [w2 / 2, -d2 / 2],
      [-w2 / 2, d2 / 2],
      [w2 / 2, d2 / 2],
    ].forEach((c) => g.add(box(0.24, UF2, 0.24, steelMat, c[0], y0 + UF2 / 2, c[1])));

    [-8.5, -5.5, -2.5].forEach((x) =>
      g.add(box(1.2, 2.0, 0.5, frameMat, x, y0 + 1.2, -1, false)),
    );
    [3.2, 5.8].forEach((x) => {
      g.add(box(0.8, 0.28, 1.7, steelMat, x, y0 + 0.36, -1, false));
      g.add(box(0.8, 0.9, 0.14, frameMat, x, y0 + 1.0, -1.7, false));
    });
    [
      [-7, 0.6],
      [1, 0.2],
      [7, -0.8],
    ].forEach((p) => {
      g.add(cyl(0.15, 0.19, 0.9, mat(0x8fa5a8, 0.95), p[0], y0 + 0.68, p[1], 8, false));
      const hd = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 8, 8),
        mat(0xc9a184, 0.9),
      );
      hd.position.set(p[0], y0 + 1.3, p[1]);
      g.add(hd);
    });

    const gymSign = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 1.5),
      cfg.gymSignMat,
    );
    gymSign.position.set(0, ceil - 0.95, -d2 / 2 - 0.18);
    gymSign.rotation.y = Math.PI;
    g.add(gymSign);
    g.add(box(9.2, 1.56, 0.1, frameMat, 0, ceil - 0.95, -d2 / 2 - 0.12, false));

    /* ROOFTOP fitness */
    const rw = cfg.w - 0.6;
    const rd = cfg.d - 0.4;
    const ry = ceil + 0.17;
    g.add(box(cfg.w + 1.0, 0.4, cfg.d + 1.0, canopyMat, 0, ceil + 0.02, 0));
    const rdeck = plane(rw - 0.4, rd - 0.4, deckMatShared);
    rdeck.position.set(0, ry + 0.05, 0);
    g.add(rdeck);

    const turf = plane(9, 5.6, mat(0x7fa85b, 1));
    turf.position.set(-7.6, ry + 0.06, 0.4);
    g.add(turf);

    g.add(steelRail(rw, 0, ry, -rd / 2 + 0.1));
    g.add(steelRail(rw, 0, ry, rd / 2 - 0.1));
    g.add(steelRail(rd, -rw / 2 + 0.1, ry, 0, Math.PI / 2));
    g.add(steelRail(rd, rw / 2 - 0.1, ry, 0, Math.PI / 2));

    g.add(pergola(9, 6.4, 7.6, ry + 2.8, 0.2, canopyMat));
    [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ].forEach((q) =>
      g.add(
        box(0.16, 2.8, 0.16, canopyMat, 7.6 + q[0] * 4.2, ry + 1.4, 0.2 + q[1] * 2.9),
      ),
    );

    [
      [-10.6, -0.8],
      [-5.0, 1.4],
    ].forEach((p) => {
      g.add(box(0.09, 2.3, 0.09, steelMat, p[0] - 1, ry + 1.15, p[1], false));
      g.add(box(0.09, 2.3, 0.09, steelMat, p[0] + 1, ry + 1.15, p[1], false));
      g.add(box(2.2, 0.08, 0.08, steelMat, p[0], ry + 2.28, p[1], false));
    });

    const ru = umbrella(2.2, -2.0, PALETTE.dorado);
    ru.position.y = ry;
    g.add(ru);

    [
      [1.8, 1.8, 0x9bb1a0],
      [-7.4, 0.4, 0xb98f6d],
    ].forEach((p) => {
      g.add(cyl(0.15, 0.19, 0.9, mat(p[2], 0.95), p[0], ry + 0.5, p[1], 8, false));
      const hd = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 8, 8),
        mat(0xc9a184, 0.9),
      );
      hd.position.set(p[0], ry + 1.12, p[1]);
      g.add(hd);
    });

    g.position.set(cfg.x, 0, cfg.z);
    scene.add(g);
    return g;
  }

  /* ---- Escalera exterior metálica del gimnasio (lado este del bloque E) ---- */
  function buildStair() {
    const g = new THREE.Group();
    const stepsMat = mat(0xb9b2a5, 0.7, 0.3);
    function flight(len: number, rise: number, cx: number, cy: number, cz: number) {
      const L = Math.hypot(len, rise);
      const f = box(1.3, 0.14, L, stepsMat, cx, cy, cz);
      f.rotation.x = -Math.atan(rise / len);
      g.add(f);
      [[-0.62], [0.62]].forEach(([ox]) => {
        const r = box(0.05, 0.06, L, steelMat, cx + ox, cy + 0.58, cz, false);
        r.rotation.x = -Math.atan(rise / len);
        g.add(r);
        const r2 = box(0.05, 0.06, L, steelMat, cx + ox, cy + 0.28, cz, false);
        r2.rotation.x = -Math.atan(rise / len);
        g.add(r2);
      });
    }
    flight(4, 4.55, 14.9, 2.27, 18.5);
    g.add(box(2.6, 0.14, 1.7, stepsMat, 14.2, 4.55, 21.3));
    g.add(steelRail(1.7, 15.5, 4.55, 21.3, Math.PI / 2));
    flight(4, 4.17, 14.9, 6.63, 24);
    [
      [14.9, 4.55, 21.9],
      [14.9, 8.6, 26],
      [14.9, 2.2, 16.6],
    ].forEach((p) => g.add(box(0.16, p[1], 0.16, steelMat, p[0], p[1] / 2, p[2])));
    scene.add(g);
  }

  /* ---- Tótem / pylon de acceso ---- */
  function buildTotem() {
    const g = new THREE.Group();
    g.add(box(1.2, 0.9, 1.2, steelMat, 0, 0.45, 0));
    g.add(box(1.7, 7.6, 0.55, canopyMat, 0, 4.6, 0));
    const t = canvasTex(512, 1024, (ctx, w, h) => {
      ctx.fillStyle = '#F7F5EF';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#D9A441';
      ctx.fillRect(0, h * 0.3, w, 10);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0E3A53';
      ctx.font = '600 92px Cambria, Georgia, serif';
      ctx.fillText('VILA', w / 2, h * 0.12);
      ctx.fillText('CAPIVARAS', w / 2, h * 0.235);
      ctx.fillStyle = '#17798A';
      ctx.font = '44px Calibri, sans-serif';
      ctx.fillText('paseo · gym · flats', w / 2, h * 0.38);
    });
    const pm = new THREE.MeshStandardMaterial({
      map: t,
      roughness: 0.6,
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveMap: t,
      emissiveIntensity: 0,
    });
    signGlows.push(pm);
    [0.29, -0.29].forEach((zz, i) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 7.3), pm);
      p.position.set(0, 4.65, zz);
      if (i === 1) p.rotation.y = Math.PI;
      g.add(p);
    });
    g.position.set(11.5, 0, -28.6);
    scene.add(g);
  }

  /* -------- Colocación (mismo parti de la Idea A) -------- */
  const signA = tenantSignMat(['BISTRÔ DA LAGOA', 'cocina de mar'], 1100, true);
  const signB = tenantSignMat(['MAR & BRASA', 'parrilla · rooftop'], 1100, true);
  const signC = tenantSignMat(['GELATO', 'SURF SHOP', 'CAFÉ DA LAGOA']);
  const signD = tenantSignMat(['MODA BÚZIOS', 'ÓTICA SOL', 'LIVRARIA']);
  const signE = tenantSignMat(
    ['MERCADINHO', 'FARMÁCIA', 'PET & CIA', 'PADARIA'],
    1500,
  );
  const signGym = tenantSignMat(['VILA FIT', 'academia · rooftop'], 1100, true);

  buildAnchor({ x: -18, z: -19, w: 18, d: 10, signMat: signA });
  buildAnchor({ x: 18, z: -19, w: 18, d: 10, signMat: signB });
  buildBlock({
    x: -16,
    z: 1,
    w: 14,
    d: 18,
    shops: 3,
    signMat: signC,
    rotationY: -Math.PI / 2,
  });
  buildBlock({
    x: 16,
    z: 1,
    w: 14,
    d: 18,
    shops: 3,
    signMat: signD,
    rotationY: Math.PI / 2,
  });
  buildGymBlock({
    x: 0,
    z: 21,
    w: 28,
    d: 10,
    shops: 4,
    signMat: signE,
    gymSignMat: signGym,
  });

  buildStair();
  buildTotem();

  /* ---------- Portal de acceso (norte, frente a la laguna) ---------- */
  const signTex = canvasTex(1024, 240, (ctx, w, h) => {
    ctx.fillStyle = '#F7F5EF';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#D9A441';
    ctx.lineWidth = 6;
    ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.fillStyle = '#0E3A53';
    ctx.textAlign = 'center';
    ctx.font = '600 96px Cambria, Georgia, serif';
    ctx.fillText('VILA CAPIVARAS', w / 2, 118);
    ctx.fillStyle = '#17798A';
    ctx.font = '34px Calibri, sans-serif';
    ctx.fillText('paseo · gastronomía · fitness · flats', w / 2, 178);
  });
  const portalSignMat = new THREE.MeshStandardMaterial({
    map: signTex,
    roughness: 0.65,
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveMap: signTex,
    emissiveIntensity: 0,
  });
  signGlows.push(portalSignMat);
  const portal = new THREE.Group();
  portal.add(box(0.4, 4.8, 0.4, steelMat, -7.5, 2.4, 0));
  portal.add(box(0.4, 4.8, 0.4, steelMat, 7.5, 2.4, 0));
  portal.add(box(16.6, 0.62, 0.7, canopyMat, 0, 4.8, 0));
  const signM = new THREE.Mesh(
    new THREE.PlaneGeometry(11, 2.5),
    portalSignMat,
  );
  signM.position.set(0, 3.35, 0.36);
  signM.castShadow = !isSoftwareGl;
  portal.add(signM);
  const signM2 = signM.clone();
  signM2.rotation.y = Math.PI;
  signM2.position.z = -0.36;
  portal.add(signM2);
  portal.position.set(0, 0, -25.4);
  scene.add(portal);

  /* ---------- Mobiliario: bancos y farolas ---------- */
  function bench(x: number, z: number, ry = 0) {
    const g = new THREE.Group();
    g.add(box(2, 0.1, 0.55, woodMat2, 0, 0.48, 0));
    g.add(box(2, 0.5, 0.1, woodMat2, 0, 0.75, -0.26));
    g.add(box(0.12, 0.48, 0.5, steelMat, -0.85, 0.24, 0));
    g.add(box(0.12, 0.48, 0.5, steelMat, 0.85, 0.24, 0));
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    scene.add(g);
  }
  bench(-4.1, -4, Math.PI / 2);
  bench(4.1, -1, -Math.PI / 2);
  bench(-4.1, 7, Math.PI / 2);
  bench(4.1, 11, -Math.PI / 2);
  bench(-6, -22.6, 0);
  bench(6, -22.6, 0);

  const lampHeads: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>[] = [];
  function lamp(x: number, z: number) {
    const g = new THREE.Group();
    g.add(cyl(0.07, 0.1, 4, steelMat, 0, 2, 0, 8));
    g.add(box(0.9, 0.06, 0.06, steelMat, 0.42, 3.9, 0));
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.21, 12, 10),
      new THREE.MeshStandardMaterial({
        color: 0xfff3d1,
        roughness: 0.15,
        emissive: 0xffc868,
        emissiveIntensity: 0.32,
      }),
    );
    head.position.set(0.86, 3.84, 0);
    g.add(head);
    lampHeads.push(head);
    g.position.set(x, 0, z);
    scene.add(g);
  }
  lamp(-6.4, -9);
  lamp(6.4, -5);
  lamp(-6.4, 0);
  lamp(6.4, 5);
  lamp(-6.4, 10);
  lamp(6.4, 14);
  lamp(-7, -19);
  lamp(7, -19);

  [
    umbrella(-5.5, -16.6, PALETTE.dorado),
    umbrella(5.5, -16.6, 0xf3ecdd),
  ].forEach((u) => scene.add(u));

  /* ---------- Vegetación ---------- */
  function palm(x: number, z: number, h = 6) {
    const g = new THREE.Group();
    let px = 0;
    let py = 0;
    const tilt = (rng() - 0.5) * 0.16;
    for (let i = 0; i < 3; i++) {
      const seg = cyl(
        0.14 - 0.03 * i,
        0.18 - 0.03 * i,
        h / 3,
        mat(PALETTE.tronco, 0.95),
        px,
        py + h / 6,
        0,
        7,
      );
      seg.rotation.z = tilt * (i + 1);
      g.add(seg);
      py += h / 3;
      px += Math.sin(tilt * (i + 1)) * (h / 3);
    }
    const crown = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const f = new THREE.Mesh(
        new THREE.ConeGeometry(0.32, 3.1, 4, 1),
        mat(0x4c7a3a, 1),
      );
      f.position.y = 0.2;
      f.geometry.translate(0, -1.4, 0);
      f.rotation.z = Math.PI / 2.4;
      f.rotation.y = i * ((Math.PI * 2) / 7);
      f.castShadow = !isSoftwareGl;
      crown.add(f);
    }
    crown.position.set(px, py + 0.2, 0);
    g.add(crown);
    const coco = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 8, 7),
      mat(0x3e6330, 1),
    );
    coco.position.set(px, py + 0.15, 0);
    coco.castShadow = !isSoftwareGl;
    g.add(coco);
    g.position.set(x, 0, z);
    scene.add(g);
  }

  function tree(x: number, z: number, s = 1) {
    const g = new THREE.Group();
    g.add(
      cyl(
        0.14 * s,
        0.2 * s,
        1.5 * s,
        mat(PALETTE.tronco, 0.95),
        0,
        0.75 * s,
        0,
        7,
      ),
    );
    const c1 = new THREE.Mesh(
      new THREE.SphereGeometry(1.5 * s, 10, 8),
      mat(PALETTE.verde, 1),
    );
    c1.position.y = 2.1 * s;
    c1.scale.set(1, 0.82, 1);
    c1.castShadow = !isSoftwareGl;
    g.add(c1);
    const c2 = new THREE.Mesh(
      new THREE.SphereGeometry(1.05 * s, 9, 7),
      mat(PALETTE.verdeOscuro, 1),
    );
    c2.position.set(0.8 * s, 2.6 * s, 0.3 * s);
    c2.castShadow = !isSoftwareGl;
    g.add(c2);
    g.position.set(x, 0, z);
    scene.add(g);
  }

  for (let x = -64; x <= 64; x += 16) palm(x, -39.2, 5.5 + rng() * 2);
  palm(-7.6, -16.4, 5.2);
  palm(7.6, -16.4, 5.6);
  palm(-1.4, -9.5, 4.6);
  palm(1.4, -4.5, 4.9);
  palm(-1.4, 6.5, 4.7);
  palm(1.4, 12, 5.1);

  [-37, 37].forEach((cx) => {
    tree(cx - 4.2, -12, 0.95);
    tree(cx + 4.2, -12, 0.9);
    tree(cx - 4.2, 10, 0.9);
    tree(cx + 4.2, 10, 0.95);
  });

  function ibdfCluster(cx: number) {
    const patch = plane(
      15,
      7,
      new THREE.MeshStandardMaterial({ color: 0x54713f, roughness: 1 }),
      cx,
      0.04,
      22.2,
    );
    scene.add(patch);
    tree(cx - 4.5, 21, 1.25);
    tree(cx - 1, 23, 1.4);
    tree(cx + 3.5, 21.5, 1.2);
    tree(cx + 1.5, 20, 1.05);
    tree(cx + 5, 23.5, 1.3);
  }
  ibdfCluster(-37.2);
  ibdfCluster(37.2);
  tree(-27.5, -20, 0.85);
  tree(27.5, -20, 0.85);

  for (let i = 0; i < 16; i++) {
    const sx = (rng() < 0.5 ? -1 : 1) * (27 + rng() * 3);
    const sz = -8 + rng() * 20;
    const b = new THREE.Mesh(
      new THREE.SphereGeometry(0.5 + rng() * 0.3, 8, 6),
      hedgeMat,
    );
    b.position.set(sx, 0.42, sz);
    b.castShadow = !isSoftwareGl;
    scene.add(b);
  }

  /* ---------- Vehículos (paleta viva, como el render de referencia) ---------- */
  const carColors = [
    0xc0392b, 0xd8d3c8, 0x2e86ab, 0x8d9aa3, 0xd9a441, 0x5d6d78, 0x17798a,
    0xb9b2a5, 0x1b1f23,
  ];
  function car(x: number, z: number, ry = 0, ci = 0) {
    const g = new THREE.Group();
    const c = carColors[ci % carColors.length];
    g.add(box(4.1, 0.62, 1.8, mat(c, 0.5, 0.35), 0, 0.52, 0));
    g.add(box(2.2, 0.55, 1.6, mat(0x33424c, 0.3, 0.4), -0.15, 1.05, 0));
    [
      [-1.35, 0.75],
      [1.35, 0.75],
      [-1.35, -0.75],
      [1.35, -0.75],
    ].forEach((w) => {
      const wh = cyl(
        0.32,
        0.32,
        0.24,
        mat(0x22262a, 0.8),
        w[0],
        0.32,
        w[1],
        10,
        false,
      );
      wh.rotation.x = Math.PI / 2;
      g.add(wh);
    });
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    scene.add(g);
  }

  let ci = 0;
  [[-37], [37]].forEach(([cx]) => {
    for (let i = 0; i < 8; i++) {
      const z = -19.4 + i * 2.5;
      if (Math.abs(z + (cx < 0 ? 2 : 0)) < 3.2 && i % 3 === 0) continue;
      if (rng() < 0.7) car(cx - 5.2, z, 0, ci++);
      if (rng() < 0.7) car(cx + 5.2, z + 1.2, Math.PI, ci++);
    }
    for (let i = 0; i < 5; i++) {
      const z = 4 + i * 2.5;
      if (rng() < 0.7) car(cx - 5.2, z, 0, ci++);
      if (rng() < 0.6) car(cx + 5.2, z + 1.2, Math.PI, ci++);
    }
  });
  car(-30, -31.4, 0, 1);
  car(22, -35.6, Math.PI, 0);
  car(-50, 14, Math.PI / 2, 4);

  /* ---------- Personas ---------- */
  const skin = mat(0xc9a184, 0.9);
  function person(x: number, z: number, c = 0x8fa5a8, ry = 0) {
    const g = new THREE.Group();
    g.add(cyl(0.16, 0.2, 0.95, mat(c, 0.95), 0, 0.62, 0, 8));
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.14, 9, 8), skin);
    h.position.y = 1.28;
    h.castShadow = !isSoftwareGl;
    g.add(h);
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    scene.add(g);
  }
  person(-2, -20, 0xb98f6d);
  person(1.5, -18.4, 0x7d8a99, 1);
  person(-1, -12, 0x8fa5a8);
  person(2.5, -6, 0xc8b9a3, 2);
  person(-2.2, 3.6, 0x9bb1a0);
  person(1.8, 8, 0xb98f6d, 1.4);
  person(-0.6, 14.6, 0x7d8a99);
  person(-14, -41.2, 0xc8b9a3);
  person(9, -41.2, 0x8fa5a8, 2.4);
  person(-9, -24.6, 0x9bb1a0, 0.6);
  person(13.4, 16.8, 0xc0392b, 2.6);

  /* ---------- Capivaras junto a la laguna ---------- */
  function capybara(x: number, z: number, ry = 0, inWater = false) {
    const g = new THREE.Group();
    const bodyM = mat(0x7a5a3a, 0.95);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), bodyM);
    b.scale.set(1.35, 0.85, 0.8);
    b.position.y = 0.42;
    b.castShadow = !isSoftwareGl;
    g.add(b);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.27, 9, 8), bodyM);
    h.scale.set(1.25, 0.9, 0.85);
    h.position.set(0.66, 0.58, 0);
    h.castShadow = !isSoftwareGl;
    g.add(h);
    const nose = box(0.2, 0.16, 0.22, mat(0x5e4429, 0.95), 0.95, 0.53, 0, false);
    g.add(nose);
    [0.09, -0.09].forEach((o) => {
      const e = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 6, 6),
        mat(0x5e4429, 0.95),
      );
      e.position.set(0.58, 0.8, o * 2);
      g.add(e);
    });
    g.position.set(x, inWater ? -0.24 : 0, z);
    g.rotation.y = ry;
    scene.add(g);
  }
  capybara(-15, -43.6, 0.5);
  capybara(-11.6, -44.4, -0.4);
  capybara(-13.4, -46.4, 0.2, true);

  /* ---------- Contexto vecino ---------- */
  function house(x: number, z: number, ry = 0) {
    const g = new THREE.Group();
    g.add(box(9, 3.2, 7, mat(0xf2ede0, 0.88), 0, 1.6, 0));
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(6.4, 2.2, 4),
      mat(0xb1654a, 0.9),
    );
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 4.2;
    roof.scale.set(1, 1, 0.8);
    roof.castShadow = !isSoftwareGl;
    g.add(roof);
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    scene.add(g);
  }
  house(-30, 33);
  house(-10, 34, 0.1);
  house(12, 33.4, -0.08);
  house(32, 34);
  house(-62, -14, 0.12);
  house(-63, 6);
  house(62, -10, -0.1);
  house(63, 12);
  [-30, -10, 12, 32].forEach((x) => tree(x + 6, 31.4, 0.8));
  tree(-60, -2, 1);
  tree(61, 2, 1);

  /* ---------- Etiquetas ---------- */
  const labelGroup = new THREE.Group();
  scene.add(labelGroup);

  function makeLabel(
    title: string,
    sub: string,
    x: number,
    y: number,
    z: number,
    anchorY = 0.2,
    scale = 1,
  ) {
    const pad = 26;
    const fT = 44;
    const fS = 30;
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d')!;
    ctx.font = `700 ${fT}px Calibri, sans-serif`;
    const wT = ctx.measureText(title).width;
    ctx.font = `${fS}px Calibri, sans-serif`;
    const wS = sub ? ctx.measureText(sub).width : 0;
    const w = Math.ceil(Math.max(wT, wS)) + pad * 2 + 14;
    const h = sub ? 128 : 88;
    c.width = w;
    c.height = h;
    const r = 18;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(w - r, 0);
    ctx.quadraticCurveTo(w, 0, w, r);
    ctx.lineTo(w, h - r);
    ctx.quadraticCurveTo(w, h, w - r, h);
    ctx.lineTo(r, h);
    ctx.quadraticCurveTo(0, h, 0, h - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(14,58,83,.93)';
    ctx.fill();
    ctx.fillStyle = '#D9A441';
    ctx.fillRect(0, 0, 8, h);
    ctx.fillStyle = '#FBFAF6';
    ctx.font = `700 ${fT}px Calibri, sans-serif`;
    ctx.fillText(title, pad + 8, sub ? 56 : 58);
    if (sub) {
      ctx.fillStyle = '#F3ECDD';
      ctx.font = `${fS}px Calibri, sans-serif`;
      ctx.fillText(sub, pad + 8, 100);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    createdTextures.push(t);
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: t, depthTest: true, transparent: true }),
    );
    const k = 0.021 * scale;
    sp.scale.set(w * k, h * k, 1);
    sp.position.set(x, y, z);
    sp.userData = { anchorPos: new THREE.Vector3(x, y, z) };
    labelGroup.add(sp);
    const lineG = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, anchorY, z),
      new THREE.Vector3(x, y - (h * k) / 2, z),
    ]);
    const line = new THREE.Line(
      lineG,
      new THREE.LineBasicMaterial({
        color: PALETTE.oceano,
        transparent: true,
        opacity: 0.75,
      }),
    );
    line.userData = { anchorPos: new THREE.Vector3(x, y, z) };
    labelGroup.add(line);
  }

  makeLabel('Acceso peatonal único', 'frente a la laguna · art. 26', 0, 10.5, -25.4, 5.1);
  makeLabel('Paseo peatonal ≥ 5 m', 'galería interior — art. 26 LUOS', 0, 7.5, 6, 0.1);
  makeLabel('Restaurante ancla 1', '150–200 m² + rooftop', -18, 12.4, -19, 8.6);
  makeLabel('Restaurante ancla 2', '150–200 m² + rooftop', 18, 12.4, -19, 8.6);
  makeLabel('Locales 40–120 m²', 'PB · cartelas al paseo', -16, 12.6, 1, 8.8);
  makeLabel('Flats 80–100 m²', 'PA · madera + canopy blanco', 16, 12.6, 1, 8.8);
  makeLabel('Gimnasio · P2', '≈220 m² + rooftop fitness', 0, 13.8, 21, 9.6);
  makeLabel('Escalera exterior', 'acceso gym / rooftop', 15, 10.6, 21, 8.7, 0.85);
  makeLabel('Estacionamiento', '~60–70 plazas · sombra arbolada', -37, 8.6, -1, 0.1);
  makeLabel('Acceso vehicular', 'desde calle lateral', 46, 5.6, -1, 0.1, 0.9);
  makeLabel('Acceso vehicular', 'desde calle lateral', -46, 5.6, -1, 0.1, 0.9);
  makeLabel('Lagoa das Capivaras', 'frente paisajístico', 4, 7, -70, 0.1);
  makeLabel('Vegetación nativa', 'ref. Termo IBDF 1983', -37.2, 9, 22.2, 4.2, 0.9);
  makeLabel('Av. José Bento Ribeiro Dantas', '(Estrada da Usina)', -58, 5.4, -33.5, 0.1, 0.85);

  /* ---------- Tótems fotográficos 3D de los renders reales ---------- */
  const renderBoardsGroup = new THREE.Group();
  scene.add(renderBoardsGroup);
  const texLoader = new THREE.TextureLoader();
  const goldTrimMat = mat(PALETTE.dorado, 0.35, 0.45);
  const renderBoardMaterials: THREE.MeshStandardMaterial[] = [];

  PROJECT_RENDERS.forEach((item) => {
    const boardGroup = new THREE.Group();
    const bw = 3.0;
    const bh = 2.0;

    // Pedestal columns + dark architectural frame + gold accent trim
    const postL = box(0.1, 1.1, 0.1, steelMat, -bw * 0.38, -bh * 0.5 - 0.5, 0, false);
    const postR = box(0.1, 1.1, 0.1, steelMat, bw * 0.38, -bh * 0.5 - 0.5, 0, false);
    const frameBox = box(bw + 0.2, bh + 0.2, 0.12, frameMat, 0, 0, 0, false);
    const goldBorder = box(bw + 0.28, bh + 0.28, 0.08, goldTrimMat, 0, 0, 0, false);
    boardGroup.add(postL, postR, goldBorder, frameBox);

    const tex = texLoader.load(item.imageUrl, () => {
      onTextureLoaded?.();
    });
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    createdTextures.push(tex);

    const photoMat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.35,
      metalness: 0.05,
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveMap: tex,
      emissiveIntensity: 0.16,
    });
    renderBoardMaterials.push(photoMat);

    const frontFace = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), photoMat);
    frontFace.position.set(0, 0, 0.085);
    frontFace.userData = { renderId: item.id };
    boardGroup.add(frontFace);

    const backFace = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), photoMat);
    backFace.position.set(0, 0, -0.085);
    backFace.rotation.y = Math.PI;
    backFace.userData = { renderId: item.id };
    boardGroup.add(backFace);

    frameBox.userData = { renderId: item.id };
    goldBorder.userData = { renderId: item.id };

    // Floating camera badge above the 3D render board
    const badgeCanvas = document.createElement('canvas');
    badgeCanvas.width = 480;
    badgeCanvas.height = 92;
    const bctx = badgeCanvas.getContext('2d')!;
    bctx.fillStyle = 'rgba(14, 58, 83, 0.96)';
    bctx.beginPath();
    bctx.roundRect(4, 4, 472, 84, 42);
    bctx.fill();
    bctx.strokeStyle = '#D9A441';
    bctx.lineWidth = 5;
    bctx.stroke();
    bctx.fillStyle = '#D9A441';
    bctx.font = '700 32px Calibri, sans-serif';
    bctx.textAlign = 'center';
    bctx.textBaseline = 'middle';
    bctx.fillText(`📷 Render: ${item.shortLabel}`, 240, 48);

    const badgeTex = new THREE.CanvasTexture(badgeCanvas);
    badgeTex.colorSpace = THREE.SRGBColorSpace;
    createdTextures.push(badgeTex);

    const badgeSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: badgeTex, depthTest: true, transparent: true }),
    );
    badgeSprite.scale.set(3.8, 0.74, 1);
    badgeSprite.position.set(0, bh * 0.5 + 0.65, 0);
    badgeSprite.userData = { renderId: item.id };
    boardGroup.add(badgeSprite);

    boardGroup.position.set(item.hotspotPos.x, item.hotspotPos.y, item.hotspotPos.z);
    boardGroup.rotation.y = item.rotationY;
    boardGroup.userData = { renderId: item.id };
    renderBoardsGroup.add(boardGroup);
  });

  // Warm architectural point lights along the paseo and entrance for sunset glow
  const paseoWarmLights: THREE.PointLight[] = [
    new THREE.PointLight(0xffb866, 0, 22, 1.8),
    new THREE.PointLight(0xffb866, 0, 22, 1.8),
    new THREE.PointLight(0xffb866, 0, 24, 1.8),
  ];
  paseoWarmLights[0].position.set(0, 4.2, -18);
  paseoWarmLights[1].position.set(0, 4.2, 1);
  paseoWarmLights[2].position.set(0, 6.5, 19);
  paseoWarmLights.forEach((pl) => scene.add(pl));

  function setDaytime(evening: boolean) {
    if (evening) {
      skyMat.map = skySunset;
      skyMat.needsUpdate = true;
      sun.position.set(-95, 17, -42);
      sun.color.set(0xff9e54);
      sun.intensity = 1.12;
      hemi.color.set(0xd99b72);
      hemi.groundColor.set(0x4a3b2c);
      hemi.intensity = 0.55;
      fill.color.set(0xd48a62);
      fill.intensity = 0.14;
      scene.environmentIntensity = 0.32;
      if (scene.fog instanceof THREE.Fog) {
        scene.fog.color.set(0xd89468);
      }
      groundMat.color.set(0xd9b894);
      glowWindows.forEach((w) => {
        (w.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.15;
      });
      gymGlows.forEach((m) => {
        m.emissiveIntensity = 1.85;
      });
      signGlows.forEach((m) => {
        m.emissiveIntensity = 0.55;
      });
      renderBoardMaterials.forEach((m) => {
        m.emissiveIntensity = 0.55;
      });
      lampHeads.forEach((h) => {
        h.material.emissiveIntensity = 3.5;
      });
      paseoWarmLights.forEach((pl) => {
        pl.intensity = 1.45;
      });
      (aguaFuente.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.35;
      waterMat.color.set(0xb58364);
    } else {
      skyMat.map = skyDay;
      skyMat.needsUpdate = true;
      sun.position.set(65, 95, -35);
      sun.color.set(0xfff2df);
      sun.intensity = 1.26;
      hemi.color.set(0xdfeef7);
      hemi.groundColor.set(0x8a7a5c);
      hemi.intensity = 0.78;
      fill.color.set(0xcfe3ec);
      fill.intensity = 0.25;
      scene.environmentIntensity = 0.38;
      if (scene.fog instanceof THREE.Fog) {
        scene.fog.color.set(0xdcecf2);
      }
      groundMat.color.set(0xffffff);
      glowWindows.forEach((w) => {
        (w.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.12;
      });
      gymGlows.forEach((m) => {
        m.emissiveIntensity = 0.08;
      });
      signGlows.forEach((m) => {
        m.emissiveIntensity = 0.18;
      });
      renderBoardMaterials.forEach((m) => {
        m.emissiveIntensity = 0.16;
      });
      lampHeads.forEach((h) => {
        h.material.emissiveIntensity = 1.25;
      });
      paseoWarmLights.forEach((pl) => {
        pl.intensity = 0;
      });
      (aguaFuente.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.45;
      waterMat.color.set(0xffffff);
    }
  }

  function dispose() {
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material?.dispose();
        }
      }
    });
    createdTextures.forEach((t) => t.dispose());
    envRenderTarget.dispose();
  }

  return {
    scene,
    waterTex,
    labelGroup,
    renderBoardsGroup,
    setDaytime,
    dispose,
  };
}
