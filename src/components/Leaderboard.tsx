import React, { useState } from 'react';
import { LeaderboardEntry } from '../types';
import {
  Trophy,
  Crown,
  Medal,
  Clock,
  Heart,
  Activity,
  CheckCircle2,
  Copy,
  Check,
  DoorOpen,
  Share2,
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
  liveEvents = [],
  onSwitchRoom,
}) => {
  const [copied, setCopied] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopyInvite = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('room', roomCode);
      navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback copy raw code
      navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const topRunner = entries.length > 0 ? entries[0] : null;
  const activeRunnersCount = entries.filter(
    (e) => e.status !== 'ESCAPED' && e.status !== 'ELIMINATED'
  ).length;

  return (
    <aside className="w-full lg:w-80 flex-shrink-0 bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-2xl flex flex-col gap-3">
      {/* Room Badge Header */}
      <div className="bg-slate-950/80 border border-cyan-500/30 rounded-lg p-2.5 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-mono uppercase text-slate-400">LAB ROOM</div>
          <div className="text-sm font-black text-cyan-300 font-['Orbitron'] tracking-wider">
            {roomCode}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopyInvite}
            title="Copy invite link to share with lab classmates"
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-mono text-cyan-300 transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
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
              title="Change lab room"
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <DoorOpen className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Leaderboard Title */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          <h2 className="text-xs font-black text-slate-100 tracking-wider font-['Orbitron']">
            ROOM LEADERBOARD
          </h2>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold">{activeRunnersCount} ONLINE</span>
        </div>
      </div>

      {/* Spotlight: Current #1 in Room */}
      {topRunner ? (
        <div className="bg-gradient-to-br from-amber-500/20 via-amber-600/10 to-transparent border border-amber-500/40 rounded-lg p-3 relative overflow-hidden">
          <div className="absolute -right-2 -bottom-2 opacity-15 pointer-events-none">
            <Crown className="w-20 h-20 text-amber-400" />
          </div>
          <div className="flex items-center justify-between text-xs font-mono text-amber-400 font-bold mb-1">
            <span className="flex items-center gap-1">
              <Crown className="w-3.5 h-3.5 text-amber-300 animate-bounce" /> ROOM #1 LEADER
            </span>
            <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 text-[10px]">
              {topRunner.status === 'ESCAPED'
                ? 'ESCAPED MAZE'
                : `CP ${topRunner.checkpointsCleared || 0}/5`}
            </span>
          </div>
          <div className="text-base font-black text-amber-200 tracking-wide font-['Orbitron'] truncate">
            {topRunner.name}
            {(topRunner.id === currentRunnerId ||
              (currentRunnerName && topRunner.name === currentRunnerName)) && (
              <span className="ml-1.5 text-[9px] font-mono px-1 py-0.5 rounded bg-cyan-500/30 text-cyan-300">
                YOU
              </span>
            )}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-300 mt-2 font-mono">
            <span className="flex items-center gap-1 text-cyan-300">
              <Clock className="w-3 h-3" /> {formatTime(topRunner.timeSeconds)}
            </span>
            <span className="flex items-center gap-1 text-red-400">
              <Heart className="w-3 h-3 fill-red-400 text-red-400" /> {topRunner.livesRemaining}/5
            </span>
            <span className="text-[10px] text-slate-400">
              {topRunner.checkpointsCleared || 0}/5 CPs
            </span>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-lg border border-dashed border-slate-800 text-center text-xs text-slate-400 font-mono">
          Waiting for lab runners to join {roomCode}...
        </div>
      )}

      {/* Real-time Simultaneous Room Runners List */}
      <div className="flex-1 overflow-y-auto max-h-[360px] space-y-1.5 pr-1">
        {entries.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs font-mono">
            No runners in this room yet. Share code <span className="text-cyan-300 font-bold">{roomCode}</span>!
          </div>
        ) : (
          entries.map((entry, index) => {
            const isFirst = index === 0;
            const isSecond = index === 1;
            const isThird = index === 2;
            const isCurrentPlayer =
              entry.isCurrentRun ||
              entry.id === currentRunnerId ||
              (currentRunnerName && entry.name === currentRunnerName);
            const isEscaped = entry.status === 'ESCAPED';
            const isEliminated = entry.status === 'ELIMINATED';
            const cleared = entry.checkpointsCleared || 0;

            return (
              <div
                key={entry.id || `${entry.name}-${index}`}
                className={`p-2 rounded-lg border text-xs transition-all ${
                  isCurrentPlayer
                    ? 'bg-cyan-950/70 border-cyan-500/70 text-cyan-200 shadow-[0_0_15px_rgba(0,240,255,0.18)]'
                    : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                {/* Row 1: Rank, Name, Status Badge */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span
                      className={`w-5 h-5 flex items-center justify-center rounded font-mono font-bold text-[10px] ${
                        isFirst
                          ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                          : isSecond
                          ? 'bg-slate-300/20 text-slate-200 border border-slate-400/40'
                          : isThird
                          ? 'bg-amber-700/30 text-amber-400 border border-amber-700/50'
                          : 'text-slate-400 bg-slate-900 border border-slate-800'
                      }`}
                    >
                      {isFirst ? (
                        <Crown className="w-3 h-3 text-amber-300" />
                      ) : isSecond || isThird ? (
                        <Medal className="w-3 h-3" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span className="font-semibold truncate font-['Orbitron'] tracking-wider text-[11px]">
                      {entry.name}
                    </span>
                    {isCurrentPlayer && (
                      <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-cyan-500/30 text-cyan-300 border border-cyan-500/40">
                        YOU
                      </span>
                    )}
                  </div>

                  {/* Status badge */}
                  <div>
                    {isEscaped ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" /> ESCAPED
                      </span>
                    ) : isEliminated ? (
                      <span className="inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-950/60 text-red-400 border border-red-800/40">
                        ELIMINATED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-950/60 text-sky-300 border border-sky-800/40">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        LIVE
                      </span>
                    )}
                  </div>
                </div>

                {/* Row 2: Checkpoint progress indicator & stats */}
                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-800/60 font-mono text-[10px]">
                  {/* Checkpoint Dots [1] [2] [3] [4] [5] */}
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400 text-[9px] mr-0.5">CPs:</span>
                    {Array.from({ length: 5 }).map((_, cpIdx) => (
                      <span
                        key={cpIdx}
                        title={`Checkpoint ${cpIdx + 1}: ${cpIdx < cleared ? 'Cleared' : 'Pending'}`}
                        className={`w-3.5 h-3.5 rounded flex items-center justify-center font-bold text-[8px] ${
                          cpIdx < cleared
                            ? 'bg-cyan-500 text-slate-950 font-black'
                            : 'bg-slate-900 border border-slate-800 text-slate-400'
                        }`}
                      >
                        {cpIdx + 1}
                      </span>
                    ))}
                  </div>

                  {/* Time & Lives */}
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-400 font-bold flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {formatTime(entry.timeSeconds)}
                    </span>
                    <span className="text-red-400 flex items-center gap-0.5">
                      <Heart className="w-2.5 h-2.5 fill-red-400 text-red-400" />
                      {entry.livesRemaining}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Live Room Broadcast Activity Feed */}
      <div className="border-t border-slate-800/80 pt-2 flex flex-col gap-1.5">
        <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400 uppercase">
          <Activity className="w-3 h-3 text-cyan-400" /> Room Activity Feed
        </div>
        <div className="space-y-1 max-h-16 overflow-y-auto">
          {liveEvents.length > 0 ? (
            liveEvents.slice(0, 3).map((ev) => (
              <div
                key={ev.id}
                className="text-[10px] font-mono text-slate-400 flex items-center justify-between gap-1 leading-tight"
              >
                <span className={`truncate ${ev.color}`}>{ev.text}</span>
                <span className="text-slate-400 text-[9px] flex-shrink-0">{ev.time}</span>
              </div>
            ))
          ) : (
            <div className="text-[10px] text-slate-400 font-mono italic">
              Room {roomCode} connected in real-time.
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
