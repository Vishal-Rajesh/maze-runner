import React, { useState, useEffect } from 'react';
import { User, Play, ShieldAlert, Target, Flame, Compass, KeyRound, Plus, Users } from 'lucide-react';

interface NameModalProps {
  onStart: (name: string, roomCode: string) => void;
  defaultName?: string;
  defaultRoom?: string;
}

export const NameModal: React.FC<NameModalProps> = ({
  onStart,
  defaultName = '',
  defaultRoom = '',
}) => {
  const [name, setName] = useState(defaultName || 'RUNNER_' + Math.floor(100 + Math.random() * 900));
  const [roomMode, setRoomMode] = useState<'JOIN' | 'CREATE'>('JOIN');
  const [roomCode, setRoomCode] = useState(defaultRoom || 'LAB-101');
  const [error, setError] = useState('');

  // Auto-detect ?room= query param from URL (for easy 1-click sharing in college lab)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlRoom = params.get('room');
      if (urlRoom) {
        setRoomCode(urlRoom.toUpperCase().trim());
        setRoomMode('JOIN');
      }
    } catch {
      // ignore
    }
  }, []);

  const handleGenerateNewRoom = () => {
    const num = Math.floor(100 + Math.random() * 900);
    const newCode = `LAB-${num}`;
    setRoomCode(newCode);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter a callsign to proceed');
      return;
    }
    if (trimmedName.length > 14) {
      setError('Callsign must be 14 characters or fewer');
      return;
    }

    const cleanRoom = roomCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!cleanRoom) {
      setError('Please enter or generate a Room Code for your lab');
      return;
    }

    onStart(trimmedName, cleanRoom);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/92 backdrop-blur-md p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-slate-900 border border-cyan-500/40 rounded-2xl p-6 sm:p-7 shadow-[0_0_60px_rgba(0,240,255,0.15)] relative overflow-hidden my-auto">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />

        {/* Title */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono mb-2.5">
            <Compass className="w-3.5 h-3.5" /> COLLEGE LAB SESSION PROTOCOL
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-wider font-['Orbitron']">
            SIGNAL RUNNER
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Private room multiplayer for your lab class. Compete on the live leaderboard.
          </p>
        </div>

        {/* Tactical Rules Card */}
        <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3.5 mb-5 space-y-2 text-xs text-slate-300">
          <div className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded bg-cyan-500/20 text-cyan-400 flex items-center justify-center flex-shrink-0 mt-0.5 font-bold text-[11px]">
              1
            </div>
            <div>
              <strong className="text-slate-100">Maze Dash:</strong> Steer your blue cyber core with{' '}
              <span className="text-cyan-300 font-mono font-bold">Arrow Keys</span> or{' '}
              <span className="text-cyan-300 font-mono font-bold">WASD</span>.
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded bg-red-500/20 text-red-400 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Flame className="w-3.5 h-3.5" />
            </div>
            <div>
              <strong className="text-slate-100">Disappearing Hazards:</strong> Red lasers pulse on and off.
              Dash through only during the safe inactive gap!
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Target className="w-3.5 h-3.5" />
            </div>
            <div>
              <strong className="text-slate-100">5 Checkpoint Mini-Games:</strong> Fruit Ninja-style letter smasher.
              Letters float for 4+ seconds. Type or slice them!
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded bg-red-500/20 text-red-400 flex items-center justify-center flex-shrink-0 mt-0.5">
              <ShieldAlert className="w-3.5 h-3.5" />
            </div>
            <div>
              <strong className="text-slate-100">Avoid Bomb Letters:</strong> Red bomb letters cost 1 life if typed.
              You have 5 lives total.
            </div>
          </div>
        </div>

        {/* Form: Name & Room Selection */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Runner Name */}
          <div>
            <label
              htmlFor="callsign-input"
              className="block text-xs font-mono uppercase tracking-wider text-slate-300 mb-1"
            >
              1. Your Callsign / Student Name:
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <User className="w-4 h-4 text-cyan-400" />
              </div>
              <input
                id="callsign-input"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                maxLength={14}
                autoFocus
                placeholder="e.g. Vishal, Alex, Bot_01"
                className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-lg pl-10 pr-4 py-2.5 text-slate-100 font-mono tracking-wider text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 transition-all"
              />
            </div>
          </div>

          {/* Room Selection */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                2. Lab Room Code:
              </span>

              {/* Mode Toggle */}
              <div className="flex rounded-md bg-slate-900 p-0.5 border border-slate-700 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => setRoomMode('JOIN')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    roomMode === 'JOIN'
                      ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Join Room
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRoomMode('CREATE');
                    handleGenerateNewRoom();
                  }}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    roomMode === 'CREATE'
                      ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Create New
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <KeyRound className="w-4 h-4 text-cyan-400" />
                </div>
                <input
                  id="room-code-input"
                  type="text"
                  value={roomCode}
                  onChange={(e) => {
                    setRoomCode(e.target.value.toUpperCase());
                    setError('');
                  }}
                  maxLength={12}
                  placeholder="e.g. LAB-101 or CS-B2"
                  className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-lg pl-9 pr-3 py-2 text-cyan-300 font-mono font-bold tracking-widest text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 transition-all uppercase"
                />
              </div>

              {roomMode === 'CREATE' && (
                <button
                  type="button"
                  onClick={handleGenerateNewRoom}
                  title="Generate another code"
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Random
                </button>
              )}
            </div>

            <p className="text-[11px] text-slate-400 mt-1.5 font-mono">
              Share code <strong className="text-cyan-300 font-bold">{roomCode}</strong> with others in your lab so your leaderboards and checkpoint alerts sync together!
            </p>
          </div>

          {error && <p className="text-xs text-red-400 font-mono">{error}</p>}

          <button
            type="submit"
            id="start-grid-btn"
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black font-['Orbitron'] tracking-wider py-3 px-6 rounded-lg flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(0,240,255,0.4)] hover:shadow-[0_0_35px_rgba(0,240,255,0.6)] active:scale-[0.98] transition-all cursor-pointer text-sm sm:text-base"
          >
            <Play className="w-4 h-4 fill-slate-950" /> ENTER LAB ROOM [{roomCode}]
          </button>
        </form>
      </div>
    </div>
  );
};
