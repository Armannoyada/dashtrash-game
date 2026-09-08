"use client";

import { useEffect, useRef, useState } from "react";

type Mode = "single" | "duo";

type Player = { x: number; y: number; vy: number; w: number; h: number; grounded: boolean; color: string; spawnX: number };
type Block = { x: number; y: number; w: number; h: number; kind?: "solid" | "hazard" | "finish" };

const WORLD_W = 5200;
const WORLD_H = 720;
const START_TIME = 55;
const GRAVITY = 1800;
const RUN_SPEED = 330;
const SPRINT_SPEED = 460;
const JUMP = 700;

const platforms: Block[] = [
  { x: 0, y: 580, w: 950, h: 140 }, { x: 1100, y: 580, w: 620, h: 140 },
  { x: 1850, y: 520, w: 520, h: 200 }, { x: 2500, y: 600, w: 680, h: 120 },
  { x: 3300, y: 540, w: 720, h: 180 }, { x: 4140, y: 480, w: 1060, h: 240 },
];
const hazards: Block[] = [
  { x: 640, y: 540, w: 150, h: 40, kind: "hazard" }, { x: 1260, y: 540, w: 150, h: 40, kind: "hazard" },
  { x: 2020, y: 480, w: 90, h: 40, kind: "hazard" }, { x: 2730, y: 560, w: 170, h: 40, kind: "hazard" },
  { x: 3510, y: 500, w: 120, h: 40, kind: "hazard" }, { x: 4410, y: 440, w: 150, h: 40, kind: "hazard" },
];

function intersect(a: Player, b: Block) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function createPlayer(color: string, x: number): Player {
  return { x, y: 480, vy: 0, w: 34, h: 72, grounded: false, color, spawnX: x };
}

export function GameCanvas({ mode, onExit }: { mode: Mode; onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("RACE");
  const [timeLeft, setTimeLeft] = useState(START_TIME);
  const [result, setResult] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const keys = new Set<string>();
    const players = [createPlayer("#ffef70", 90)];
    if (mode === "duo") players.push(createPlayer("#75e6ff", 40));

    let running = true;
    let elapsed = 0;
    let last = performance.now();
    let winner = "";

    const keydown = (e: KeyboardEvent) => {
      keys.add(e.key.toLowerCase());
      if (["arrowup", "arrowleft", "arrowright", " "].includes(e.key.toLowerCase())) e.preventDefault();
      if (e.key.toLowerCase() === "r" && !running) reset();
      if (e.key === "Escape") onExit();
    };
    const keyup = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);

    function reset() {
      players[0].x = 90; players[0].y = 480; players[0].vy = 0;
      if (players[1]) { players[1].x = 40; players[1].y = 480; players[1].vy = 0; }
      elapsed = 0; winner = ""; running = true; setStatus("RACE"); setResult(""); setTimeLeft(START_TIME);
      last = performance.now();
    }

    function respawn(p: Player) { p.x = p.spawnX; p.y = 430; p.vy = 0; }

    function updatePlayer(p: Player, dt: number, p2: boolean) {
      const left = p2 ? keys.has("arrowleft") : keys.has("a");
      const right = p2 ? keys.has("arrowright") : keys.has("d");
      const jump = p2 ? keys.has("arrowup") : keys.has("w") || keys.has(" ");
      const sprint = p2 ? keys.has("l") : keys.has("shift");
      const speed = sprint ? SPRINT_SPEED : RUN_SPEED;
      if (left) p.x -= speed * dt;
      if (right) p.x += speed * dt;
      p.x = Math.max(0, Math.min(WORLD_W - p.w, p.x));
      if (jump && p.grounded) { p.vy = -JUMP; p.grounded = false; }
      p.vy += GRAVITY * dt;
      const prevBottom = p.y + p.h;
      p.y += p.vy * dt;
      p.grounded = false;
      for (const b of platforms) {
        const horizontal = p.x + p.w > b.x && p.x < b.x + b.w;
        if (horizontal && prevBottom <= b.y && p.y + p.h >= b.y && p.vy >= 0) {
          p.y = b.y - p.h; p.vy = 0; p.grounded = true;
        }
      }
      for (const h of hazards) if (intersect(p, h)) respawn(p);
      if (p.y > WORLD_H + 100) respawn(p);
    }

    function cameraFor(p: Player, width: number) {
      return Math.max(0, Math.min(WORLD_W - width, p.x - width * 0.32));
    }

    function drawScene(p: Player, viewX: number, viewW: number, viewY: number, height: number) {
      const gradient = ctx.createLinearGradient(0, viewY, 0, viewY + height);
      gradient.addColorStop(0, "#10172f"); gradient.addColorStop(1, "#253f54");
      ctx.fillStyle = gradient; ctx.fillRect(viewX, viewY, viewW, height);
      ctx.save(); ctx.beginPath(); ctx.rect(viewX, viewY, viewW, height); ctx.clip(); ctx.translate(viewX, viewY);
      const horizon = 410;
      ctx.fillStyle = "rgba(120,220,255,.08)";
      for (let i = 0; i < 14; i++) ctx.fillRect((i * 430 - 120) - (p.x * .18 % 430), 80, 170, 330);
      ctx.fillStyle = "#17231f";
      for (const b of platforms) { ctx.fillRect(b.x - p.x + viewW * .32, b.y, b.w, b.h); }
      ctx.strokeStyle = "#8fe86f"; ctx.lineWidth = 4;
      for (let x = 0; x < WORLD_W; x += 80) { ctx.beginPath(); ctx.moveTo(x - p.x + viewW * .32, 580); ctx.lineTo(x - p.x + viewW * .32 + 38, 540); ctx.stroke(); }
      for (const h of hazards) {
        ctx.fillStyle = "#ff4d67"; ctx.fillRect(h.x - p.x + viewW * .32, h.y, h.w, h.h);
        ctx.fillStyle = "#ffd5d9"; for (let x = 0; x < h.w; x += 20) { ctx.beginPath(); ctx.moveTo(h.x - p.x + viewW * .32 + x, h.y); ctx.lineTo(h.x - p.x + viewW * .32 + x + 10, h.y - 16); ctx.lineTo(h.x - p.x + viewW * .32 + x + 20, h.y); ctx.fill(); }
      }
      const fx = 4960 - p.x + viewW * .32;
      ctx.fillStyle = "#f7f1cf"; ctx.fillRect(fx, 350, 10, 230); ctx.fillRect(fx + 190, 350, 10, 230);
      ctx.fillStyle = "#ff4e70"; ctx.beginPath(); ctx.moveTo(fx + 10, 360); ctx.lineTo(fx + 190, 360); ctx.lineTo(fx + 190, 410); ctx.lineTo(fx + 10, 410); ctx.fill();
      ctx.font = "bold 26px system-ui"; ctx.fillStyle = "white"; ctx.fillText("FINISH", fx + 35, 395);
      ctx.restore();
    }

    function drawPlayer(p: Player, viewX: number, viewW: number, viewY: number) {
      const x = p.x - cameraFor(p, viewW) + viewX;
      const y = p.y + viewY;
      ctx.save();
      ctx.translate(x + p.w / 2, y + p.h / 2);
      ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(0, 38, 28, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.roundRect(-17, -36, 34, 72, 16); ctx.fill();
      ctx.fillStyle = "#111827"; ctx.beginPath(); ctx.arc(-7, -15, 4, 0, Math.PI * 2); ctx.arc(7, -15, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#111827"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, -3, 9, 0, Math.PI); ctx.stroke();
      ctx.strokeStyle = p.color; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(-16, 8); ctx.lineTo(-29, 29); ctx.moveTo(16, 8); ctx.lineTo(29, 29); ctx.stroke();
      ctx.restore();
    }

    function frame(now: number) {
      if (!running) return;
      const dt = Math.min(0.033, (now - last) / 1000); last = now; elapsed += dt;
      const remain = Math.max(0, START_TIME - elapsed); setTimeLeft(remain);
      updatePlayer(players[0], dt, false); if (players[1]) updatePlayer(players[1], dt, true);
      if (!winner && players.some(p => p.x >= 4920)) { winner = players[0].x >= 4920 ? "PLAYER 1 WINS" : "PLAYER 2 WINS"; running = false; setStatus("FINISH"); setResult(winner + " · Press R to race again"); }
      if (!winner && remain <= 0) { running = false; setStatus("TIME"); setResult("TIME UP · Press R to try again"); }
      const w = canvas.clientWidth * (window.devicePixelRatio || 1), h = canvas.clientHeight * (window.devicePixelRatio || 1);
      canvas.width = w; canvas.height = h; ctx.setTransform(1,0,0,1,0,0);
      ctx.fillStyle = "#07101d"; ctx.fillRect(0,0,w,h);
      if (players.length === 1) { drawScene(players[0], 0, w, 0, h); drawPlayer(players[0], 0, w, 0); }
      else { const half = w / 2; drawScene(players[0], 0, half, 0, h/2); drawPlayer(players[0],0,half,0); drawScene(players[1],0,half,h/2,h/2); drawPlayer(players[1],0,half,h/2); ctx.strokeStyle="#ffffff55"; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(0,h/2); ctx.lineTo(w,h/2); ctx.stroke(); }
      ctx.fillStyle="#07101dcc"; ctx.fillRect(18,18,w-36,74); ctx.font="700 24px system-ui"; ctx.fillStyle="#ffffff"; ctx.fillText(`DASHTRASH · ${mode === "duo" ? "2P SPLIT SCREEN" : "1P"}`,32,50); ctx.textAlign="right"; ctx.fillStyle=remain<10?"#ff6279":"#8ff0b0"; ctx.fillText(`${remain.toFixed(1)}s`,w-34,50); ctx.textAlign="left";
      if (status !== "RACE") { ctx.fillStyle="#00000099"; ctx.fillRect(0,0,w,h); ctx.textAlign="center"; ctx.fillStyle="#ffffff"; ctx.font="900 54px system-ui"; ctx.fillText(status,w/2,h/2-20); ctx.font="700 20px system-ui"; ctx.fillText(result,w/2,h/2+30); ctx.textAlign="left"; }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return () => { running = false; window.removeEventListener("keydown", keydown); window.removeEventListener("keyup", keyup); };
  }, [mode, onExit]);

  return <div className="game-wrap"><canvas ref={canvasRef} /><button className="exit-button" onClick={onExit}>ESC · MENU</button><div className="controls-card">P1: <b>A D W</b> + SHIFT · {mode === "duo" ? <>P2: <b>← → ↑</b> + L</> : <>R: restart after finish</>}</div></div>;
}
