import * as THREE from 'three';
import { TERRARIUM_RADIUS, WATER_LEVEL } from './prng';
import type { TerrariumTextures } from './textures';
import type { WeatherMode } from './types';

export interface WeatherSystem {
  group: THREE.Group;
  update: (
    dt: number,
    elapsed: number,
    weather: WeatherMode,
    windSpeed: number,
    mistDensity: number,
    nocturnalFactor: number
  ) => void;
  dispose: () => void;
}

const _dummy = new THREE.Object3D();

export function createWeatherSystem(textures: TerrariumTextures): WeatherSystem {
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  // 1. Low-lying Pond Mist Plumes (inspired by still-water mist band)
  const mistCount = 16;
  const mistSprites: {
    sprite: THREE.Sprite;
    baseX: number;
    baseZ: number;
    speed: number;
    phase: number;
    baseScale: number;
  }[] = [];

  for (let i = 0; i < mistCount; i++) {
    const mat = track(
      new THREE.SpriteMaterial({
        map: textures.mistSprite,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
        color: 0xdce6ee,
      })
    );
    const sprite = new THREE.Sprite(mat);
    const angle = (i / mistCount) * Math.PI * 2;
    const rad = 0.25 + (i % 4) * 0.48;
    const baseX = -0.65 + Math.cos(angle) * rad;
    const baseZ = 0.42 + Math.sin(angle) * rad * 0.85;
    const baseScale = 1.45 + (i % 3) * 0.55;
    sprite.position.set(baseX, WATER_LEVEL + 0.18 + (i % 2) * 0.08, baseZ);
    sprite.scale.set(baseScale * 1.4, baseScale * 0.45, 1);
    sprite.renderOrder = 6;
    group.add(sprite);
    mistSprites.push({
      sprite,
      baseX,
      baseZ,
      speed: 0.18 + (i % 5) * 0.05,
      phase: i * 1.37,
      baseScale,
    });
  }

  // 2. Rain Streaks (InstancedMesh inside glass dome)
  const rainCount = 240;
  const rainGeo = track(new THREE.CylinderGeometry(0.004, 0.004, 0.24, 4));
  const rainMat = track(
    new THREE.MeshBasicMaterial({
      color: 0xcbe2f0,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    })
  );
  const rainMesh = new THREE.InstancedMesh(rainGeo, rainMat, rainCount);
  rainMesh.frustumCulled = false;
  rainMesh.visible = false;
  rainMesh.renderOrder = 8;

  const rainData = Array.from({ length: rainCount }, (_, i) => {
    const a = ((i * 137.5) % 360) * (Math.PI / 180);
    const r = Math.sqrt((i % 97) / 97) * (TERRARIUM_RADIUS - 0.55);
    const roofMaxY = 2.05 + (1 - r / TERRARIUM_RADIUS) * 1.05;
    return {
      x: Math.cos(a) * r,
      y: WATER_LEVEL + Math.random() * (roofMaxY - WATER_LEVEL),
      z: Math.sin(a) * r,
      speed: 3.4 + (i % 7) * 0.38,
    };
  });
  group.add(rainMesh);

  // 3. Expanding Pond Ripple Rings during Rain/Storm
  const rippleCount = 12;
  const rippleGeo = track(new THREE.RingGeometry(0.04, 0.055, 24));
  rippleGeo.rotateX(-Math.PI / 2);
  const ripples: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; life: number }[] = [];
  for (let i = 0; i < rippleCount; i++) {
    const mat = track(
      new THREE.MeshBasicMaterial({
        color: 0xd6ebf5,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    const mesh = new THREE.Mesh(rippleGeo, mat);
    mesh.position.set(-0.82 + (Math.random() - 0.5) * 1.4, WATER_LEVEL + 0.012, 0.55 + (Math.random() - 0.5) * 1.1);
    mesh.renderOrder = 5;
    group.add(mesh);
    ripples.push({ mesh, mat, life: i / rippleCount });
  }

  // 4. Drifting Blossom Petals from the Hero Bonsai
  const petalCount = 26;
  const petalGeo = track(new THREE.PlaneGeometry(0.042, 0.028));
  const petalMat = track(
    new THREE.MeshBasicMaterial({
      color: 0xfff5f2,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    })
  );
  const petalMesh = new THREE.InstancedMesh(petalGeo, petalMat, petalCount);
  petalMesh.frustumCulled = false;
  petalMesh.renderOrder = 7;
  const petals = Array.from({ length: petalCount }, (_, i) => ({
    x: (Math.random() - 0.5) * 2.2,
    y: 0.3 + Math.random() * 1.6,
    z: (Math.random() - 0.5) * 2.0,
    phase: i * 0.9,
    fallSpeed: 0.18 + (i % 4) * 0.04,
  }));
  group.add(petalMesh);

  // 5. Nocturnal Fireflies (Points)
  const fireflyCount = 28;
  const fireflyPositions = new Float32Array(fireflyCount * 3);
  const fireflySeeds = Array.from({ length: fireflyCount }, (_, i) => {
    const a = (i / fireflyCount) * Math.PI * 2;
    const r = 0.4 + ((i * 37) % 24) * 0.1;
    return {
      x: Math.cos(a) * r,
      y: WATER_LEVEL + 0.25 + (i % 6) * 0.24,
      z: Math.sin(a) * r,
      phase: i * 1.13,
    };
  });
  const fireflyGeo = track(new THREE.BufferGeometry());
  fireflyGeo.setAttribute('position', new THREE.BufferAttribute(fireflyPositions, 3));
  const fireflyMat = track(
    new THREE.PointsMaterial({
      map: textures.glowSprite,
      size: 0.18,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  const fireflyPoints = new THREE.Points(fireflyGeo, fireflyMat);
  fireflyPoints.renderOrder = 9;
  group.add(fireflyPoints);

  return {
    group,
    update(dt, elapsed, weather, windSpeed, mistDensity, nocturnalFactor) {
      const clampedDt = Math.min(dt, 0.08);
      const isRaining = weather === 'rain' || weather === 'storm';
      const stormBoost = weather === 'storm' ? 1.55 : 1.0;

      // Update Mist Plumes
      const effectiveMist = Math.min(
        1,
        mistDensity + (weather === 'mist' ? 0.5 : weather === 'rain' ? 0.22 : weather === 'storm' ? 0.32 : 0)
      );
      for (const m of mistSprites) {
        m.sprite.visible = effectiveMist > 0.04;
        if (!m.sprite.visible) continue;
        const drift = Math.sin(elapsed * m.speed + m.phase) * (0.28 + windSpeed * 0.35);
        m.sprite.position.x = m.baseX + drift;
        m.sprite.position.z = m.baseZ + Math.cos(elapsed * m.speed * 0.8 + m.phase) * 0.18;
        m.sprite.material.opacity = effectiveMist * 0.38 * (0.78 + 0.22 * Math.sin(elapsed + m.phase));
      }

      // Update Rain Streaks
      rainMesh.visible = isRaining;
      if (isRaining) {
        const tiltZ = (0.08 + windSpeed * 0.36) * stormBoost;
        const activeCount = weather === 'storm' ? rainCount : Math.floor(rainCount * 0.65);
        rainMesh.count = activeCount;
        for (let i = 0; i < activeCount; i++) {
          const drop = rainData[i];
          drop.y -= drop.speed * stormBoost * clampedDt;
          drop.x += (windSpeed * 0.9 + 0.15) * clampedDt;
          if (drop.y < WATER_LEVEL || Math.hypot(drop.x, drop.z) > TERRARIUM_RADIUS - 0.35) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.sqrt(Math.random()) * (TERRARIUM_RADIUS - 0.55);
            drop.x = Math.cos(a) * r;
            drop.z = Math.sin(a) * r;
            const roofMaxY = 2.05 + (1 - r / TERRARIUM_RADIUS) * 1.05;
            drop.y = roofMaxY - Math.random() * 0.35;
          }
          _dummy.position.set(drop.x, drop.y, drop.z);
          _dummy.rotation.set(0, 0, -tiltZ);
          _dummy.scale.set(1, weather === 'storm' ? 1.35 : 1.0, 1);
          _dummy.updateMatrix();
          rainMesh.setMatrixAt(i, _dummy.matrix);
        }
        rainMesh.instanceMatrix.needsUpdate = true;
      }

      // Update Pond Ripples
      for (const rp of ripples) {
        if (!isRaining) {
          rp.mesh.visible = false;
          continue;
        }
        rp.mesh.visible = true;
        rp.life += clampedDt * (weather === 'storm' ? 1.5 : 1.0);
        if (rp.life >= 1) {
          rp.life = 0;
          rp.mesh.position.x = -0.82 + (Math.random() - 0.5) * 1.55;
          rp.mesh.position.z = 0.55 + (Math.random() - 0.5) * 1.2;
        }
        const s = 0.6 + rp.life * 3.8;
        rp.mesh.scale.setScalar(s);
        rp.mat.opacity = (1 - rp.life) * 0.48;
      }

      // Update Falling Cherry Blossoms
      for (let i = 0; i < petalCount; i++) {
        const p = petals[i];
        p.y -= p.fallSpeed * clampedDt;
        p.x += (Math.sin(elapsed * 1.3 + p.phase) * 0.14 + windSpeed * 0.35) * clampedDt;
        p.z += Math.cos(elapsed * 1.1 + p.phase) * 0.12 * clampedDt;
        if (p.y < WATER_LEVEL + 0.02 || Math.hypot(p.x, p.z) > TERRARIUM_RADIUS - 0.35) {
          p.y = 1.55 + Math.random() * 0.45;
          p.x = -0.35 + (Math.random() - 0.5) * 1.5;
          p.z = 0.0 + (Math.random() - 0.5) * 1.3;
        }
        _dummy.position.set(p.x, p.y, p.z);
        _dummy.rotation.set(
          elapsed * 1.4 + p.phase,
          elapsed * 0.9 + p.phase,
          Math.sin(elapsed + p.phase) * 0.8
        );
        _dummy.scale.setScalar(1);
        _dummy.updateMatrix();
        petalMesh.setMatrixAt(i, _dummy.matrix);
      }
      petalMesh.instanceMatrix.needsUpdate = true;

      // Update Nocturnal Fireflies
      const fireflyAlpha = nocturnalFactor * (isRaining ? 0.35 : 0.92);
      fireflyMat.opacity = fireflyAlpha;
      fireflyPoints.visible = fireflyAlpha > 0.05;
      if (fireflyPoints.visible) {
        const attr = fireflyGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < fireflyCount; i++) {
          const f = fireflySeeds[i];
          const fx = f.x + Math.sin(elapsed * 0.65 + f.phase) * 0.25;
          const fy = f.y + Math.sin(elapsed * 1.15 + f.phase * 1.7) * 0.14;
          const fz = f.z + Math.cos(elapsed * 0.72 + f.phase) * 0.25;
          attr.setXYZ(i, fx, fy, fz);
        }
        attr.needsUpdate = true;
      }
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
    },
  };
}
