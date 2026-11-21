import { useCallback, useEffect, useMemo, useState } from 'react';
import { ControlOverlay } from './components/ControlOverlay';
import { computeAtmosphere, presetToHours } from './terrarium/atmosphere';
import { TerrariumViewport } from './terrarium/TerrariumViewport';
import type {
  AtmosphereState,
  CameraPreset,
  ControlTab,
  SpecimenInfo,
  TerrariumConfig,
} from './terrarium/types';

export default function App() {
  const [config, setConfig] = useState<TerrariumConfig>({
    timeOfDay: presetToHours('dusk'), // Golden twilight dusk + pond mist default
    autoCycle: false,
    weather: 'mist',
    windSpeed: 0.32,
    mistDensity: 0.52,
    floraDensity: 1.0,
    seed: 108,
    glassVisible: true,
  });

  const [activeTab, setActiveTab] = useState<ControlTab>('atmosphere');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('overview');
  const [cameraTrigger, setCameraTrigger] = useState(0);
  const [specimens, setSpecimens] = useState<SpecimenInfo[]>([]);
  const [selectedSpecimen, setSelectedSpecimen] = useState<SpecimenInfo | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const initialAtmosphere = useMemo(
    () => computeAtmosphere(config.timeOfDay, config.weather, config.mistDensity),
    []
  );
  const [atmosphere, setAtmosphere] = useState<AtmosphereState>(initialAtmosphere);

  const handleUpdateConfig = useCallback((patch: Partial<TerrariumConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleTimeTick = useCallback((nextHour: number) => {
    setConfig((prev) => ({ ...prev, timeOfDay: nextHour }));
  }, []);

  const handleSelectCamera = useCallback((preset: CameraPreset) => {
    setSelectedSpecimen(null);
    setCameraPreset(preset);
    setCameraTrigger((n) => n + 1);
  }, []);

  // Keyboard shortcut 'H' to toggle Cinema / Zen HUD collapse
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        setCollapsed((c) => !c);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <main
      className="relative w-screen h-screen overflow-hidden bg-[#0d1115]"
      data-weather={config.weather}
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      <TerrariumViewport
        config={config}
        cameraPreset={cameraPreset}
        cameraTrigger={cameraTrigger}
        selectedSpecimen={selectedSpecimen}
        onSelectSpecimen={setSelectedSpecimen}
        onSpecimensChange={setSpecimens}
        onAtmosphereUpdate={setAtmosphere}
        onTimeTick={handleTimeTick}
      />

      <ControlOverlay
        config={config}
        atmosphere={atmosphere}
        activeTab={activeTab}
        cameraPreset={cameraPreset}
        specimens={specimens}
        selectedSpecimen={selectedSpecimen}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        onChangeTab={setActiveTab}
        onUpdateConfig={handleUpdateConfig}
        onSelectCamera={handleSelectCamera}
        onSelectSpecimen={setSelectedSpecimen}
      />
    </main>
  );
}
