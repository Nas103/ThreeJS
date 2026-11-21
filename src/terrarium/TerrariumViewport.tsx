import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { computeAtmosphere } from './atmosphere';
import { generateTerrariumLayout } from './floraLayout';
import {
  buildTerrariumContents,
  buildWardianEnclosure,
  type AnimatedFloraRefs,
} from './models';
import { FLOOR_BASE_Y } from './prng';
import { createTerrariumTextures } from './textures';
import type {
  AtmosphereState,
  CameraPreset,
  SpecimenInfo,
  TerrariumConfig,
} from './types';
import { createWeatherSystem } from './weather';

interface TerrariumViewportProps {
  config: TerrariumConfig;
  cameraPreset: CameraPreset;
  cameraTrigger: number;
  selectedSpecimen: SpecimenInfo | null;
  onSelectSpecimen: (specimen: SpecimenInfo | null) => void;
  onSpecimensChange: (specimens: SpecimenInfo[]) => void;
  onAtmosphereUpdate: (state: AtmosphereState) => void;
  onTimeTick?: (nextHour: number) => void;
}

const CAMERA_PRESETS: Record<
  CameraPreset,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  overview: { pos: [7.0, 3.65, 7.6], target: [0, 1.02, 0] },
  canopy: { pos: [2.75, 2.55, 2.95], target: [0.25, 1.25, -0.15] },
  pond: { pos: [-3.4, 1.35, 3.55], target: [-0.65, 0.05, 0.45] },
  macro: { pos: [2.1, 0.95, 2.35], target: [0.35, 0.25, -0.05] },
};

export function TerrariumViewport({
  config,
  cameraPreset,
  cameraTrigger,
  selectedSpecimen,
  onSelectSpecimen,
  onSpecimensChange,
  onAtmosphereUpdate,
  onTimeTick,
}: TerrariumViewportProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [contextLost, setContextLost] = useState(false);

  const configRef = useRef(config);
  configRef.current = config;

  const callbacksRef = useRef({
    onSelectSpecimen,
    onSpecimensChange,
    onAtmosphereUpdate,
    onTimeTick,
  });
  callbacksRef.current = {
    onSelectSpecimen,
    onSpecimensChange,
    onAtmosphereUpdate,
    onTimeTick,
  };

  const cameraGoalRef = useRef<{
    active: boolean;
    pos: THREE.Vector3;
    target: THREE.Vector3;
  }>({
    active: false,
    pos: new THREE.Vector3(...CAMERA_PRESETS.overview.pos),
    target: new THREE.Vector3(...CAMERA_PRESETS.overview.target),
  });

  const rebuildSignalRef = useRef<{ seed: number; floraDensity: number }>({
    seed: config.seed,
    floraDensity: config.floraDensity,
  });

  // Trigger smooth camera preset glide
  useEffect(() => {
    const preset = CAMERA_PRESETS[cameraPreset];
    cameraGoalRef.current.pos.set(...preset.pos);
    cameraGoalRef.current.target.set(...preset.target);
    cameraGoalRef.current.active = true;
  }, [cameraPreset, cameraTrigger]);

  // Trigger smooth camera glide to selected specimen
  useEffect(() => {
    if (!selectedSpecimen) return;
    const [fx, fy, fz] = selectedSpecimen.focusPoint;
    const [ox, oy, oz] = selectedSpecimen.cameraOffset;
    cameraGoalRef.current.target.set(fx, fy, fz);
    cameraGoalRef.current.pos.set(fx + ox, fy + oy, fz + oz);
    cameraGoalRef.current.active = true;
  }, [selectedSpecimen]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const scene = new THREE.Scene();
    const fog = new THREE.FogExp2('#1c222d', 0.024);
    scene.fog = fog;
    scene.background = new THREE.Color('#1c222d');

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 120);
    const updateCameraFov = (w: number, h: number) => {
      const aspect = Math.max(0.35, w / Math.max(1, h));
      camera.aspect = aspect;
      camera.fov = aspect < 1 ? Math.min(68, 42 / Math.pow(aspect, 0.56)) : 42;
      camera.updateProjectionMatrix();
    };
    updateCameraFov(width, height);
    camera.position.set(...CAMERA_PRESETS.overview.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...CAMERA_PRESETS.overview.target);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.055;
    controls.minDistance = 2.1;
    controls.maxDistance = 13.5;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minPolarAngle = 0.18;
    controls.enablePan = false;
    controls.update();

    const cancelGoal = () => {
      cameraGoalRef.current.active = false;
    };
    controls.addEventListener('start', cancelGoal);

    // Sky dome gradient sphere matching atmosphere horizon & zenith
    const skyUniforms = {
      uTopColor: { value: new THREE.Color('#181f2c') },
      uHorizonColor: { value: new THREE.Color('#785258') },
    };
    const skyGeo = new THREE.SphereGeometry(55, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uHorizonColor;
        varying vec3 vWorldPos;
        void main() {
          float h = clamp(normalize(vWorldPos).y * 1.45 + 0.12, 0.0, 1.0);
          vec3 col = mix(uHorizonColor, uTopColor, pow(h, 0.72));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const skyDome = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyDome);

    // Soft radial studio shadow pool under plinth (zero harsh horizon edge)
    const tableGeo = new THREE.CircleGeometry(7.2, 48);
    tableGeo.rotateX(-Math.PI / 2);
    const tableMat = new THREE.MeshBasicMaterial({
      color: 0x050709,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    const tableMesh = new THREE.Mesh(tableGeo, tableMat);
    tableMesh.position.y = FLOOR_BASE_Y - 0.34;
    scene.add(tableMesh);

    // 3-Point Studio + Orbital Sun/Moon Rig
    const hemiLight = new THREE.HemisphereLight(0x8c8ba8, 0x262820, 0.75);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffb68a, 1.8);
    sunLight.position.set(8, 7, 4);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 28;
    sunLight.shadow.camera.left = -4.8;
    sunLight.shadow.camera.right = 4.8;
    sunLight.shadow.camera.top = 4.8;
    sunLight.shadow.camera.bottom = -4.8;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const moonLight = new THREE.DirectionalLight(0x8cb2f0, 0.25);
    moonLight.position.set(-7, 8, -4);
    scene.add(moonLight);

    const rimLight = new THREE.DirectionalLight(0xffb199, 1.1);
    rimLight.position.set(-6, 3.2, -5.5);
    scene.add(rimLight);

    // Nocturnal mushroom bioluminescence point light
    const fungiLight = new THREE.PointLight(0x63f2b8, 0.0, 3.8, 2);
    fungiLight.position.set(0.65, 0.35, -0.15);
    scene.add(fungiLight);

    // Procedural Textures & Wardian Enclosure
    const textures = createTerrariumTextures(renderer.capabilities.getMaxAnisotropy());
    tableMat.map = textures.contactShadow;
    tableMat.needsUpdate = true;
    const enclosure = buildWardianEnclosure(textures, isSoftwareGl);
    scene.add(enclosure.enclosureGroup);

    // Weather Particle & Mist System
    const weatherSystem = createWeatherSystem(textures);
    scene.add(weatherSystem.group);

    // Procedural Flora Contents (Rebuildable on seed / density change)
    let activeLayout = generateTerrariumLayout(
      configRef.current.seed,
      configRef.current.floraDensity
    );
    let activeFlora = buildTerrariumContents(
      configRef.current.seed,
      activeLayout,
      textures,
      isSoftwareGl
    );
    activeFlora.refs.glassMaterial = enclosure.glassMaterial;
    activeFlora.refs.glassGroup = enclosure.glassGroup;
    scene.add(activeFlora.contentGroup);

    let currentSpecimens: SpecimenInfo[] = activeLayout.specimens;
    callbacksRef.current.onSpecimensChange(currentSpecimens);

    let floraRefs: AnimatedFloraRefs = activeFlora.refs;
    let builtSeed = configRef.current.seed;
    let builtDensity = configRef.current.floraDensity;

    const rebuildFlora = (seed: number, density: number) => {
      scene.remove(activeFlora.contentGroup);
      activeFlora.refs.dispose();
      activeLayout = generateTerrariumLayout(seed, density);
      activeFlora = buildTerrariumContents(seed, activeLayout, textures, isSoftwareGl);
      activeFlora.refs.glassMaterial = enclosure.glassMaterial;
      activeFlora.refs.glassGroup = enclosure.glassGroup;
      scene.add(activeFlora.contentGroup);
      floraRefs = activeFlora.refs;
      currentSpecimens = activeLayout.specimens;
      callbacksRef.current.onSpecimensChange(currentSpecimens);
      builtSeed = seed;
      builtDensity = density;
    };

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Raycasting on click (only when pointer didn't drag OrbitControls)
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointerNdc = new THREE.Vector2();
    let downX = 0;
    let downY = 0;

    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };

    const onPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (dist > 6) return; // Was an orbit drag
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(floraRefs.interactables, false);
      if (hits.length > 0) {
        const sid = hits[0].object.userData.specimenId as string | undefined;
        const found = currentSpecimens.find((s) => s.id === sid) ?? null;
        callbacksRef.current.onSelectSpecimen(found);
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    // Resize listener (immediately re-render so resize never leaves a blank cleared frame)
    const handleResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      updateCameraFov(w, h);
      renderer.setSize(w, h);
      renderer.render(scene, camera);
    };
    window.addEventListener('resize', handleResize);

    // Pre-allocated scratch helpers (zero GC in loop)
    const _bgColor = new THREE.Color();
    const _sunColor = new THREE.Color();
    const _moonColor = new THREE.Color();
    const _hemiSky = new THREE.Color();
    const _hemiGround = new THREE.Color();
    const _rimColor = new THREE.Color();
    const startMs = performance.now();
    let prevMs = startMs;

    let frameId = 0;
    let frameCount = 0;
    let lastHudSync = 0;
    let lightningTimer = 4.5;
    let lightningFlash = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(() => {
            if (!disposed) {
              frameId = requestAnimationFrame(cb);
            }
          }, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    let disposed = false;

    function tick() {
      if (disposed) return;
      try {
        const nowMs = performance.now();
        const dt = Math.min((nowMs - prevMs) / 1000, 0.08);
        prevMs = nowMs;
        const elapsed = (nowMs - startMs) / 1000;
        const cfg = configRef.current;

        // Rebuild procedural flora if seed or density changed
        if (cfg.seed !== builtSeed || Math.abs(cfg.floraDensity - builtDensity) > 0.01) {
          rebuildFlora(cfg.seed, cfg.floraDensity);
        }

        // Advance auto diurnal cycle
        let activeHour = cfg.timeOfDay;
        if (cfg.autoCycle && callbacksRef.current.onTimeTick) {
          activeHour = (cfg.timeOfDay + dt * 0.45) % 24;
          if (elapsed - lastHudSync > 0.12) {
            callbacksRef.current.onTimeTick(activeHour);
          }
        }

        // Compute atmosphere & apply to lights/sky/fog
        const atmo = computeAtmosphere(activeHour, cfg.weather, cfg.mistDensity);
        if (elapsed - lastHudSync > 0.12) {
          lastHudSync = elapsed;
          callbacksRef.current.onAtmosphereUpdate(atmo);
        }

        // Storm lightning flash
        if (cfg.weather === 'storm') {
          lightningTimer -= dt;
          if (lightningTimer <= 0) {
            lightningFlash = 1.0;
            lightningTimer = 3.2 + Math.random() * 5.0;
          }
          lightningFlash = Math.max(0, lightningFlash - dt * 4.5);
        } else {
          lightningFlash = 0;
        }

        skyUniforms.uTopColor.value.set(atmo.skyTopHex);
        skyUniforms.uHorizonColor.value.set(atmo.skyHorizonHex);
        if (lightningFlash > 0.05) {
          skyUniforms.uTopColor.value.lerp(_sunColor.set('#d8e6ff'), lightningFlash * 0.55);
        }
        _bgColor.set(atmo.fogHex);
        scene.background = _bgColor;
        fog.color.copy(_bgColor);
        fog.density = atmo.fogDensity;
        renderer.toneMappingExposure = atmo.exposure + lightningFlash * 0.35;
        scene.environmentIntensity = 0.24 + (1 - atmo.nocturnalFactor) * 0.76 + lightningFlash * 0.4;

        sunLight.position.set(...atmo.sunDirection);
        sunLight.color.copy(_sunColor.set(atmo.sunColorHex));
        sunLight.intensity = atmo.sunIntensity + lightningFlash * 2.8;

        moonLight.position.set(...atmo.moonDirection);
        moonLight.color.copy(_moonColor.set(atmo.moonColorHex));
        moonLight.intensity = atmo.moonIntensity;

        hemiLight.color.copy(_hemiSky.set(atmo.hemiSkyHex));
        hemiLight.groundColor.copy(_hemiGround.set(atmo.hemiGroundHex));
        hemiLight.intensity = atmo.hemiIntensity;

        rimLight.color.copy(_rimColor.set(atmo.rimColorHex));
        rimLight.intensity = atmo.rimIntensity;

        // Nocturnal fungi glow
        floraRefs.mushroomCaps.emissiveIntensity = 0.08 + atmo.nocturnalFactor * 1.85;
        fungiLight.intensity = atmo.nocturnalFactor * 1.35;

        // Glass visibility & humidity condensation sheen
        enclosure.glassGroup.visible = cfg.glassVisible;
        enclosure.glassMaterial.roughness = 0.04 + atmo.condensation * 0.24;

        // Animate water ripple normal UV offset
        const windMult = 0.35 + cfg.windSpeed * 1.2 + (cfg.weather === 'storm' ? 0.9 : 0);
        textures.waterNormal.offset.x = (elapsed * 0.022 * windMult) % 1;
        textures.waterNormal.offset.y = (elapsed * 0.015 * windMult) % 1;

        // Animate wind shader & flora sway
        const windUniforms = floraRefs.grassMaterial.userData.windUniforms as {
          uTime: { value: number };
          uWind: { value: number };
        };
        windUniforms.uTime.value = elapsed;
        windUniforms.uWind.value = cfg.windSpeed + (cfg.weather === 'storm' ? 0.55 : 0);

        const swayAmp = 0.012 + cfg.windSpeed * 0.04;
        floraRefs.heroTreeGroup.rotation.z = Math.sin(elapsed * 1.2) * swayAmp * 0.55;
        for (const f of floraRefs.fernGroups) {
          f.group.rotation.x = Math.sin(elapsed * 1.8 + f.phase) * swayAmp;
        }

        // Weather particles, pond mist, ripples, petals, fireflies
        weatherSystem.update(
          dt,
          elapsed,
          cfg.weather,
          cfg.windSpeed,
          cfg.mistDensity,
          atmo.nocturnalFactor
        );

        // Exponentially damped camera preset glide
        if (cameraGoalRef.current.active) {
          const lambda = 4.8;
          camera.position.x = THREE.MathUtils.damp(
            camera.position.x,
            cameraGoalRef.current.pos.x,
            lambda,
            dt
          );
          camera.position.y = THREE.MathUtils.damp(
            camera.position.y,
            cameraGoalRef.current.pos.y,
            lambda,
            dt
          );
          camera.position.z = THREE.MathUtils.damp(
            camera.position.z,
            cameraGoalRef.current.pos.z,
            lambda,
            dt
          );
          controls.target.x = THREE.MathUtils.damp(
            controls.target.x,
            cameraGoalRef.current.target.x,
            lambda,
            dt
          );
          controls.target.y = THREE.MathUtils.damp(
            controls.target.y,
            cameraGoalRef.current.target.y,
            lambda,
            dt
          );
          controls.target.z = THREE.MathUtils.damp(
            controls.target.z,
            cameraGoalRef.current.target.z,
            lambda,
            dt
          );

          if (
            camera.position.distanceTo(cameraGoalRef.current.pos) < 0.03 &&
            controls.target.distanceTo(cameraGoalRef.current.target) < 0.03
          ) {
            cameraGoalRef.current.active = false;
          }
        }

        controls.update();
        renderer.render(scene, camera);
        frameCount++;
        if (mountRef.current) {
          mountRef.current.dataset.frames = String(frameCount);
        }

        if (isSoftwareGl) {
          afterDraw(tick);
        } else {
          frameId = requestAnimationFrame(tick);
        }
      } catch (err) {
        console.error('Terrarium render error:', err);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      controls.removeEventListener('start', cancelGoal);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

      controls.dispose();
      skyGeo.dispose();
      skyMat.dispose();
      tableGeo.dispose();
      tableMat.dispose();
      envTex.dispose();
      weatherSystem.dispose();
      enclosure.disposables.forEach((d) => d.dispose());
      activeFlora.refs.dispose();
      textures.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Keep rebuildSignalRef synced so unused warning doesn't arise
  void rebuildSignalRef;

  return (
    <div className="relative w-full h-full">
      <div
        ref={mountRef}
        data-testid="terrarium-viewport"
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />
      {contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0d1115]/95 text-[#eef2ef] p-6 z-30">
          <div className="max-w-md text-center space-y-2">
            <h2 className="font-display text-2xl font-semibold">WebGL Context Suspended</h2>
            <p className="text-sm text-[#eef2ef]/70">
              Graphics rendering was temporarily paused by the browser. Reload the page to restore the 3D terrarium.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
