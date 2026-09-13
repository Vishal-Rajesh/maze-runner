import React, { useEffect, useRef, useCallback } from 'react';
import { Point, CheckpointConfig, HazardConfig, MazeData, RunnerLivePosition } from '../types';
import {
  DEFAULT_MAZE,
} from '../data/mazeData';
import { sound } from '../utils/sound';

interface MazeCanvasProps {
  playerPos: Point;
  onMovePlayer: (newPos: Point) => void;
  completedCheckpoints: boolean[];
  onTriggerCheckpoint: (checkpointId: number) => void;
  onHitHazard: () => void;
  onReachExit: () => void;
  onShowWarning: (msg: string) => void;
  invulnerableUntil: number;
  maze?: MazeData;
  otherRunners?: RunnerLivePosition[];
}

const CELL_SIZE = 26; // 43 cols * 26 = 1118px, 25 rows * 26 = 650px

export const MazeCanvas: React.FC<MazeCanvasProps> = ({
  playerPos,
  onMovePlayer,
  completedCheckpoints,
  onTriggerCheckpoint,
  onHitHazard,
  onReachExit,
  onShowWarning,
  invulnerableUntil,
  maze,
  otherRunners = [],
}) => {
  const currentMaze = maze || DEFAULT_MAZE;
  const {
    cols: MAZE_COLS,
    rows: MAZE_ROWS,
    grid: MAZE_GRID,
    startPos: START_POS,
    exitPos: EXIT_POS,
    checkpoints: CHECKPOINTS,
    hazards: HAZARDS,
  } = currentMaze;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastHazardHitRef = useRef<number>(0);
  const playerRenderPosRef = useRef<{ x: number; y: number }>({
    x: playerPos.c * CELL_SIZE + CELL_SIZE / 2,
    y: playerPos.r * CELL_SIZE + CELL_SIZE / 2,
  });
  const otherRunnersRef = useRef<RunnerLivePosition[]>(otherRunners);
  const otherRunnersRenderPosRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Update otherRunners ref immediately on prop change
  useEffect(() => {
    otherRunnersRef.current = otherRunners;
  }, [otherRunners]);
  const trailParticlesRef = useRef<{ x: number; y: number; alpha: number }[]>([]);
  const lastMoveTimeRef = useRef(0);
  const activeKeysRef = useRef<{ [key: string]: boolean }>({});

  const allCleared = completedCheckpoints.every(Boolean);

  // Sync render position when player teleports or maze changes
  useEffect(() => {
    playerRenderPosRef.current = {
      x: playerPos.c * CELL_SIZE + CELL_SIZE / 2,
      y: playerPos.r * CELL_SIZE + CELL_SIZE / 2,
    };
    trailParticlesRef.current = [];
  }, [playerPos.c, playerPos.r, currentMaze]);

  // Helper to check if a hazard is currently active
  const isHazardDangerous = useCallback((hz: HazardConfig, now: number) => {
    const cycleTime = (now + hz.offsetMs) % hz.periodMs;
    return cycleTime < hz.activeDurationMs;
  }, []);

  // Movement execution with collision detection against maze walls
  const executeMove = useCallback(
    (dc: number, dr: number) => {
      const now = performance.now();
      if (now - lastMoveTimeRef.current < 95) return; // Responsive movement rate limiter

      const targetC = playerPos.c + dc;
      const targetR = playerPos.r + dr;

      // Bounds check
      if (targetC < 0 || targetC >= MAZE_COLS || targetR < 0 || targetR >= MAZE_ROWS) return;

      // Wall collision check: 1 is solid wall
      if (MAZE_GRID[targetR][targetC] === 1) {
        return;
      }

      lastMoveTimeRef.current = now;
      sound.playStep();

      // Spawn movement trail
      trailParticlesRef.current.push({
        x: playerPos.c * CELL_SIZE + CELL_SIZE / 2,
        y: playerPos.r * CELL_SIZE + CELL_SIZE / 2,
        alpha: 1,
      });

      const nextPos = { c: targetC, r: targetR };
      onMovePlayer(nextPos);

      // Check if stepped on a checkpoint
      CHECKPOINTS.forEach((cp: CheckpointConfig) => {
        if (cp.c === targetC && cp.r === targetR) {
          if (!completedCheckpoints[cp.id - 1]) {
            onTriggerCheckpoint(cp.id);
          }
        }
      });

      // Check if stepped on exit
      if (targetC === EXIT_POS.c && targetR === EXIT_POS.r) {
        if (allCleared) {
          onReachExit();
        } else {
          const clearedCount = completedCheckpoints.filter(Boolean).length;
          onShowWarning(`EXIT PORTAL CLOAKED: ALL 5 CHECKPOINTS REQUIRED! (${clearedCount}/5 COMPLETED)`);
        }
      }
    },
    [
      allCleared,
      completedCheckpoints,
      onMovePlayer,
      onReachExit,
      onShowWarning,
      onTriggerCheckpoint,
      playerPos.c,
      playerPos.r,
      MAZE_COLS,
      MAZE_ROWS,
      MAZE_GRID,
      CHECKPOINTS,
      EXIT_POS.c,
      EXIT_POS.r,
    ]
  );

  // Keyboard Event Listeners for Arrow keys & WASD
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      activeKeysRef.current[e.key.toLowerCase()] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      activeKeysRef.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Key polling loop for smooth responsive holding
  useEffect(() => {
    let animId: number;
    const checkKeys = () => {
      const keys = activeKeysRef.current;
      if (keys['arrowup'] || keys['w']) executeMove(0, -1);
      else if (keys['arrowdown'] || keys['s']) executeMove(0, 1);
      else if (keys['arrowleft'] || keys['a']) executeMove(-1, 0);
      else if (keys['arrowright'] || keys['d']) executeMove(1, 0);

      animId = requestAnimationFrame(checkKeys);
    };
    animId = requestAnimationFrame(checkKeys);
    return () => cancelAnimationFrame(animId);
  }, [executeMove]);

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const now = performance.now();
      const isInvulnerable = now < invulnerableUntil;

      // Smooth player render interpolation
      const targetX = playerPos.c * CELL_SIZE + CELL_SIZE / 2;
      const targetY = playerPos.r * CELL_SIZE + CELL_SIZE / 2;
      playerRenderPosRef.current.x += (targetX - playerRenderPosRef.current.x) * 0.4;
      playerRenderPosRef.current.y += (targetY - playerRenderPosRef.current.y) * 0.4;

      // Hazard Collision Check (immediate local debounce so 1 hit takes exactly 1 life)
      if (!isInvulnerable && now - lastHazardHitRef.current > 1800) {
        for (const hz of HAZARDS) {
          if (hz.c === playerPos.c && hz.r === playerPos.r) {
            if (isHazardDangerous(hz, now)) {
              lastHazardHitRef.current = now;
              onHitHazard();
              break;
            }
          }
        }
      }

      // --- 1. RENDER BACKGROUND & FLOOR ---
      ctx.fillStyle = '#060714';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Floor cyber grid pattern
      ctx.strokeStyle = 'rgba(26, 32, 60, 0.45)';
      ctx.lineWidth = 1;
      for (let c = 0; c <= MAZE_COLS; c++) {
        ctx.beginPath();
        ctx.moveTo(c * CELL_SIZE, 0);
        ctx.lineTo(c * CELL_SIZE, canvas.height);
        ctx.stroke();
      }
      for (let r = 0; r <= MAZE_ROWS; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * CELL_SIZE);
        ctx.lineTo(canvas.width, r * CELL_SIZE);
        ctx.stroke();
      }

      // --- 2. RENDER MAZE WALLS ---
      for (let r = 0; r < MAZE_ROWS; r++) {
        for (let c = 0; c < MAZE_COLS; c++) {
          if (MAZE_GRID[r][c] === 1) {
            const wx = c * CELL_SIZE;
            const wy = r * CELL_SIZE;

            // Base dark wall block
            ctx.fillStyle = '#0f1325';
            ctx.fillRect(wx, wy, CELL_SIZE, CELL_SIZE);

            // Wall inner metallic face
            ctx.fillStyle = '#161c36';
            ctx.fillRect(wx + 2, wy + 2, CELL_SIZE - 4, CELL_SIZE - 4);

            // Tech center core
            ctx.fillStyle = '#0b0f20';
            ctx.fillRect(wx + 5, wy + 5, CELL_SIZE - 10, CELL_SIZE - 10);

            // Subtle neon border accent
            ctx.strokeStyle = 'rgba(99, 102, 241, 0.35)';
            ctx.lineWidth = 1;
            ctx.strokeRect(wx + 0.5, wy + 0.5, CELL_SIZE - 1, CELL_SIZE - 1);
          }
        }
      }

      // --- 3. RENDER START ZONE ---
      {
        const sx = START_POS.c * CELL_SIZE;
        const sy = START_POS.r * CELL_SIZE;
        ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
        ctx.fillRect(sx, sy, CELL_SIZE, CELL_SIZE);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(sx + 2, sy + 2, CELL_SIZE - 4, CELL_SIZE - 4);
        ctx.font = 'bold 8px Orbitron, monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'center';
        ctx.fillText('START', sx + CELL_SIZE / 2, sy + CELL_SIZE - 5);
      }

      // --- 4. RENDER EXIT GATEWAY (REVEALED ONLY WHEN ALL 5 CHECKPOINTS ARE COMPLETED) ---
      {
        const ex = EXIT_POS.c * CELL_SIZE;
        const ey = EXIT_POS.r * CELL_SIZE;

        if (allCleared) {
          // ================= REVEALED EXIT PORTAL =================
          ctx.save();
          const portalPulse = Math.sin(now / 120) * 2.5;

          // Glowing background hyper-field
          ctx.fillStyle = 'rgba(16, 185, 129, 0.35)';
          ctx.fillRect(ex + 1, ey + 1, CELL_SIZE - 2, CELL_SIZE - 2);

          ctx.shadowColor = '#10b981';
          ctx.shadowBlur = 20;

          // Rotating vortex energy rays
          ctx.translate(ex + CELL_SIZE / 2, ey + CELL_SIZE / 2);
          ctx.rotate(now / 500);

          for (let i = 0; i < 6; i++) {
            ctx.rotate((Math.PI * 2) / 6);
            ctx.strokeStyle = 'rgba(52, 211, 153, 0.75)';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(12 + portalPulse, 0);
            ctx.stroke();
          }

          // Pulsing portal ring
          ctx.rotate(-now / 250);
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, 0, 10 + portalPulse, 0, Math.PI * 2);
          ctx.stroke();

          // Radiant white core
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();

          // High visibility text label
          ctx.font = '900 8px Orbitron, monospace';
          ctx.fillStyle = '#6ee7b7';
          ctx.textAlign = 'center';
          ctx.fillText('EXIT', ex + CELL_SIZE / 2, ey + CELL_SIZE - 3);
        }
        // When not all cleared, the exit tile remains completely cloaked / blended into floor
      }

      // --- 5. RENDER HAZARDS (DISAPPEARING / REAPPEARING) ---
      HAZARDS.forEach((hz) => {
        const hx = hz.c * CELL_SIZE + CELL_SIZE / 2;
        const hy = hz.r * CELL_SIZE + CELL_SIZE / 2;
        const cycleTime = (now + hz.offsetMs) % hz.periodMs;
        const isDangerous = cycleTime < hz.activeDurationMs;

        ctx.save();
        if (isDangerous) {
          // ACTIVE HAZARD: Crimson Node & Arc Spikes
          const pulse = Math.sin(now / 75) * 2;
          ctx.shadowColor = '#ff003c';
          ctx.shadowBlur = 14;

          // Glowing background hazard zone
          ctx.fillStyle = 'rgba(255, 0, 60, 0.28)';
          ctx.fillRect(
            hz.c * CELL_SIZE + 2,
            hz.r * CELL_SIZE + 2,
            CELL_SIZE - 4,
            CELL_SIZE - 4
          );

          // Danger diamond / spike icon
          ctx.translate(hx, hy);
          ctx.rotate(now / 350);
          ctx.fillStyle = '#ff1744';
          ctx.beginPath();
          const s = 11 + pulse;
          ctx.moveTo(0, -s);
          ctx.lineTo(s * 0.4, -s * 0.4);
          ctx.lineTo(s, 0);
          ctx.lineTo(s * 0.4, s * 0.4);
          ctx.lineTo(0, s);
          ctx.lineTo(-s * 0.4, s * 0.4);
          ctx.lineTo(-s, 0);
          ctx.lineTo(-s * 0.4, -s * 0.4);
          ctx.closePath();
          ctx.fill();

          // Center white hot warning core
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(0, 0, 3, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // INACTIVE HAZARD (ESCAPE GAP): Dimmed dormant silhouette + circular recharge progress
          const rechargeProgress =
            (cycleTime - hz.activeDurationMs) / (hz.periodMs - hz.activeDurationMs);

          ctx.fillStyle = 'rgba(255, 23, 68, 0.04)';
          ctx.fillRect(
            hz.c * CELL_SIZE + 2,
            hz.r * CELL_SIZE + 2,
            CELL_SIZE - 4,
            CELL_SIZE - 4
          );

          // Faint outline ring
          ctx.strokeStyle = 'rgba(255, 80, 80, 0.25)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(hx, hy, 9, 0, Math.PI * 2);
          ctx.stroke();

          // Charging arc showing player when it will reactivate
          ctx.strokeStyle = 'rgba(255, 50, 50, 0.75)';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(hx, hy, 9, -Math.PI / 2, -Math.PI / 2 + rechargeProgress * Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = 'rgba(255, 120, 120, 0.6)';
          ctx.font = '7px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('SAFE', hx, hy);
        }
        ctx.restore();
      });

      // --- 6. RENDER CHECKPOINTS (1 to 5) ---
      CHECKPOINTS.forEach((cp) => {
        const cx = cp.c * CELL_SIZE + CELL_SIZE / 2;
        const cy = cp.r * CELL_SIZE + CELL_SIZE / 2;
        const isDone = completedCheckpoints[cp.id - 1];

        ctx.save();
        if (isDone) {
          // CLEARED CHECKPOINT: Emerald Green Emblem
          ctx.strokeStyle = '#10b981';
          ctx.fillStyle = '#064e3b';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx, cy, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#34d399';
          ctx.font = 'bold 10px Orbitron, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('✓', cx, cy);
        } else {
          // ACTIVE CHECKPOINT: Pulsing Amber Golden Beacon
          const pulse = Math.sin(now / 180 + cp.id) * 2;
          ctx.shadowColor = '#f59e0b';
          ctx.shadowBlur = 12;

          // Outer beacon ring
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, 11 + pulse, 0, Math.PI * 2);
          ctx.stroke();

          // Inner disc
          ctx.fillStyle = '#1e1b4b';
          ctx.beginPath();
          ctx.arc(cx, cy, 9, 0, Math.PI * 2);
          ctx.fill();

          // Checkpoint Number
          ctx.fillStyle = '#fef08a';
          ctx.font = '900 10px Orbitron, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(cp.id), cx, cy);
        }
        ctx.restore();
      });

      // --- 7. WAYPOINT GUIDANCE BEAM (WHEN EXIT PORTAL IS REVEALED) ---
      if (allCleared) {
        const px = playerRenderPosRef.current.x;
        const py = playerRenderPosRef.current.y;
        const ex = EXIT_POS.c * CELL_SIZE + CELL_SIZE / 2;
        const ey = EXIT_POS.r * CELL_SIZE + CELL_SIZE / 2;

        ctx.save();
        ctx.strokeStyle = `rgba(52, 211, 153, ${0.35 + Math.sin(now / 150) * 0.2})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.lineDashOffset = -now / 20;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.restore();
      }

      // --- 8. RENDER PLAYER TRAIL PARTICLES ---
      trailParticlesRef.current.forEach((tp) => {
        tp.alpha -= 0.045;
        if (tp.alpha > 0) {
          ctx.save();
          ctx.fillStyle = `rgba(0, 240, 255, ${tp.alpha * 0.35})`;
          ctx.beginPath();
          ctx.arc(tp.x, tp.y, 6 * tp.alpha, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });
      trailParticlesRef.current = trailParticlesRef.current.filter((tp) => tp.alpha > 0);

      // --- 8.5 RENDER OTHER PLAYERS MOVING IN THE SAME ROOM (30-100 PLAYERS) ---
      // Reduced opacity cursor with small semi-transparent name tag on top
      if (otherRunnersRef.current && otherRunnersRef.current.length > 0) {
        const RUNNER_PALETTE = [
          '#a855f7', '#ec4899', '#f97316', '#10b981', '#06b6d4',
          '#eab308', '#8b5cf6', '#14b8a6', '#f43f5e', '#6366f1'
        ];

        // Prune stale runner entries
        const activeIds = new Set(otherRunnersRef.current.map((r) => r.id));
        for (const id of otherRunnersRenderPosRef.current.keys()) {
          if (!activeIds.has(id)) {
            otherRunnersRenderPosRef.current.delete(id);
          }
        }

        otherRunnersRef.current.forEach((runner) => {
          const targetX = runner.c * CELL_SIZE + CELL_SIZE / 2;
          const targetY = runner.r * CELL_SIZE + CELL_SIZE / 2;

          let pos = otherRunnersRenderPosRef.current.get(runner.id);
          if (!pos) {
            pos = { x: targetX, y: targetY };
            otherRunnersRenderPosRef.current.set(runner.id, pos);
          } else {
            // Smooth lerp interpolation for zero-lag silky rendering
            pos.x += (targetX - pos.x) * 0.35;
            pos.y += (targetY - pos.y) * 0.35;
          }

          let hash = 0;
          for (let i = 0; i < runner.id.length; i++) {
            hash = (hash * 31 + runner.id.charCodeAt(i)) | 0;
          }
          const runnerColor = RUNNER_PALETTE[Math.abs(hash) % RUNNER_PALETTE.length];

          ctx.save();

          // 1. Reduced Opacity Cursor
          ctx.globalAlpha = 0.42;
          ctx.fillStyle = runnerColor;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 7.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Small inner core
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 2.5, 0, Math.PI * 2);
          ctx.fill();

          // 2. Small Name Tag on Top with Reduced Opacity
          ctx.globalAlpha = 0.55;
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';

          const textWidth = ctx.measureText(runner.name).width;
          ctx.fillStyle = 'rgba(2, 6, 23, 0.7)';
          ctx.fillRect(pos.x - textWidth / 2 - 2, pos.y - 19, textWidth + 4, 10);

          ctx.fillStyle = '#e2e8f0';
          ctx.fillText(runner.name, pos.x, pos.y - 10);

          ctx.restore();
        });
      }

      // --- 9. RENDER PLAYER (THE BLUE DRONE) ---
      const px = playerRenderPosRef.current.x;
      const py = playerRenderPosRef.current.y;

      ctx.save();
      if (isInvulnerable && Math.floor(now / 100) % 2 === 0) {
        ctx.globalAlpha = 0.35;
      }

      // Outer Cyan Glow
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 16;

      const corePulse = Math.sin(now / 140) * 1.2;
      const playerRadius = 10.5 + corePulse;

      const playerGrad = ctx.createRadialGradient(px, py, 2, px, py, playerRadius);
      playerGrad.addColorStop(0, '#ffffff');
      playerGrad.addColorStop(0.3, '#38bdf8');
      playerGrad.addColorStop(0.8, '#0284c7');
      playerGrad.addColorStop(1, '#0369a1');

      ctx.fillStyle = playerGrad;
      ctx.beginPath();
      ctx.arc(px, py, playerRadius, 0, Math.PI * 2);
      ctx.fill();

      // Outer shield ring
      ctx.strokeStyle = '#bae6fd';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Cyber crosshair detail
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px - 4, py);
      ctx.lineTo(px + 4, py);
      ctx.moveTo(px, py - 4);
      ctx.lineTo(px, py + 4);
      ctx.stroke();

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    allCleared,
    completedCheckpoints,
    invulnerableUntil,
    isHazardDangerous,
    onHitHazard,
    playerPos.c,
    playerPos.r,
    currentMaze,
  ]);

  return (
    <div className="relative w-full flex flex-col items-center select-none">
      {/* Minimal Status Bar */}
      <div className="w-full max-w-[1120px] mb-2 flex items-center justify-between text-xs px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/80 font-mono">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${allCleared ? 'bg-emerald-400 animate-ping' : 'bg-cyan-400'}`} />
          <span className="text-[11px] text-slate-300">
            {allCleared ? (
              <strong className="text-emerald-300 font-bold">
                ⚡ EXIT PORTAL UNLOCKED (BOTTOM-RIGHT) — ESCAPE NOW!
              </strong>
            ) : (
              <span>
                Exit: Secured {completedCheckpoints.filter(Boolean).length}/5 Checkpoints
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="relative border-2 border-slate-700/80 rounded-xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] bg-slate-950 max-w-full">
        <canvas
          ref={canvasRef}
          width={MAZE_COLS * CELL_SIZE}
          height={MAZE_ROWS * CELL_SIZE}
          className="block max-w-full h-auto aspect-[43/25]"
        />
      </div>

      {/* Touch / Virtual Keypad for Mobile or Quick Navigation */}
      <div className="flex md:hidden items-center justify-center gap-2 mt-3 select-none">
        <div className="grid grid-cols-3 gap-2 w-48">
          <div />
          <button
            type="button"
            onClick={() => executeMove(0, -1)}
            className="p-3 bg-slate-800 active:bg-cyan-600 rounded-lg text-cyan-300 font-bold flex items-center justify-center border border-slate-700 active:scale-95 transition-transform"
          >
            ▲
          </button>
          <div />
          <button
            type="button"
            onClick={() => executeMove(-1, 0)}
            className="p-3 bg-slate-800 active:bg-cyan-600 rounded-lg text-cyan-300 font-bold flex items-center justify-center border border-slate-700 active:scale-95 transition-transform"
          >
            ◀
          </button>
          <button
            type="button"
            onClick={() => executeMove(0, 1)}
            className="p-3 bg-slate-800 active:bg-cyan-600 rounded-lg text-cyan-300 font-bold flex items-center justify-center border border-slate-700 active:scale-95 transition-transform"
          >
            ▼
          </button>
          <button
            type="button"
            onClick={() => executeMove(1, 0)}
            className="p-3 bg-slate-800 active:bg-cyan-600 rounded-lg text-cyan-300 font-bold flex items-center justify-center border border-slate-700 active:scale-95 transition-transform"
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  );
};
