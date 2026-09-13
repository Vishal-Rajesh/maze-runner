import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FlyingLetter, Sparkle, CheckpointConfig } from '../types';
import { CHECKPOINTS } from '../data/mazeData';
import { sound } from '../utils/sound';
import { Heart, Bomb, ShieldAlert, Sparkles, Zap, Timer } from 'lucide-react';

interface LetterSmasherMinigameProps {
  checkpointId: number; // 1 to 5
  checkpointConfig?: CheckpointConfig;
  lives: number;
  onSuccess: () => void;
  onLoseLife: (reason: string) => void;
  onAbort?: () => void;
}

// Clear, easily distinguishable letters (avoiding easily confused glyphs if desired)
const REGULAR_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'.split('');
const BOMB_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export const LetterSmasherMinigame: React.FC<LetterSmasherMinigameProps> = ({
  checkpointId,
  checkpointConfig,
  lives,
  onSuccess,
  onLoseLife,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cpConfig = checkpointConfig || CHECKPOINTS.find((c) => c.id === checkpointId) || CHECKPOINTS[0];
  const targetCount = cpConfig.targetCount;

  const [smashedCount, setSmashedCount] = useState(0);
  const [combo, setCombo] = useState(0);
  const [lastEvent, setLastEvent] = useState<{ text: string; color: string } | null>(null);

  // References to keep game loop in sync
  const lettersRef = useRef<
    (FlyingLetter & { spawnTime: number; totalAirDuration: number })[]
  >([]);
  const sparklesRef = useRef<Sparkle[]>([]);
  const bladePointsRef = useRef<{ x: number; y: number; time: number }[]>([]);
  const isFinishedRef = useRef(false);
  const smashedRef = useRef(0);
  const livesRef = useRef(lives);
  livesRef.current = lives;

  const shakeRef = useRef(0);
  const spawnTimerRef = useRef<number | null>(null);

  // Clear event notification
  const triggerEventToast = useCallback((text: string, color: string) => {
    setLastEvent({ text, color });
    setTimeout(() => setLastEvent(null), 1500);
  }, []);

  // Spawn physics calibrated for 3.5 to 4.8 seconds of crystal-clear on-screen visibility
  const spawnLetter = useCallback(() => {
    if (isFinishedRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.width;
    const height = canvas.height;

    // Checkpoint difficulty scaling
    const bombProb = cpConfig.bombChance;

    // At checkpoints 4 & 5, occasionally launch 2 letters with a slight gap
    const count = checkpointId >= 4 && Math.random() < 0.35 ? 2 : 1;

    for (let i = 0; i < count; i++) {
      const isBomb = Math.random() < bombProb;
      const char = isBomb
        ? BOMB_CHARS[Math.floor(Math.random() * BOMB_CHARS.length)]
        : REGULAR_CHARS[Math.floor(Math.random() * REGULAR_CHARS.length)];

      // Launch position across bottom width (safe margin of 140px on left and right)
      const x = 140 + Math.random() * (width - 280);
      const y = height + 10;

      // Gentle horizontal drift towards center
      const targetCenterX = width / 2;
      const horizontalDir = (targetCenterX - x) / (width * 0.5);
      const vx = (Math.random() * 1.4 - 0.7 + horizontalDir * 0.6);

      // Physics: Apex around y = 80px, total airtime 3.6 to 4.5 seconds
      // g between 0.052 (CP1) and 0.072 (CP5)
      // vy between -6.2 and -7.5
      const baseG = 0.052 + (checkpointId - 1) * 0.005;
      const initialVy = -(6.3 + (checkpointId - 1) * 0.3 + (Math.random() - 0.5) * 0.4);

      // Approximate flight duration in ms: 2 * |vy| / g frames * 16.6ms
      const flightDurationMs = Math.round((2 * Math.abs(initialVy) / baseG) * (1000 / 60));

      lettersRef.current.push({
        id: Math.random().toString(36).substring(2, 9),
        char,
        isBomb,
        x,
        y,
        vx,
        vy: initialVy,
        radius: 42, // Extra large for maximum legibility
        rotation: (Math.random() - 0.5) * 0.2,
        rotationSpeed: (Math.random() - 0.5) * 0.015,
        sliced: false,
        sliceAngle: 0,
        sliceProgress: 0,
        sparkles: [],
        spawnTime: performance.now() + i * 280,
        totalAirDuration: flightDurationMs,
      });
    }
  }, [checkpointId, cpConfig]);

  // Handle smashing a letter (by key or slice)
  const smashLetter = useCallback(
    (letter: FlyingLetter, hitAngle: number = Math.PI / 4) => {
      if (letter.sliced || isFinishedRef.current) return;

      letter.sliced = true;
      letter.sliceAngle = hitAngle;

      // Generate burst sparkles
      for (let i = 0; i < 24; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 2 + Math.random() * 8;
        sparklesRef.current.push({
          x: letter.x,
          y: letter.y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          color: letter.isBomb ? '#ff2a55' : '#00f0ff',
          life: 1,
          maxLife: 0.45 + Math.random() * 0.4,
          size: 3 + Math.random() * 5,
        });
      }

      if (letter.isBomb) {
        // Punish player for typing a bomb!
        shakeRef.current = 20;
        sound.playBombExplosion();
        triggerEventToast(`BOMB DETONATED (${letter.char})! -1 LIFE`, 'text-red-500');
        setCombo(0);
        onLoseLife(`Detonated Bomb Letter '${letter.char}'`);
      } else {
        // Valid letter smash!
        sound.playSlice();
        smashedRef.current += 1;
        setSmashedCount(smashedRef.current);
        setCombo((prev) => prev + 1);

        if (smashedRef.current >= targetCount) {
          isFinishedRef.current = true;
          sound.playCheckpointReached();
          triggerEventToast('CHECKPOINT DECRYPTED!', 'text-emerald-400');
          setTimeout(() => {
            onSuccess();
          }, 850);
        }
      }
    },
    [onLoseLife, onSuccess, targetCount, triggerEventToast]
  );

  // Keyboard handler: Smashes matching active letter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFinishedRef.current) return;
      const key = e.key.toUpperCase();
      if (key.length !== 1 || key < 'A' || key > 'Z') return;

      // Look for flying unsliced letters with this key currently on screen
      const activeLetters = lettersRef.current.filter(
        (l) => !l.sliced && l.char === key && l.y < (canvasRef.current?.height || 600) + 15
      );

      if (activeLetters.length > 0) {
        // Prioritize the letter nearest to apex or lowest
        activeLetters.sort((a, b) => b.y - a.y);
        smashLetter(activeLetters[0], Math.PI / 4 + (Math.random() - 0.5) * 0.3);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [smashLetter]);

  // Mouse / Touch blade slicing support
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let isMouseDown = false;

    const addBladePoint = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (clientX - rect.left) * scaleX;
      const y = (clientY - rect.top) * scaleY;

      bladePointsRef.current.push({ x, y, time: performance.now() });

      // Check collision with any letter
      lettersRef.current.forEach((l) => {
        if (l.sliced) return;
        const dx = l.x - x;
        const dy = l.y - y;
        if (Math.hypot(dx, dy) < l.radius + 15) {
          smashLetter(l, Math.atan2(dy, dx) + Math.PI / 2);
        }
      });
    };

    const handleMouseDown = (e: MouseEvent) => {
      isMouseDown = true;
      addBladePoint(e.clientX, e.clientY);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isMouseDown) return;
      addBladePoint(e.clientX, e.clientY);
    };

    const handleMouseUp = () => {
      isMouseDown = false;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        addBladePoint(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        addBladePoint(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
    };
  }, [smashLetter]);

  // Main game loop (physics, gravity, rendering)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Relaxed spawn interval: 1.8s - 2.2s so letters don't overwhelm and are clearly visible for 3-5s
    const spawnInterval = Math.max(1700, 2200 - checkpointId * 100);
    spawnTimerRef.current = window.setInterval(spawnLetter, spawnInterval);
    spawnLetter(); // immediate initial spawn

    let animId: number;
    let lastTime = performance.now();
    // Gentle gravity: ensures ~3.8 to 4.5 seconds of flight time!
    const gravity = 0.052 + (checkpointId - 1) * 0.005;

    const render = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      // Screen shake decay
      if (shakeRef.current > 0) {
        shakeRef.current *= 0.88;
        if (shakeRef.current < 0.2) shakeRef.current = 0;
      }

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (shakeRef.current > 0) {
        const sx = (Math.random() - 0.5) * shakeRef.current * 2;
        const sy = (Math.random() - 0.5) * shakeRef.current * 2;
        ctx.translate(sx, sy);
      }

      // 1. Cyber background grid
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.35)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 60) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // 2. Update & Draw Blade Trail
      const nowMs = performance.now();
      bladePointsRef.current = bladePointsRef.current.filter((p) => nowMs - p.time < 200);
      if (bladePointsRef.current.length > 1) {
        ctx.beginPath();
        ctx.moveTo(bladePointsRef.current[0].x, bladePointsRef.current[0].y);
        for (let i = 1; i < bladePointsRef.current.length; i++) {
          const pt = bladePointsRef.current[i];
          const age = (nowMs - pt.time) / 200;
          ctx.strokeStyle = `rgba(0, 240, 255, ${1 - age})`;
          ctx.lineWidth = Math.max(1.5, (1 - age) * 9);
          ctx.lineTo(pt.x, pt.y);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y);
        }
      }

      // 3. Update & Draw Sparkles
      sparklesRef.current.forEach((sp) => {
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.life -= dt / sp.maxLife;

        if (sp.life > 0) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, sp.life);
          ctx.fillStyle = sp.color;
          ctx.shadowColor = sp.color;
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, sp.size * sp.life, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });
      sparklesRef.current = sparklesRef.current.filter((sp) => sp.life > 0);

      // 4. Update & Draw Letters
      const floor = canvas.height + 45;
      lettersRef.current.forEach((letter) => {
        // Physics step
        letter.vy += gravity;
        letter.x += letter.vx;
        letter.y += letter.vy;
        letter.rotation += letter.rotationSpeed;

        if (letter.sliced) {
          letter.sliceProgress = Math.min(1, letter.sliceProgress + dt * 3.2);
        }

        // Check if letter fell off screen without being smashed
        if (!letter.sliced && letter.vy > 0 && letter.y > floor - 10) {
          letter.sliced = true; // mark processed
          if (!letter.isBomb) {
            // Missed normal letter: player loses a life!
            sound.playMiss();
            shakeRef.current = 12;
            triggerEventToast(`MISSED LETTER '${letter.char}'! -1 LIFE`, 'text-amber-400');
            setCombo(0);
            onLoseLife(`Missed Letter '${letter.char}'`);
          }
          // Note: If bomb drops off screen, safe! No penalty.
        }

        // DRAW LETTER
        ctx.save();
        ctx.translate(letter.x, letter.y);
        ctx.rotate(letter.rotation);

        const r = letter.radius;

        if (!letter.sliced) {
          // --- UNSLICED FLYING LETTER ---
          if (letter.isBomb) {
            // ==========================================
            // BOMB LETTER: Distinct Red Warning Background
            // ==========================================
            const pulse = Math.sin(now / 110) * 4;

            // Outer red glow
            ctx.shadowColor = '#ff1144';
            ctx.shadowBlur = 18 + pulse;

            // Red warning background disc / rounded squircle
            const bgGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, r + 4);
            bgGrad.addColorStop(0, '#ff3b30');
            bgGrad.addColorStop(0.65, '#dc2626');
            bgGrad.addColorStop(1, '#7f1d1d');
            ctx.fillStyle = bgGrad;
            ctx.beginPath();
            ctx.roundRect(-r, -r, r * 2, r * 2, 16);
            ctx.fill();

            // Bright Hazard border
            ctx.lineWidth = 3.5;
            ctx.strokeStyle = '#fecaca';
            ctx.stroke();

            // Ticking spark fuse on top-right
            ctx.fillStyle = '#facc15';
            ctx.shadowColor = '#facc15';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(r - 4, -r + 2, 6 + Math.sin(now / 70) * 2, 0, Math.PI * 2);
            ctx.fill();

            // BOMB Header Badge
            ctx.shadowColor = '#000000';
            ctx.shadowBlur = 6;
            ctx.font = 'bold 11px Orbitron, monospace';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText('⚠ BOMB ⚠', 0, -r + 6);

            // Sub-warning text
            ctx.font = 'bold 8px sans-serif';
            ctx.fillStyle = '#fca5a5';
            ctx.fillText('DO NOT TYPE', 0, -r + 19);

            // ACTUAL LETTER IN CENTER - Crisp, Huge, High Contrast
            ctx.shadowColor = '#000000';
            ctx.shadowBlur = 8;
            ctx.font = '900 36px Orbitron, sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(letter.char, 0, 12);
          } else {
            // ==========================================
            // REGULAR SMASHABLE LETTER: Cyan Cyber Disc
            // ==========================================
            // Subtle floating glow
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 18;

            const bgGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, r);
            bgGrad.addColorStop(0, '#0284c7');
            bgGrad.addColorStop(0.7, '#0369a1');
            bgGrad.addColorStop(1, '#082f49');
            ctx.fillStyle = bgGrad;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();

            // Glowing neon cyan border
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#38bdf8';
            ctx.stroke();

            // Inner circuit ring
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, 0, r - 7, 0, Math.PI * 2);
            ctx.stroke();

            // Center Letter - Huge, Bold, High Contrast
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 10;
            ctx.font = '900 36px Orbitron, sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(letter.char, 0, -3);

            // Keyboard hint pill under the letter
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
            ctx.beginPath();
            ctx.roundRect(-22, r - 18, 44, 15, 4);
            ctx.fill();
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.font = 'bold 9px monospace';
            ctx.fillStyle = '#7dd3fc';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`KEY [${letter.char}]`, 0, r - 10);
          }
        } else if (letter.sliceProgress < 1 && !letter.isBomb) {
          // --- SLICED HALVES FLYING APART ---
          const splitOffset = letter.sliceProgress * 48;
          ctx.shadowBlur = 12;
          ctx.shadowColor = '#00f0ff';

          // Half 1 (flying left)
          ctx.save();
          ctx.translate(-splitOffset, -splitOffset * 0.5);
          ctx.rotate(-letter.sliceProgress * 0.6);
          ctx.fillStyle = '#0ea5e9';
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI);
          ctx.fill();
          ctx.font = '900 32px Orbitron, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText(letter.char, 0, 0);
          ctx.restore();

          // Half 2 (flying right)
          ctx.save();
          ctx.translate(splitOffset, splitOffset * 0.5);
          ctx.rotate(letter.sliceProgress * 0.6);
          ctx.fillStyle = '#0369a1';
          ctx.beginPath();
          ctx.arc(0, 0, r, Math.PI, Math.PI * 2);
          ctx.fill();
          ctx.font = '900 32px Orbitron, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText(letter.char, 0, 0);
          ctx.restore();
        }

        ctx.restore();
      });

      // Filter out dead offscreen letters
      lettersRef.current = lettersRef.current.filter((l) => l.y < floor + 60);

      ctx.restore();

      if (!isFinishedRef.current) {
        animId = requestAnimationFrame(render);
      }
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      if (spawnTimerRef.current) clearInterval(spawnTimerRef.current);
    };
  }, [checkpointId, cpConfig, onLoseLife, spawnLetter, triggerEventToast]);

  const progressPercent = Math.min(100, Math.round((smashedCount / targetCount) * 100));

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-between bg-slate-950/92 backdrop-blur-md p-4 select-none">
      {/* Top Banner HUD */}
      <div className="w-full max-w-4xl flex items-center justify-between border-b border-cyan-500/30 pb-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 text-xs font-bold font-mono">
            CP{checkpointId}
          </span>
          <h2 className="text-lg font-black text-cyan-300 font-mono tracking-wider">
            CHECKPOINT {checkpointId}/5
          </h2>
        </div>

        {/* Lives counter */}
        <div className="flex items-center gap-3">
          {combo > 1 && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold">
              <Zap className="w-3 h-3" />
              x{combo}
            </div>
          )}
          <div className="flex items-center gap-1 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-700">
            {Array.from({ length: 5 }).map((_, i) => (
              <Heart
                key={i}
                className={`w-4 h-4 ${
                  i < lives
                    ? 'text-red-500 fill-red-500 drop-shadow-[0_0_6px_rgba(239,68,68,0.8)]'
                    : 'text-slate-700'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Main Interactive Stage */}
      <div className="relative w-full max-w-4xl flex-1 my-2 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={860}
          height={480}
          className="w-full h-full max-h-[500px] rounded-xl border border-cyan-500/25 bg-slate-950 shadow-[0_0_35px_rgba(0,240,255,0.12)] cursor-crosshair"
        />

        {/* Dynamic Center Alerts (Toasts) */}
        {lastEvent && (
          <div
            className={`absolute top-10 px-4 py-2 rounded-lg bg-slate-900/95 border border-slate-700 shadow-2xl text-base font-bold font-['Orbitron'] tracking-wide animate-bounce ${lastEvent.color}`}
          >
            {lastEvent.text}
          </div>
        )}

        {/* Controls Hint */}
        <div className="absolute bottom-2.5 left-4 right-4 flex items-center justify-between text-[11px] text-slate-400 pointer-events-none bg-slate-900/80 backdrop-blur-sm px-3 py-1 rounded border border-slate-800 font-mono">
          <span>Type letter or drag mouse to smash</span>
          <span className="text-red-400 font-bold">Avoid Red Bombs (-1 Life)</span>
        </div>
      </div>

      {/* Bottom Progress Bar */}
      <div className="w-full max-w-4xl flex items-center gap-4 bg-slate-900/80 p-3 rounded-lg border border-slate-800">
        <div className="text-sm font-mono font-bold text-cyan-300 min-w-[140px]">
          SMASHED: {smashedCount} / {targetCount}
        </div>
        <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 transition-all duration-200"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="text-xs font-mono text-slate-400">{progressPercent}%</div>
      </div>
    </div>
  );
};
