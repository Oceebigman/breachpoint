import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';

export interface GameSettings {
  sensitivity: number;
  fov: number;
  volume: number;
  showFps: boolean;
  reducedMotion: boolean;
  graphics: 'low' | 'balanced' | 'high';
}

export const DEFAULT_SETTINGS: GameSettings = {
  sensitivity: 0.002,
  fov: 75,
  volume: 0.7,
  showFps: false,
  reducedMotion: false,
  graphics: 'balanced',
};

interface Props {
  settings: GameSettings;
  onSave: (s: GameSettings) => void;
  onBack: () => void;
}

function Slider({ label, value, min, max, step, format, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-[#8899aa] text-xs font-mono tracking-widest w-28 shrink-0">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-[#f5a623]"
      />
      <span className="text-white font-mono text-sm tabular-nums w-12 text-right">{format(value)}</span>
    </div>
  );
}

export function SettingsScreen({ settings, onSave, onBack }: Props) {
  const [s, setS] = useState<GameSettings>({ ...settings });

  return (
    <div className="min-h-dvh bg-[#0d1117] flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onBack}
            className="p-2 border border-[#2a3040] text-[#8899aa] hover:border-[#f5a623] hover:text-white rounded-sm transition-all"
          >
            <ArrowLeft size={16} />
          </button>
          <h2 className="text-white font-bold text-xl tracking-wider" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
            SETTINGS
          </h2>
        </div>

        <div className="flex flex-col gap-4">
          {/* Mouse */}
          <div className="p-4 border border-[#2a3040] rounded-sm">
            <div className="text-[#f5a623] text-xs font-mono tracking-widest mb-4">MOUSE</div>
            <div className="flex flex-col gap-4">
              <Slider
                label="SENSITIVITY"
                value={s.sensitivity}
                min={0.0005}
                max={0.006}
                step={0.0001}
                format={v => v.toFixed(4)}
                onChange={v => setS({ ...s, sensitivity: v })}
              />
            </div>
          </div>

          {/* Display */}
          <div className="p-4 border border-[#2a3040] rounded-sm">
            <div className="text-[#f5a623] text-xs font-mono tracking-widest mb-4">DISPLAY</div>
            <div className="flex flex-col gap-4">
              <Slider
                label="FOV"
                value={s.fov}
                min={60}
                max={110}
                step={1}
                format={v => `${v}°`}
                onChange={v => setS({ ...s, fov: v })}
              />
              <div className="flex items-center gap-4">
                <span className="text-[#8899aa] text-xs font-mono tracking-widest w-28">GRAPHICS</span>
                <div className="flex gap-2">
                  {(['low', 'balanced', 'high'] as const).map(g => (
                    <button
                      key={g}
                      onClick={() => setS({ ...s, graphics: g })}
                      className={`px-3 py-1 text-xs font-mono uppercase rounded-sm border transition-all ${
                        s.graphics === g
                          ? 'border-[#f5a623] text-[#f5a623] bg-[#f5a62310]'
                          : 'border-[#2a3040] text-[#5a6a7a]'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[#8899aa] text-xs font-mono tracking-widest w-28">SHOW FPS</span>
                <button
                  onClick={() => setS({ ...s, showFps: !s.showFps })}
                  className={`w-10 h-5 rounded-full border transition-all relative ${
                    s.showFps ? 'border-[#f5a623] bg-[#f5a62330]' : 'border-[#2a3040] bg-transparent'
                  }`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                    s.showFps ? 'left-5 bg-[#f5a623]' : 'left-0.5 bg-[#3a4050]'
                  }`} />
                </button>
              </div>
            </div>
          </div>

          {/* Audio */}
          <div className="p-4 border border-[#2a3040] rounded-sm">
            <div className="text-[#f5a623] text-xs font-mono tracking-widest mb-4">AUDIO</div>
            <Slider
              label="VOLUME"
              value={s.volume}
              min={0}
              max={1}
              step={0.01}
              format={v => `${Math.round(v * 100)}%`}
              onChange={v => setS({ ...s, volume: v })}
            />
          </div>

          {/* Accessibility */}
          <div className="p-4 border border-[#2a3040] rounded-sm">
            <div className="text-[#f5a623] text-xs font-mono tracking-widest mb-3">ACCESSIBILITY</div>
            <div className="flex items-center gap-4">
              <span className="text-[#8899aa] text-xs font-mono tracking-widest w-28">REDUCED MOTION</span>
              <button
                onClick={() => setS({ ...s, reducedMotion: !s.reducedMotion })}
                className={`w-10 h-5 rounded-full border transition-all relative ${
                  s.reducedMotion ? 'border-[#f5a623] bg-[#f5a62330]' : 'border-[#2a3040] bg-transparent'
                }`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                  s.reducedMotion ? 'left-5 bg-[#f5a623]' : 'left-0.5 bg-[#3a4050]'
                }`} />
              </button>
            </div>
          </div>

          {/* Controls reference */}
          <div className="p-4 border border-[#2a3040] rounded-sm">
            <div className="text-[#f5a623] text-xs font-mono tracking-widest mb-3">CONTROLS</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs font-mono">
              {[
                ['WASD', 'Move'], ['Mouse', 'Aim'], ['LMB', 'Fire'], ['RMB', 'ADS'],
                ['R', 'Reload'], ['E (hold)', 'Interact'], ['Shift', 'Sprint'],
                ['Ctrl / C', 'Crouch'], ['Space', 'Jump'], ['Tab', 'Scoreboard'],
                ['Esc', 'Pause / unlock'],
              ].map(([key, action]) => (
                <div key={key} className="flex justify-between gap-2">
                  <span className="text-[#f5a623]">{key}</span>
                  <span className="text-[#8899aa]">{action}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => { onSave(s); onBack(); }}
            className="w-full py-3 bg-[#f5a623] text-[#0d1117] font-bold rounded-sm hover:bg-[#ffc046] transition-colors"
            style={{ fontFamily: '"Space Grotesk", sans-serif' }}
          >
            SAVE SETTINGS
          </button>
        </div>
      </div>
    </div>
  );
}
