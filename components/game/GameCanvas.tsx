// @ts-nocheck
"use client";

import { useEffect, useRef, useState } from "react";

type Mode = "single" | "duo";
type Player = {
  x: number;
  y: number;
  vy: number;
  w: number;
  h: number;
  grounded: boolean;
  color: string;
  spawnX: number;
  checkpoint: number;
  finished: boolean;
};
type Rect = { x: number; y: number; w: number; h: number };
type MovingHazard = Rect & { baseX: number; range: number; speed: number; phase: number };
type Rotator = { x: number; y: number; length: number; speed: number; angle: number };

const WORLD_W = 6600;
const WORLD_H = 720;
const START_TIME = 65;
const GRAVITY = 1900;
const RUN_SPEED = 330;
const SPRINT_SPEED = 475;
const JUMP = 720;
const PLAYER_W = 34;
const PLAYER_H = 72;

const platforms: Rect[] = [
  { x: 0, y: 580, w: 900, h: 140 },
  { x: 1040, y: 580, w: 620, h: 140 },
  { x: 1790, y: 530, w: 560, h: 190 },
  { x: 2480, y: 600, w: 630, h: 120 },
  { x: 3270, y: 540, w: 780, h: 180 },
  { x: 4210, y: 500, w: 850, h: 220 },
  { x: 5200, y: 570, w: 1400, h: 150 },
  { x: 1440, y: 450, w: 150, h: 24 },
  { x: 2720, y: 470, w: 180, h: 24 },
  { x: 3600, y: 410, w: 180, h: 24 },
  { x: 4560, y: 375, w: 220, h: 24 },
];

const staticHazards: Rect[] = [
  { x: 600, y: 540, w: 155, h: 40 },
  { x: 1180, y: 540, w: 145, h: 40 },
  { x: 1900, y: 490, w: 105, h: 40 },
  { x: 2580, y: 560, w: 165, h: 40 },
  { x: 3360, y: 500, w: 125, h: 40 },
  { x: 4290, y: 460, w: 170, h: 40 },
  { x: 5520, y: 530, w: 160, h: 40 },
  { x: 5750, y: 530, w: 95, h: 40 },
];

const movingHazards: MovingHazard[] = [
  { x: 1310, y: 360, w: 80, h: 28, baseX: 1310, range: 170, speed: 1.7, phase: 0 },
  { x: 2940, y: 430, w: 100, h: 28, baseX: 2940, range: 230, speed: 1.25, phase: 1.5 },
  { x: 3890, y: 310, w: 115, h: 28, baseX: 3890, range: 220, speed: 1.8, phase: 2.4 },
  { x: 4750, y: 300, w: 100, h: 28, baseX: 4750, range: 260, speed: 1.1, phase: 0.7 },
];

const rotators: Rotator[] = [
  { x: 1600, y: 500, length: 150, speed: 2.7, angle: 0 },
  { x: 2280, y: 430, length: 165, speed: -2.2, angle: 1 },
  { x: 3500, y: 430, length: 190, speed: 2.4, angle: 0.5 },
  { x: 5050, y: 450, length: 210, speed: -2.5, angle: 2 },
];

const checkpoints = [900, 1660, 2350, 3110, 4050, 5050, 5940];
const finishX = 6260;

function intersects(a: Player, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function pointDistanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function rotatorHitsPlayer(p: Player, r: Rotator) {
  const x1 = r.x - Math.cos(r.angle) * r.length;
  const y1 = r.y - Math.sin(r.angle) * r.length;
  const x2 = r.x + Math.cos(r.angle) * r.length;
  const y2 = r.y + Math.sin(r.angle) * r.length;
  return pointDistanceToSegment(p.x + p.w / 2, p.y + p.h / 2, x1, y1, x2, y2) < 18 + Math.min(p.w, p.h) * 0.25;
}

function createPlayer(color: string, x: number): Player {
  return { x, y: 480, vy: 0, w: PLAYER_W, h: PLAYER_H, grounded: false, color, spawnX: x, checkpoint: 0, finished: false };
}

export function GameCanvas({ mode, onExit }: { mode: Mode; onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"COUNTDOWN" | "RACE" | "PAUSED" | "FINISH" | "TIME">("COUNTDOWN");
  const [timeLeft, setTimeLeft] = useState(START_TIME);
  const [result, setResult] = useState("GET READY");
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const keys = new Set<string>();
    const previousKeys = new Set<string>();
    const players = [createPlayer("#ffe66d", 70)];
    if (mode === "duo") players.push(createPlayer("#69e7ff", 25));

    let running = true;
    let raceTime = 0;
    let countdownTime = 3.4;
    let paused = false;
    let winner = "";
    let last = performance.now();
    const statusRef = { current: "COUNTDOWN" as "COUNTDOWN" | "RACE" | "PAUSED" | "FINISH" | "TIME" };

    const down = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (["arrowup", "arrowleft", "arrowright", " "].includes(key)) e.preventDefault();
      keys.add(key);
      if (key === "escape") onExit();
      if (key === "p" && (statusRef.current === "RACE" || statusRef.current === "PAUSED")) {
        paused = !paused;
        statusRef.current = paused ? "PAUSED" : "RACE";
        setStatus(statusRef.current);
      }
      if (key === "r" && (winner || statusRef.current === "TIME")) reset();
    };
    const up = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    function reset() {
      players.forEach((p, i) => {
        p.x = i === 0 ? 70 : 25;
        p.y = 480;
        p.vy = 0;
        p.checkpoint = 0;
        p.spawnX = p.x;
        p.finished = false;
        p.grounded = false;
      });
      raceTime = 0;
      countdownTime = 3.4;
      winner = "";
      paused = false;
      statusRef.current = "COUNTDOWN";
      setStatus("COUNTDOWN");
      setResult("GET READY");
      setCountdown(3);
      setTimeLeft(START_TIME);
      last = performance.now();
    }

    function respawn(p: Player) {
      const cpX = p.checkpoint > 0 ? checkpoints[p.checkpoint - 1] : p.spawnX;
      p.x = cpX + 18;
      p.y = 430;
      p.vy = 0;
    }

    function updateHazards(t: number) {
      movingHazards.forEach((h) => { h.x = h.baseX + Math.sin(t * h.speed + h.phase) * h.range; });
      rotators.forEach((r) => { r.angle += r.speed * 0.016; });
    }

    function updatePlayer(p: Player, dt: number, p2: boolean) {
      const left = p2 ? keys.has("arrowleft") : keys.has("a");
      const right = p2 ? keys.has("arrowright") : keys.has("d");
      const jumpKey = p2 ? "arrowup" : "w";
      const jumpPressed = keys.has(jumpKey) && !previousKeys.has(jumpKey);
      const sprint = p2 ? keys.has("l") : keys.has("shift");
      const speed = sprint ? SPRINT_SPEED : RUN_SPEED;
      if (left) p.x -= speed * dt;
      if (right) p.x += speed * dt;
      p.x = Math.max(0, Math.min(WORLD_W - p.w, p.x));
      if (jumpPressed && p.grounded) { p.vy = -JUMP; p.grounded = false; }
      p.vy += GRAVITY * dt;
      const prevBottom = p.y + p.h;
      p.y += p.vy * dt;
      p.grounded = false;
      for (const b of platforms) {
        const horizontal = p.x + p.w > b.x && p.x < b.x + b.w;
        if (horizontal && prevBottom <= b.y && p.y + p.h >= b.y && p.vy >= 0) {
          p.y = b.y - p.h;
          p.vy = 0;
          p.grounded = true;
        }
      }
      const allHazards = [...staticHazards, ...movingHazards];
      if (allHazards.some((h) => intersects(p, h)) || rotators.some((r) => rotatorHitsPlayer(p, r)) || p.y > WORLD_H + 80) {
        respawn(p);
        return;
      }
      for (let i = p.checkpoint; i < checkpoints.length; i += 1) {
        if (p.x + p.w >= checkpoints[i]) {
          p.checkpoint = i + 1;
          p.spawnX = checkpoints[i];
        }
      }
    }

    function drawBackground(viewX: number, viewY: number, viewW: number, viewH: number, focusX: number) {
      const gradient = ctx.createLinearGradient(0, viewY, 0, viewY + viewH);
      gradient.addColorStop(0, "#091225");
      gradient.addColorStop(0.6, "#19364a");
      gradient.addColorStop(1, "#10211f");
      ctx.fillStyle = gradient;
      ctx.fillRect(viewX, viewY, viewW, viewH);
      ctx.save();
      ctx.beginPath(); ctx.rect(viewX, viewY, viewW, viewH); ctx.clip();
      const offset = ((focusX * 0.18) % 520 + 520) % 520;
      for (let i = -1; i < 10; i += 1) {
        const x = i * 520 - offset;
        ctx.fillStyle = "rgba(128,225,255,.055)"; ctx.fillRect(viewX + x, viewY + 70, 230, viewH - 120);
        ctx.fillStyle = "rgba(255,214,102,.035)"; ctx.fillRect(viewX + x + 100, viewY + 150, 75, viewH - 200);
      }
      ctx.restore();
    }

    function worldToScreen(worldX: number, cameraX: number, viewW: number) { return worldX - cameraX + viewW * 0.28; }

    function drawWorld(player: Player, viewX: number, viewY: number, viewW: number, viewH: number) {
      const cameraX = Math.max(0, Math.min(WORLD_W - viewW, player.x - viewW * 0.28));
      drawBackground(viewX, viewY, viewW, viewH, player.x);
      ctx.save(); ctx.beginPath(); ctx.rect(viewX, viewY, viewW, viewH); ctx.clip();
      for (const b of platforms) {
        const x = worldToScreen(b.x, cameraX, viewW);
        ctx.fillStyle = "#17251f"; ctx.fillRect(x, viewY + b.y, b.w, b.h);
        ctx.fillStyle = "#65d67a"; ctx.fillRect(x, viewY + b.y, b.w, 6);
      }
      for (let x = 0; x < WORLD_W; x += 80) {
        const sx = worldToScreen(x, cameraX, viewW);
        ctx.strokeStyle = "rgba(143,232,111,.2)"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(sx, viewY + 580); ctx.lineTo(sx + 36, viewY + 548); ctx.stroke();
      }
      for (const h of [...staticHazards, ...movingHazards]) {
        const x = worldToScreen(h.x, cameraX, viewW);
        ctx.fillStyle = "#ff4264"; ctx.fillRect(x, viewY + h.y, h.w, h.h);
        ctx.fillStyle = "#ffd6dc";
        for (let spike = 0; spike < h.w; spike += 20) {
          ctx.beginPath(); ctx.moveTo(x + spike, viewY + h.y); ctx.lineTo(x + spike + 10, viewY + h.y - 16); ctx.lineTo(x + spike + 20, viewY + h.y); ctx.fill();
        }
      }
      for (const r of rotators) {
        const cx = worldToScreen(r.x, cameraX, viewW); const cy = viewY + r.y;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(r.angle);
        ctx.strokeStyle = "#ffae48"; ctx.lineWidth = 15; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(-r.length, 0); ctx.lineTo(r.length, 0); ctx.stroke();
        ctx.fillStyle = "#ffe6a3"; ctx.beginPath(); ctx.arc(-r.length, 0, 12, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(r.length, 0, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#25180a"; ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      checkpoints.forEach((cx, i) => {
        const sx = worldToScreen(cx, cameraX, viewW);
        ctx.strokeStyle = i < player.checkpoint ? "#6de6a1" : "#b6c9db55"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(sx, viewY + 430); ctx.lineTo(sx, viewY + 585); ctx.stroke();
        ctx.fillStyle = i < player.checkpoint ? "#6de6a1" : "#7c8ba2";
        ctx.beginPath(); ctx.moveTo(sx, viewY + 435); ctx.lineTo(sx + 55, viewY + 450); ctx.lineTo(sx, viewY + 468); ctx.fill();
        ctx.font = "700 10px system-ui"; ctx.fillText(`CP ${i + 1}`, sx + 6, viewY + 425);
      });
      const fx = worldToScreen(finishX, cameraX, viewW);
      ctx.fillStyle = "#f4f0db"; ctx.fillRect(fx, viewY + 330, 12, 255); ctx.fillRect(fx + 190, viewY + 330, 12, 255);
      for (let row = 0; row < 4; row += 1) for (let col = 0; col < 5; col += 1) { ctx.fillStyle = (row + col) % 2 === 0 ? "#151b29" : "#f4f0db"; ctx.fillRect(fx + 12 + col * 36, viewY + 340 + row * 24, 36, 24); }
      ctx.font = "900 24px system-ui"; ctx.fillStyle = "#ff5b73"; ctx.fillText("FINISH", fx + 39, viewY + 325);
      ctx.restore();
      drawPlayer(player, cameraX, viewX, viewY, viewW);
    }

    function drawPlayer(p: Player, cameraX: number, _viewX: number, viewY: number, viewW: number) {
      const x = worldToScreen(p.x, cameraX, viewW) + p.w / 2; const y = viewY + p.y + p.h / 2;
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(0, 40, 28, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.roundRect(-18, -36, 36, 72, 16); ctx.fill();
      ctx.fillStyle = "#121827"; ctx.beginPath(); ctx.arc(-7, -15, 4, 0, Math.PI * 2); ctx.arc(7, -15, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#121827"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, -2, 9, 0, Math.PI); ctx.stroke();
      const step = Math.sin(performance.now() * 0.015) * 4; ctx.strokeStyle = p.color; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(-15, 8); ctx.lineTo(-28, 29 + step); ctx.moveTo(15, 8); ctx.lineTo(28, 29 - step); ctx.stroke(); ctx.restore();
    }

    function frame(now: number) {
      if (!running) return;
      const dt = Math.min(0.033, (now - last) / 1000); last = now;
      if (!paused) {
        if (statusRef.current === "COUNTDOWN") {
          countdownTime -= dt; const shown = Math.max(1, Math.ceil(countdownTime - 0.15)); setCountdown(shown);
          if (countdownTime <= 0) { statusRef.current = "RACE"; setStatus("RACE"); setResult(""); raceTime = 0; setTimeLeft(START_TIME); }
        } else if (statusRef.current === "RACE") {
          raceTime += dt; setTimeLeft(Math.max(0, START_TIME - raceTime)); updateHazards(raceTime);
          updatePlayer(players[0], dt, false); if (players[1]) updatePlayer(players[1], dt, true);
          const finisher = players.findIndex((p) => p.x >= finishX);
          if (finisher >= 0) {
            players[finisher].finished = true; winner = mode === "duo" ? `PLAYER ${finisher + 1} WINS` : "COURSE CLEARED";
            statusRef.current = "FINISH"; setStatus("FINISH"); setResult(`${winner} · ${raceTime.toFixed(2)}s · Press R to race again`);
          } else if (raceTime >= START_TIME) { statusRef.current = "TIME"; setStatus("TIME"); setResult("TIME UP · Press R to try again"); }
        }
      }
      const dpr = Math.min(2, window.devicePixelRatio || 1); const cssW = Math.max(320, canvas.clientWidth || window.innerWidth); const cssH = Math.max(240, canvas.clientHeight || window.innerHeight);
      canvas.width = Math.floor(cssW * dpr); canvas.height = Math.floor(cssH * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#06101a"; ctx.fillRect(0, 0, cssW, cssH);
      if (players.length === 1) drawWorld(players[0], 0, 0, cssW, cssH);
      else { const half = cssH / 2; drawWorld(players[0], 0, 0, cssW, half); drawWorld(players[1], 0, half, cssW, half); ctx.strokeStyle = "#ffffff66"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, half); ctx.lineTo(cssW, half); ctx.stroke(); ctx.fillStyle = "#07101dcc"; ctx.fillRect(18, half - 33, 118, 26); ctx.fillStyle = "#ffffff"; ctx.font = "700 12px system-ui"; ctx.fillText("PLAYER 2 VIEW", 30, half - 15); }
      ctx.fillStyle = "#07101de6"; ctx.fillRect(16, 16, cssW - 32, 62);
      ctx.fillStyle = "#fff"; ctx.font = "900 21px system-ui"; ctx.fillText(`DASHTRASH · ${mode === "duo" ? "2P SPLIT" : "1P RACE"}`, 30, 43);
      ctx.font = "700 12px system-ui"; ctx.fillStyle = "#8fa5bf"; ctx.fillText("P = PAUSE · R = RESTART AFTER RACE · ESC = MENU", 30, 63);
      ctx.textAlign = "right"; ctx.font = "900 24px system-ui"; ctx.fillStyle = timeLeft < 10 ? "#ff617b" : "#8ff0b0"; ctx.fillText(`${timeLeft.toFixed(1)}s`, cssW - 28, 48); ctx.textAlign = "left";
      if (statusRef.current === "COUNTDOWN") { ctx.fillStyle = "#0008"; ctx.fillRect(0, 0, cssW, cssH); ctx.textAlign = "center"; ctx.font = "900 112px system-ui"; ctx.fillStyle = countdown <= 1 ? "#ff5c72" : "#fff"; ctx.fillText(String(countdown), cssW / 2, cssH / 2); ctx.font = "700 15px system-ui"; ctx.fillStyle = "#bdc8d7"; ctx.fillText("RUN BEFORE THE CLOCK RUNS OUT", cssW / 2, cssH / 2 + 55); ctx.textAlign = "left"; }
      else if (statusRef.current === "PAUSED" || statusRef.current === "FINISH" || statusRef.current === "TIME") { ctx.fillStyle = "#0009"; ctx.fillRect(0, 0, cssW, cssH); ctx.textAlign = "center"; ctx.font = "900 54px system-ui"; ctx.fillStyle = statusRef.current === "FINISH" ? "#8ff0b0" : "#fff"; ctx.fillText(statusRef.current, cssW / 2, cssH / 2 - 18); ctx.font = "700 18px system-ui"; ctx.fillStyle = "#d6deea"; ctx.fillText(statusRef.current === "PAUSED" ? "Press P to resume" : result, cssW / 2, cssH / 2 + 28); ctx.textAlign = "left"; }
      previousKeys.clear(); keys.forEach((key) => previousKeys.add(key));
      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
    return () => { running = false; window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [mode, onExit]);

  return (
    <div className="game-wrap">
      <canvas ref={canvasRef} aria-label="DashTrash racing game" />
      <button className="exit-button" onClick={onExit}>ESC · MENU</button>
      <div className="controls-card">P1: <b>A D W</b> + SHIFT · {mode === "duo" ? <>P2: <b>← → ↑</b> + L · P = PAUSE</> : <>P = PAUSE</>}</div>
    </div>
  );
}
