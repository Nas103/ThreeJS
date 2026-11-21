import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TERRARIUM_RADIUS,
  WATER_LEVEL,
  mulberry32,
  sampleTerrainHeight,
  isWaterAt,
} from './prng';
import { computeAtmosphere, formatTimeHours, presetToHours } from './atmosphere';
import { generateTerrariumLayout } from './floraLayout';

test('mulberry32 produces deterministic sequence for same seed', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const seqA = [a(), a(), a(), a()];
  const seqB = [b(), b(), b(), b()];
  assert.deepEqual(seqA, seqB);
  assert.ok(seqA.every((v) => v >= 0 && v < 1));
});

test('terrain heightmap forms a pond basin below WATER_LEVEL and elevated bank for hero tree', () => {
  const pondH = sampleTerrainHeight(-0.82, 0.55, 108);
  const bankH = sampleTerrainHeight(1.05, -0.35, 108);
  assert.ok(pondH < WATER_LEVEL, `Expected pond height ${pondH} < ${WATER_LEVEL}`);
  assert.ok(bankH > WATER_LEVEL + 0.15, `Expected bank height ${bankH} above water`);
  assert.equal(isWaterAt(-0.82, 0.55, 108), true);
  assert.equal(isWaterAt(1.05, -0.35, 108), false);
});

test('generateTerrariumLayout keeps all flora inside glass bounds and grounded on terrain', () => {
  const layout = generateTerrariumLayout(777, 1.0);
  assert.ok(layout.rocks.length >= 4);
  assert.ok(layout.ferns.length >= 6);
  assert.ok(layout.grasses.length >= 120);
  assert.ok(layout.mushrooms.length >= 3);
  assert.ok(layout.specimens.length === 5);

  const checkRadius = (x: number, z: number, label: string) => {
    const r = Math.hypot(x, z);
    assert.ok(r < TERRARIUM_RADIUS - 0.35, `${label} at r=${r} exceeds safe terrarium radius`);
  };

  checkRadius(layout.heroTree.x, layout.heroTree.z, 'heroTree');
  for (const fern of layout.ferns) {
    checkRadius(fern.x, fern.z, 'fern');
    assert.ok(fern.y >= WATER_LEVEL - 0.02, 'fern should not spawn underwater');
  }
  for (const mush of layout.mushrooms) {
    checkRadius(mush.x, mush.z, 'mushroom');
    assert.ok(mush.y >= WATER_LEVEL, 'mushroom should sit above water');
  }
  for (const lotus of layout.lotuses) {
    checkRadius(lotus.x, lotus.z, 'lotus');
    assert.ok(Math.abs(lotus.y - WATER_LEVEL) < 0.05, 'lotus sits on water surface');
  }
});

test('computeAtmosphere transitions cleanly across Dawn, Noon, Dusk, Midnight and Weather modes', () => {
  const noonClear = computeAtmosphere(presetToHours('noon'), 'clear', 0.1);
  const duskMist = computeAtmosphere(presetToHours('dusk'), 'mist', 0.8);
  const midnightStorm = computeAtmosphere(presetToHours('midnight'), 'storm', 0.9);

  assert.ok(noonClear.sunIntensity > duskMist.sunIntensity);
  assert.ok(noonClear.nocturnalFactor < 0.1);
  assert.ok(midnightStorm.nocturnalFactor > 0.85);
  assert.ok(midnightStorm.moonIntensity > 0.2);
  assert.ok(midnightStorm.humidityPct > noonClear.humidityPct);
  assert.ok(duskMist.fogDensity > noonClear.fogDensity);
  assert.equal(formatTimeHours(18.25), '18:15');
  assert.equal(formatTimeHours(24.5), '00:30');
});
