import * as THREE from 'three';
import {
  FLOOR_BASE_Y,
  TERRARIUM_RADIUS,
  WATER_LEVEL,
  mulberry32,
  sampleTerrainHeight,
} from './prng';
import type { TerrariumLayout } from './floraLayout';
import type { TerrariumTextures } from './textures';

export interface AnimatedFloraRefs {
  grassMaterial: THREE.MeshStandardMaterial;
  blossomCanopy: THREE.InstancedMesh | null;
  heroTreeGroup: THREE.Group;
  fernGroups: { group: THREE.Group; phase: number }[];
  mushroomCaps: THREE.MeshStandardMaterial;
  waterMaterial: THREE.MeshPhysicalMaterial;
  glassMaterial: THREE.MeshPhysicalMaterial;
  glassGroup: THREE.Group;
  interactables: THREE.Object3D[];
  dispose: () => void;
}

/**
 * Builds the entire Wardian glass-and-brass vessel (multi-part plinth, brass ribs,
 * octagonal dome, finial vent crown, glass panes, and studio contact shadow).
 */
export function buildWardianEnclosure(
  textures: TerrariumTextures,
  isSoftwareGl: boolean
): {
  enclosureGroup: THREE.Group;
  glassGroup: THREE.Group;
  glassMaterial: THREE.MeshPhysicalMaterial;
  disposables: { dispose: () => void }[];
} {
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const enclosureGroup = new THREE.Group();
  const glassGroup = new THREE.Group();

  const walnutMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x221b17,
      roughness: 0.62,
      metalness: 0.08,
      bumpMap: textures.barkBump,
      bumpScale: 0.008,
    })
  );

  const slateMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x1b2024,
      roughness: 0.78,
      metalness: 0.05,
      bumpMap: textures.stoneBump,
      bumpScale: 0.012,
    })
  );

  const brassMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x9e7b49,
      roughness: 0.28,
      metalness: 0.88,
      bumpMap: textures.brassBump,
      bumpScale: 0.006,
    })
  );

  const darkBronzeMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x45392a,
      roughness: 0.42,
      metalness: 0.78,
      bumpMap: textures.brassBump,
      bumpScale: 0.005,
    })
  );

  // 1. Turned stepped plinth base (LatheGeometry)
  const R = TERRARIUM_RADIUS + 0.14;
  const plinthPoints = [
    new THREE.Vector2(0, FLOOR_BASE_Y - 0.32),
    new THREE.Vector2(R + 0.38, FLOOR_BASE_Y - 0.32),
    new THREE.Vector2(R + 0.38, FLOOR_BASE_Y - 0.2),
    new THREE.Vector2(R + 0.26, FLOOR_BASE_Y - 0.12),
    new THREE.Vector2(R + 0.22, FLOOR_BASE_Y - 0.02),
    new THREE.Vector2(R + 0.06, FLOOR_BASE_Y + 0.04),
    new THREE.Vector2(0, FLOOR_BASE_Y + 0.04),
  ];
  const plinthGeo = track(new THREE.LatheGeometry(plinthPoints, 8));
  plinthGeo.rotateY(Math.PI / 8);
  const plinthMesh = new THREE.Mesh(plinthGeo, walnutMat);
  plinthMesh.castShadow = true;
  plinthMesh.receiveShadow = true;
  enclosureGroup.add(plinthMesh);

  // Inner dark slate bed tray
  const trayGeo = track(new THREE.CylinderGeometry(TERRARIUM_RADIUS + 0.02, TERRARIUM_RADIUS + 0.02, 0.12, 8));
  trayGeo.rotateY(Math.PI / 8);
  const trayMesh = new THREE.Mesh(trayGeo, slateMat);
  trayMesh.position.y = FLOOR_BASE_Y + 0.06;
  trayMesh.receiveShadow = true;
  enclosureGroup.add(trayMesh);

  // 2. Lower & Upper Brass Collar Rings
  const lowerCollarGeo = track(new THREE.TorusGeometry(R + 0.02, 0.055, 10, 8));
  lowerCollarGeo.rotateX(Math.PI / 2);
  lowerCollarGeo.rotateY(Math.PI / 8);
  const lowerCollar = new THREE.Mesh(lowerCollarGeo, darkBronzeMat);
  lowerCollar.position.y = FLOOR_BASE_Y + 0.12;
  lowerCollar.castShadow = true;
  enclosureGroup.add(lowerCollar);

  const wallHeight = 2.95;
  const eaveY = FLOOR_BASE_Y + 0.12 + wallHeight;

  const upperCollarGeo = track(new THREE.TorusGeometry(R + 0.01, 0.045, 10, 8));
  upperCollarGeo.rotateX(Math.PI / 2);
  upperCollarGeo.rotateY(Math.PI / 8);
  const upperCollar = new THREE.Mesh(upperCollarGeo, brassMat);
  upperCollar.position.y = eaveY;
  upperCollar.castShadow = true;
  enclosureGroup.add(upperCollar);

  // 3. 8 Corner Mullion Pillars + Riveted Brass Feet + Roof Slanted Ribs
  const apexY = eaveY + 1.52;
  const crownRadius = 0.72;
  const pillarGeo = track(new THREE.CylinderGeometry(0.036, 0.042, wallHeight, 8));
  const footGeo = track(new THREE.CylinderGeometry(0.065, 0.075, 0.12, 8));
  const ribLen = Math.hypot(R - crownRadius, apexY - eaveY);
  const ribGeo = track(new THREE.CylinderGeometry(0.028, 0.036, ribLen, 8));

  for (let i = 0; i < 8; i++) {
    const theta = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const cx = Math.cos(theta) * R;
    const cz = Math.sin(theta) * R;

    const pillar = new THREE.Mesh(pillarGeo, darkBronzeMat);
    pillar.position.set(cx, FLOOR_BASE_Y + 0.12 + wallHeight * 0.5, cz);
    pillar.castShadow = true;
    enclosureGroup.add(pillar);

    const foot = new THREE.Mesh(footGeo, brassMat);
    foot.position.set(cx, FLOOR_BASE_Y + 0.14, cz);
    enclosureGroup.add(foot);

    // Roof rib from eave corner to octagonal crown ring
    const tx = Math.cos(theta) * crownRadius;
    const tz = Math.sin(theta) * crownRadius;
    const midX = (cx + tx) * 0.5;
    const midY = (eaveY + apexY) * 0.5;
    const midZ = (cz + tz) * 0.5;

    const rib = new THREE.Mesh(ribGeo, brassMat);
    rib.position.set(midX, midY, midZ);
    rib.lookAt(tx, apexY, tz);
    rib.rotateX(Math.PI / 2);
    rib.castShadow = true;
    enclosureGroup.add(rib);
  }

  // 4. Crown Ring + Ventilated Brass Finial Spire
  const crownGeo = track(new THREE.TorusGeometry(crownRadius, 0.042, 10, 8));
  crownGeo.rotateX(Math.PI / 2);
  crownGeo.rotateY(Math.PI / 8);
  const crownMesh = new THREE.Mesh(crownGeo, brassMat);
  crownMesh.position.y = apexY;
  enclosureGroup.add(crownMesh);

  const finialPoints = [
    new THREE.Vector2(crownRadius * 0.98, 0),
    new THREE.Vector2(crownRadius * 0.85, 0.16),
    new THREE.Vector2(0.28, 0.28),
    new THREE.Vector2(0.14, 0.36),
    new THREE.Vector2(0.19, 0.45),
    new THREE.Vector2(0.06, 0.62),
    new THREE.Vector2(0.0, 0.72),
  ];
  const finialGeo = track(new THREE.LatheGeometry(finialPoints, 8));
  finialGeo.rotateY(Math.PI / 8);
  const finialMesh = new THREE.Mesh(finialGeo, brassMat);
  finialMesh.position.y = apexY;
  finialMesh.castShadow = true;
  enclosureGroup.add(finialMesh);

  // Brass Specimen Plaque flush on front-right plinth face (angle = Math.PI / 4)
  const plaqueApothem = (R + 0.38) * Math.cos(Math.PI / 8);
  const plaqueAngle = Math.PI / 4;
  const plaqueGeo = track(new THREE.BoxGeometry(0.88, 0.12, 0.03));
  const plaque = new THREE.Mesh(plaqueGeo, brassMat);
  plaque.position.set(
    Math.sin(plaqueAngle) * (plaqueApothem + 0.008),
    FLOOR_BASE_Y - 0.26,
    Math.cos(plaqueAngle) * (plaqueApothem + 0.008)
  );
  plaque.rotation.y = plaqueAngle;
  enclosureGroup.add(plaque);

  // 5. Optical Glass Wall & Roof Panels
  const glassMaterial = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xeaf4f2,
      metalness: 0.0,
      roughness: 0.05,
      transmission: isSoftwareGl ? 0 : 0.92,
      transparent: true,
      opacity: isSoftwareGl ? 0.18 : 1.0,
      ior: 1.52,
      thickness: 0.32,
      attenuationColor: new THREE.Color(0xd8ede8),
      attenuationDistance: 8.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      roughnessMap: textures.condensationRoughness,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );

  const glassWallGeo = track(
    new THREE.CylinderGeometry(R - 0.01, R - 0.01, wallHeight - 0.04, 8, 1, true)
  );
  glassWallGeo.rotateY(Math.PI / 8);
  const glassWall = new THREE.Mesh(glassWallGeo, glassMaterial);
  glassWall.position.y = FLOOR_BASE_Y + 0.12 + wallHeight * 0.5;
  glassWall.renderOrder = 12;
  glassGroup.add(glassWall);

  const glassRoofGeo = track(
    new THREE.CylinderGeometry(crownRadius - 0.01, R - 0.01, apexY - eaveY, 8, 1, true)
  );
  glassRoofGeo.rotateY(Math.PI / 8);
  const glassRoof = new THREE.Mesh(glassRoofGeo, glassMaterial);
  glassRoof.position.y = (eaveY + apexY) * 0.5;
  glassRoof.renderOrder = 12;
  glassGroup.add(glassRoof);

  enclosureGroup.add(glassGroup);

  // 6. Soft Contact Shadow Disc under the Plinth on Studio Table
  const shadowMat = track(
    new THREE.MeshBasicMaterial({
      map: textures.contactShadow,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    })
  );
  const shadowGeo = track(new THREE.CircleGeometry(R + 1.6, 32));
  shadowGeo.rotateX(-Math.PI / 2);
  const contactShadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadowMesh.position.y = FLOOR_BASE_Y - 0.325;
  contactShadowMesh.renderOrder = 1;
  enclosureGroup.add(contactShadowMesh);

  return { enclosureGroup, glassGroup, glassMaterial, disposables };
}

/**
 * Builds the procedural terrain bed, geological strata skirt, reflective pond water,
 * and all procedural flora & rocks inside the terrarium.
 */
export function buildTerrariumContents(
  seed: number,
  layout: TerrariumLayout,
  textures: TerrariumTextures,
  isSoftwareGl: boolean
): {
  contentGroup: THREE.Group;
  refs: AnimatedFloraRefs;
} {
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const contentGroup = new THREE.Group();
  const interactables: THREE.Object3D[] = [];
  const fernGroups: { group: THREE.Group; phase: number }[] = [];
  const rng = mulberry32(seed + 551);

  // 1. Displaced Circular Terrain Surface
  const terrainRadius = TERRARIUM_RADIUS - 0.02;
  const radialSegs = 48;
  const ringSegs = 28;
  const terrainGeo = track(new THREE.BufferGeometry());
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const cPondBed = new THREE.Color(0x1b211c);
  const cShore = new THREE.Color(0x3a372a);
  const cMoss = new THREE.Color(0x4a6934);
  const cMossBright = new THREE.Color(0x6d8c45);
  const tmpColor = new THREE.Color();

  // Center vertex
  const centerH = sampleTerrainHeight(0, 0, seed);
  positions.push(0, centerH, 0);
  uvs.push(0.5, 0.5);
  colors.push(cMoss.r, cMoss.g, cMoss.b);

  for (let ir = 1; ir <= ringSegs; ir++) {
    const rad = (ir / ringSegs) * terrainRadius;
    for (let ia = 0; ia <= radialSegs; ia++) {
      const ang = (ia / radialSegs) * Math.PI * 2;
      const x = Math.cos(ang) * rad;
      const z = Math.sin(ang) * rad;
      const y = sampleTerrainHeight(x, z, seed);
      positions.push(x, y, z);
      uvs.push(0.5 + x / (terrainRadius * 2), 0.5 + z / (terrainRadius * 2));

      if (y < WATER_LEVEL - 0.08) {
        tmpColor.copy(cPondBed);
      } else if (y < WATER_LEVEL + 0.04) {
        const t = (y - (WATER_LEVEL - 0.08)) / 0.12;
        tmpColor.copy(cPondBed).lerp(cShore, t);
      } else if (y < WATER_LEVEL + 0.22) {
        const t = (y - (WATER_LEVEL + 0.04)) / 0.18;
        tmpColor.copy(cShore).lerp(cMoss, t);
      } else {
        const t = Math.min(1, (y - (WATER_LEVEL + 0.22)) / 0.45);
        tmpColor.copy(cMoss).lerp(cMossBright, t);
      }
      colors.push(tmpColor.r, tmpColor.g, tmpColor.b);
    }
  }

  const stride = radialSegs + 1;
  // Center fan
  for (let ia = 0; ia < radialSegs; ia++) {
    indices.push(0, 1 + ia + 1, 1 + ia);
  }
  // Rings
  for (let ir = 1; ir < ringSegs; ir++) {
    const rowStart = 1 + (ir - 1) * stride;
    const nextRowStart = 1 + ir * stride;
    for (let ia = 0; ia < radialSegs; ia++) {
      const a = rowStart + ia;
      const b = rowStart + ia + 1;
      const c = nextRowStart + ia;
      const d = nextRowStart + ia + 1;
      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }

  terrainGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  terrainGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  terrainGeo.setIndex(indices);
  terrainGeo.computeVertexNormals();

  const terrainMat = track(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: textures.mossAlbedo,
      bumpMap: textures.mossBump,
      bumpScale: 0.045,
      roughness: 0.88,
      metalness: 0.02,
    })
  );
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  contentGroup.add(terrainMesh);

  // 2. Geological Strata Cross-Section Skirt along outer perimeter
  const skirtVerts: number[] = [];
  const skirtUvs: number[] = [];
  const skirtIndices: number[] = [];
  const skirtSegs = 48;
  for (let i = 0; i <= skirtSegs; i++) {
    const ang = (i / skirtSegs) * Math.PI * 2;
    const x = Math.cos(ang) * terrainRadius;
    const z = Math.sin(ang) * terrainRadius;
    const topY = sampleTerrainHeight(x, z, seed);
    const botY = FLOOR_BASE_Y + 0.1;
    const u = i / skirtSegs;
    skirtVerts.push(x, topY, z);
    skirtUvs.push(u, 1);
    skirtVerts.push(x, botY, z);
    skirtUvs.push(u, 0);
  }
  for (let i = 0; i < skirtSegs; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    // Outward-facing counter-clockwise winding
    skirtIndices.push(a, d, b);
    skirtIndices.push(a, c, d);
  }
  const skirtGeo = track(new THREE.BufferGeometry());
  skirtGeo.setAttribute('position', new THREE.Float32BufferAttribute(skirtVerts, 3));
  skirtGeo.setAttribute('uv', new THREE.Float32BufferAttribute(skirtUvs, 2));
  skirtGeo.setIndex(skirtIndices);
  skirtGeo.computeVertexNormals();

  const skirtMat = track(
    new THREE.MeshStandardMaterial({
      map: textures.strataAlbedo,
      bumpMap: textures.strataBump,
      bumpScale: 0.04,
      roughness: 0.9,
      metalness: 0.02,
    })
  );
  const skirtMesh = new THREE.Mesh(skirtGeo, skirtMat);
  skirtMesh.receiveShadow = true;
  contentGroup.add(skirtMesh);

  // 3. Reflective Pond Surface (contained cleanly inside earthen shoreline)
  const waterGeo = track(new THREE.CircleGeometry(terrainRadius - 0.28, 48));
  waterGeo.rotateX(-Math.PI / 2);
  const waterMaterial = track(
    new THREE.MeshPhysicalMaterial({
      color: 0x0e191e,
      roughness: 0.06,
      metalness: 0.26,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      normalMap: textures.waterNormal,
      normalScale: new THREE.Vector2(0.16, 0.16),
      transparent: true,
      opacity: 0.92,
      envMapIntensity: 1.6,
    })
  );
  const waterMesh = new THREE.Mesh(waterGeo, waterMaterial);
  waterMesh.position.y = WATER_LEVEL;
  waterMesh.receiveShadow = true;
  contentGroup.add(waterMesh);

  // Pond inspection hit proxy
  const pondProxy = new THREE.Mesh(
    track(new THREE.CylinderGeometry(1.15, 1.15, 0.2, 12)),
    track(new THREE.MeshBasicMaterial({ visible: false }))
  );
  pondProxy.position.set(-0.82, WATER_LEVEL + 0.05, 0.55);
  pondProxy.userData.specimenId = 'pond-basin';
  pondProxy.layers.enable(1);
  contentGroup.add(pondProxy);
  interactables.push(pondProxy);

  // 4. Hero Gnarled Blossoming Bonsai Tree (Composite 10+ part THREE.Group + Instanced Blossoms)
  const barkMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x3b2f29,
      map: textures.barkAlbedo,
      bumpMap: textures.barkBump,
      bumpScale: 0.04,
      roughness: 0.86,
      metalness: 0.04,
    })
  );

  const heroTreeGroup = new THREE.Group();
  heroTreeGroup.position.set(layout.heroTree.x, layout.heroTree.y - 0.03, layout.heroTree.z);
  heroTreeGroup.rotation.y = layout.heroTree.rotY;

  // Main gnarled curving trunk leaning out over the pond
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.05, 0),
    new THREE.Vector3(-0.18, 0.42, 0.08),
    new THREE.Vector3(-0.45, 0.92, 0.16),
    new THREE.Vector3(-0.78, 1.38, 0.22),
    new THREE.Vector3(-1.22, 1.62, 0.28),
  ]);
  const trunkGeo = track(new THREE.TubeGeometry(trunkCurve, 24, 0.11, 10, false));
  // Taper trunk along curve
  const tPos = trunkGeo.attributes.position;
  for (let i = 0; i < tPos.count; i++) {
    const vy = tPos.getY(i);
    const taper = Math.max(0.32, 1 - vy * 0.36);
    const center = trunkCurve.getPoint(Math.min(1, Math.max(0, (vy + 0.05) / 1.67)));
    tPos.setX(i, center.x + (tPos.getX(i) - center.x) * taper);
    tPos.setZ(i, center.z + (tPos.getZ(i) - center.z) * taper);
  }
  trunkGeo.computeVertexNormals();
  const trunkMesh = new THREE.Mesh(trunkGeo, barkMat);
  trunkMesh.castShadow = true;
  trunkMesh.receiveShadow = true;
  heroTreeGroup.add(trunkMesh);

  // Flared root buttresses anchoring into the mossy bank
  for (let r = 0; r < 4; r++) {
    const ang = (r / 4) * Math.PI * 2 + 0.4;
    const rootCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(ang) * 0.04, 0.18, Math.sin(ang) * 0.04),
      new THREE.Vector3(Math.cos(ang) * 0.22, 0.02, Math.sin(ang) * 0.22),
      new THREE.Vector3(Math.cos(ang) * 0.38, -0.09, Math.sin(ang) * 0.38),
    ]);
    const rootGeo = track(new THREE.TubeGeometry(rootCurve, 10, 0.042, 7, false));
    const rootMesh = new THREE.Mesh(rootGeo, barkMat);
    rootMesh.castShadow = true;
    heroTreeGroup.add(rootMesh);
  }

  // Secondary forked branches + twig tips for blossoms
  const branchConfigs: THREE.Vector3[][] = [
    [
      new THREE.Vector3(-0.42, 0.88, 0.15),
      new THREE.Vector3(-0.22, 1.32, -0.18),
      new THREE.Vector3(-0.08, 1.66, -0.45),
    ],
    [
      new THREE.Vector3(-0.62, 1.18, 0.18),
      new THREE.Vector3(-0.98, 1.48, -0.15),
      new THREE.Vector3(-1.35, 1.72, -0.32),
    ],
    [
      new THREE.Vector3(-0.78, 1.36, 0.22),
      new THREE.Vector3(-1.12, 1.45, 0.56),
      new THREE.Vector3(-1.48, 1.54, 0.78),
    ],
    [
      new THREE.Vector3(-0.35, 0.72, 0.12),
      new THREE.Vector3(0.08, 1.05, 0.36),
      new THREE.Vector3(0.32, 1.28, 0.48),
    ],
    [
      new THREE.Vector3(-1.02, 1.52, 0.26),
      new THREE.Vector3(-1.45, 1.78, 0.22),
      new THREE.Vector3(-1.76, 1.88, 0.16),
    ],
  ];

  const blossomCenters: THREE.Vector3[] = [
    new THREE.Vector3(-1.22, 1.62, 0.28),
    new THREE.Vector3(-0.98, 1.55, 0.2),
  ];

  for (const pts of branchConfigs) {
    const bCurve = new THREE.CatmullRomCurve3(pts);
    const bGeo = track(new THREE.TubeGeometry(bCurve, 14, 0.042, 7, false));
    const bMesh = new THREE.Mesh(bGeo, barkMat);
    bMesh.castShadow = true;
    heroTreeGroup.add(bMesh);
    blossomCenters.push(pts[1].clone(), pts[2].clone());
  }

  // Organic moss cushions tucked between root buttresses
  const mossCapMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x3e5c2c,
      map: textures.mossAlbedo,
      bumpMap: textures.mossBump,
      bumpScale: 0.045,
      roughness: 0.92,
      metalness: 0.0,
    })
  );
  const cushionGeo = track(new THREE.SphereGeometry(0.14, 12, 8));
  for (let c = 0; c < 3; c++) {
    const ca = (c / 3) * Math.PI * 2 + 0.8;
    const cushion = new THREE.Mesh(cushionGeo, mossCapMat);
    cushion.position.set(Math.cos(ca) * 0.13, -0.02, Math.sin(ca) * 0.13);
    cushion.scale.set(1.25, 0.42, 1.05);
    cushion.rotation.y = ca;
    cushion.receiveShadow = true;
    heroTreeGroup.add(cushion);
  }

  // Instanced Ivory/Blush Cherry Blossom Clusters
  const petalShape = new THREE.Shape();
  petalShape.moveTo(0, 0);
  petalShape.quadraticCurveTo(0.045, 0.045, 0.028, 0.095);
  petalShape.quadraticCurveTo(0, 0.11, -0.028, 0.095);
  petalShape.quadraticCurveTo(-0.045, 0.045, 0, 0);
  const blossomGeo = track(
    new THREE.ShapeGeometry(petalShape, 5)
  );
  const blossomMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xfaf2ee,
      roughness: 0.58,
      metalness: 0.0,
      side: THREE.DoubleSide,
    })
  );

  const petalsPerCluster = 46;
  const totalBlossoms = blossomCenters.length * petalsPerCluster;
  const blossomCanopy = new THREE.InstancedMesh(blossomGeo, blossomMat, totalBlossoms);
  blossomCanopy.castShadow = !isSoftwareGl;

  const dummy = new THREE.Object3D();
  const cIvory = new THREE.Color(0xfff8f4);
  const cBlush = new THREE.Color(0xf6d8dc);
  const cSageBud = new THREE.Color(0xe9efe0);
  let bIdx = 0;

  for (const center of blossomCenters) {
    for (let p = 0; p < petalsPerCluster; p++) {
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(2 * rng() - 1);
      const rad = 0.08 + Math.pow(rng(), 0.7) * 0.34;
      dummy.position.set(
        center.x + Math.sin(phi) * Math.cos(theta) * rad * 1.25,
        center.y + Math.cos(phi) * rad * 0.65 + 0.06,
        center.z + Math.sin(phi) * Math.sin(theta) * rad * 1.25
      );
      dummy.rotation.set(
        rng() * Math.PI,
        rng() * Math.PI * 2,
        rng() * Math.PI
      );
      dummy.scale.setScalar(0.65 + rng() * 0.75);
      dummy.updateMatrix();
      blossomCanopy.setMatrixAt(bIdx, dummy.matrix);

      const tintPick = rng();
      const tint = tintPick < 0.65 ? cIvory : tintPick < 0.9 ? cBlush : cSageBud;
      blossomCanopy.setColorAt(bIdx, tint);
      bIdx++;
    }
  }
  blossomCanopy.instanceMatrix.needsUpdate = true;
  if (blossomCanopy.instanceColor) blossomCanopy.instanceColor.needsUpdate = true;
  blossomCanopy.computeBoundingSphere();
  heroTreeGroup.add(blossomCanopy);

  // Hero tree raycast proxy
  const treeProxy = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.9, 0.5, 1.9, 8)),
    track(new THREE.MeshBasicMaterial({ visible: false }))
  );
  treeProxy.position.set(-0.65, 1.0, 0.15);
  treeProxy.userData.specimenId = 'hero-bonsai';
  treeProxy.layers.enable(1);
  heroTreeGroup.add(treeProxy);
  interactables.push(treeProxy);
  contentGroup.add(heroTreeGroup);

  // 5. Pine / Conifer Saplings (Composite tiered boughs + trunk)
  const pineMatDark = track(
    new THREE.MeshStandardMaterial({
      color: 0x263f2a,
      roughness: 0.85,
      metalness: 0.02,
      flatShading: true,
    })
  );
  const pineMatMid = track(
    new THREE.MeshStandardMaterial({
      color: 0x335234,
      roughness: 0.82,
      metalness: 0.02,
      flatShading: true,
    })
  );

  for (const c of layout.conifers) {
    const pineGroup = new THREE.Group();
    pineGroup.position.set(c.x, c.y - 0.02, c.z);
    pineGroup.rotation.y = c.rotY;
    pineGroup.scale.setScalar(c.scale);

    const trunk = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.032, 0.068, 1.25, 7)),
      barkMat
    );
    trunk.position.y = 0.62;
    trunk.castShadow = true;
    pineGroup.add(trunk);

    const tiers = 5;
    for (let t = 0; t < tiers; t++) {
      const frac = t / (tiers - 1);
      const r = 0.44 * (1 - frac * 0.62);
      const h = 0.36 * (1 - frac * 0.25);
      const cone = new THREE.Mesh(
        track(new THREE.ConeGeometry(r, h, 7)),
        t % 2 === 0 ? pineMatDark : pineMatMid
      );
      cone.position.y = 0.55 + t * 0.24;
      cone.rotation.y = t * 0.6;
      cone.castShadow = true;
      cone.receiveShadow = true;
      pineGroup.add(cone);
    }
    contentGroup.add(pineGroup);
  }

  // 6. Sculpted Basalt Boulders + Moss Caps
  const basaltMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x3a4045,
      bumpMap: textures.stoneBump,
      bumpScale: 0.04,
      roughness: 0.68,
      metalness: 0.08,
      flatShading: true,
    })
  );

  layout.rocks.forEach((rk, idx) => {
    const rockGroup = new THREE.Group();
    rockGroup.position.set(rk.x, rk.y, rk.z);
    rockGroup.rotation.set(rk.tiltX, rk.rotY, rk.tiltZ);
    rockGroup.scale.setScalar(rk.scale);

    // Main displaced icosahedron boulder
    const mainRockGeo = track(new THREE.IcosahedronGeometry(0.42, 1));
    const rPos = mainRockGeo.attributes.position;
    for (let i = 0; i < rPos.count; i++) {
      const vx = rPos.getX(i);
      const vy = rPos.getY(i);
      const vz = rPos.getZ(i);
      const warp = 0.78 + Math.sin(vx * 7 + idx) * 0.16 + Math.cos(vz * 6 - idx) * 0.14;
      rPos.setXYZ(i, vx * warp * 1.25, vy * warp * 0.72, vz * warp);
    }
    mainRockGeo.computeVertexNormals();
    const mainRock = new THREE.Mesh(mainRockGeo, basaltMat);
    mainRock.position.y = 0.16;
    mainRock.castShadow = true;
    mainRock.receiveShadow = true;
    rockGroup.add(mainRock);

    // Secondary companion stone
    const sideRock = new THREE.Mesh(track(new THREE.DodecahedronGeometry(0.22, 0)), basaltMat);
    sideRock.position.set(0.32, 0.08, 0.14);
    sideRock.scale.set(1.2, 0.65, 0.9);
    sideRock.castShadow = true;
    sideRock.receiveShadow = true;
    rockGroup.add(sideRock);

    // Moss cap perched on top
    if (rk.mossAmount > 0.3) {
      const mossCap = new THREE.Mesh(
        track(new THREE.SphereGeometry(0.25, 10, 8)),
        mossCapMat
      );
      mossCap.position.set(-0.02, 0.3, 0.02);
      mossCap.scale.set(1.2, 0.32 * rk.mossAmount, 1.0);
      mossCap.receiveShadow = true;
      rockGroup.add(mossCap);
    }

    if (idx === 0) {
      const rockProxy = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.95, 0.65, 0.95)),
        track(new THREE.MeshBasicMaterial({ visible: false }))
      );
      rockProxy.position.y = 0.25;
      rockProxy.userData.specimenId = 'basalt-outcrop';
      rockProxy.layers.enable(1);
      rockGroup.add(rockProxy);
      interactables.push(rockProxy);
    }

    contentGroup.add(rockGroup);
  });

  // 7. Fern Rosettes (Composite multi-frond groups)
  const frondShape = new THREE.Shape();
  frondShape.moveTo(0, 0);
  frondShape.lineTo(0.035, 0.14);
  frondShape.lineTo(0.068, 0.28);
  frondShape.lineTo(0.048, 0.44);
  frondShape.lineTo(0.02, 0.56);
  frondShape.lineTo(0, 0.64);
  frondShape.lineTo(-0.02, 0.56);
  frondShape.lineTo(-0.048, 0.44);
  frondShape.lineTo(-0.068, 0.28);
  frondShape.lineTo(-0.035, 0.14);
  frondShape.closePath();

  const frondGeo = track(new THREE.ShapeGeometry(frondShape, 6));
  // Bend frond gracefully outward along Z/Y
  const fPos = frondGeo.attributes.position;
  for (let i = 0; i < fPos.count; i++) {
    const fy = fPos.getY(i);
    const archZ = fy * fy * 0.85;
    const archY = fy * 0.82 - fy * fy * 0.22;
    fPos.setY(i, archY);
    fPos.setZ(i, archZ);
  }
  frondGeo.computeVertexNormals();

  const fernMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x4f7d3a,
      roughness: 0.72,
      metalness: 0.02,
      side: THREE.DoubleSide,
    })
  );

  layout.ferns.forEach((f, idx) => {
    const fernGroup = new THREE.Group();
    fernGroup.position.set(f.x, f.y, f.z);
    fernGroup.rotation.y = f.rotY;
    fernGroup.scale.setScalar(f.scale);

    // Humus crown
    const crown = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.055, 8, 6)),
      barkMat
    );
    crown.scale.set(1, 0.6, 1);
    fernGroup.add(crown);

    for (let k = 0; k < f.frondCount; k++) {
      const frond = new THREE.Mesh(frondGeo, fernMat);
      frond.rotation.y = (k / f.frondCount) * Math.PI * 2 + rng() * 0.25;
      frond.rotation.x = 0.25 + rng() * 0.22;
      frond.castShadow = !isSoftwareGl;
      frond.receiveShadow = true;
      fernGroup.add(frond);
    }

    if (idx === 0) {
      const fernProxy = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.45, 0.35, 0.55, 8)),
        track(new THREE.MeshBasicMaterial({ visible: false }))
      );
      fernProxy.position.y = 0.25;
      fernProxy.userData.specimenId = 'fern-grove';
      fernProxy.layers.enable(1);
      fernGroup.add(fernProxy);
      interactables.push(fernProxy);
    }

    contentGroup.add(fernGroup);
    fernGroups.push({ group: fernGroup, phase: rng() * Math.PI * 2 });
  });

  // 8. Instanced Grass & Shoreline Reeds with Custom PBR Wind Shader (`onBeforeCompile`)
  const bladeGeo = track(new THREE.PlaneGeometry(0.038, 0.34, 1, 4));
  bladeGeo.translate(0, 0.17, 0);
  const bPos = bladeGeo.attributes.position;
  for (let i = 0; i < bPos.count; i++) {
    const y = bPos.getY(i);
    const t = y / 0.34;
    bPos.setX(i, bPos.getX(i) * (1 - t * 0.85)); // Taper to tip
    bPos.setZ(i, t * t * 0.08); // Gentle curve
  }
  bladeGeo.computeVertexNormals();

  const windUniforms = {
    uTime: { value: 0 },
    uWind: { value: 0.35 },
  };
  const grassMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.78,
      metalness: 0.02,
      side: THREE.DoubleSide,
    })
  );
  grassMaterial.userData.windUniforms = windUniforms;
  grassMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.uniforms.uWind = windUniforms.uWind;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      uniform float uTime;
      uniform float uWind;`
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      float hFactor = clamp(position.y / 0.34, 0.0, 1.0);
      float sway = sin(uTime * (1.8 + uWind * 2.5) + position.x * 9.0 + float(gl_InstanceID) * 0.73) * (0.04 + uWind * 0.14);
      transformed.x += sway * hFactor * hFactor;
      transformed.z += sway * 0.45 * hFactor * hFactor;`
    );
  };

  if (layout.grasses.length > 0) {
    const grassMesh = new THREE.InstancedMesh(bladeGeo, grassMaterial, layout.grasses.length);
    grassMesh.receiveShadow = true;
    const gColor = new THREE.Color();
    layout.grasses.forEach((g, idx) => {
      dummy.position.set(g.x, g.y, g.z);
      dummy.rotation.set(g.tilt, g.rotY, 0);
      dummy.scale.setScalar(g.scale);
      dummy.updateMatrix();
      grassMesh.setMatrixAt(idx, dummy.matrix);
      gColor.setHex(g.colorHex);
      grassMesh.setColorAt(idx, gColor);
    });
    grassMesh.instanceMatrix.needsUpdate = true;
    if (grassMesh.instanceColor) grassMesh.instanceColor.needsUpdate = true;
    grassMesh.computeBoundingSphere();
    contentGroup.add(grassMesh);
  }

  // 9. Bioluminescent Mycena Mushroom Clusters
  const stemMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xd9decb,
      roughness: 0.65,
      metalness: 0.0,
    })
  );
  const mushroomCaps = track(
    new THREE.MeshStandardMaterial({
      color: 0x557566,
      emissive: new THREE.Color(0x4ef5b0),
      emissiveIntensity: 0.15,
      roughness: 0.42,
      metalness: 0.05,
    })
  );

  const capPoints = [
    new THREE.Vector2(0.0, 0.055),
    new THREE.Vector2(0.032, 0.048),
    new THREE.Vector2(0.064, 0.02),
    new THREE.Vector2(0.072, 0.0),
    new THREE.Vector2(0.02, 0.006),
  ];
  const capGeo = track(new THREE.LatheGeometry(capPoints, 12));

  layout.mushrooms.forEach((m, idx) => {
    const mGroup = new THREE.Group();
    mGroup.position.set(m.x, m.y, m.z);
    mGroup.rotation.y = m.rotY;
    mGroup.scale.setScalar(m.scale);

    for (let c = 0; c < m.capCount; c++) {
      const angle = (c / m.capCount) * Math.PI * 2 + 0.3;
      const dist = c === 0 ? 0 : 0.065 + rng() * 0.04;
      const height = c === 0 ? 0.19 : 0.1 + rng() * 0.07;

      const stem = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.008, 0.013, height, 6)),
        stemMat
      );
      stem.position.set(Math.cos(angle) * dist, height * 0.5, Math.sin(angle) * dist);
      stem.rotation.z = (rng() - 0.5) * 0.22;
      mGroup.add(stem);

      const cap = new THREE.Mesh(capGeo, mushroomCaps);
      cap.position.set(
        stem.position.x - Math.sin(stem.rotation.z) * height * 0.45,
        height - 0.01,
        stem.position.z
      );
      cap.scale.setScalar(c === 0 ? 1.15 : 0.72 + rng() * 0.32);
      cap.rotation.z = stem.rotation.z;
      mGroup.add(cap);
    }

    if (idx === 0) {
      const mushProxy = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.28, 0.28, 0.35, 8)),
        track(new THREE.MeshBasicMaterial({ visible: false }))
      );
      mushProxy.position.y = 0.16;
      mushProxy.userData.specimenId = 'luminous-fungi';
      mushProxy.layers.enable(1);
      mGroup.add(mushProxy);
      interactables.push(mushProxy);
    }

    contentGroup.add(mGroup);
  });

  // 10. Floating Pond Lily Pads & Lotus Flowers
  const padMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x3b6333,
      roughness: 0.42,
      metalness: 0.02,
      side: THREE.DoubleSide,
    })
  );
  const lotusMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xf9e8ea,
      roughness: 0.48,
      metalness: 0.0,
    })
  );

  const padShape = new THREE.Shape();
  padShape.absarc(0, 0, 0.16, 0.22, Math.PI * 2 - 0.22, false);
  padShape.lineTo(0, 0);
  const padGeo = track(new THREE.ShapeGeometry(padShape, 16));
  padGeo.rotateX(-Math.PI / 2);

  for (const l of layout.lotuses) {
    const lGroup = new THREE.Group();
    lGroup.position.set(l.x, l.y, l.z);
    lGroup.rotation.y = l.rotY;
    lGroup.scale.setScalar(l.scale);

    const pad = new THREE.Mesh(padGeo, padMat);
    pad.receiveShadow = true;
    lGroup.add(pad);

    if (l.hasFlower) {
      for (let p = 0; p < 6; p++) {
        const petal = new THREE.Mesh(
          track(new THREE.ConeGeometry(0.028, 0.075, 5)),
          lotusMat
        );
        const a = (p / 6) * Math.PI * 2;
        petal.position.set(Math.cos(a) * 0.026, 0.028, Math.sin(a) * 0.026);
        petal.rotation.z = -Math.cos(a) * 0.55;
        petal.rotation.x = Math.sin(a) * 0.55;
        lGroup.add(petal);
      }
    }
    contentGroup.add(lGroup);
  }

  return {
    contentGroup,
    refs: {
      grassMaterial,
      blossomCanopy,
      heroTreeGroup,
      fernGroups,
      mushroomCaps,
      waterMaterial,
      glassMaterial: null as unknown as THREE.MeshPhysicalMaterial, // attached by viewport
      glassGroup: null as unknown as THREE.Group,
      interactables,
      dispose: () => {
        disposables.forEach((d) => d.dispose());
      },
    },
  };
}
