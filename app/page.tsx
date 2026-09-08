"use client";

import { useState } from "react";
import { GameCanvas } from "@/components/game/GameCanvas";

export default function Home() {
  const [mode, setMode] = useState<"menu" | "single" | "duo">("menu");

  if (mode !== "menu") {
    return <GameCanvas mode={mode} onExit={() => setMode("menu")} />;
  }

  return (
    <main className="menu-shell">
      <div className="menu-card">
        <div className="eyebrow">DASHTRASH // CHAOS RACING</div>
        <h1>RUN.<br />DODGE.<br /><span>SURVIVE.</span></h1>
        <p className="tagline">Beat the clock. Beat the course. Don&apos;t become the obstacle.</p>
        <div className="mode-grid">
          <button className="mode-button primary" onClick={() => setMode("single")}>
            <strong>1 PLAYER</strong>
            <small>A / D + W &nbsp; · &nbsp; SHIFT SPRINT</small>
          </button>
          <button className="mode-button" onClick={() => setMode("duo")}>
            <strong>2 PLAYER</strong>
            <small>P1: A / D / W &nbsp; · &nbsp; P2: ← / → / ↑</small>
          </button>
        </div>
        <div className="menu-tip">FIRST BUILD · PROCEDURAL CANVAS WORLD</div>
      </div>
    </main>
  );
}
