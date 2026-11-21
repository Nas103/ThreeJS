/**
 * Deterministic PRNG, 2D FBM noise, and terrarium basin topography sampler.
 * Radius of the octagonal/cylindrical glass terrarium interior is TERRARIUM_RADIUS = 3.6m (scaled units).
 */

export const TERRARIUM_RADIUS = 3.6;
export const WATER_LEVEL = -0.18;
export const FLOOR_BASE_Y = -0.82;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix: number, iz: number, seed: number): number {
  let n = Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function smoothstep01(t: number): number {
  return t * t * (3 - 2 * t);
}

export function valueNoise2D(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smoothstep01(x - ix);
  const fz = smoothstep01(z - iz);

  const v00 = hash2(ix, iz, seed);
  const v10 = hash2(ix + 1, iz, seed);
  const v01 = hash2(ix, iz + 1, seed);
  const v11 = hash2(ix + 1, iz + 1, seed);

  const a = v00 + (v10 - v00) * fx;
  const b = v01 + (v11 - v01) * fx;
  return a + (b - a) * fz;
}

export function fbm2D(x: number, z: number, seed: number, octaves = 4): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let norm = 0;

  for (let i = 0; i < octaves; i++) {
    value += amplitude * (valueNoise2D(x * frequency, z * frequency, seed + i * 97) * 2 - 1);
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }

  return value / norm;
}

/**
 * Samples the continuous soil & pond basin height at (x, z) inside the terrarium.
 * Creates an asymmetric pond cove on the front-left/center (-X, +Z) and a lush
 * elevated mossy bank on the back-right (+X, -Z) where the hero blossoming tree roots.
 */
export function sampleTerrainHeight(x: number, z: number, seed: number): number {
  const r = Math.hypot(x, z);
  const normR = Math.min(1, r / TERRARIUM_RADIUS);

  // Asymmetric ridge rising toward (+0.9, -0.8)
  const bankPull = x * 0.24 - z * 0.22;
  // Pond depression centered near (-0.75, +0.48), contained cleanly inside the perimeter
  const pondDx = (x + 0.75) / 1.52;
  const pondDz = (z - 0.48) / 1.32;
  const pondDistSq = pondDx * pondDx + pondDz * pondDz;
  const pondCarve = 0.64 * Math.exp(-pondDistSq * 1.95);

  // Secondary gentle mound on far right for conifer / boulders
  const knollDx = (x - 1.35) / 1.4;
  const knollDz = (z + 0.85) / 1.4;
  const knollRise = 0.42 * Math.exp(-(knollDx * knollDx + knollDz * knollDz) * 1.4);

  // Organic multi-octave micro-undulation
  const detail = fbm2D(x * 0.72 + 4.1, z * 0.72 - 2.3, seed, 4) * 0.2;
  const micro = fbm2D(x * 2.1, z * 2.1, seed + 313, 2) * 0.04;

  // Raise outer shoreline slightly near glass wall on pond side so water stays inside natural basin
  const rimLift = normR > 0.82 ? ((normR - 0.82) / 0.18) * 0.14 : 0;

  return Math.max(
    WATER_LEVEL - 0.42,
    0.11 + bankPull * 0.52 + knollRise - pondCarve + detail + micro + rimLift
  );
}

export function isWaterAt(x: number, z: number, seed: number): boolean {
  return sampleTerrainHeight(x, z, seed) < WATER_LEVEL - 0.015;
}
