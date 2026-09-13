import { CheckpointConfig, HazardConfig } from '../types';

export const MAZE_COLS = 25;
export const MAZE_ROWS = 15;

// 1 = Solid Wall, 0 = Walkable Corridor
// Designed with authentic maze corridors, branching routes, dead-ends, and loops.
export const MAZE_GRID: number[][] = [
  // Col: 0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24
  /* 0 */[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  /* 1 */[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  /* 2 */[1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1],
  /* 3 */[1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1],
  /* 4 */[1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1],
  /* 5 */[1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
  /* 6 */[1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1],
  /* 7 */[1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1],
  /* 8 */[1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1],
  /* 9 */[1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
  /*10 */[1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1],
  /*11 */[1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1],
  /*12 */[1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1],
  /*13 */[1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1],
  /*14 */[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

export const START_POS = { c: 1, r: 1 };
export const EXIT_POS = { c: 23, r: 13 };

export const CHECKPOINTS: CheckpointConfig[] = [
  {
    id: 1,
    c: 5,
    r: 3,
    name: 'Sector Alpha',
    targetCount: 8,
    speedMultiplier: 1.0,
    bombChance: 0.20,
  },
  {
    id: 2,
    c: 19,
    r: 1,
    name: 'Sector Beta',
    targetCount: 10,
    speedMultiplier: 1.25,
    bombChance: 0.25,
  },
  {
    id: 3,
    c: 11,
    r: 7,
    name: 'Sector Gamma',
    targetCount: 12,
    speedMultiplier: 1.45,
    bombChance: 0.28,
  },
  {
    id: 4,
    c: 3,
    r: 11,
    name: 'Sector Delta',
    targetCount: 14,
    speedMultiplier: 1.65,
    bombChance: 0.32,
  },
  {
    id: 5,
    c: 19,
    r: 11,
    name: 'Sector Epsilon',
    targetCount: 16,
    speedMultiplier: 1.85,
    bombChance: 0.35,
  },
];

// Disappearing & reappearing hazards positioned in corridors
export const HAZARDS: HazardConfig[] = [
  {
    id: 'hz-1',
    c: 3,
    r: 1,
    periodMs: 3000,
    activeDurationMs: 1600,
    offsetMs: 0,
    label: 'Laser Barrier A',
  },
  {
    id: 'hz-2',
    c: 9,
    r: 1,
    periodMs: 2600,
    activeDurationMs: 1400,
    offsetMs: 700,
    label: 'Arc Discharge B',
  },
  {
    id: 'hz-3',
    c: 17,
    r: 3,
    periodMs: 2800,
    activeDurationMs: 1500,
    offsetMs: 1200,
    label: 'Plasma Spike C',
  },
  {
    id: 'hz-4',
    c: 7,
    r: 5,
    periodMs: 3200,
    activeDurationMs: 1700,
    offsetMs: 400,
    label: 'Laser Barrier D',
  },
  {
    id: 'hz-5',
    c: 15,
    r: 5,
    periodMs: 2700,
    activeDurationMs: 1400,
    offsetMs: 1500,
    label: 'Arc Discharge E',
  },
  {
    id: 'hz-6',
    c: 5,
    r: 9,
    periodMs: 3000,
    activeDurationMs: 1600,
    offsetMs: 900,
    label: 'Plasma Spike F',
  },
  {
    id: 'hz-7',
    c: 13,
    r: 9,
    periodMs: 2500,
    activeDurationMs: 1300,
    offsetMs: 600,
    label: 'Laser Barrier G',
  },
  {
    id: 'hz-8',
    c: 9,
    r: 13,
    periodMs: 3100,
    activeDurationMs: 1600,
    offsetMs: 1100,
    label: 'Arc Discharge H',
  },
  {
    id: 'hz-9',
    c: 17,
    r: 13,
    periodMs: 2800,
    activeDurationMs: 1500,
    offsetMs: 1800,
    label: 'Plasma Spike I',
  },
  {
    id: 'hz-10',
    c: 21,
    r: 11,
    periodMs: 2600,
    activeDurationMs: 1400,
    offsetMs: 300,
    label: 'Final Gate Laser',
  },
];

export const INITIAL_LEADERBOARD: any[] = [];
