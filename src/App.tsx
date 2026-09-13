import { useState, useEffect, useRef, useCallback } from 'react';
import { GameStatus, LeaderboardEntry, Point } from './types';
import { START_POS, CHECKPOINTS } from './data/mazeData';
import { MazeCanvas } from './components/MazeCanvas';
import { LetterSmasherMinigame } from './components/LetterSmasherMinigame';
import { Leaderboard } from './components/Leaderboard';
import { NameModal } from './components/NameModal';
import { EndGameModal } from './components/EndGameModal';
import { sound } from './utils/sound';
import {
  Heart,
  Clock,
  Volume2,
  VolumeX,
  Compass,
  RotateCcw,
  AlertTriangle,
  Info,
  Users,
  DoorOpen,
} from 'lucide-react';

export default function App() {
  // --- Persistent Runner ID for Session ---
  const [runnerId] = useState<string>(() => {
    try {
      const stored = sessionStorage.getItem('signal_runner_id');
      if (stored) return stored;
      const created = `runner-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      sessionStorage.setItem('signal_runner_id', created);
      return created;
    } catch {
      return `runner-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    }
  });

  // Room Code (defaults from URL parameter ?room=XYZ or stored in session)
  const [roomCode, setRoomCode] = useState<string>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlRoom = params.get('room');
      if (urlRoom) return urlRoom.toUpperCase().trim();
      const stored = sessionStorage.getItem('signal_room_code');
      if (stored) return stored;
    } catch {
      // ignore
    }
    return 'LAB-101';
  });

  // --- Game State ---
  const [gameStatus, setGameStatus] = useState<GameStatus>('NAME_ENTRY');
  const [playerName, setPlayerName] = useState<string>(() => {
    try {
      return sessionStorage.getItem('signal_runner_name') || '';
    } catch {
      return '';
    }
  });
  const [playerPos, setPlayerPos] = useState<Point>(START_POS);
  const [lives, setLives] = useState<number>(5);
  const [completedCheckpoints, setCompletedCheckpoints] = useState<boolean[]>([
    false,
    false,
    false,
    false,
    false,
  ]);
  const [activeCheckpointId, setActiveCheckpointId] = useState<number | null>(null);

  // Invulnerability window after taking damage (ms)
  const [invulnerableUntil, setInvulnerableUntil] = useState<number>(0);

  // Timer
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const timerIntervalRef = useRef<number | null>(null);

  // Audio mute state
  const [soundMuted, setSoundMuted] = useState<boolean>(false);

  // Warnings / Toasts
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // End Game Info
  const [defeatReason, setDefeatReason] = useState<string>('');
  const [finalRank, setFinalRank] = useState<number | undefined>(undefined);
  const [isNewBest, setIsNewBest] = useState<boolean>(false);

  // Real-time Multi-User Leaderboard & Activity Feed scoped to active Room
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [liveEvents, setLiveEvents] = useState<
    { id: string; text: string; time: string; color: string }[]
  >([]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  }, []);

  const addLiveEvent = useCallback((text: string, color: string = 'text-cyan-300') => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    setLiveEvents((prev) => [
      { id: `${Date.now()}-${Math.random()}`, text, time: timeStr, color },
      ...prev.slice(0, 9),
    ]);
  }, []);

  // ==================== REAL-TIME ROOM SYNCHRONIZATION ====================

  // 1. Fetch initial room leaderboard & backup polling
  const fetchRoomLeaderboard = useCallback(async () => {
    if (!roomCode) return;
    try {
      const res = await fetch(`/api/room/${encodeURIComponent(roomCode)}/leaderboard`);
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.leaderboard)) {
          setLeaderboard(json.leaderboard);
        }
      }
    } catch {
      // ignore
    }
  }, [roomCode]);

  useEffect(() => {
    fetchRoomLeaderboard();
    const pollInterval = window.setInterval(fetchRoomLeaderboard, 3500);
    return () => clearInterval(pollInterval);
  }, [fetchRoomLeaderboard]);

  // 2. Server-Sent Events (SSE) scoped to this Room
  useEffect(() => {
    if (!roomCode) return;
    let es: EventSource | null = null;
    try {
      es = new EventSource(`/api/events?roomCode=${encodeURIComponent(roomCode)}`);

      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          const { type, data } = payload;

          if (type === 'initial_state' || type === 'leaderboard_update') {
            if (Array.isArray(data)) {
              setLeaderboard(data);
            }
          } else if (type === 'checkpoint_cleared') {
            const isMe = data.playerId === runnerId;
            addLiveEvent(
              `⚡ ${data.playerName} reached Checkpoint ${data.checkpointId}!`,
              isMe ? 'text-cyan-300 font-bold' : 'text-amber-300'
            );
            if (!isMe) {
              showToast(`📢 ${data.playerName} reached Checkpoint ${data.checkpointId}!`);
            }
          } else if (type === 'player_escaped') {
            const isMe = data.playerId === runnerId;
            addLiveEvent(
              `🏆 ${data.playerName} ESCAPED THE GRID in ${Math.floor(data.timeSeconds / 60)}m ${
                data.timeSeconds % 60
              }s!`,
              'text-emerald-400 font-bold'
            );
            if (!isMe) {
              showToast(`🏆 ${data.playerName} ESCAPED THE GRID (#${data.rank})!`);
            }
          } else if (type === 'player_joined') {
            addLiveEvent(`🎮 ${data.player.name} joined room ${roomCode}`, 'text-slate-400');
          } else if (type === 'player_eliminated') {
            addLiveEvent(`💀 ${data.playerName} eliminated at CP ${data.checkpointsCleared}/5`, 'text-red-400');
          }
        } catch {
          // ignore
        }
      };
    } catch {
      // ignore
    }

    return () => {
      if (es) es.close();
    };
  }, [addLiveEvent, roomCode, runnerId, showToast]);

  // 3. Heartbeat to keep room presence
  useEffect(() => {
    if (!playerName || gameStatus === 'NAME_ENTRY' || !roomCode) return;

    const sendHeartbeat = async () => {
      try {
        await fetch('/api/player/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: runnerId,
            roomCode,
            totalTimeSeconds: elapsedSeconds,
            livesRemaining: lives,
            status: gameStatus === 'CHECKPOINT_MINIGAME' ? 'IN_CHECKPOINT' : 'NAVIGATING',
          }),
        });
      } catch {
        // ignore
      }
    };

    const interval = window.setInterval(sendHeartbeat, 5000);
    return () => clearInterval(interval);
  }, [runnerId, roomCode, playerName, elapsedSeconds, lives, gameStatus]);

  // 4. Stopwatch
  useEffect(() => {
    if (gameStatus === 'NAVIGATING' || gameStatus === 'CHECKPOINT_MINIGAME') {
      timerIntervalRef.current = window.setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [gameStatus]);

  // Toggle audio
  const toggleSound = () => {
    const next = !soundMuted;
    setSoundMuted(next);
    sound.enabled = !next;
  };

  // Start new game run with name and roomCode
  const handleStartGame = async (name: string, selectedRoom: string) => {
    const cleanRoom = selectedRoom.trim().toUpperCase();
    setPlayerName(name);
    setRoomCode(cleanRoom);

    try {
      sessionStorage.setItem('signal_runner_name', name);
      sessionStorage.setItem('signal_room_code', cleanRoom);
      // Update URL query string without reloading page
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('room', cleanRoom);
      window.history.replaceState({}, '', newUrl.toString());
    } catch {
      // ignore
    }

    setPlayerPos(START_POS);
    setLives(5);
    setCompletedCheckpoints([false, false, false, false, false]);
    setActiveCheckpointId(null);
    setElapsedSeconds(0);
    setInvulnerableUntil(0);
    setGameStatus('NAVIGATING');

    // Register with server in that specific room
    try {
      await fetch('/api/room/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: runnerId, name, roomCode: cleanRoom }),
      });
      fetchRoomLeaderboard();
    } catch {
      // ignore
    }

    showToast(`ENTERED LAB ROOM [${cleanRoom}] — GOOD LUCK!`);
  };

  // Restart run with existing name & room
  const handleRestart = async () => {
    setPlayerPos(START_POS);
    setLives(5);
    setCompletedCheckpoints([false, false, false, false, false]);
    setActiveCheckpointId(null);
    setElapsedSeconds(0);
    setInvulnerableUntil(0);
    setGameStatus('NAVIGATING');

    if (playerName && roomCode) {
      try {
        await fetch('/api/room/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: runnerId, name: playerName, roomCode }),
        });
        fetchRoomLeaderboard();
      } catch {
        // ignore
      }
    }
    showToast('GRID REINITIALIZED — GOOD LUCK');
  };

  // Switch room
  const handleSwitchRoom = () => {
    setGameStatus('NAME_ENTRY');
  };

  // Checkpoint triggered in maze
  const handleTriggerCheckpoint = (cpId: number) => {
    setActiveCheckpointId(cpId);
    setGameStatus('CHECKPOINT_MINIGAME');
    showToast(`SIGNAL INTERCEPT: CHECKPOINT ${cpId} MINI-GAME!`);
  };

  // Checkpoint mini-game cleared
  const handleCheckpointSuccess = async () => {
    if (activeCheckpointId !== null) {
      const currentCp = activeCheckpointId;
      const updated = [...completedCheckpoints];
      updated[currentCp - 1] = true;
      setCompletedCheckpoints(updated);
      const cpName = CHECKPOINTS[currentCp - 1]?.name || `Sector ${currentCp}`;
      showToast(`CHECKPOINT ${currentCp} (${cpName}) SECURED!`);

      // Broadcast checkpoint progress to current room
      try {
        await fetch('/api/player/checkpoint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: runnerId,
            roomCode,
            checkpointId: currentCp,
            totalTimeSeconds: elapsedSeconds,
            livesRemaining: lives,
          }),
        });
        fetchRoomLeaderboard();
      } catch {
        // ignore
      }
    }
    setActiveCheckpointId(null);
    setGameStatus('NAVIGATING');
    setInvulnerableUntil(performance.now() + 1500);
  };

  // Lose life handler
  const handleLoseLife = useCallback(
    async (reason: string) => {
      setLives((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          // Game Over
          setGameStatus('GAME_OVER');
          setDefeatReason(reason);
          showToast(`MISSION FAILED: ${reason.toUpperCase()}`);

          // Broadcast elimination to room
          const cleared = completedCheckpoints.filter(Boolean).length;
          fetch('/api/player/gameover', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: runnerId,
              roomCode,
              totalTimeSeconds: elapsedSeconds,
              checkpointsCleared: cleared,
              reason,
            }),
          }).catch(() => {});

          return 0;
        }
        return next;
      });
    },
    [completedCheckpoints, elapsedSeconds, roomCode, runnerId, showToast]
  );

  // Touched hazard
  const handleHitHazard = useCallback(() => {
    sound.playHazardHit();
    setInvulnerableUntil(performance.now() + 2000);

    let respawnPoint = START_POS;
    for (let i = CHECKPOINTS.length - 1; i >= 0; i--) {
      if (completedCheckpoints[i]) {
        respawnPoint = { c: CHECKPOINTS[i].c, r: CHECKPOINTS[i].r };
        break;
      }
    }
    setPlayerPos(respawnPoint);

    showToast('HAZARD CONTACT! -1 LIFE (Respawned at safe node)');
    handleLoseLife('Electrocuted by active laser hazard');
  }, [completedCheckpoints, handleLoseLife, showToast]);

  // Reached exit
  const handleReachExit = async () => {
    sound.playVictory();
    setGameStatus('VICTORY');

    const totalSeconds = elapsedSeconds;
    const finalLives = lives;

    // Send room completion to server
    try {
      const res = await fetch('/api/player/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: runnerId,
          roomCode,
          totalTimeSeconds: totalSeconds,
          livesRemaining: finalLives,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setFinalRank(json.rank);
        setIsNewBest(json.rank === 1);
      }
      fetchRoomLeaderboard();
    } catch {
      // ignore
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const clearedCount = completedCheckpoints.filter(Boolean).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none antialiased">
      {/* Top Header Bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Brand & Room Info */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.3)]">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-wider text-slate-100 font-['Orbitron'] flex items-center gap-2">
                MAZE RUNNER <span className="text-xs text-cyan-400 font-mono font-normal">SIGNAL BREACH</span>
              </h1>
              <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
                <span className="flex items-center gap-1 text-cyan-300 font-bold">
                  <Users className="w-3 h-3" /> ROOM: {roomCode}
                </span>
                <span>•</span>
                <span>{playerName ? `RUNNER: ${playerName}` : 'CALLSIGN PENDING'}</span>
              </div>
            </div>
          </div>

          {/* HUD Live Stats */}
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            {/* Timer */}
            <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span className="font-mono font-bold text-sm text-cyan-300">
                {formatTime(elapsedSeconds)}
              </span>
            </div>

            {/* Checkpoint Indicators (1 to 5) */}
            <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="text-[10px] font-mono text-slate-400 uppercase mr-1">Checkpoints:</span>
              {completedCheckpoints.map((cleared, idx) => (
                <div
                  key={idx}
                  title={`Checkpoint ${idx + 1}: ${cleared ? 'Cleared' : 'Pending'}`}
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold transition-all ${
                    cleared
                      ? 'bg-emerald-500 text-slate-950 shadow-[0_0_8px_rgba(16,185,129,0.7)]'
                      : idx + 1 === activeCheckpointId
                      ? 'bg-amber-400 text-slate-950 animate-ping'
                      : 'border border-slate-700 text-slate-400 bg-slate-900'
                  }`}
                >
                  {cleared ? '✓' : idx + 1}
                </div>
              ))}
            </div>

            {/* Lives Remaining */}
            <div className="flex items-center gap-1 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="text-[10px] font-mono text-slate-400 uppercase mr-1">Lives:</span>
              {Array.from({ length: 5 }).map((_, i) => (
                <Heart
                  key={i}
                  className={`w-4 h-4 transition-all ${
                    i < lives
                      ? 'text-red-500 fill-red-500 drop-shadow-[0_0_6px_rgba(239,68,68,0.9)]'
                      : 'text-slate-700'
                  }`}
                />
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleSound}
                title={soundMuted ? 'Unmute Sound' : 'Mute Sound'}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              >
                {soundMuted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
              </button>

              <button
                type="button"
                onClick={handleRestart}
                title="Restart Run in this Room"
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleSwitchRoom}
                title="Switch Room or Change Callsign"
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors"
              >
                <DoorOpen className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 flex flex-col lg:flex-row gap-4 items-start justify-center">
        {/* Left / Center: Maze Display & HUD */}
        <div className="flex-1 w-full flex flex-col items-center">
          {/* Quick Mission Guidance Banner */}
          <div className="w-full mb-2.5 flex items-center justify-between text-xs text-slate-400 bg-slate-900/60 border border-slate-800/80 px-3 py-2 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>
                <strong className="text-cyan-300">Blue Core</strong> = You. Move with{' '}
                <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700 font-mono text-[10px]">
                  Arrow Keys
                </kbd>{' '}
                or{' '}
                <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700 font-mono text-[10px]">
                  WASD
                </kbd>.
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-3">
              <span className="flex items-center gap-1 text-red-400 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" /> Red hazards disappear & reappear — time your dash!
              </span>
              <span className="text-emerald-400 font-medium">
                Exit requires {clearedCount}/5 Checkpoints
              </span>
            </div>
          </div>

          {/* Toast Notification Alert */}
          {toastMessage && (
            <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border border-cyan-500/60 text-cyan-200 px-4 py-2 rounded-lg shadow-2xl text-xs sm:text-sm font-['Orbitron'] tracking-wider flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
              <Info className="w-4 h-4 text-cyan-400" />
              {toastMessage}
            </div>
          )}

          {/* Maze Canvas */}
          <div className="w-full relative">
            <MazeCanvas
              playerPos={playerPos}
              onMovePlayer={setPlayerPos}
              completedCheckpoints={completedCheckpoints}
              onTriggerCheckpoint={handleTriggerCheckpoint}
              onHitHazard={handleHitHazard}
              onReachExit={handleReachExit}
              onShowWarning={showToast}
              invulnerableUntil={invulnerableUntil}
            />

            {/* Checkpoint Letter Smasher Overlay */}
            {gameStatus === 'CHECKPOINT_MINIGAME' && activeCheckpointId !== null && (
              <LetterSmasherMinigame
                checkpointId={activeCheckpointId}
                lives={lives}
                onSuccess={handleCheckpointSuccess}
                onLoseLife={handleLoseLife}
              />
            )}
          </div>
        </div>

        {/* Right Side: Room-Scoped Real-Time Multi-User Leaderboard */}
        <Leaderboard
          entries={leaderboard}
          roomCode={roomCode}
          currentRunnerId={runnerId}
          currentRunnerName={playerName}
          liveEvents={liveEvents}
          onSwitchRoom={handleSwitchRoom}
        />
      </main>

      {/* Initial Name & Room Entry Modal */}
      {gameStatus === 'NAME_ENTRY' && (
        <NameModal
          onStart={handleStartGame}
          defaultName={playerName}
          defaultRoom={roomCode}
        />
      )}

      {/* Victory or Game Over Overlay */}
      {(gameStatus === 'VICTORY' || gameStatus === 'GAME_OVER') && (
        <EndGameModal
          type={gameStatus}
          playerName={playerName}
          timeSeconds={elapsedSeconds}
          livesRemaining={lives}
          checkpointsCleared={clearedCount}
          reason={defeatReason}
          rank={finalRank}
          isNewBest={isNewBest}
          onRestart={handleRestart}
        />
      )}
    </div>
  );
}
