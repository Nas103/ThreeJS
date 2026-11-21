import {
  ChevronDown,
  ChevronUp,
  CloudFog,
  CloudLightning,
  CloudRain,
  Eye,
  EyeOff,
  Pause,
  Play,
  RefreshCw,
  Sun,
  X,
} from 'lucide-react';
import { formatTimeHours, presetToHours } from '../terrarium/atmosphere';
import type {
  AtmosphereState,
  CameraPreset,
  ControlTab,
  SpecimenInfo,
  TerrariumConfig,
  TimePreset,
  WeatherMode,
} from '../terrarium/types';

interface ControlOverlayProps {
  config: TerrariumConfig;
  atmosphere: AtmosphereState;
  activeTab: ControlTab;
  cameraPreset: CameraPreset;
  specimens: SpecimenInfo[];
  selectedSpecimen: SpecimenInfo | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onChangeTab: (tab: ControlTab) => void;
  onUpdateConfig: (patch: Partial<TerrariumConfig>) => void;
  onSelectCamera: (preset: CameraPreset) => void;
  onSelectSpecimen: (specimen: SpecimenInfo | null) => void;
}

const TIME_PRESETS: { id: TimePreset; label: string }[] = [
  { id: 'dawn', label: 'Dawn' },
  { id: 'noon', label: 'Noon' },
  { id: 'dusk', label: 'Dusk' },
  { id: 'midnight', label: 'Midnight' },
];

const WEATHER_MODES: { id: WeatherMode; label: string; icon: typeof Sun }[] = [
  { id: 'clear', label: 'Clear', icon: Sun },
  { id: 'mist', label: 'Mist', icon: CloudFog },
  { id: 'rain', label: 'Rain', icon: CloudRain },
  { id: 'storm', label: 'Storm', icon: CloudLightning },
];

const CAMERA_VIEWS: { id: CameraPreset; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'canopy', label: 'Canopy' },
  { id: 'pond', label: 'Pond' },
  { id: 'macro', label: 'Macro' },
];

export function ControlOverlay({
  config,
  atmosphere,
  activeTab,
  cameraPreset,
  specimens,
  selectedSpecimen,
  collapsed,
  onToggleCollapse,
  onChangeTab,
  onUpdateConfig,
  onSelectCamera,
  onSelectSpecimen,
}: ControlOverlayProps) {
  const formattedTime = formatTimeHours(config.timeOfDay);

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-5">
      {/* Top-Left Minimal Editorial Title & Unboxed Microclimate Readout */}
      <header className="pointer-events-auto flex items-baseline justify-between gap-6">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#eef2ef] leading-none">
            Vitrarium
          </h1>
          <div className="flex items-center gap-2 text-xs text-[#eef2ef]/70 font-mono-num">
            <span data-testid="readout-time">{formattedTime}</span>
            <span aria-hidden="true">·</span>
            <span data-testid="readout-temp">{atmosphere.temperatureC.toFixed(1)}°C</span>
            <span aria-hidden="true">·</span>
            <span data-testid="readout-humidity">{atmosphere.humidityPct}% RH</span>
            <span aria-hidden="true">·</span>
            <span className="capitalize font-sans">{config.weather}</span>
          </div>
        </div>
      </header>

      {/* Bottom Dock Container (Zero Mid-Screen Obstruction) */}
      <div
        data-testid="control-dock"
        data-collapsed={collapsed ? 'true' : 'false'}
        className="flex flex-col items-center w-full"
      >
        {/* Specimen Inspector Strip (Only visible when user selects a specimen in 3D or via Flora tab) */}
        {selectedSpecimen && !collapsed && (
          <div
            data-testid="specimen-card"
            className="pointer-events-auto mb-1.5 sm:mb-2.5 w-full max-w-[min(860px,96vw)] rounded-xl bg-[#0e1317]/92 border border-white/12 px-3 py-2 sm:px-4 sm:py-3 flex items-start justify-between gap-3 sm:gap-4 shadow-xl"
          >
            <div className="min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-display text-base sm:text-lg font-semibold text-[#eef2ef]">
                  {selectedSpecimen.name}
                </span>
                <span className="text-xs italic text-[#c89f65]">
                  {selectedSpecimen.latinName}
                </span>
                <span className="text-xs text-[#eef2ef]/55">
                  · {selectedSpecimen.category} · {selectedSpecimen.humidityPreference}
                </span>
              </div>
              <p className="text-xs text-[#eef2ef]/75 mt-0.5 sm:mt-1 leading-relaxed line-clamp-2 sm:line-clamp-none">
                {selectedSpecimen.notes}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSelectSpecimen(null)}
              aria-label="Close specimen details"
              className="shrink-0 p-1.5 rounded-lg text-[#eef2ef]/65 hover:text-[#eef2ef] hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Collapse / Expand Toggle Attached to Top Edge of Dock */}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Show Controls' : 'Hide Controls'}
          className="pointer-events-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-t-lg bg-[#0e1317]/92 border border-b-0 border-white/12 text-xs font-medium text-[#eef2ef]/85 hover:text-[#eef2ef] transition-colors whitespace-nowrap shrink-0"
        >
          {collapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-[#c89f65]" />
              <span>Show Controls</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-[#c89f65]" />
              <span>Hide Controls</span>
            </>
          )}
        </button>

        {/* Main Horizontal Control Dock */}
        {!collapsed && (
          <section
            aria-label="Terrarium Controls"
            className="pointer-events-auto w-full max-w-[min(860px,96vw)] rounded-xl bg-[#0e1317]/92 border border-white/12 px-3 py-2 sm:px-4 sm:py-3 shadow-2xl"
          >
            {/* Top Row: Mode Tabs + Quick Camera View Switcher */}
            <div className="flex flex-nowrap sm:flex-wrap items-center justify-between gap-2 sm:gap-3 pb-2 mb-2 border-b border-white/10 overflow-x-auto no-scrollbar">
              <div role="tablist" aria-label="Control categories" className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg shrink-0">
                {(
                  [
                    { id: 'atmosphere', label: 'Lighting' },
                    { id: 'weather', label: 'Weather' },
                    { id: 'flora', label: 'Flora & View' },
                  ] as { id: ControlTab; label: string }[]
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    onClick={() => onChangeTab(tab.id)}
                    className={`px-2.5 sm:px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      activeTab === tab.id
                        ? 'bg-[#c89f65] text-[#0e1317]'
                        : 'text-[#eef2ef]/75 hover:text-[#eef2ef]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {CAMERA_VIEWS.map((view) => (
                  <button
                    key={view.id}
                    type="button"
                    onClick={() => onSelectCamera(view.id)}
                    className={`px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      cameraPreset === view.id
                        ? 'bg-white/15 text-[#eef2ef]'
                        : 'text-[#eef2ef]/65 hover:text-[#eef2ef] hover:bg-white/5'
                    }`}
                  >
                    {view.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Panel: Day / Night Lighting */}
            {activeTab === 'atmosphere' && (
              <div className="flex flex-nowrap sm:flex-wrap items-center justify-between gap-2.5 sm:gap-4 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-1.5 shrink-0">
                  {TIME_PRESETS.map((preset) => {
                    const targetH = presetToHours(preset.id);
                    const isClose = Math.abs(config.timeOfDay - targetH) < 0.75;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() =>
                          onUpdateConfig({ timeOfDay: targetH, autoCycle: false })
                        }
                        className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          isClose
                            ? 'bg-white/16 text-[#eef2ef]'
                            : 'bg-white/5 text-[#eef2ef]/70 hover:text-[#eef2ef]'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-3 flex-1 min-w-[190px]">
                  <label
                    htmlFor="time-of-day-slider"
                    className="text-xs text-[#eef2ef]/70 whitespace-nowrap shrink-0"
                  >
                    Solar Arc
                  </label>
                  <input
                    id="time-of-day-slider"
                    type="range"
                    min={0}
                    max={23.95}
                    step={0.05}
                    value={config.timeOfDay}
                    onChange={(e) =>
                      onUpdateConfig({
                        timeOfDay: parseFloat(e.target.value),
                        autoCycle: false,
                      })
                    }
                    className="terrarium-slider"
                  />
                  <span className="text-xs font-mono-num text-[#eef2ef]/85 w-11 text-right shrink-0">
                    {formattedTime}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onUpdateConfig({ autoCycle: !config.autoCycle })}
                  aria-pressed={config.autoCycle}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    config.autoCycle
                      ? 'bg-[#c89f65]/25 text-[#f0cf99] border border-[#c89f65]/40'
                      : 'bg-white/5 text-[#eef2ef]/75 hover:text-[#eef2ef]'
                  }`}
                >
                  {config.autoCycle ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause Cycle</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>Auto Cycle</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Tab Panel: Weather Controls */}
            {activeTab === 'weather' && (
              <div className="flex flex-nowrap sm:flex-wrap items-center justify-between gap-2.5 sm:gap-4 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-1.5 shrink-0">
                  {WEATHER_MODES.map((w) => {
                    const Icon = w.icon;
                    const active = config.weather === w.id;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onUpdateConfig({ weather: w.id })}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-[#c89f65] text-[#0e1317]'
                            : 'bg-white/5 text-[#eef2ef]/75 hover:text-[#eef2ef]'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{w.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2.5 flex-1 min-w-[140px]">
                  <label
                    htmlFor="mist-slider"
                    className="text-xs text-[#eef2ef]/70 whitespace-nowrap shrink-0"
                  >
                    Mist
                  </label>
                  <input
                    id="mist-slider"
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={config.mistDensity}
                    onChange={(e) =>
                      onUpdateConfig({ mistDensity: parseFloat(e.target.value) })
                    }
                    className="terrarium-slider"
                  />
                  <span className="text-xs font-mono-num text-[#eef2ef]/80 w-9 text-right shrink-0">
                    {Math.round(config.mistDensity * 100)}%
                  </span>
                </div>

                <div className="flex items-center gap-2.5 flex-1 min-w-[140px]">
                  <label
                    htmlFor="wind-slider"
                    className="text-xs text-[#eef2ef]/70 whitespace-nowrap shrink-0"
                  >
                    Breeze
                  </label>
                  <input
                    id="wind-slider"
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={config.windSpeed}
                    onChange={(e) =>
                      onUpdateConfig({ windSpeed: parseFloat(e.target.value) })
                    }
                    className="terrarium-slider"
                  />
                  <span className="text-xs font-mono-num text-[#eef2ef]/80 w-9 text-right shrink-0">
                    {Math.round(config.windSpeed * 100)}%
                  </span>
                </div>
              </div>
            )}

            {/* Tab Panel: Procedural Flora & Vessel Controls */}
            {activeTab === 'flora' && (
              <div className="flex flex-nowrap sm:flex-wrap items-center justify-between gap-2.5 sm:gap-3 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-2.5 flex-1 min-w-[165px] shrink-0">
                  <label
                    htmlFor="density-slider"
                    className="text-xs text-[#eef2ef]/70 whitespace-nowrap shrink-0"
                  >
                    Flora Density
                  </label>
                  <input
                    id="density-slider"
                    type="range"
                    min={0.5}
                    max={1.4}
                    step={0.1}
                    value={config.floraDensity}
                    onChange={(e) =>
                      onUpdateConfig({ floraDensity: parseFloat(e.target.value) })
                    }
                    className="terrarium-slider"
                  />
                  <span className="text-xs font-mono-num text-[#eef2ef]/80 w-9 text-right shrink-0">
                    {Math.round(config.floraDensity * 100)}%
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {specimens.slice(0, 3).map((sp) => (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() => onSelectSpecimen(sp)}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        selectedSpecimen?.id === sp.id
                          ? 'bg-white/16 text-[#eef2ef]'
                          : 'bg-white/5 text-[#eef2ef]/70 hover:text-[#eef2ef]'
                      }`}
                    >
                      {sp.category}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateConfig({ glassVisible: !config.glassVisible })
                    }
                    aria-pressed={config.glassVisible}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-white/5 text-[#eef2ef]/80 hover:text-[#eef2ef] transition-colors whitespace-nowrap shrink-0"
                  >
                    {config.glassVisible ? (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>Glass On</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Glass Off</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onUpdateConfig({
                        seed: ((config.seed * 1103515245 + 12345) >>> 0) % 9999 + 1,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-[#c89f65]/20 text-[#f0cf99] border border-[#c89f65]/35 hover:bg-[#c89f65]/30 transition-colors whitespace-nowrap shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reseed #{config.seed}</span>
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
