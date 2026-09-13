import React, { useEffect, useRef, useCallback } from 'react';
import { Point, CheckpointConfig } from '../types';
import {
  MAZE_GRID,
  MAZE_COLS,
  MAZE_ROWS,
  START_POS,
  EXIT_POS,
  CHECKPOINTS,
  HAZARDS,
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
}

const CELL_SIZE = 40; // 25 cols * 40 = 1000px, 15 rows * 40 = 600px

export const MazeCanvas: React.FC<MazeCanvasProps> = ({
  playerPos,
  onMovePlayer,
  completedCheckpoints,
  onTriggerCheckpoint,
  onHitHazard,
  onReachExit,
  onShowWarning,
  invulnerableUntil,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playerRenderPosRef = useRef<{ x: number; y: number }>({
    x: playerPos.c * CELL_SIZE + CELL_SIZE / 2,
    y: playerPos.r * CELL_SIZE + CELL_SIZE / 2,
  });
  const trailParticlesRef = useRef<{ x: number; y: number; alpha: number }[]>([]);
  const lastMoveTimeRef = useRef(0);
  const activeKeysRef = useRef<{ [key: string]: boolean }>({});

  // Helper to check if a hazard is currently active
  const isHazardDangerous = useCallback((hz: (typeof HAZARDS)[0], now: number) => {
    const cycleTime = (now + hz.offsetMs) % hz.periodMs;
    return cycleTime < hz.activeDurationMs;
  }, []);

  // Movement execution with collision detection against maze walls
  const executeMove = useCallback(
    (dc: number, dr: number) => {
      const now = performance.now();
      if (now - lastMoveTimeRef.current < 110) return; // movement rate limiter for precision

      const targetC = playerPos.c + dc;
      const targetR = playerPos.r + dr;

      // Bounds check
      if (targetC < 0 || targetC >= MAZE_COLS || targetR < 0 || targetR >= MAZE_ROWS) return;

      // Wall collision check: 1 is solid wall!
      if (MAZE_GRID[targetR][targetC] === 1) {
        // Can't move into wall
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
        const allCleared = completedCheckpoints.every(Boolean);
        if (allCleared) {
          onReachExit();
        } else {
          const clearedCount = completedCheckpoints.filter(Boolean).length;
          onShowWarning(`SECURITY LOCK: ALL 5 CHECKPOINTS REQUIRED! (${clearedCount}/5 CLEARED)`);
        }
      }
    },
    [completedCheckpoints, onMovePlayer, onReachExit, onShowWarning, onTriggerCheckpoint, playerPos]
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
      playerRenderPosRef.current.x += (targetX - playerRenderPosRef.current.x) * 0.35;
      playerRenderPosRef.current.y += (targetY - playerRenderPosRef.current.y) * 0.35;

      // Hazard Collision Check
      if (!isInvulnerable) {
        for (const hz of HAZARDS) {
          if (hz.c === playerPos.c && hz.r === playerPos.r) {
            if (isHazardDangerous(hz, now)) {
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
      ctx.strokeStyle = 'rgba(26, 32, 60, 0.4)';
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
      // Actual maze walls with distinct bevel, metallic tech face, and glowing sci-fi borders
      for (let r = 0; r < MAZE_ROWS; r++) {
        for (let c = 0; c < MAZE_COLS; c++) {
          if (MAZE_GRID[r][c] === 1) {
            const wx = c * CELL_SIZE;
            const wy = r * CELL_SIZE;

            // Base dark wall block
            ctx.fillStyle = '#11152a';
            ctx.fillRect(wx, wy, CELL_SIZE, CELL_SIZE);

            // Wall inner texture
            ctx.fillStyle = '#181f3d';
            ctx.fillRect(wx + 2, wy + 2, CELL_SIZE - 4, CELL_SIZE - 4);

            // Tech center core
            ctx.fillStyle = '#0f142b';
            ctx.fillRect(wx + 6, wy + 6, CELL_SIZE - 12, CELL_SIZE - 12);

            // Subtle neon border accent on perimeter
            ctx.strokeStyle = 'rgba(79, 70, 229, 0.35)';
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
        ctx.lineWidth = 2;
        ctx.strokeRect(sx + 3, sy + 3, CELL_SIZE - 6, CELL_SIZE - 6);
        ctx.font = 'bold 9px Orbitron, monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'center';
        ctx.fillText('START', sx + CELL_SIZE / 2, sy + CELL_SIZE - 6);
      }

      // --- 4. RENDER EXIT GATEWAY ---
      {
        const ex = EXIT_POS.c * CELL_SIZE;
        const ey = EXIT_POS.r * CELL_SIZE;
        const allCleared = completedCheckpoints.every(Boolean);

        // Background zone
        ctx.fillStyle = allCleared ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.15)';
        ctx.fillRect(ex, ey, CELL_SIZE, CELL_SIZE);

        // Pulsing portal ring
        const portalPulse = Math.sin(now / 150) * 3;
        ctx.strokeStyle = allCleared ? '#10b981' : '#f43f5e';
        ctx.shadowColor = allCleared ? '#10b981' : '#f43f5e';
        ctx.shadowBlur = allCleared ? 15 : 6;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(ex + CELL_SIZE / 2, ey + CELL_SIZE / 2, 14 + portalPulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.font = 'bold 9px Orbitron, monospace';
        ctx.fillStyle = allCleared ? '#34d399' : '#fda4af';
        ctx.textAlign = 'center';
        ctx.fillText(allCleared ? 'EXIT' : 'LOCK', ex + CELL_SIZE / 2, ey + CELL_SIZE / 2 + 3);
        ctx.shadowBlur = 0;
      }

      // --- 5. RENDER HAZARDS (DISAPPEARING / REAPPEARING) ---
      HAZARDS.forEach((hz) => {
        const hx = hz.c * CELL_SIZE + CELL_SIZE / 2;
        const hy = hz.r * CELL_SIZE + CELL_SIZE / 2;
        const cycleTime = (now + hz.offsetMs) % hz.periodMs;
        const isDangerous = cycleTime < hz.activeDurationMs;

        ctx.save();
        if (isDangerous) {
          // ACTIVE HAZARD: Fiery Pulsing Crimson Node & Arc Spikes
          const pulse = Math.sin(now / 80) * 3;
          ctx.shadowColor = '#ff003c';
          ctx.shadowBlur = 18;

          // Glowing background hazard zone
          ctx.fillStyle = 'rgba(255, 0, 60, 0.3)';
          ctx.fillRect(
            hz.c * CELL_SIZE + 2,
            hz.r * CELL_SIZE + 2,
            CELL_SIZE - 4,
            CELL_SIZE - 4
          );

          // Danger diamond / spike icon
          ctx.translate(hx, hy);
          ctx.rotate(now / 400);
          ctx.fillStyle = '#ff1744';
          ctx.beginPath();
          const s = 14 + pulse;
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
          ctx.arc(0, 0, 4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // INACTIVE HAZARD (ESCAPE GAP): Dimmed dormant silhouette + circular recharge progress
          const rechargeProgress =
            (cycleTime - hz.activeDurationMs) / (hz.periodMs - hz.activeDurationMs);

          ctx.fillStyle = 'rgba(255, 23, 68, 0.05)';
          ctx.fillRect(
            hz.c * CELL_SIZE + 2,
            hz.r * CELL_SIZE + 2,
            CELL_SIZE - 4,
            CELL_SIZE - 4
          );

          // Faint outline ring
          ctx.strokeStyle = 'rgba(255, 80, 80, 0.3)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(hx, hy, 12, 0, Math.PI * 2);
          ctx.stroke();

          // Charging arc showing player when it will reactivate
          ctx.strokeStyle = 'rgba(255, 50, 50, 0.8)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(hx, hy, 12, -Math.PI / 2, -Math.PI / 2 + rechargeProgress * Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = 'rgba(255, 120, 120, 0.6)';
          ctx.font = '8px monospace';
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
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, 15, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#34d399';
          ctx.font = 'bold 12px Orbitron, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('✓', cx, cy);
        } else {
          // ACTIVE CHECKPOINT: Pulsing Amber Golden Beacon
          const pulse = Math.sin(now / 200 + cp.id) * 3;
          ctx.shadowColor = '#f59e0b';
          ctx.shadowBlur = 14;

          // Outer beacon ring
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(cx, cy, 16 + pulse, 0, Math.PI * 2);
          ctx.stroke();

          // Inner disc
          ctx.fillStyle = '#1e1b4b';
          ctx.beginPath();
          ctx.arc(cx, cy, 13, 0, Math.PI * 2);
          ctx.fill();

          // Checkpoint Number
          ctx.fillStyle = '#fef08a';
          ctx.font = '900 13px Orbitron, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(cp.id), cx, cy + 1);
        }
        ctx.restore();
      });

      // --- 7. RENDER PLAYER TRAIL PARTICLES ---
      trailParticlesRef.current.forEach((tp) => {
        tp.alpha -= 0.04;
        if (tp.alpha > 0) {
          ctx.save();
          ctx.fillStyle = `rgba(0, 240, 255, ${tp.alpha * 0.4})`;
          ctx.beginPath();
          ctx.arc(tp.x, tp.y, 8 * tp.alpha, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });
      trailParticlesRef.current = trailParticlesRef.current.filter((tp) => tp.alpha > 0);

      // --- 8. RENDER PLAYER (THE BLUE THING) ---
      const px = playerRenderPosRef.current.x;
      const py = playerRenderPosRef.current.y;

      ctx.save();
      // Blinking if invulnerable
      if (isInvulnerable && Math.floor(now / 100) % 2 === 0) {
        ctx.globalAlpha = 0.35;
      }

      // Outer Cyan Ion Glow
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 20;

      // Drone Core Outer Ring
      const corePulse = Math.sin(now / 150) * 1.5;
      const playerRadius = 14 + corePulse;

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
      ctx.lineWidth = 2;
      ctx.stroke();

      // Cyber crosshair detail
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px - 5, py);
      ctx.lineTo(px + 5, py);
      ctx.moveTo(px, py - 5);
      ctx.lineTo(px, py + 5);
      ctx.stroke();

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    completedCheckpoints,
    invulnerableUntil,
    isHazardDangerous,
    onHitHazard,
    playerPos.c,
    playerPos.r,
  ]);

  return (
    <div className="relative w-full flex flex-col items-center select-none">
      <div className="relative border-2 border-slate-700/80 rounded-xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] bg-slate-950 max-w-full">
        <canvas
          ref={canvasRef}
          width={MAZE_COLS * CELL_SIZE}
          height={MAZE_ROWS * CELL_SIZE}
          className="block max-w-full h-auto aspect-[25/15]"
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
