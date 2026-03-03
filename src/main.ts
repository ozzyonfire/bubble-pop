type EntityType = "bubble" | "balloon";

type Entity = {
  id: string;
  type: EntityType;
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  wobble: number;
  wobbleSpeed: number;
  color: string;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  age: number;
  color: string;
  size: number;
};

const canvas = document.getElementById("game");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Missing #game canvas element");
}

const ctx = canvas.getContext("2d", { alpha: true });
if (!ctx) {
  throw new Error("Could not create 2D rendering context");
}

const scoreEl = document.getElementById("score");
if (!(scoreEl instanceof HTMLElement)) {
  throw new Error("Missing #score element");
}

const hintEl = document.getElementById("hint");
const resetBtn = document.getElementById("resetBtn");

let dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
let W = 0;
let H = 0;

let entities: Entity[] = [];
let particles: Particle[] = [];
let score = 0;
let lastTs = 0;
let spawnAcc = 0;

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[(Math.random() * arr.length) | 0] as T;
}

function resize() {
  dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const rect = canvas.getBoundingClientRect();
  W = Math.max(1, Math.floor(rect.width));
  H = Math.max(1, Math.floor(rect.height));
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function reset() {
  entities = [];
  particles = [];
  score = 0;
  setScore(score);
  spawnAcc = 0;
  // seed a few at start
  for (let i = 0; i < 10; i++) spawnEntity(true);
}

function setScore(v: number): void {
  scoreEl.textContent = String(v);
}

const COLORS = [
  "#60a5fa", // blue
  "#34d399", // green
  "#fbbf24", // amber
  "#fb7185", // rose
  "#a78bfa", // violet
  "#22d3ee", // cyan
];

function spawnEntity(initial = false): void {
  const type = Math.random() < 0.25 ? "balloon" : "bubble";

  const r = type === "balloon" ? rand(26, 46) : rand(18, 38);
  const x = rand(r + 10, W - r - 10);
  const y = initial ? rand(r + 80, H - r - 10) : H + r + rand(0, 80);

  // velocity: float up + mild sideways drift
  const vy = -rand(30, 90) * (type === "balloon" ? 0.9 : 1.1);
  const vx = rand(-18, 18);

  const color = pick(COLORS);

  entities.push({
    id: crypto.randomUUID?.() ?? String(Math.random()),
    type,
    x,
    y,
    r,
    vx,
    vy,
    wobble: rand(0, Math.PI * 2),
    wobbleSpeed: rand(1.2, 2.8),
    color,
  });
}

function popAt(x: number, y: number): boolean {
  // forgiving hitbox: add extra radius for small fingers
  const extra = 10;

  // check top-most first (last drawn)
  for (let i = entities.length - 1; i >= 0; i--) {
    const e = entities[i];
    const dx = x - e.x;
    const dy = y - e.y;
    const rr = e.r + extra;
    if (dx * dx + dy * dy <= rr * rr) {
      doPop(i);
      return true;
    }
  }
  return false;
}

function doPop(index: number): void {
  const e = entities[index];
  entities.splice(index, 1);

  score++;
  setScore(score);
  if (hintEl instanceof HTMLElement) hintEl.style.opacity = "0";

  // confetti particles
  const n = e.type === "balloon" ? 26 : 18;
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2);
    const sp = rand(60, 220) * (e.type === "balloon" ? 1.1 : 1.0);
    particles.push({
      x: e.x,
      y: e.y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: rand(0.35, 0.7),
      age: 0,
      color: Math.random() < 0.5 ? e.color : pick(COLORS),
      size: rand(2, 5),
    });
  }
}

function drawBubble(e: Entity): void {
  // soft bubble look
  const grad = ctx.createRadialGradient(e.x - e.r * 0.25, e.y - e.r * 0.35, e.r * 0.15, e.x, e.y, e.r);
  grad.addColorStop(0, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.2, "rgba(255,255,255,0.35)");
  grad.addColorStop(1, e.color + "55");

  ctx.beginPath();
  ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.stroke();

  // highlight
  ctx.beginPath();
  ctx.arc(e.x - e.r * 0.35, e.y - e.r * 0.35, e.r * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fill();
}

function drawBalloon(e: Entity): void {
  // balloon body
  ctx.beginPath();
  ctx.ellipse(e.x, e.y, e.r * 0.85, e.r * 1.05, 0, 0, Math.PI * 2);
  ctx.fillStyle = e.color + "dd";
  ctx.fill();

  // shine
  ctx.beginPath();
  ctx.ellipse(e.x - e.r * 0.25, e.y - e.r * 0.25, e.r * 0.18, e.r * 0.35, -0.2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fill();

  // knot
  ctx.beginPath();
  ctx.moveTo(e.x - 5, e.y + e.r * 0.95);
  ctx.lineTo(e.x + 5, e.y + e.r * 0.95);
  ctx.lineTo(e.x, e.y + e.r * 0.95 + 10);
  ctx.closePath();
  ctx.fillStyle = e.color;
  ctx.fill();

  // string
  ctx.beginPath();
  ctx.moveTo(e.x, e.y + e.r * 0.95 + 10);
  const sway = Math.sin(e.wobble) * 10;
  ctx.bezierCurveTo(e.x + sway, e.y + e.r * 1.2, e.x - sway, e.y + e.r * 1.5, e.x + sway * 0.3, e.y + e.r * 1.9);
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function step(ts: number): void {
  if (!lastTs) lastTs = ts;
  const dt = Math.min(0.033, (ts - lastTs) / 1000);
  lastTs = ts;

  // spawn rate increases gently with score
  const base = 0.85; // entities/sec
  const extra = Math.min(1.75, score * 0.01);
  const rate = base + extra;
  spawnAcc += dt * rate;
  while (spawnAcc >= 1) {
    spawnAcc -= 1;
    spawnEntity(false);
  }

  // update entities
  for (const e of entities) {
    e.wobble += dt * e.wobbleSpeed;
    e.x += e.vx * dt + Math.sin(e.wobble) * 10 * dt;
    e.y += e.vy * dt;

    // keep in bounds horizontally
    if (e.x < e.r + 6) {
      e.x = e.r + 6;
      e.vx = Math.abs(e.vx) * 0.9;
    } else if (e.x > W - e.r - 6) {
      e.x = W - e.r - 6;
      e.vx = -Math.abs(e.vx) * 0.9;
    }
  }

  // cull off-screen
  entities = entities.filter((e) => e.y > -e.r - 120);

  // particles
  for (const p of particles) {
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    // gravity
    p.vy += 520 * dt;
    // drag
    p.vx *= Math.pow(0.02, dt);
    p.vy *= Math.pow(0.08, dt);
  }
  particles = particles.filter((p) => p.age < p.life);

  render();
  requestAnimationFrame(step);
}

function render(): void {
  ctx.clearRect(0, 0, W, H);

  // subtle floating background dots
  ctx.save();
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < 18; i++) {
    const x = (i * 137 + (lastTs * 0.02)) % (W + 80) - 40;
    const y = (i * 89 + (lastTs * 0.03)) % (H + 80) - 40;
    ctx.beginPath();
    ctx.arc(x, y, 14 + (i % 5) * 6, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.fill();
  }
  ctx.restore();

  // draw entities (bigger behind)
  entities
    .slice()
    .sort((a, b) => a.r - b.r)
    .forEach((e) => {
      if (e.type === "balloon") drawBalloon(e);
      else drawBubble(e);
    });

  // particles
  for (const p of particles) {
    const t = 1 - p.age / p.life;
    ctx.globalAlpha = Math.max(0, t);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function getPointerPos(ev: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const x = (ev.clientX - rect.left);
  const y = (ev.clientY - rect.top);
  return { x, y };
}

// Input
canvas.addEventListener("pointerdown", (ev) => {
  ev.preventDefault();
  canvas.setPointerCapture?.(ev.pointerId);
  const { x, y } = getPointerPos(ev);
  popAt(x, y);
});

window.addEventListener("keydown", (ev) => {
  if (ev.key.toLowerCase() === "r") reset();
});

if (resetBtn instanceof HTMLButtonElement) {
  resetBtn.addEventListener("click", () => reset());
}

// boot
resize();
reset();
requestAnimationFrame(step);

window.addEventListener("resize", resize);

// prevent iOS double-tap zoom + scrolling while playing
window.addEventListener(
  "touchmove",
  (e) => {
    if (e.target === canvas) e.preventDefault();
  },
  { passive: false }
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed", error);
    });
  });
}
