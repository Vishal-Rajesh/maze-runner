import React, { useState } from 'react';
import { LeaderboardEntry } from '../types';
import {
  Users,
  Copy,
  Check,
  DoorOpen,
  Share2,
  Heart,
  CheckCircle2,
  Trophy,
} from 'lucide-react';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  roomCode: string;
  currentRunnerId?: string;
  currentRunnerName?: string;
  liveEvents?: { id: string; text: string; time: string; color: string }[];
  onSwitchRoom?: () => void;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  entries,
  roomCode,
  currentRunnerId,
  currentRunnerName,
  onSwitchRoom,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyInvite = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('room', roomCode);
      navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const totalPlayers = entries.length;
  const activeCount = entries.filter(
    (e) => e.status !== 'ESCAPED' && e.status !== 'ELIMINATED'
  ).length;

  return (
    <aside className="w-full lg:w-72 flex-shrink-0 bg-slate-900/95 border border-slate-800 rounded-xl p-3.5 shadow-2xl flex flex-col gap-3">
      {/* Room & Actions Header */}
      <div className="flex items-center justify-between bg-slate-950/90 border border-cyan-500/20 rounded-lg px-3 py-2">
        <div>
          <div className="text-[10px] font-mono text-slate-400 uppercase">ROOM</div>
          <div className="text-sm font-black text-cyan-300 font-mono tracking-wider">
            {roomCode}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopyInvite}
            title="Share Room Link"
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-cyan-300 border border-slate-700 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Share2 className="w-3 h-3" />
                <span>Share</span>
              </>
            )}
          </button>

          {onSwitchRoom && (
            <button
              type="button"
              onClick={onSwitchRoom}
              title="Change Room"
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors"
            >
              <DoorOpen className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Players Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200 uppercase font-mono">
          <Users className="w-4 h-4 text-cyan-400" />
          <span>PLAYERS ({totalPlayers})</span>
        </div>
        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
          {activeCount} Active
        </span>
      </div>

      {/* Clean Player List */}
      <div className="flex flex-col gap-1.5 max-h-[460px] overflow-y-auto pr-1">
        {entries.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-500 font-mono">
            Waiting for players to join...
          </div>
        ) : (
          entries.map((player) => {
            const isMe =
              player.id === currentRunnerId ||
              (currentRunnerName && player.name === currentRunnerName);
            const cleared = player.checkpointsCleared || 0;
            const percentage = Math.round((cleared / 5) * 100);
            const lives = player.livesRemaining ?? 5;

            return (
              <div
                key={player.id}
                className={`p-2.5 rounded-lg border text-xs transition-all ${
                  isMe
                    ? 'bg-cyan-950/40 border-cyan-500/50 shadow-[0_0_12px_rgba(0,240,255,0.1)]'
                    : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* Top Row: Name + Status */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-bold text-slate-200 truncate font-mono text-xs">
                      {player.name}
                    </span>
                    {isMe && (
                      <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        YOU
                      </span>
                    )}
                  </div>

                  {player.status === 'ESCAPED' ? (
                    <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-1.5 py-0.5 rounded">
                      <Trophy className="w-2.5 h-2.5" /> ESCAPED
                    </span>
                  ) : player.status === 'ELIMINATED' ? (
                    <span className="text-[10px] font-mono font-bold text-red-400 bg-red-950/80 border border-red-500/40 px-1.5 py-0.5 rounded">
                      ELIMINATED
                    </span>
                  ) : (
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Heart
                          key={i}
                          className={`w-2.5 h-2.5 ${
                            i < lives
                              ? 'text-red-500 fill-red-500'
                              : 'text-slate-700 fill-slate-800'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Bottom Row: Checkpoints & Percentage */}
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <div className="flex items-center gap-1 text-slate-400">
                    <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                    <span>
                      Checkpoints: <strong className="text-cyan-300">{cleared}/5</strong>
                    </span>
                  </div>
                  <span
                    className={`font-bold ${
                      cleared === 5
                        ? 'text-emerald-400'
                        : cleared > 0
                        ? 'text-amber-300'
                        : 'text-slate-400'
                    }`}
                  >
                    {percentage}%
                  </span>
                </div>

                {/* Mini Progress Bar */}
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1.5">
                  <div
                    className={`h-full transition-all duration-300 ${
                      player.status === 'ESCAPED'
                        ? 'bg-emerald-400'
                        : player.status === 'ELIMINATED'
                        ? 'bg-red-500'
                        : 'bg-gradient-to-r from-cyan-500 to-sky-400'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
