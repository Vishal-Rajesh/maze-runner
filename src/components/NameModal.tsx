import React, { useState, useEffect } from 'react';
import { User, Play, KeyRound, Plus } from 'lucide-react';

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

  // Auto-detect ?room= query param from URL
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
      setError('Please enter a name');
      return;
    }
    if (trimmedName.length > 14) {
      setError('Name must be 14 characters or fewer');
      return;
    }

    const cleanRoom = roomCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!cleanRoom) {
      setError('Please enter or generate a Room Code');
      return;
    }

    onStart(trimmedName, cleanRoom);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
      <div className="w-full max-w-md bg-slate-900 border border-cyan-500/40 rounded-2xl p-6 shadow-2xl relative">
        <div className="text-center mb-5">
          <h1 className="text-2xl font-black text-slate-100 font-mono tracking-wider">
            SIGNAL RUNNER
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            College Lab Multiplayer Maze
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Runner Name */}
          <div>
            <label
              htmlFor="callsign-input"
              className="block text-xs font-mono uppercase text-slate-300 mb-1"
            >
              Player Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
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
                placeholder="Enter your name"
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono text-sm"
              />
            </div>
          </div>

          {/* Room Mode Tabs */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="room-code-input"
                className="block text-xs font-mono uppercase text-slate-300"
              >
                Room Code
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setRoomMode('JOIN')}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded ${
                    roomMode === 'JOIN'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
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
                  className={`px-2 py-0.5 text-[10px] font-mono rounded ${
                    roomMode === 'CREATE'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Create Room
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
                  maxLength={10}
                  placeholder="e.g. LAB-101"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono text-sm tracking-wider uppercase"
                />
              </div>

              {roomMode === 'CREATE' && (
                <button
                  type="button"
                  onClick={handleGenerateNewRoom}
                  title="Generate Random Code"
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-xs font-mono flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="text-red-400 text-xs font-mono bg-red-950/40 border border-red-800/50 p-2 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-slate-950 font-mono font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            ENTER LAB MAZE
          </button>
        </form>
      </div>
    </div>
  );
};
