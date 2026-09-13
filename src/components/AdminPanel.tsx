import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Trophy,
  Skull,
  Shield,
  RefreshCw,
  Trash2,
  UserX,
  ArrowLeft,
  Search,
  Activity,
  Heart,
  CheckCircle2,
  Clock,
  Layers,
} from 'lucide-react';
import { PlayerSession } from '../types';

interface RoomOverview {
  code: string;
  createdAt: number;
  playerCount: number;
  players: (PlayerSession & { isOnline?: boolean })[];
}

interface AdminOverviewData {
  stats: {
    totalRooms: number;
    totalPlayers: number;
    escapedCount: number;
    eliminatedCount: number;
    activeCount: number;
  };
  rooms: RoomOverview[];
}

interface AdminPanelProps {
  onBackToGame: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onBackToGame }) => {
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/overview');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
    const interval = setInterval(fetchOverview, 2500);
    return () => clearInterval(interval);
  }, [fetchOverview]);

  const showActionToast = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3000);
  };

  const handleResetRoom = async (roomCode: string) => {
    if (!window.confirm(`Are you sure you want to reset and clear Room ${roomCode}?`)) {
      return;
    }
    try {
      const res = await fetch('/api/admin/room/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode }),
      });
      if (res.ok) {
        showActionToast(`Room ${roomCode} reset successfully`);
        fetchOverview();
      }
    } catch {
      showActionToast(`Failed to reset room ${roomCode}`);
    }
  };

  const handleKickPlayer = async (roomCode: string, playerId: string, playerName: string) => {
    if (!window.confirm(`Kick player "${playerName}" from Room ${roomCode}?`)) {
      return;
    }
    try {
      const res = await fetch('/api/admin/player/kick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode, playerId }),
      });
      if (res.ok) {
        showActionToast(`Player ${playerName} removed`);
        fetchOverview();
      }
    } catch {
      showActionToast(`Failed to kick player ${playerName}`);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredRooms = (data?.rooms || []).filter((r) => {
    if (selectedRoom !== 'ALL' && r.code !== selectedRoom) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    if (r.code.toLowerCase().includes(q)) return true;
    return r.players.some((p) => p.name.toLowerCase().includes(q));
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Admin Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/90 px-4 py-3 sticky top-0 z-40 backdrop-blur">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToGame}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-cyan-300 border border-slate-700 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Game</span>
            </button>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-cyan-400" />
              <h1 className="text-base sm:text-lg font-black font-mono tracking-wider text-slate-100">
                ADMIN PANEL <span className="text-xs text-cyan-400 font-normal">(/admin)</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {actionMessage && (
              <span className="hidden sm:inline text-xs font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-2 py-1 rounded animate-fade-in">
                {actionMessage}
              </span>
            )}
            <button
              type="button"
              onClick={fetchOverview}
              title="Refresh Live Data"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200 border border-slate-700 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
              <span>Live Refresh</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Admin Dashboard */}
      <main className="max-w-7xl w-full mx-auto p-4 sm:p-6 flex-1 flex flex-col gap-6">
        {/* KPI Aggregate Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
              <span>ACTIVE ROOMS</span>
              <Layers className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-black font-mono text-cyan-300 mt-1">
              {data?.stats.totalRooms ?? 0}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
              <span>TOTAL PLAYERS</span>
              <Users className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-2xl font-black font-mono text-sky-300 mt-1">
              {data?.stats.totalPlayers ?? 0}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
              <span>NAVIGATING</span>
              <Activity className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black font-mono text-amber-300 mt-1">
              {data?.stats.activeCount ?? 0}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
              <span>ESCAPED</span>
              <Trophy className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
              {data?.stats.escapedCount ?? 0}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
              <span>ELIMINATED</span>
              <Skull className="w-4 h-4 text-red-400" />
            </div>
            <div className="text-2xl font-black font-mono text-red-400 mt-1">
              {data?.stats.eliminatedCount ?? 0}
            </div>
          </div>
        </div>

        {/* Filter / Search Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-mono text-slate-400 uppercase">Room:</span>
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono rounded px-2.5 py-1.5 focus:outline-none focus:border-cyan-400"
            >
              <option value="ALL">All Rooms ({data?.rooms.length ?? 0})</option>
              {data?.rooms.map((r) => (
                <option key={r.code} value={r.code}>
                  Room {r.code} ({r.playerCount} players)
                </option>
              ))}
            </select>
          </div>

          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-500">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              placeholder="Search player or room..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        {/* Rooms & Player Inspection Tables */}
        {filteredRooms.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500 font-mono text-sm">
            No rooms or players currently registered.
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {filteredRooms.map((room) => (
              <div
                key={room.code}
                className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg"
              >
                {/* Room Card Header */}
                <div className="bg-slate-950/80 border-b border-slate-800 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-black font-mono text-cyan-300">
                      ROOM {room.code}
                    </div>
                    <span className="text-xs font-mono text-slate-400">
                      ({room.players.length} players)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleResetRoom(room.code)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800/60 text-xs font-mono transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Reset Room
                  </button>
                </div>

                {/* Player List Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-950/40 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-4">Player</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Checkpoints</th>
                        <th className="py-2.5 px-3">Lives</th>
                        <th className="py-2.5 px-3">Time</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {room.players.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-slate-500">
                            No players in this room yet.
                          </td>
                        </tr>
                      ) : (
                        room.players.map((p) => {
                          const cleared = p.checkpointsCleared || 0;
                          const pct = Math.round((cleared / 5) * 100);
                          const lives = p.livesRemaining ?? 5;

                          return (
                            <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                              {/* Player Name */}
                              <td className="py-3 px-4">
                                <div className="font-bold text-slate-200">{p.name}</div>
                                <div className="text-[10px] text-slate-500">ID: {p.id.slice(0, 8)}</div>
                              </td>

                              {/* Status */}
                              <td className="py-3 px-3">
                                {p.status === 'ESCAPED' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded">
                                    <Trophy className="w-3 h-3" /> ESCAPED
                                  </span>
                                ) : p.status === 'ELIMINATED' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-950/80 border border-red-500/30 px-2 py-0.5 rounded">
                                    <Skull className="w-3 h-3" /> ELIMINATED
                                  </span>
                                ) : p.status === 'IN_CHECKPOINT' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-950/80 border border-amber-500/30 px-2 py-0.5 rounded animate-pulse">
                                    IN CHECKPOINT
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-300 bg-sky-950/80 border border-sky-500/30 px-2 py-0.5 rounded">
                                    NAVIGATING
                                  </span>
                                )}
                              </td>

                              {/* Checkpoints & Progress */}
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-200">
                                    {cleared}/5 ({pct}%)
                                  </span>
                                </div>
                                <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                                  <div
                                    className={`h-full ${
                                      p.status === 'ESCAPED'
                                        ? 'bg-emerald-400'
                                        : p.status === 'ELIMINATED'
                                        ? 'bg-red-500'
                                        : 'bg-cyan-400'
                                    }`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </td>

                              {/* Lives Remaining */}
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-1">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <Heart
                                      key={i}
                                      className={`w-3 h-3 ${
                                        i < lives
                                          ? 'text-red-500 fill-red-500'
                                          : 'text-slate-700 fill-slate-800'
                                      }`}
                                    />
                                  ))}
                                  <span className="ml-1 text-slate-400 text-[10px]">
                                    ({lives}/5)
                                  </span>
                                </div>
                              </td>

                              {/* Elapsed Time */}
                              <td className="py-3 px-3 text-slate-300">
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-cyan-400" />
                                  <span>{formatTime(p.totalTimeSeconds || 0)}</span>
                                </div>
                              </td>

                              {/* Kick Action */}
                              <td className="py-3 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleKickPlayer(room.code, p.id, p.name)}
                                  title="Kick player from room"
                                  className="p-1.5 rounded bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 border border-slate-700 transition-colors"
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
