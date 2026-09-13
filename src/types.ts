export type GameStatus =
  | 'NAME_ENTRY'
  | 'NAVIGATING'
  | 'CHECKPOINT_MINIGAME'
  | 'GAME_OVER'
  | 'VICTORY';

export interface PlayerSession {
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
  isCurrentRun?: boolean;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  roomCode?: string;
  status?: 'NAVIGATING' | 'IN_CHECKPOINT' | 'ESCAPED' | 'ELIMINATED';
  checkpointsCleared?: number;
  timeSeconds: number;
  livesRemaining: number;
  date?: string;
  lastActive?: number;
  isCurrentRun?: boolean;
}

export interface HazardConfig {
  id: string;
  c: number; // column in grid
  r: number; // row in grid
  periodMs: number; // total cycle duration (e.g. 3000ms)
  activeDurationMs: number; // how long it stays dangerous (e.g. 1500ms)
  offsetMs: number; // phase shift
  label?: string;
}

export interface CheckpointConfig {
  id: number; // 1 to 5
  c: number;
  r: number;
  name: string;
  targetCount: number; // smashes required
  speedMultiplier: number;
  bombChance: number;
}

export interface FlyingLetter {
  id: string;
  char: string;
  isBomb: boolean;
  x: number; // canvas X
  y: number; // canvas Y
  vx: number; // velocity X
  vy: number; // velocity Y
  radius: number;
  rotation: number;
  rotationSpeed: number;
  sliced: boolean;
  sliceAngle: number;
  sliceProgress: number;
  sparkles: Sparkle[];
}

export interface Sparkle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

export interface Point {
  c: number;
  r: number;
}

export interface RunnerLivePosition {
  id: string;
  name: string;
  c: number;
  r: number;
  updatedAt?: number;
}

export interface MazeData {
  cols: number;
  rows: number;
  grid: number[][]; // 0 = pathway, 1 = solid wall
  startPos: Point;
  exitPos: Point;
  checkpoints: CheckpointConfig[];
  hazards: HazardConfig[];
}
