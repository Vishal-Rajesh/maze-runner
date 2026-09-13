import express from 'express';
import path from 'path';
import fs from 'fs';
import type { WebSocket } from 'ws';
import { WebSocketServer } from 'ws';

interface PlayerSession {
  id: string;
  name: string;
  roomCode: string;
  status: 'NAVIGATING' | 'IN_CHECKPOINT' | 'ESCAPED' | 'ELIMINATED';
  checkpointsCleared: number; // 0 to 5
  lastCheckpointTime: number; // seconds
  totalTimeSeconds: number;
  livesRemaining: number;
  lastActive: number; // timestamp
  finishedAt?: number;
}

export interface RunnerPosition {
  id: string;
  name: string;
  c: number;
  r: number;
  updatedAt: number;
}

interface RoomData {
  code: string;
  createdAt: number;
  players: Map<string, PlayerSession>;
}

export const app = express();

app.use(express.json());

// Persistent storage path (safe for Vercel /tmp or local server)
const DATA_DIR = process.env.VERCEL
  ? path.join('/tmp', 'maze_runner_data')
  : path.join(process.cwd(), 'data');
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json');

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch {
  // safe fallback
}

// Global in-memory room registry
const rooms: Map<string, RoomData> = new Map();

// Map of roomCode -> Set of express Response streams (for SSE)
const roomSseClients: Map<string, Set<express.Response>> = new Map();

// Map of roomCode -> Set of WebSocket clients
export const roomWsClients: Map<string, Set<WebSocket>> = new Map();

// Map of roomCode -> Map of playerId -> RunnerPosition
export const roomPositions: Map<string, Map<string, RunnerPosition>> = new Map();

export function sanitizeRoomCode(code: string): string {
  return (
    String(code || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '')
      .slice(0, 14) || 'ROOM-1'
  );
}

// Prefix list for generating cool team room codes
const TEAM_PREFIXES = [
  'ALPHA', 'BETA', 'CYBER', 'DELTA', 'ECHO', 'FROST', 'GHOST', 'HYPER',
  'ION', 'JADE', 'KRYPTON', 'LASER', 'MATRIX', 'NEXUS', 'OMEGA', 'PULSE',
  'QUANTUM', 'RADAR', 'STORM', 'TITAN', 'ULTRA', 'VIPER', 'WARP', 'XENON', 'ZERO'
];

export function generateRandomRoomCode(): string {
  const prefix = TEAM_PREFIXES[Math.floor(Math.random() * TEAM_PREFIXES.length)];
  const num = Math.floor(10 + Math.random() * 90);
  return `${prefix}-${num}`;
}

export function updateRunnerPosition(
  roomCode: string,
  id: string,
  name: string,
  c: number,
  r: number
) {
  const code = sanitizeRoomCode(roomCode);
  let pMap = roomPositions.get(code);
  if (!pMap) {
    pMap = new Map();
    roomPositions.set(code, pMap);
  }
  pMap.set(id, {
    id,
    name: (name || 'Runner').slice(0, 14),
    c: Number(c),
    r: Number(r),
    updatedAt: Date.now(),
  });
}

export function getActiveRoomPositions(roomCode: string) {
  const code = sanitizeRoomCode(roomCode);
  const pMap = roomPositions.get(code);
  if (!pMap) return [];
  const now = Date.now();
  const list: { id: string; name: string; c: number; r: number }[] = [];
  for (const [id, pos] of pMap.entries()) {
    // Prune runners inactive for > 15s
    if (now - pos.updatedAt > 15000) {
      pMap.delete(id);
    } else {
      list.push({ id: pos.id, name: pos.name, c: pos.c, r: pos.r });
    }
  }
  return list;
}

// Load persisted room data if available
try {
  if (fs.existsSync(ROOMS_FILE)) {
    const raw = fs.readFileSync(ROOMS_FILE, 'utf-8');
    const parsed: { code: string; createdAt: number; players: PlayerSession[] }[] = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      parsed.forEach((r) => {
        const pMap = new Map<string, PlayerSession>();
        if (Array.isArray(r.players)) {
          r.players.forEach((p) => pMap.set(p.id, p));
        }
        rooms.set(r.code, {
          code: r.code,
          createdAt: r.createdAt || Date.now(),
          players: pMap,
        });
      });
    }
  }
} catch (err) {
  // ignore
}

function persistData() {
  try {
    const serialized = Array.from(rooms.values()).map((r) => ({
      code: r.code,
      createdAt: r.createdAt,
      players: Array.from(r.players.values()),
    }));
    fs.writeFileSync(ROOMS_FILE, JSON.stringify(serialized, null, 2));
  } catch {
    // ignore
  }
}

export function getOrCreateRoom(rawCode: string): RoomData {
  const code = sanitizeRoomCode(rawCode);
  let room = rooms.get(code);
  if (!room) {
    room = {
      code,
      createdAt: Date.now(),
      players: new Map(),
    };
    rooms.set(code, room);
    persistData();
  }
  return room;
}

export function getSortedRoomLeaderboard(roomCode: string) {
  const room = rooms.get(roomCode);
  if (!room) return [];

  const list = Array.from(room.players.values());

  return list.sort((a, b) => {
    // 1. Escaped players come first (ranked by fastest time, then lives)
    if (a.status === 'ESCAPED' && b.status !== 'ESCAPED') return -1;
    if (b.status === 'ESCAPED' && a.status !== 'ESCAPED') return 1;
    if (a.status === 'ESCAPED' && b.status === 'ESCAPED') {
      if (a.totalTimeSeconds !== b.totalTimeSeconds) {
        return a.totalTimeSeconds - b.totalTimeSeconds;
      }
      return b.livesRemaining - a.livesRemaining;
    }

    // 2. Active runners ranked by checkpoints cleared descending
    if (a.checkpointsCleared !== b.checkpointsCleared) {
      return b.checkpointsCleared - a.checkpointsCleared;
    }

    // 3. For same checkpoints, faster time
    if (a.totalTimeSeconds !== b.totalTimeSeconds) {
      return a.totalTimeSeconds - b.totalTimeSeconds;
    }

    // 4. Lives remaining
    return b.livesRemaining - a.livesRemaining;
  });
}

export function broadcastToRoom(roomCode: string, type: string, data: unknown) {
  const code = sanitizeRoomCode(roomCode);

  // 1. SSE Broadcast
  const sseClients = roomSseClients.get(code);
  if (sseClients && sseClients.size > 0) {
    const payload = `data: ${JSON.stringify({ type, roomCode: code, data, timestamp: Date.now() })}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(payload);
      } catch {
        sseClients.delete(client);
      }
    }
  }

  // 2. WebSocket Broadcast
  const wsClients = roomWsClients.get(code);
  if (wsClients && wsClients.size > 0) {
    const wsPayload = JSON.stringify({ type, roomCode: code, data, timestamp: Date.now() });
    for (const ws of wsClients) {
      try {
        if (ws.readyState === 1 /* OPEN */) {
          ws.send(wsPayload);
        }
      } catch {
        wsClients.delete(ws);
      }
    }
  }
}

// WebSocket Setup for low-latency zero-lag movement sync
export function setupWebSocket(httpServer: any) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req: any) => {
    try {
      const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const rawCode = url.searchParams.get('roomCode') || '';
      const roomCode = sanitizeRoomCode(rawCode);
      const runnerId = url.searchParams.get('id') || '';
      const runnerName = url.searchParams.get('name') || 'Runner';

      if (!roomWsClients.has(roomCode)) {
        roomWsClients.set(roomCode, new Set());
      }
      roomWsClients.get(roomCode)!.add(ws);

      // Send initial positions immediately
      const initialPositions = getActiveRoomPositions(roomCode);
      ws.send(JSON.stringify({ type: 'positions_update', roomCode, data: initialPositions }));

      ws.on('message', (rawMsg: any) => {
        try {
          const parsed = JSON.parse(rawMsg.toString());
          if (parsed.type === 'move' && typeof parsed.c === 'number' && typeof parsed.r === 'number') {
            updateRunnerPosition(
              roomCode,
              parsed.id || runnerId,
              parsed.name || runnerName,
              parsed.c,
              parsed.r
            );
          }
        } catch {
          // ignore malformed msg
        }
      });

      ws.on('close', () => {
        const clientSet = roomWsClients.get(roomCode);
        if (clientSet) {
          clientSet.delete(ws);
          if (clientSet.size === 0) {
            roomWsClients.delete(roomCode);
          }
        }
      });

      ws.on('error', () => {
        // safe error catch
      });
    } catch {
      // safe fallback
    }
  });

  return wss;
}

// Zero-Lag 20Hz Batching Tick (50ms interval):
// Batches 30-100 player positions into compact updates per room
setInterval(() => {
  if (roomPositions.size === 0) return;
  for (const [code, pMap] of roomPositions.entries()) {
    const hasSse = roomSseClients.has(code) && roomSseClients.get(code)!.size > 0;
    const hasWs = roomWsClients.has(code) && roomWsClients.get(code)!.size > 0;
    if (!hasSse && !hasWs) continue;

    const positions = getActiveRoomPositions(code);
    if (positions.length > 0) {
      broadcastToRoom(code, 'positions_update', positions);
    }
  }
}, 50);

// Helper router to handle routes with or without "/api" prefix
const apiRouter = express.Router();

// Health check
apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    totalRooms: rooms.size,
    platform: process.env.VERCEL ? 'vercel-serverless' : 'node-server',
  });
});

// Create Room with custom or auto-generated code
apiRouter.post('/room/create', (req, res) => {
  const { customCode } = req.body;
  let code = customCode ? sanitizeRoomCode(customCode) : '';

  if (!code) {
    code = generateRandomRoomCode();
  }

  const room = getOrCreateRoom(code);
  res.json({ success: true, roomCode: room.code });
});

// Real-time player movement endpoint (fallback for environments where WS is blocked)
apiRouter.post('/player/move', (req, res) => {
  const { id, name, roomCode, c, r } = req.body;
  if (!id || roomCode === undefined || c === undefined || r === undefined) {
    res.status(400).json({ error: 'Missing movement parameters' });
    return;
  }
  updateRunnerPosition(roomCode, id, name, c, r);
  res.json({ success: true });
});

// Join Room / Register Player
apiRouter.post('/room/join', (req, res) => {
  const { id, name, roomCode } = req.body;
  if (!id || !name) {
    res.status(400).json({ error: 'id and name are required' });
    return;
  }

  const cleanCode = sanitizeRoomCode(roomCode);
  const cleanName = String(name).trim().slice(0, 16);
  const room = getOrCreateRoom(cleanCode);

  const session: PlayerSession = {
    id,
    name: cleanName,
    roomCode: cleanCode,
    status: 'NAVIGATING',
    checkpointsCleared: 0,
    lastCheckpointTime: 0,
    totalTimeSeconds: 0,
    livesRemaining: 5,
    lastActive: Date.now(),
  };

  room.players.set(id, session);
  persistData();

  broadcastToRoom(cleanCode, 'player_joined', { player: session });
  broadcastToRoom(cleanCode, 'leaderboard_update', getSortedRoomLeaderboard(cleanCode));

  res.json({
    success: true,
    roomCode: cleanCode,
    player: session,
    leaderboard: getSortedRoomLeaderboard(cleanCode),
  });
});

// SSE Stream for instant multi-user synchronization within a specific room
apiRouter.get('/events', (req, res) => {
  const rawCode = (req.query.roomCode as string) || 'DEFAULT';
  const roomCode = sanitizeRoomCode(rawCode);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  if (!roomSseClients.has(roomCode)) {
    roomSseClients.set(roomCode, new Set());
  }
  const clients = roomSseClients.get(roomCode)!;
  clients.add(res);

  // Send initial room leaderboard immediately
  res.write(
    `data: ${JSON.stringify({
      type: 'initial_state',
      roomCode,
      data: getSortedRoomLeaderboard(roomCode),
      timestamp: Date.now(),
    })}\n\n`
  );

  req.on('close', () => {
    clients.delete(res);
  });
});

// Fetch current room leaderboard
apiRouter.get('/room/:roomCode/leaderboard', (req, res) => {
  const roomCode = sanitizeRoomCode(req.params.roomCode);
  res.json({
    roomCode,
    leaderboard: getSortedRoomLeaderboard(roomCode),
  });
});

// Legacy / Direct leaderboard fetch
apiRouter.get('/leaderboard', (req, res) => {
  const roomCode = sanitizeRoomCode((req.query.roomCode as string) || 'LAB-101');
  res.json({
    roomCode,
    leaderboard: getSortedRoomLeaderboard(roomCode),
  });
});

// Update checkpoint progress for room
apiRouter.post('/player/checkpoint', (req, res) => {
  const { id, checkpointId, totalTimeSeconds, livesRemaining, roomCode } = req.body;
  const cleanCode = sanitizeRoomCode(roomCode);
  const room = rooms.get(cleanCode);

  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  const player = room.players.get(id);
  if (!player) {
    res.status(404).json({ error: 'Player not found in room' });
    return;
  }

  player.checkpointsCleared = Math.max(player.checkpointsCleared, Number(checkpointId));
  player.lastCheckpointTime = Number(totalTimeSeconds) || player.totalTimeSeconds;
  player.totalTimeSeconds = Number(totalTimeSeconds) || player.totalTimeSeconds;
  player.livesRemaining = Number(livesRemaining) !== undefined ? Number(livesRemaining) : player.livesRemaining;
  player.lastActive = Date.now();
  player.status = 'NAVIGATING';

  persistData();

  broadcastToRoom(cleanCode, 'checkpoint_cleared', {
    playerId: id,
    playerName: player.name,
    checkpointId: player.checkpointsCleared,
    timeSeconds: player.totalTimeSeconds,
    livesRemaining: player.livesRemaining,
  });
  broadcastToRoom(cleanCode, 'leaderboard_update', getSortedRoomLeaderboard(cleanCode));

  res.json({ success: true, player });
});

// Finish maze / Escape in room
apiRouter.post('/player/finish', (req, res) => {
  const { id, totalTimeSeconds, livesRemaining, roomCode } = req.body;
  const cleanCode = sanitizeRoomCode(roomCode);
  const room = rooms.get(cleanCode);

  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  const player = room.players.get(id);
  if (!player) {
    res.status(404).json({ error: 'Player not found in room' });
    return;
  }

  player.status = 'ESCAPED';
  player.checkpointsCleared = 5;
  player.totalTimeSeconds = Number(totalTimeSeconds) || player.totalTimeSeconds;
  player.livesRemaining = Number(livesRemaining) !== undefined ? Number(livesRemaining) : player.livesRemaining;
  player.lastActive = Date.now();
  player.finishedAt = Date.now();

  persistData();

  const sorted = getSortedRoomLeaderboard(cleanCode);
  const rank = sorted.findIndex((p) => p.id === id) + 1;

  broadcastToRoom(cleanCode, 'player_escaped', {
    playerId: id,
    playerName: player.name,
    timeSeconds: player.totalTimeSeconds,
    livesRemaining: player.livesRemaining,
    rank,
  });
  broadcastToRoom(cleanCode, 'leaderboard_update', sorted);

  res.json({ success: true, rank, player });
});

// Player eliminated / Game over in room
apiRouter.post('/player/gameover', (req, res) => {
  const { id, totalTimeSeconds, checkpointsCleared, reason, roomCode } = req.body;
  const cleanCode = sanitizeRoomCode(roomCode);
  const room = rooms.get(cleanCode);

  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  const player = room.players.get(id);
  if (!player) {
    res.status(404).json({ error: 'Player not found in room' });
    return;
  }

  player.status = 'ELIMINATED';
  player.livesRemaining = 0;
  player.totalTimeSeconds = Number(totalTimeSeconds) || player.totalTimeSeconds;
  player.checkpointsCleared = Number(checkpointsCleared) || player.checkpointsCleared;
  player.lastActive = Date.now();

  persistData();

  broadcastToRoom(cleanCode, 'player_eliminated', {
    playerId: id,
    playerName: player.name,
    checkpointsCleared: player.checkpointsCleared,
    timeSeconds: player.totalTimeSeconds,
    reason,
  });
  broadcastToRoom(cleanCode, 'leaderboard_update', getSortedRoomLeaderboard(cleanCode));

  res.json({ success: true, player });
});

// Immediate sync when player loses a life (hazard or minigame bomb/miss)
apiRouter.post('/player/lose-life', (req, res) => {
  const { id, roomCode, livesRemaining, reason, totalTimeSeconds } = req.body;
  const cleanCode = sanitizeRoomCode(roomCode);
  const room = rooms.get(cleanCode);

  if (room) {
    const player = room.players.get(id);
    if (player) {
      player.lastActive = Date.now();
      player.livesRemaining = Math.max(0, Number(livesRemaining));
      if (totalTimeSeconds !== undefined) player.totalTimeSeconds = Number(totalTimeSeconds);

      if (player.livesRemaining <= 0) {
        player.status = 'ELIMINATED';
        broadcastToRoom(cleanCode, 'player_eliminated', {
          playerId: id,
          playerName: player.name,
          checkpointsCleared: player.checkpointsCleared,
          timeSeconds: player.totalTimeSeconds,
          reason: reason || 'Lost all lives',
        });
      }

      persistData();
      broadcastToRoom(cleanCode, 'leaderboard_update', getSortedRoomLeaderboard(cleanCode));
    }
  }

  res.json({ success: true });
});

// Heartbeat to keep live presence inside room
apiRouter.post('/player/heartbeat', (req, res) => {
  const { id, totalTimeSeconds, livesRemaining, status, roomCode } = req.body;
  const cleanCode = sanitizeRoomCode(roomCode);
  const room = rooms.get(cleanCode);

  if (room) {
    const player = room.players.get(id);
    if (player) {
      player.lastActive = Date.now();
      if (totalTimeSeconds !== undefined) player.totalTimeSeconds = Number(totalTimeSeconds);
      if (livesRemaining !== undefined) player.livesRemaining = Number(livesRemaining);
      if (status && player.status !== 'ESCAPED' && player.status !== 'ELIMINATED') {
        player.status = status;
      }
      broadcastToRoom(cleanCode, 'leaderboard_update', getSortedRoomLeaderboard(cleanCode));
    }
  }

  res.json({ success: true });
});

// --- ADMIN API ENDPOINTS ---
// 1. Admin Overview: returns all rooms, players, and aggregate stats
apiRouter.get('/admin/overview', (_req, res) => {
  const roomList = Array.from(rooms.values()).map((r) => {
    const pList = Array.from(r.players.values()).map((p) => ({
      ...p,
      isOnline: Date.now() - p.lastActive < 45000,
    }));

    return {
      code: r.code,
      createdAt: r.createdAt,
      playerCount: pList.length,
      players: pList,
    };
  });

  let totalPlayers = 0;
  let escapedCount = 0;
  let eliminatedCount = 0;
  let activeCount = 0;

  roomList.forEach((r) => {
    totalPlayers += r.players.length;
    r.players.forEach((p) => {
      if (p.status === 'ESCAPED') escapedCount++;
      else if (p.status === 'ELIMINATED') eliminatedCount++;
      else activeCount++;
    });
  });

  res.json({
    stats: {
      totalRooms: roomList.length,
      totalPlayers,
      escapedCount,
      eliminatedCount,
      activeCount,
    },
    rooms: roomList,
  });
});

// 2. Admin: Reset a room (removes all players or re-initializes room)
apiRouter.post('/admin/room/reset', (req, res) => {
  const { roomCode } = req.body;
  const cleanCode = sanitizeRoomCode(roomCode);
  const room = rooms.get(cleanCode);

  if (room) {
    room.players.clear();
    persistData();
    broadcastToRoom(cleanCode, 'leaderboard_update', []);
    res.json({ success: true, message: `Room ${cleanCode} reset successfully` });
  } else {
    res.status(404).json({ error: 'Room not found' });
  }
});

// 3. Admin: Kick/remove a player from a room
apiRouter.post('/admin/player/kick', (req, res) => {
  const { roomCode, playerId } = req.body;
  const cleanCode = sanitizeRoomCode(roomCode);
  const room = rooms.get(cleanCode);

  if (room && room.players.has(playerId)) {
    const kicked = room.players.get(playerId);
    room.players.delete(playerId);
    persistData();
    broadcastToRoom(cleanCode, 'leaderboard_update', getSortedRoomLeaderboard(cleanCode));
    res.json({ success: true, message: `Player ${kicked?.name} kicked from room ${cleanCode}` });
  } else {
    res.status(404).json({ error: 'Player or room not found' });
  }
});

// Mount on both `/api` (when full path is preserved) and `/` (when Vercel strips /api in function handler)
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Export for Vercel Serverless Function entry point
export default app;
