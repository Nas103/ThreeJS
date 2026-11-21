import * as THREE from 'three';

export interface TerrariumTextures {
  mossAlbedo: THREE.CanvasTexture;
  mossBump: THREE.CanvasTexture;
  strataAlbedo: THREE.CanvasTexture;
  strataBump: THREE.CanvasTexture;
  barkAlbedo: THREE.CanvasTexture;
  barkBump: THREE.CanvasTexture;
  stoneBump: THREE.CanvasTexture;
  waterNormal: THREE.DataTexture;
  brassBump: THREE.CanvasTexture;
  condensationRoughness: THREE.CanvasTexture;
  mistSprite: THREE.CanvasTexture;
  glowSprite: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function createTerrariumTextures(maxAnisotropy: number): TerrariumTextures {
  const aniso = Math.min(8, Math.max(1, maxAnisotropy));

  // 1. Moss Albedo & Bump
  const [mossCanvas, mossCtx] = makeCanvas(512, 512);
  const [mossBumpCanvas, mossBumpCtx] = makeCanvas(512, 512);
  const rngMoss = seededRand(101);
  mossCtx.fillStyle = '#486634';
  mossCtx.fillRect(0, 0, 512, 512);
  mossBumpCtx.fillStyle = '#808080';
  mossBumpCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 4200; i++) {
    const x = rngMoss() * 512;
    const y = rngMoss() * 512;
    const r = 1.5 + rngMoss() * 6.5;
    const shade = rngMoss();
    if (shade < 0.35) {
      mossCtx.fillStyle = 'rgba(46, 71, 31, 0.35)';
    } else if (shade < 0.72) {
      mossCtx.fillStyle = 'rgba(89, 118, 56, 0.32)';
    } else {
      mossCtx.fillStyle = 'rgba(116, 138, 67, 0.28)';
    }
    mossCtx.beginPath();
    mossCtx.arc(x, y, r, 0, Math.PI * 2);
    mossCtx.fill();

    const bVal = Math.floor(85 + shade * 145);
    mossBumpCtx.fillStyle = `rgba(${bVal},${bVal},${bVal},0.35)`;
    mossBumpCtx.beginPath();
    mossBumpCtx.arc(x, y, r * 0.85, 0, Math.PI * 2);
    mossBumpCtx.fill();
  }

  const mossAlbedo = new THREE.CanvasTexture(mossCanvas);
  mossAlbedo.colorSpace = THREE.SRGBColorSpace;
  mossAlbedo.wrapS = mossAlbedo.wrapT = THREE.RepeatWrapping;
  mossAlbedo.repeat.set(3, 3);
  mossAlbedo.anisotropy = aniso;

  const mossBump = new THREE.CanvasTexture(mossBumpCanvas);
  mossBump.wrapS = mossBump.wrapT = THREE.RepeatWrapping;
  mossBump.repeat.set(3, 3);
  mossBump.anisotropy = aniso;

  // 2. Geological Soil Strata Cross-Section (for the terrarium base wall)
  const [strataCanvas, strataCtx] = makeCanvas(512, 256);
  const [strataBumpCanvas, strataBumpCtx] = makeCanvas(512, 256);
  const rngStrata = seededRand(202);

  const grad = strataCtx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#362d23'); // Forest humus
  grad.addColorStop(0.35, '#2b231b'); // Dark peat
  grad.addColorStop(0.56, '#1a1b1d'); // Activated charcoal layer
  grad.addColorStop(0.68, '#5a5042'); // Mineral sand seam
  grad.addColorStop(0.76, '#3e3934'); // River grit
  grad.addColorStop(1.0, '#2a2826'); // Drainage gravel
  strataCtx.fillStyle = grad;
  strataCtx.fillRect(0, 0, 512, 256);

  strataBumpCtx.fillStyle = '#707070';
  strataBumpCtx.fillRect(0, 0, 512, 256);

  // Add organic soil flecks and lower drainage pebbles
  for (let i = 0; i < 1600; i++) {
    const x = rngStrata() * 512;
    const y = rngStrata() * 256;
    const isGravel = y > 175;
    const r = isGravel ? 3 + rngStrata() * 7 : 1 + rngStrata() * 3;
    const v = isGravel ? Math.floor(45 + rngStrata() * 85) : Math.floor(25 + rngStrata() * 50);
    strataCtx.fillStyle = isGravel
      ? `rgba(${v + 12}, ${v + 8}, ${v}, 0.85)`
      : `rgba(${v + 14}, ${v + 6}, ${v - 4}, 0.55)`;
    strataCtx.beginPath();
    strataCtx.ellipse(x, y, r * 1.3, r * 0.85, rngStrata() * Math.PI, 0, Math.PI * 2);
    strataCtx.fill();

    const bv = isGravel ? Math.floor(130 + rngStrata() * 110) : Math.floor(90 + rngStrata() * 90);
    strataBumpCtx.fillStyle = `rgba(${bv},${bv},${bv},0.65)`;
    strataBumpCtx.beginPath();
    strataBumpCtx.ellipse(x, y, r * 1.2, r * 0.8, 0, 0, Math.PI * 2);
    strataBumpCtx.fill();
  }

  const strataAlbedo = new THREE.CanvasTexture(strataCanvas);
  strataAlbedo.colorSpace = THREE.SRGBColorSpace;
  strataAlbedo.wrapS = THREE.RepeatWrapping;
  strataAlbedo.wrapT = THREE.ClampToEdgeWrapping;
  strataAlbedo.repeat.set(4, 1);
  strataAlbedo.anisotropy = aniso;

  const strataBump = new THREE.CanvasTexture(strataBumpCanvas);
  strataBump.wrapS = THREE.RepeatWrapping;
  strataBump.wrapT = THREE.ClampToEdgeWrapping;
  strataBump.repeat.set(4, 1);
  strataBump.anisotropy = aniso;

  // 3. Gnarled Bark Albedo & Bump
  const [barkCanvas, barkCtx] = makeCanvas(256, 512);
  const [barkBumpCanvas, barkBumpCtx] = makeCanvas(256, 512);
  const rngBark = seededRand(303);
  barkCtx.fillStyle = '#332924';
  barkCtx.fillRect(0, 0, 256, 512);
  barkBumpCtx.fillStyle = '#787878';
  barkBumpCtx.fillRect(0, 0, 256, 512);

  for (let i = 0; i < 420; i++) {
    const x = rngBark() * 256;
    const y = rngBark() * 512;
    const w = 1 + rngBark() * 4;
    const h = 24 + rngBark() * 70;
    const dark = rngBark() > 0.45;
    barkCtx.fillStyle = dark ? 'rgba(26, 20, 18, 0.55)' : 'rgba(84, 71, 63, 0.35)';
    barkCtx.fillRect(x, y, w, h);
    barkBumpCtx.fillStyle = dark ? 'rgba(40,40,40,0.6)' : 'rgba(210,210,210,0.45)';
    barkBumpCtx.fillRect(x, y, w, h);
  }
  // Subtle horizontal cherry-bark lenticels
  for (let i = 0; i < 140; i++) {
    const x = rngBark() * 256;
    const y = rngBark() * 512;
    barkCtx.fillStyle = 'rgba(130, 108, 96, 0.25)';
    barkCtx.fillRect(x, y, 10 + rngBark() * 18, 1.5);
  }

  const barkAlbedo = new THREE.CanvasTexture(barkCanvas);
  barkAlbedo.colorSpace = THREE.SRGBColorSpace;
  barkAlbedo.wrapS = barkAlbedo.wrapT = THREE.RepeatWrapping;
  barkAlbedo.repeat.set(2, 4);
  barkAlbedo.anisotropy = aniso;

  const barkBump = new THREE.CanvasTexture(barkBumpCanvas);
  barkBump.wrapS = barkBump.wrapT = THREE.RepeatWrapping;
  barkBump.repeat.set(2, 4);
  barkBump.anisotropy = aniso;

  // 4. Basalt Stone Bump
  const [stoneCanvas, stoneCtx] = makeCanvas(256, 256);
  const rngStone = seededRand(404);
  stoneCtx.fillStyle = '#808080';
  stoneCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1200; i++) {
    const x = rngStone() * 256;
    const y = rngStone() * 256;
    const r = 1 + rngStone() * 8;
    const v = Math.floor(40 + rngStone() * 180);
    stoneCtx.fillStyle = `rgba(${v},${v},${v},0.3)`;
    stoneCtx.fillRect(x, y, r, r * 0.7);
  }
  const stoneBump = new THREE.CanvasTexture(stoneCanvas);
  stoneBump.wrapS = stoneBump.wrapT = THREE.RepeatWrapping;
  stoneBump.anisotropy = aniso;

  // 5. Pond Water Ripple Normal Map (procedural tangent-space normals)
  const size = 256;
  const normalData = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * Math.PI * 2;
      const v = (y / size) * Math.PI * 2;
      const dx =
        Math.cos(u * 3 + Math.sin(v * 2)) * 0.14 +
        Math.cos(u * 7 - v * 5) * 0.06;
      const dy =
        Math.sin(v * 4 + Math.cos(u * 2)) * 0.14 +
        Math.sin(v * 6 + u * 5) * 0.06;
      const nx = -dx;
      const ny = -dy;
      const nz = 1.0;
      const len = Math.hypot(nx, ny, nz);
      const idx = (y * size + x) * 4;
      normalData[idx] = Math.round(((nx / len) * 0.5 + 0.5) * 255);
      normalData[idx + 1] = Math.round(((ny / len) * 0.5 + 0.5) * 255);
      normalData[idx + 2] = Math.round(((nz / len) * 0.5 + 0.5) * 255);
      normalData[idx + 3] = 255;
    }
  }
  const waterNormal = new THREE.DataTexture(normalData, size, size, THREE.RGBAFormat);
  waterNormal.wrapS = waterNormal.wrapT = THREE.RepeatWrapping;
  waterNormal.repeat.set(3, 3);
  waterNormal.needsUpdate = true;

  // 6. Brushed Aged Brass Bump
  const [brassCanvas, brassCtx] = makeCanvas(256, 256);
  const rngBrass = seededRand(505);
  brassCtx.fillStyle = '#808080';
  brassCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y++) {
    const v = Math.floor(110 + rngBrass() * 45);
    brassCtx.fillStyle = `rgba(${v},${v},${v},0.45)`;
    brassCtx.fillRect(0, y, 256, 1);
  }
  const brassBump = new THREE.CanvasTexture(brassCanvas);
  brassBump.wrapS = brassBump.wrapT = THREE.RepeatWrapping;
  brassBump.anisotropy = aniso;

  // 7. Glass Condensation Roughness Map
  const [condCanvas, condCtx] = makeCanvas(256, 256);
  const rngCond = seededRand(606);
  condCtx.fillStyle = '#0c0c0c';
  condCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 650; i++) {
    const x = rngCond() * 256;
    const y = 70 + rngCond() * 186; // Stronger near lower humid zone
    const r = 1 + rngCond() * 3.5;
    const v = Math.floor(90 + rngCond() * 120);
    condCtx.fillStyle = `rgba(${v},${v},${v},0.4)`;
    condCtx.beginPath();
    condCtx.arc(x, y, r, 0, Math.PI * 2);
    condCtx.fill();
  }
  const condensationRoughness = new THREE.CanvasTexture(condCanvas);
  condensationRoughness.wrapS = condensationRoughness.wrapT = THREE.RepeatWrapping;
  condensationRoughness.repeat.set(2, 1);

  // 8. Soft Mist Sprite
  const [mistCanvas, mistCtx] = makeCanvas(128, 128);
  const mistGrad = mistCtx.createRadialGradient(64, 64, 4, 64, 64, 62);
  mistGrad.addColorStop(0, 'rgba(232, 238, 245, 0.55)');
  mistGrad.addColorStop(0.45, 'rgba(210, 220, 230, 0.25)');
  mistGrad.addColorStop(1, 'rgba(200, 212, 225, 0)');
  mistCtx.fillStyle = mistGrad;
  mistCtx.fillRect(0, 0, 128, 128);
  const mistSprite = new THREE.CanvasTexture(mistCanvas);
  mistSprite.colorSpace = THREE.SRGBColorSpace;

  // 9. Firefly / Glow Sprite
  const [glowCanvas, glowCtx] = makeCanvas(64, 64);
  const glowGrad = glowCtx.createRadialGradient(32, 32, 1, 32, 32, 30);
  glowGrad.addColorStop(0, 'rgba(255, 252, 220, 1)');
  glowGrad.addColorStop(0.3, 'rgba(210, 245, 130, 0.75)');
  glowGrad.addColorStop(1, 'rgba(180, 230, 90, 0)');
  glowCtx.fillStyle = glowGrad;
  glowCtx.fillRect(0, 0, 64, 64);
  const glowSprite = new THREE.CanvasTexture(glowCanvas);
  glowSprite.colorSpace = THREE.SRGBColorSpace;

  // 10. Radial Contact Shadow Texture
  const [shadowCanvas, shadowCtx] = makeCanvas(256, 256);
  const shGrad = shadowCtx.createRadialGradient(128, 128, 20, 128, 128, 126);
  shGrad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  shGrad.addColorStop(0.65, 'rgba(0, 0, 0, 0.34)');
  shGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  shadowCtx.fillStyle = shGrad;
  shadowCtx.fillRect(0, 0, 256, 256);
  const contactShadow = new THREE.CanvasTexture(shadowCanvas);

  return {
    mossAlbedo,
    mossBump,
    strataAlbedo,
    strataBump,
    barkAlbedo,
    barkBump,
    stoneBump,
    waterNormal,
    brassBump,
    condensationRoughness,
    mistSprite,
    glowSprite,
    contactShadow,
    dispose: () => {
      mossAlbedo.dispose();
      mossBump.dispose();
      strataAlbedo.dispose();
      strataBump.dispose();
      barkAlbedo.dispose();
      barkBump.dispose();
      stoneBump.dispose();
      waterNormal.dispose();
      brassBump.dispose();
      condensationRoughness.dispose();
      mistSprite.dispose();
      glowSprite.dispose();
      contactShadow.dispose();
    },
  };
}
