import React from 'react';
import { Trophy, AlertOctagon, RotateCcw, Clock, Heart, CheckCircle2, Crown } from 'lucide-react';

interface EndGameModalProps {
  type: 'VICTORY' | 'GAME_OVER';
  playerName: string;
  timeSeconds: number;
  livesRemaining: number;
  checkpointsCleared: number;
  reason?: string;
  isNewBest?: boolean;
  rank?: number;
  onRestart: () => void;
}

export const EndGameModal: React.FC<EndGameModalProps> = ({
  type,
  playerName,
  timeSeconds,
  livesRemaining,
  checkpointsCleared,
  reason,
  isNewBest,
  rank,
  onRestart,
}) => {
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isVictory = type === 'VICTORY';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/92 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div
        className={`w-full max-w-md bg-slate-900 border ${
          isVictory ? 'border-emerald-500/50' : 'border-red-500/50'
        } rounded-2xl p-6 sm:p-8 text-center shadow-2xl relative overflow-hidden`}
      >
        {/* Glow Header Accent */}
        <div
          className={`absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1.5 bg-gradient-to-r from-transparent ${
            isVictory ? 'via-emerald-400' : 'via-red-500'
          } to-transparent`}
        />

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center ${
              isVictory
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_30px_rgba(16,185,129,0.4)]'
                : 'bg-red-500/20 text-red-400 border border-red-500/40 shadow-[0_0_30px_rgba(239,68,68,0.4)]'
            }`}
          >
            {isVictory ? (
              rank === 1 ? (
                <Crown className="w-8 h-8 text-amber-300 animate-bounce" />
              ) : (
                <Trophy className="w-8 h-8 text-emerald-300" />
              )
            ) : (
              <AlertOctagon className="w-8 h-8 text-red-400 animate-pulse" />
            )}
          </div>
        </div>

        {/* Title */}
        <h2
          className={`text-2xl font-black font-['Orbitron'] tracking-wider ${
            isVictory ? 'text-emerald-300' : 'text-red-400'
          }`}
        >
          {isVictory ? 'MAZE BREACH SUCCESSFUL!' : 'SIGNAL CRITICAL — DEFEAT'}
        </h2>

        {/* Subtitle / Reason */}
        <p className="text-xs sm:text-sm text-slate-300 mt-2">
          {isVictory
            ? `${playerName}, you cleared all 5 checkpoints and successfully extracted!`
            : reason || 'All 5 lives lost. The grid re-established containment.'}
        </p>

        {/* Rank Notice */}
        {isVictory && rank && (
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold">
            <Trophy className="w-3.5 h-3.5" /> LEADERBOARD RANK: #{rank}
            {isNewBest && ' (NEW TOP SCORE!)'}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 my-5 text-center">
          <div className="border-r border-slate-800">
            <div className="text-[10px] font-mono text-slate-400 uppercase flex items-center justify-center gap-1">
              <Clock className="w-3 h-3" /> Time
            </div>
            <div className="text-base font-bold font-mono text-cyan-300 mt-1">
              {formatTime(timeSeconds)}
            </div>
          </div>

          <div className="border-r border-slate-800">
            <div className="text-[10px] font-mono text-slate-400 uppercase flex items-center justify-center gap-1">
              <Heart className="w-3 h-3 text-red-400" /> Lives Left
            </div>
            <div className="text-base font-bold font-mono text-red-400 mt-1">
              {livesRemaining} / 5
            </div>
          </div>

          <div>
            <div className="text-[10px] font-mono text-slate-400 uppercase flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Checkpoints
            </div>
            <div className="text-base font-bold font-mono text-emerald-400 mt-1">
              {checkpointsCleared} / 5
            </div>
          </div>
        </div>

        {/* Restart Action */}
        <button
          type="button"
          onClick={onRestart}
          className={`w-full py-3 px-6 rounded-lg font-['Orbitron'] font-black text-sm tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] ${
            isVictory
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
              : 'bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-slate-100 shadow-[0_0_20px_rgba(239,68,68,0.4)]'
          }`}
        >
          <RotateCcw className="w-4 h-4" /> {isVictory ? 'PLAY AGAIN' : 'RETRY MISSION'}
        </button>
      </div>
    </div>
  );
};
