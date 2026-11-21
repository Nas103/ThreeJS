import type { AtmosphereState, TimePreset, WeatherMode } from './types';

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) =>
    Math.max(0, Math.min(255, Math.round(c)))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function lerpHex(hexA: string, hexB: string, t: number): string {
  const u = clamp01(t);
  const [ar, ag, ab] = hexToRgb(hexA);
  const [br, bg, bb] = hexToRgb(hexB);
  return rgbToHex(lerp(ar, br, u), lerp(ag, bg, u), lerp(ab, bb, u));
}

export function presetToHours(preset: TimePreset): number {
  switch (preset) {
    case 'dawn':
      return 6.35;
    case 'noon':
      return 12.75;
    case 'dusk':
      return 18.25;
    case 'midnight':
      return 23.5;
  }
}

export function formatTimeHours(hours: number): string {
  const normalized = ((hours % 24) + 24) % 24;
  const h = Math.floor(normalized);
  const m = Math.floor((normalized - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

interface Keyframe {
  hour: number;
  skyTop: string;
  skyHorizon: string;
  sunColor: string;
  sunIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  rimColor: string;
  rimIntensity: number;
  exposure: number;
}

const KEYFRAMES: Keyframe[] = [
  {
    hour: 0,
    skyTop: '#080c16',
    skyHorizon: '#141d2e',
    sunColor: '#3b4f78',
    sunIntensity: 0.08,
    hemiSky: '#243554',
    hemiGround: '#101518',
    hemiIntensity: 0.42,
    rimColor: '#6f93d6',
    rimIntensity: 0.72,
    exposure: 0.98,
  },
  {
    hour: 5.5,
    skyTop: '#182238',
    skyHorizon: '#594256',
    sunColor: '#f09468',
    sunIntensity: 0.55,
    hemiSky: '#6b6f94',
    hemiGround: '#21221e',
    hemiIntensity: 0.52,
    rimColor: '#f5a97d',
    rimIntensity: 0.85,
    exposure: 1.02,
  },
  {
    hour: 7.0,
    skyTop: '#314c6e',
    skyHorizon: '#d99a79',
    sunColor: '#ffbe8a',
    sunIntensity: 1.85,
    hemiSky: '#9ec2de',
    hemiGround: '#2f3829',
    hemiIntensity: 0.78,
    rimColor: '#ffd4ab',
    rimIntensity: 1.15,
    exposure: 1.1,
  },
  {
    hour: 12.5,
    skyTop: '#3b668c',
    skyHorizon: '#b9ced9',
    sunColor: '#fff5e4',
    sunIntensity: 2.55,
    hemiSky: '#c7e2f2',
    hemiGround: '#394631',
    hemiIntensity: 0.95,
    rimColor: '#e6f4ff',
    rimIntensity: 0.9,
    exposure: 1.12,
  },
  {
    hour: 17.6,
    skyTop: '#262d3d',
    skyHorizon: '#cf8372',
    sunColor: '#ff9d6e',
    sunIntensity: 1.95,
    hemiSky: '#8c8ba8',
    hemiGround: '#282620',
    hemiIntensity: 0.72,
    rimColor: '#ffb199',
    rimIntensity: 1.45,
    exposure: 1.08,
  },
  {
    hour: 19.2,
    skyTop: '#161b29',
    skyHorizon: '#634353',
    sunColor: '#d46d64',
    sunIntensity: 0.55,
    hemiSky: '#4a4e6e',
    hemiGround: '#161b18',
    hemiIntensity: 0.5,
    rimColor: '#9fb8e8',
    rimIntensity: 0.95,
    exposure: 1.0,
  },
  {
    hour: 21.0,
    skyTop: '#0b101c',
    skyHorizon: '#1b2436',
    sunColor: '#485d87',
    sunIntensity: 0.1,
    hemiSky: '#283959',
    hemiGround: '#11161a',
    hemiIntensity: 0.44,
    rimColor: '#7ca2e0',
    rimIntensity: 0.78,
    exposure: 0.98,
  },
  {
    hour: 24.0,
    skyTop: '#080c16',
    skyHorizon: '#141d2e',
    sunColor: '#3b4f78',
    sunIntensity: 0.08,
    hemiSky: '#243554',
    hemiGround: '#101518',
    hemiIntensity: 0.42,
    rimColor: '#6f93d6',
    rimIntensity: 0.72,
    exposure: 0.98,
  },
];

export function computeAtmosphere(
  timeOfDay: number,
  weather: WeatherMode,
  mistDensity: number
): AtmosphereState {
  const hour = ((timeOfDay % 24) + 24) % 24;

  let k0 = KEYFRAMES[0];
  let k1 = KEYFRAMES[1];
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (hour >= KEYFRAMES[i].hour && hour <= KEYFRAMES[i + 1].hour) {
      k0 = KEYFRAMES[i];
      k1 = KEYFRAMES[i + 1];
      break;
    }
  }
  const span = Math.max(0.0001, k1.hour - k0.hour);
  const t = clamp01((hour - k0.hour) / span);

  let skyTopHex = lerpHex(k0.skyTop, k1.skyTop, t);
  let skyHorizonHex = lerpHex(k0.skyHorizon, k1.skyHorizon, t);
  let sunColorHex = lerpHex(k0.sunColor, k1.sunColor, t);
  let sunIntensity = lerp(k0.sunIntensity, k1.sunIntensity, t);
  let hemiSkyHex = lerpHex(k0.hemiSky, k1.hemiSky, t);
  const hemiGroundHex = lerpHex(k0.hemiGround, k1.hemiGround, t);
  let hemiIntensity = lerp(k0.hemiIntensity, k1.hemiIntensity, t);
  let rimColorHex = lerpHex(k0.rimColor, k1.rimColor, t);
  let rimIntensity = lerp(k0.rimIntensity, k1.rimIntensity, t);
  let exposure = lerp(k0.exposure, k1.exposure, t);

  // Weather attenuation
  const weatherOvercast =
    weather === 'clear' ? 0 : weather === 'mist' ? 0.35 : weather === 'rain' ? 0.58 : 0.78;

  const overcastTone = hour > 6.5 && hour < 18.5 ? '#5c6973' : '#18212b';
  skyTopHex = lerpHex(skyTopHex, overcastTone, weatherOvercast * 0.65);
  skyHorizonHex = lerpHex(skyHorizonHex, overcastTone, weatherOvercast * 0.55);
  hemiSkyHex = lerpHex(hemiSkyHex, '#7e8f9e', weatherOvercast * 0.45);
  sunIntensity *= 1 - weatherOvercast * 0.62;
  hemiIntensity *= 1 - weatherOvercast * 0.15;
  rimIntensity *= 1 - weatherOvercast * 0.3;
  exposure -= weatherOvercast * 0.08;

  // Orbital sun arc: rises around 06:00 (+X/+Z), peaks 12:30, sets 19:00 (-X/-Z)
  const sunAngle = ((hour - 6) / 24) * Math.PI * 2;
  const sunElev = Math.sin(sunAngle);
  const sunX = Math.cos(sunAngle) * 11;
  const sunY = Math.max(1.6, sunElev * 12.5);
  const sunZ = 4.2 + Math.sin(sunAngle * 0.5) * 3.0;

  // Moon opposite to sun
  const moonAngle = sunAngle + Math.PI;
  const moonElev = Math.max(0, Math.sin(moonAngle));
  const moonX = Math.cos(moonAngle) * 10;
  const moonY = Math.max(2.5, Math.sin(moonAngle) * 11);
  const moonZ = -4.5;

  const nocturnalFactor = clamp01(1 - (sunElev + 0.12) / 0.42);
  const moonIntensity = nocturnalFactor * (0.95 - weatherOvercast * 0.45);

  // Fog matches horizon color
  const fogHex = lerpHex(skyHorizonHex, skyTopHex, 0.28);
  const baseFog = 0.018 + mistDensity * 0.025 + weatherOvercast * 0.022;

  // Microclimate readout inside glass enclosure
  const diurnalTemp = 19.2 + Math.sin(((hour - 9) / 24) * Math.PI * 2) * 3.8;
  const weatherTempOffset =
    weather === 'clear' ? 1.1 : weather === 'mist' ? -0.4 : weather === 'rain' ? -1.6 : -2.4;
  const temperatureC = Number((diurnalTemp + weatherTempOffset).toFixed(1));

  const baseHum =
    66 + mistDensity * 14 + (weather === 'mist' ? 12 : weather === 'rain' ? 18 : weather === 'storm' ? 22 : 0);
  const humidityPct = Math.min(99, Math.round(baseHum + nocturnalFactor * 5));
  const condensation = clamp01((humidityPct - 62) / 36);

  return {
    skyTopHex,
    skyHorizonHex,
    fogHex,
    fogDensity: baseFog,
    sunDirection: [sunX, sunY, sunZ],
    sunColorHex,
    sunIntensity,
    moonDirection: [moonX, moonY, moonZ],
    moonColorHex: '#8eb2f0',
    moonIntensity,
    hemiSkyHex,
    hemiGroundHex,
    hemiIntensity,
    rimColorHex,
    rimIntensity,
    exposure,
    nocturnalFactor,
    temperatureC,
    humidityPct,
    condensation,
  };
}
