import { CheckpointConfig, HazardConfig, MazeData, Point } from '../types';

// ==========================================
// DYNAMIC PROCEDURAL LABYRINTH GENERATOR
// Dimension: 43 Columns x 25 Rows (enlarged tactical cyber-grid)
// 0 = Pathway | 1 = Solid Wall
// ==========================================
export const MAZE_COLS = 43;
export const MAZE_ROWS = 25;

/**
 * Deterministic seeded 32-bit PRNG (Mulberry32)
 * Ensures all runners joining the same roomCode get the EXACT same maze layout,
 * checkpoints, and hazard locations, with zero network overhead.
 */
function createPrng(seedStr: string): () => number {
  const clean = seedStr.trim().toUpperCase() || 'LAB-101';
  let hash = 2166136261;
  for (let i = 0; i < clean.length; i++) {
    hash ^= clean.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  let seed = hash >>> 0;

  return function nextFloat(): number {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a complete, balanced, and solvable dynamic maze for a given roomCode
 */
export function generateMazeForRoom(roomCode: string): MazeData {
  const prng = createPrng(roomCode);
  const cols = MAZE_COLS;
  const rows = MAZE_ROWS;

  // 1. Initialize grid filled with solid cyber walls (1)
  const grid: number[][] = Array.from({ length: rows }, () => Array(cols).fill(1));

  // 2. Randomized Depth-First Search (Recursive Backtracker) on odd grid nodes
  // Guarantees 100% full connectivity of all pathway corridors without islands.
  const visited: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
  const stack: Point[] = [{ c: 1, r: 1 }];
  grid[1][1] = 0;
  visited[1][1] = true;

  const DIRS = [
    { dc: 0, dr: -2 }, // Up
    { dc: 0, dr: 2 },  // Down
    { dc: -2, dr: 0 }, // Left
    { dc: 2, dr: 0 },  // Right
  ];

  while (stack.length > 0) {
    const curr = stack[stack.length - 1];
    const unvisited: { next: Point; wall: Point }[] = [];

    for (const d of DIRS) {
      const nc = curr.c + d.dc;
      const nr = curr.r + d.dr;
      if (nc >= 1 && nc <= cols - 2 && nr >= 1 && nr <= rows - 2 && !visited[nr][nc]) {
        unvisited.push({
          next: { c: nc, r: nr },
          wall: { c: curr.c + d.dc / 2, r: curr.r + d.dr / 2 },
        });
      }
    }

    if (unvisited.length > 0) {
      const idx = Math.floor(prng() * unvisited.length);
      const chosen = unvisited[idx];
      grid[chosen.wall.r][chosen.wall.c] = 0;
      grid[chosen.next.r][chosen.next.c] = 0;
      visited[chosen.next.r][chosen.next.c] = true;
      stack.push(chosen.next);
    } else {
      stack.pop();
    }
  }

  // 3. Braiding & Tactical Loops: Knock down select walls between pathways
  // This creates multiple routes, flanking corridors, and escape bypasses around laser barriers
  for (let r = 2; r < rows - 2; r++) {
    for (let c = 2; c < cols - 2; c++) {
      if (grid[r][c] === 1) {
        const horizontal = grid[r][c - 1] === 0 && grid[r][c + 1] === 0;
        const vertical = grid[r - 1][c] === 0 && grid[r + 1][c] === 0;
        if ((horizontal || vertical) && prng() < 0.22) {
          grid[r][c] = 0;
        }
      }
    }
  }

  // 4. Ensure Start (1, 1) and Exit (cols - 2, rows - 2) zones are open
  const startPos: Point = { c: 1, r: 1 };
  const exitPos: Point = { c: cols - 2, r: rows - 2 };

  grid[1][1] = 0;
  grid[1][2] = 0;
  grid[2][1] = 0;

  grid[exitPos.r][exitPos.c] = 0;
  grid[exitPos.r][exitPos.c - 1] = 0;
  grid[exitPos.r - 1][exitPos.c] = 0;

  // 5. Place 5 Strategic Checkpoints in 5 Distinct Sectors
  const sectorBounds = [
    { name: 'Sector Alpha', cMin: 7, cMax: 13, rMin: 3, rMax: 7, targetCount: 9, speedMultiplier: 1.15, bombChance: 0.22 },
    { name: 'Sector Beta', cMin: 7, cMax: 13, rMin: 17, rMax: 21, targetCount: 12, speedMultiplier: 1.40, bombChance: 0.26 },
    { name: 'Sector Gamma', cMin: 19, cMax: 25, rMin: 11, rMax: 15, targetCount: 15, speedMultiplier: 1.65, bombChance: 0.30 },
    { name: 'Sector Delta', cMin: 29, cMax: 37, rMin: 3, rMax: 7, targetCount: 18, speedMultiplier: 1.85, bombChance: 0.34 },
    { name: 'Sector Epsilon', cMin: 29, cMax: 37, rMin: 15, rMax: 19, targetCount: 22, speedMultiplier: 2.10, bombChance: 0.38 },
  ];

  const checkpoints: CheckpointConfig[] = sectorBounds.map((sec, idx) => {
    // Find odd coordinates in this sector (guaranteed open by DFS)
    const validPoints: Point[] = [];
    for (let r = sec.rMin; r <= sec.rMax; r++) {
      for (let c = sec.cMin; c <= sec.cMax; c++) {
        if (grid[r][c] === 0) {
          validPoints.push({ c, r });
        }
      }
    }

    let pos: Point;
    if (validPoints.length > 0) {
      const pIdx = Math.floor(prng() * validPoints.length);
      pos = validPoints[pIdx];
    } else {
      // Fallback: force open a cell in the center of the sector
      const fc = Math.floor((sec.cMin + sec.cMax) / 2) | 1;
      const fr = Math.floor((sec.rMin + sec.rMax) / 2) | 1;
      grid[fr][fc] = 0;
      grid[fr][fc + 1] = 0;
      pos = { c: fc, r: fr };
    }

    // Ensure checkpoint has at least 2 open pathways around it
    if (pos.c + 1 < cols - 1) grid[pos.r][pos.c + 1] = 0;
    if (pos.c - 1 > 0) grid[pos.r][pos.c - 1] = 0;

    return {
      id: idx + 1,
      c: pos.c,
      r: pos.r,
      name: sec.name,
      targetCount: sec.targetCount,
      speedMultiplier: sec.speedMultiplier,
      bombChance: sec.bombChance,
    };
  });

  // 6. Place 36 Dynamic Hazards (Laser Gates, Arc Barriers, Plasma Spikes)
  const candidateCells: Point[] = [];
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      if (grid[r][c] !== 0) continue;

      // Safe zone near start
      const distStart = Math.abs(c - startPos.c) + Math.abs(r - startPos.r);
      if (distStart <= 3) continue;

      // Safe zone near exit
      const distExit = Math.abs(c - exitPos.c) + Math.abs(r - exitPos.r);
      if (distExit <= 2) continue;

      // Safe zone near checkpoints
      let nearCheckpoint = false;
      for (const cp of checkpoints) {
        const distCp = Math.abs(c - cp.c) + Math.abs(r - cp.r);
        if (distCp <= 1) {
          nearCheckpoint = true;
          break;
        }
      }
      if (nearCheckpoint) continue;

      candidateCells.push({ c, r });
    }
  }

  // Shuffle candidate cells using seeded PRNG (Fisher-Yates)
  for (let i = candidateCells.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    const tmp = candidateCells[i];
    candidateCells[i] = candidateCells[j];
    candidateCells[j] = tmp;
  }

  const hazards: HazardConfig[] = [];
  const occupiedHazardCoords = new Set<string>();
  const TARGET_HAZARD_COUNT = 36;

  for (const pt of candidateCells) {
    if (hazards.length >= TARGET_HAZARD_COUNT) break;

    // Check that no adjacent cell has a hazard to prevent impassable choke bottlenecks
    let neighborHasHazard = false;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (occupiedHazardCoords.has(`${pt.c + dc},${pt.r + dr}`)) {
          neighborHasHazard = true;
          break;
        }
      }
      if (neighborHasHazard) break;
    }

    if (neighborHasHazard) continue;

    occupiedHazardCoords.add(`${pt.c},${pt.r}`);
    const hzIndex = hazards.length + 1;
    const periodMs = 2300 + Math.floor(prng() * 450); // 2300ms - 2750ms
    const activeDurationMs = 1450 + Math.floor(prng() * 200); // 1450ms - 1650ms
    const offsetMs = Math.floor(prng() * 2000);

    const hazardType = hzIndex % 3 === 0 ? 'Plasma Spike' : hzIndex % 2 === 0 ? 'Arc Barrier' : 'Laser Gate';

    hazards.push({
      id: `hz-${hzIndex}`,
      c: pt.c,
      r: pt.r,
      periodMs,
      activeDurationMs,
      offsetMs,
      label: `${hazardType} ${hzIndex}`,
    });
  }

  return {
    cols,
    rows,
    grid,
    startPos,
    exitPos,
    checkpoints,
    hazards,
  };
}

// In-memory cache to guarantee referential stability per roomCode
const mazeCache = new Map<string, MazeData>();

export function getMazeForRoom(roomCode: string): MazeData {
  const key = (roomCode || 'LAB-101').trim().toUpperCase();
  let data = mazeCache.get(key);
  if (!data) {
    data = generateMazeForRoom(key);
    mazeCache.set(key, data);
  }
  return data;
}

// Default static exports for backward compatibility
export const DEFAULT_MAZE: MazeData = getMazeForRoom('LAB-101');
export const START_POS: Point = DEFAULT_MAZE.startPos;
export const EXIT_POS: Point = DEFAULT_MAZE.exitPos;
export const CHECKPOINTS: CheckpointConfig[] = DEFAULT_MAZE.checkpoints;
export const HAZARDS: HazardConfig[] = DEFAULT_MAZE.hazards;
export const MAZE_GRID: number[][] = DEFAULT_MAZE.grid;
