import { useState, useRef, useEffect, useCallback } from 'react';
import { MainMenu } from './components/MainMenu';
import { LobbySetup } from './components/LobbySetup';
import { HUD } from './components/HUD';
import { MatchResults } from './components/MatchResults';
import { SettingsScreen, GameSettings, DEFAULT_SETTINGS } from './components/SettingsScreen';
import { LeaderboardScreen, saveLocalRecord } from './components/LeaderboardScreen';
import { BPRenderer, GameSnapshot } from './game/renderer';
import { BotDifficulty } from './game/bots';
import { WeaponId } from './game/weapons';

type Screen = 'menu' | 'lobby' | 'practice_lobby' | 'game' | 'results' | 'settings' | 'leaderboard';

interface LaunchConfig {
  botCount: number;
  difficulty: BotDifficulty;
  playerName: string;
  weapon: WeaponId;
  team: 0 | 1;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [snap, setSnap] = useState<GameSnapshot | null>(null);
  const [launchConfig, setLaunchConfig] = useState<LaunchConfig | null>(null);
  const [showScoreboard, setShowScoreboard] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<BPRenderer | null>(null);
  const prevPhaseRef = useRef<string | null>(null);

  // Google Fonts
  useEffect(() => {
    if (!document.getElementById('bp-fonts')) {
      const link = document.createElement('link');
      link.id = 'bp-fonts';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  // Tab scoreboard
  useEffect(() => {
    if (screen !== 'game') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Tab') { e.preventDefault(); setShowScoreboard(true); }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Tab') setShowScoreboard(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [screen]);

  // Canvas resize observer
  useEffect(() => {
    if (screen !== 'game' || !canvasRef.current) return;
    const obs = new ResizeObserver(() => {
      rendererRef.current?.resize();
    });
    obs.observe(canvasRef.current);
    return () => obs.disconnect();
  }, [screen]);

  // Watch for match end
  useEffect(() => {
    if (!snap) return;
    const phase = snap.matchState.phase;
    if (phase === 'match_end' && prevPhaseRef.current !== 'match_end') {
      saveLocalRecord(snap.player.stats.kills, launchConfig?.difficulty ?? 'normal');
      setScreen('results');
    }
    prevPhaseRef.current = phase;
  }, [snap, launchConfig]);

  const startGame = useCallback((cfg: LaunchConfig) => {
    setLaunchConfig(cfg);
    setScreen('game');
    prevPhaseRef.current = null;

    // Defer one frame to let canvas mount
    requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (rendererRef.current) {
        rendererRef.current.stop();
        rendererRef.current = null;
      }

      const renderer = new BPRenderer(canvas, cfg.difficulty, cfg.botCount, cfg.team, cfg.weapon);
      renderer.onSnapshot = (s: GameSnapshot) => setSnap({ ...s });
      renderer.setVolume(settings.volume);
      rendererRef.current = renderer;
      renderer.start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally exclude settings — volume is applied via the separate useEffect

  const handleRematch = () => {
    if (!launchConfig) return;
    setSnap(null);
    startGame(launchConfig);
  };

  const handleMenu = () => {
    rendererRef.current?.stop();
    rendererRef.current = null;
    setSnap(null);
    setScreen('menu');
  };

  // Push volume changes to the renderer immediately
  useEffect(() => {
    rendererRef.current?.setVolume(settings.volume);
  }, [settings.volume]);

  // Cleanup
  useEffect(() => {
    return () => { rendererRef.current?.stop(); };
  }, []);

  return (
    <div className="min-h-dvh bg-[#0d1117]" style={{ fontFamily: '"DM Sans", sans-serif' }}>
      {screen === 'menu' && (
        <MainMenu
          onPlay={() => setScreen('lobby')}
          onPractice={() => setScreen('practice_lobby')}
          onLeaderboard={() => setScreen('leaderboard')}
          onSettings={() => setScreen('settings')}
        />
      )}

      {(screen === 'lobby' || screen === 'practice_lobby') && (
        <LobbySetup
          isPractice={screen === 'practice_lobby'}
          onStart={cfg => startGame(cfg)}
          onBack={() => setScreen('menu')}
        />
      )}

      {screen === 'settings' && (
        <SettingsScreen
          settings={settings}
          onSave={setSettings}
          onBack={() => setScreen('menu')}
        />
      )}

      {screen === 'leaderboard' && (
        <LeaderboardScreen onBack={() => setScreen('menu')} />
      )}

      {screen === 'results' && snap && (
        <MatchResults
          snap={snap}
          onRematch={handleRematch}
          onMenu={handleMenu}
        />
      )}

      {screen === 'game' && (
        <div className="relative w-full h-dvh">
          <canvas
            ref={canvasRef}
            className="w-full h-full block"
          />
          {snap && (
            <HUD
              snap={snap}
              showScoreboard={showScoreboard}
            />
          )}

          {/* Menu button — always visible */}
          <button
            onClick={handleMenu}
            className="absolute top-4 left-4 px-3 py-1.5 text-xs font-mono text-[#5a6a7a] border border-[#2a3040] rounded-sm hover:border-[#f5a623] hover:text-white transition-all pointer-events-auto z-10"
          >
            MENU
          </button>
        </div>
      )}
    </div>
  );
}
