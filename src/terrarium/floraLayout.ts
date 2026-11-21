import {
  TERRARIUM_RADIUS,
  WATER_LEVEL,
  mulberry32,
  sampleTerrainHeight,
} from './prng';
import type { SpecimenInfo } from './types';

export interface PlacedRock {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotY: number;
  tiltX: number;
  tiltZ: number;
  mossAmount: number;
}

export interface PlacedFern {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotY: number;
  frondCount: number;
  hueShift: number;
}

export interface PlacedGrass {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotY: number;
  tilt: number;
  colorHex: number;
}

export interface PlacedMushroom {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotY: number;
  capCount: number;
}

export interface PlacedConifer {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotY: number;
}

export interface PlacedLotus {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotY: number;
  hasFlower: boolean;
}

export interface TerrariumLayout {
  heroTree: { x: number; y: number; z: number; rotY: number };
  conifers: PlacedConifer[];
  rocks: PlacedRock[];
  ferns: PlacedFern[];
  grasses: PlacedGrass[];
  mushrooms: PlacedMushroom[];
  lotuses: PlacedLotus[];
  specimens: SpecimenInfo[];
}

const MAX_FLORA_RADIUS = TERRARIUM_RADIUS - 0.58;

export function generateTerrariumLayout(seed: number, floraDensity: number): TerrariumLayout {
  const rng = mulberry32(seed + 1013);
  const density = Math.max(0.35, Math.min(1.5, floraDensity));

  // Hero gnarled blossoming bonsai positioned on the mossy ridge overlooking the pond
  const heroX = 1.05 + (rng() - 0.5) * 0.25;
  const heroZ = -0.35 + (rng() - 0.5) * 0.25;
  const heroY = sampleTerrainHeight(heroX, heroZ, seed);

  // Pine saplings along the elevated back-right and far-left perimeter ridge
  const conifers: PlacedConifer[] = [];
  const coniferCandidates: [number, number][] = [
    [1.85, -1.35],
    [-1.75, -1.45],
    [-0.25, -2.05],
    [2.15, 0.45],
  ];
  for (const [cx, cz] of coniferCandidates) {
    const x = cx + (rng() - 0.5) * 0.35;
    const z = cz + (rng() - 0.5) * 0.35;
    if (Math.hypot(x, z) < MAX_FLORA_RADIUS - 0.25) {
      const y = sampleTerrainHeight(x, z, seed);
      if (y > WATER_LEVEL + 0.08) {
        conifers.push({
          x,
          y,
          z,
          scale: 0.72 + rng() * 0.42,
          rotY: rng() * Math.PI * 2,
        });
      }
    }
  }

  // Sculpted basalt boulders clustered along the pond shoreline and slopes
  const rocks: PlacedRock[] = [];
  const rockTarget = Math.round(9 * Math.min(1.2, 0.7 + density * 0.4));
  let attempts = 0;
  while (rocks.length < rockTarget && attempts < 140) {
    attempts++;
    const angle = rng() * Math.PI * 2;
    const rad = Math.sqrt(rng()) * (MAX_FLORA_RADIUS - 0.2);
    const x = Math.cos(angle) * rad;
    const z = Math.sin(angle) * rad;
    if (Math.hypot(x - heroX, z - heroZ) < 0.75) continue;

    const y = sampleTerrainHeight(x, z, seed);
    if (y < WATER_LEVEL - 0.12) continue;

    const tooClose = rocks.some((rk) => Math.hypot(rk.x - x, rk.z - z) < 0.65);
    if (tooClose) continue;

    rocks.push({
      x,
      y: y - 0.04,
      z,
      scale: 0.42 + rng() * 0.58,
      rotY: rng() * Math.PI * 2,
      tiltX: (rng() - 0.5) * 0.22,
      tiltZ: (rng() - 0.5) * 0.22,
      mossAmount: y > WATER_LEVEL + 0.04 ? 0.5 + rng() * 0.5 : 0.15,
    });
  }

  // Fern rosettes on damp shaded slopes
  const ferns: PlacedFern[] = [];
  const fernTarget = Math.round(14 * density);
  attempts = 0;
  while (ferns.length < fernTarget && attempts < 220) {
    attempts++;
    const angle = rng() * Math.PI * 2;
    const rad = Math.sqrt(rng()) * (MAX_FLORA_RADIUS - 0.15);
    const x = Math.cos(angle) * rad;
    const z = Math.sin(angle) * rad;
    if (Math.hypot(x - heroX, z - heroZ) < 0.48) continue;

    const y = sampleTerrainHeight(x, z, seed);
    if (y < WATER_LEVEL + 0.03) continue;

    const onRock = rocks.some((rk) => Math.hypot(rk.x - x, rk.z - z) < rk.scale * 0.45);
    if (onRock) continue;

    ferns.push({
      x,
      y: y - 0.015,
      z,
      scale: 0.55 + rng() * 0.55,
      rotY: rng() * Math.PI * 2,
      frondCount: 6 + Math.floor(rng() * 4),
      hueShift: (rng() - 0.5) * 0.08,
    });
  }

  // Instanced grass & shoreline reed blades
  const grasses: PlacedGrass[] = [];
  const grassTarget = Math.round(280 * density);
  const grassPalette = [0x4b6e36, 0x5c803e, 0x3b592c, 0x738c45, 0x627a39];
  attempts = 0;
  while (grasses.length < grassTarget && attempts < 1400) {
    attempts++;
    const angle = rng() * Math.PI * 2;
    const rad = Math.sqrt(rng()) * (MAX_FLORA_RADIUS + 0.1);
    const x = Math.cos(angle) * rad;
    const z = Math.sin(angle) * rad;
    const y = sampleTerrainHeight(x, z, seed);

    // Grow along banks and shallow water edge
    if (y < WATER_LEVEL - 0.04) continue;
    const nearWater = y < WATER_LEVEL + 0.14;

    grasses.push({
      x,
      y: y - 0.01,
      z,
      scale: (nearWater ? 1.05 : 0.65) + rng() * 0.75,
      rotY: rng() * Math.PI * 2,
      tilt: 0.08 + rng() * 0.25,
      colorHex: grassPalette[Math.floor(rng() * grassPalette.length)],
    });
  }

  // Bioluminescent mushroom clusters tucked near hero roots & boulders
  const mushrooms: PlacedMushroom[] = [];
  const mushTarget = Math.max(3, Math.round(6 * density));
  attempts = 0;
  while (mushrooms.length < mushTarget && attempts < 160) {
    attempts++;
    const nearHero = mushrooms.length < 2;
    let x: number;
    let z: number;
    if (nearHero) {
      const a = rng() * Math.PI * 2;
      const d = 0.42 + rng() * 0.35;
      x = heroX + Math.cos(a) * d;
      z = heroZ + Math.sin(a) * d;
    } else {
      const a = rng() * Math.PI * 2;
      const d = Math.sqrt(rng()) * (MAX_FLORA_RADIUS - 0.25);
      x = Math.cos(a) * d;
      z = Math.sin(a) * d;
    }
    if (Math.hypot(x, z) > MAX_FLORA_RADIUS - 0.15) continue;
    const y = sampleTerrainHeight(x, z, seed);
    if (y < WATER_LEVEL + 0.04) continue;

    mushrooms.push({
      x,
      y: y - 0.01,
      z,
      scale: 0.75 + rng() * 0.45,
      rotY: rng() * Math.PI * 2,
      capCount: 3 + Math.floor(rng() * 3),
    });
  }

  // Floating lily pads / lotus leaves on the pond surface
  const lotuses: PlacedLotus[] = [];
  attempts = 0;
  while (lotuses.length < 6 && attempts < 140) {
    attempts++;
    const x = -0.85 + (rng() - 0.5) * 2.1;
    const z = 0.55 + (rng() - 0.5) * 1.8;
    if (Math.hypot(x, z) > MAX_FLORA_RADIUS - 0.2) continue;
    const y = sampleTerrainHeight(x, z, seed);
    if (y > WATER_LEVEL - 0.06) continue;
    const tooClose = lotuses.some((l) => Math.hypot(l.x - x, l.z - z) < 0.42);
    if (tooClose) continue;

    lotuses.push({
      x,
      y: WATER_LEVEL + 0.008,
      z,
      scale: 0.75 + rng() * 0.45,
      rotY: rng() * Math.PI * 2,
      hasFlower: lotuses.length % 2 === 0,
    });
  }

  const firstFern = ferns[0] ?? { x: -0.3, y: 0.1, z: -0.9 };
  const firstMush = mushrooms[0] ?? { x: heroX - 0.45, y: heroY, z: heroZ + 0.35 };
  const firstRock = rocks[0] ?? { x: -1.4, y: 0.0, z: -0.2 };

  const specimens: SpecimenInfo[] = [
    {
      id: 'hero-bonsai',
      name: 'White-Blossom Bonsai',
      latinName: 'Prunus incisa × mume',
      category: 'Canopy',
      notes:
        'Gnarled miniature cherry overhanging the reflective basin; sheds ivory petals across the pond under breeze.',
      humidityPreference: '65–80% RH',
      focusPoint: [heroX - 0.2, heroY + 1.1, heroZ + 0.1],
      cameraOffset: [2.8, 1.9, 3.2],
    },
    {
      id: 'pond-basin',
      name: 'Stillwater Mirror Basin',
      latinName: 'Silica & River Basalt Bed',
      category: 'Hydrology',
      notes:
        'Natural depression fed by glass condensation runoff; catches sky twilight reflections and drifting surface mist.',
      humidityPreference: '85–99% RH',
      focusPoint: [-0.82, WATER_LEVEL + 0.1, 0.55],
      cameraOffset: [2.6, 1.4, 3.3],
    },
    {
      id: 'fern-grove',
      name: 'Maidenhair Fern Rosette',
      latinName: 'Adiantum pedatum',
      category: 'Fern',
      notes:
        'Arching pinnae fronds thriving on the shaded humus slope with rhythmic wind response.',
      humidityPreference: '75–90% RH',
      focusPoint: [firstFern.x, firstFern.y + 0.28, firstFern.z],
      cameraOffset: [1.8, 1.1, 2.2],
    },
    {
      id: 'luminous-fungi',
      name: 'Noctilucent Mycena Cluster',
      latinName: 'Mycena chlorophos',
      category: 'Fungi',
      notes:
        'Saprotrophic caps nestled in damp moss pockets; bioluminescence intensifies after dusk.',
      humidityPreference: '82–95% RH',
      focusPoint: [firstMush.x, firstMush.y + 0.18, firstMush.z],
      cameraOffset: [1.5, 0.85, 1.8],
    },
    {
      id: 'basalt-outcrop',
      name: 'Moss-Capped Basalt',
      latinName: 'Leucobryum glaucum on Basalt',
      category: 'Geology',
      notes:
        'Fractured volcanic stone anchoring the shoreline and hosting cushion moss colonies.',
      humidityPreference: '60–85% RH',
      focusPoint: [firstRock.x, firstRock.y + 0.25, firstRock.z],
      cameraOffset: [2.0, 1.15, 2.4],
    },
  ];

  return {
    heroTree: { x: heroX, y: heroY, z: heroZ, rotY: rng() * Math.PI * 2 },
    conifers,
    rocks,
    ferns,
    grasses,
    mushrooms,
    lotuses,
    specimens,
  };
}
