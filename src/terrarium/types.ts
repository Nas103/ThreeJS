export type WeatherMode = 'clear' | 'mist' | 'rain' | 'storm';

export type TimePreset = 'dawn' | 'noon' | 'dusk' | 'midnight';

export type CameraPreset = 'overview' | 'canopy' | 'pond' | 'macro';

export type ControlTab = 'atmosphere' | 'weather' | 'flora';

export interface TerrariumConfig {
  /** Time of day in hours [0, 24) */
  timeOfDay: number;
  /** Whether time advances continuously */
  autoCycle: boolean;
  /** Current weather mode */
  weather: WeatherMode;
  /** Wind strength [0, 1] */
  windSpeed: number;
  /** Mist density [0, 1] */
  mistDensity: number;
  /** Flora density multiplier [0.4, 1.4] */
  floraDensity: number;
  /** Deterministic procedural seed */
  seed: number;
  /** Glass dome visibility toggle for macro inspection */
  glassVisible: boolean;
}

export interface SpecimenInfo {
  id: string;
  name: string;
  latinName: string;
  category: 'Canopy' | 'Bryophyte' | 'Fern' | 'Fungi' | 'Geology' | 'Hydrology';
  notes: string;
  humidityPreference: string;
  focusPoint: [number, number, number];
  cameraOffset: [number, number, number];
}

export interface AtmosphereState {
  skyTopHex: string;
  skyHorizonHex: string;
  fogHex: string;
  fogDensity: number;
  sunDirection: [number, number, number];
  sunColorHex: string;
  sunIntensity: number;
  moonDirection: [number, number, number];
  moonColorHex: string;
  moonIntensity: number;
  hemiSkyHex: string;
  hemiGroundHex: string;
  hemiIntensity: number;
  rimColorHex: string;
  rimIntensity: number;
  exposure: number;
  /** 0 during midday, ramping to 1 at night/deep dusk */
  nocturnalFactor: number;
  /** Computed ambient temperature in Celsius */
  temperatureC: number;
  /** Computed relative humidity percentage */
  humidityPct: number;
  /** Glass condensation factor [0, 1] */
  condensation: number;
}
