import React, { useState, useEffect } from 'react';
import { User, Play, KeyRound, RefreshCw, Copy, Check, Users, Sparkles } from 'lucide-react';

interface NameModalProps {
  onStart: (name: string, roomCode: string) => void;
  defaultName?: string;
  defaultRoom?: string;
}

const TEAM_PREFIXES = [
  'CYBER', 'ALPHA', 'DELTA', 'OMEGA', 'NEXUS', 'TITAN', 'KRYPTON', 'MATRIX',
  'VIPER', 'WARP', 'PULSE', 'QUANTUM', 'STORM', 'HYPER', 'LASER', 'ZERO'
];

function generateCode(): string {
  const prefix = TEAM_PREFIXES[Math.floor(Math.random() * TEAM_PREFIXES.length)];
  const num = Math.floor(10 + Math.random() * 90);
  return `${prefix}-${num}`;
}

export const NameModal: React.FC<NameModalProps> = ({
  onStart,
  defaultName = '',
  defaultRoom = '',
}) => {
  // Mandatory: no default name
  const [name, setName] = useState(defaultName || '');
  const [roomMode, setRoomMode] = useState<'JOIN' | 'CREATE'>('CREATE');
  const [roomCode, setRoomCode] = useState(() => defaultRoom || generateCode());
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [invitedFromUrl, setInvitedFromUrl] = useState(false);

  // Auto-detect ?room= query param from URL (for teammates joining via invite link)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlRoom = params.get('room');
      if (urlRoom) {
        const clean = urlRoom.toUpperCase().trim().replace(/[^A-Z0-9_-]/g, '');
        if (clean) {
          setRoomCode(clean);
          setRoomMode('JOIN');
          setInvitedFromUrl(true);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const handleRollNewCode = () => {
    setRoomCode(generateCode());
    setCopied(false);
  };

  const handleCopyInvite = async () => {
    const cleanRoom = roomCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!cleanRoom) return;

    try {
      const shareUrl = `${window.location.origin}${window.location.pathname}?room=${cleanRoom}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is mandatory. Please type your runner callsign.');
      return;
    }
    if (trimmedName.length > 14) {
      setError('Name must be 14 characters or fewer.');
      return;
    }

    const cleanRoom = roomCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!cleanRoom) {
      setError('Please enter or create a valid Team Code.');
      return;
    }

    onStart(trimmedName, cleanRoom);
  };

  const cleanRoomCode = roomCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/92 backdrop-blur-md p-4">
      <div className="w-full max-w-lg bg-slate-900/95 border border-cyan-500/40 rounded-2xl p-6 md:p-8 shadow-2xl shadow-cyan-950/50 relative">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-950/70 border border-cyan-500/30 text-cyan-300 text-[11px] font-mono mb-2">
            <Users className="w-3.5 h-3.5" />
            <span>30–100 Player Real-Time Multiplayer</span>
          </div>
          <h1 className="text-3xl font-black text-slate-100 font-mono tracking-wider">
            SIGNAL RUNNER
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Synchronized College Lab Maze Challenge
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Mandatory Runner Name */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="callsign-input"
                className="block text-xs font-mono uppercase text-slate-200 font-semibold"
              >
                Player Name <span className="text-rose-400 font-bold">* (Mandatory)</span>
              </label>
              <span className="text-[10px] font-mono text-slate-400">
                {name.trim().length}/14 chars
              </span>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <User className="w-4 h-4 text-cyan-400" />
              </div>
              <input
                id="callsign-input"
                type="text"
                autoFocus
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError('');
                }}
                maxLength={14}
                placeholder="Type your name (e.g. Alex, Maya, CyberNinja)"
                className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 font-mono text-sm shadow-inner"
              />
            </div>
            {!name.trim() && (
              <p className="text-[11px] text-amber-400/90 font-mono mt-1 flex items-center gap-1">
                <span>⚠️</span> You must type a name to join or create a game.
              </p>
            )}
          </div>

          {/* Room Mode Selection */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono uppercase text-slate-300 font-semibold">
                Team Room Setup
              </span>
              <div className="flex gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setRoomMode('CREATE');
                    if (!roomCode) handleRollNewCode();
                  }}
                  className={`px-3 py-1 text-xs font-mono rounded-md transition-colors ${
                    roomMode === 'CREATE'
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Create Room
                </button>
                <button
                  type="button"
                  onClick={() => setRoomMode('JOIN')}
                  className={`px-3 py-1 text-xs font-mono rounded-md transition-colors ${
                    roomMode === 'JOIN'
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Join via Code
                </button>
              </div>
            </div>

            {invitedFromUrl && (
              <div className="mb-3 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Invited to join Team Room: <strong>{cleanRoomCode}</strong></span>
              </div>
            )}

            {roomMode === 'CREATE' ? (
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="room-code-input"
                    className="block text-[11px] font-mono text-slate-400 mb-1"
                  >
                    Your Generated Team Code (Share with your group):
                  </label>
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
                          if (error) setError('');
                        }}
                        maxLength={12}
                        className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-cyan-500/50 rounded-lg text-cyan-300 font-mono font-bold text-base tracking-widest uppercase focus:outline-none focus:border-cyan-300"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleRollNewCode}
                      title="Generate Different Code"
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-xs font-mono flex items-center gap-1 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Randomize
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] font-mono text-slate-400">
                    Supports 30–100 players in this room simultaneously
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyInvite}
                    className="px-2.5 py-1 bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/40 rounded-md text-[11px] font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300 font-semibold">Copied Link!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Invite Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <label
                  htmlFor="join-code-input"
                  className="block text-[11px] font-mono text-slate-400 mb-1"
                >
                  Enter the Team Code given by your room creator:
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <KeyRound className="w-4 h-4 text-cyan-400" />
                  </div>
                  <input
                    id="join-code-input"
                    type="text"
                    value={roomCode}
                    onChange={(e) => {
                      setRoomCode(e.target.value.toUpperCase());
                      if (error) setError('');
                    }}
                    maxLength={12}
                    placeholder="e.g. CYBER-42"
                    className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 font-mono text-sm tracking-wider uppercase"
                  />
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="text-red-400 text-xs font-mono bg-red-950/50 border border-red-800/60 p-2.5 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!name.trim() || !cleanRoomCode}
            className={`w-full py-3 px-4 font-mono font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg ${
              name.trim() && cleanRoomCode
                ? 'bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-slate-950 cursor-pointer shadow-cyan-500/20'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            }`}
          >
            <Play className="w-4 h-4 fill-current" />
            {roomMode === 'CREATE' ? 'CREATE ROOM & ENTER MAZE' : 'JOIN TEAM MAZE'}
          </button>
        </form>
      </div>
    </div>
  );
};
