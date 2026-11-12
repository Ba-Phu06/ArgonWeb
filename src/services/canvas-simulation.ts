import type { SimulationConfig, SimulationPaletteId, TelemetrySnapshot } from '../types/studio-types';

export type PointerMode = 'attract' | 'repel';
export type SimulationMetrics = Pick<TelemetrySnapshot, 'fps' | 'activeParticles' | 'activeLinks' | 'interactionCount'>;

interface Particle { x: number; y: number; vx: number; vy: number; radius: number; phase: number; colorIndex: number; }
interface Shockwave { x: number; y: number; radius: number; maxRadius: number; alpha: number; }
interface PointerState { active: boolean; x: number; y: number; mode: PointerMode; }
interface PaletteSpec { backdrop: string; nodes: readonly [string, string, string]; linkRgb: string; waveRgb: string; pointerRgb: string; }

const PALETTES: Record<SimulationPaletteId, PaletteSpec> = {
  cosmic: { backdrop: 'rgba(56, 189, 248, 0.14)', nodes: ['#22d3ee', '#a78bfa', '#38bdf8'], linkRgb: '103, 232, 249', waveRgb: '167, 139, 250', pointerRgb: '34, 211, 238' },
  emerald: { backdrop: 'rgba(52, 211, 153, 0.14)', nodes: ['#34d399', '#2dd4bf', '#67e8f9'], linkRgb: '52, 211, 153', waveRgb: '45, 212, 191', pointerRgb: '52, 211, 153' },
  solar: { backdrop: 'rgba(251, 191, 36, 0.15)', nodes: ['#fbbf24', '#fb923c', '#f472b6'], linkRgb: '251, 191, 36', waveRgb: '251, 146, 60', pointerRgb: '251, 191, 36' },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function createParticle(width: number, height: number): Particle {
  const angle = Math.random() * Math.PI * 2;
  const speed = 0.45 + Math.random() * 0.75;
  return { x: Math.random() * width, y: Math.random() * height, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: 1.8 + Math.random() * 2.1, phase: Math.random() * Math.PI * 2, colorIndex: Math.floor(Math.random() * 3) };
}

function syncParticlePool(particles: Particle[], targetCount: number, width: number, height: number): void {
  const safeTarget = clamp(Math.round(targetCount), 8, 140);
  while (particles.length < safeTarget) particles.push(createParticle(width, height));
  if (particles.length > safeTarget) particles.length = safeTarget;
}

function applyPointerForce(p: Particle, pointer: PointerState, dtFactor: number): void {
  if (!pointer.active) return;
  const dx = pointer.x - p.x;
  const dy = pointer.y - p.y;
  const distSq = dx * dx + dy * dy;
  if (distSq < 1 || distSq > 175 * 175) return;
  const dist = Math.sqrt(distSq);
  const falloff = 1 - dist / 175;
  const dir = pointer.mode === 'repel' ? -1 : 1;
  // Soft inner cushion prevents attract mode from collapsing nodes onto one pixel.
  const radial = pointer.mode === 'attract' && dist < 28 ? -0.35 : 0.22 * dir;
  const nx = dx / dist;
  const ny = dy / dist;
  p.vx += (nx * radial * falloff - ny * 0.06 * dir * falloff) * dtFactor;
  p.vy += (ny * radial * falloff + nx * 0.06 * dir * falloff) * dtFactor;
}

function advanceParticles(particles: Particle[], width: number, height: number, config: SimulationConfig, pointer: PointerState, dtFactor: number): void {
  const speedScale = clamp(config.flowSpeed, 0.1, 3.5);
  const maxSpeed = 2.8 * speedScale;
  for (const p of particles) {
    applyPointerForce(p, pointer, dtFactor);
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > maxSpeed) {
      p.vx = (p.vx / speed) * maxSpeed;
      p.vy = (p.vy / speed) * maxSpeed;
    } else if (speed > 0.01) {
      const blend = 1 + ((0.75 * speedScale) / speed - 1) * 0.018 * dtFactor;
      p.vx *= blend;
      p.vy *= blend;
    }
    p.x += p.vx * dtFactor;
    p.y += p.vy * dtFactor;
    if (p.x <= p.radius || p.x >= width - p.radius) { p.vx *= -1; p.x = clamp(p.x, p.radius, width - p.radius); }
    if (p.y <= p.radius || p.y >= height - p.radius) { p.vy *= -1; p.y = clamp(p.y, p.radius, height - p.radius); }
  }
}

function advanceShockwaves(waves: Shockwave[], particles: Particle[], dtFactor: number): void {
  for (let i = waves.length - 1; i >= 0; i -= 1) {
    const wave = waves[i];
    wave.radius += 4.4 * dtFactor;
    wave.alpha = Math.max(0, 1 - wave.radius / wave.maxRadius);
    for (const p of particles) {
      const dx = p.x - wave.x;
      const dy = p.y - wave.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 1 && Math.abs(dist - wave.radius) < 24) {
        const push = 0.48 * wave.alpha * dtFactor;
        p.vx += (dx / dist) * push;
        p.vy += (dy / dist) * push;
      }
    }
    if (wave.radius >= wave.maxRadius) waves.splice(i, 1);
  }
}

function renderLinks(ctx: CanvasRenderingContext2D, particles: readonly Particle[], linkRadius: number, linkRgb: string): number {
  const safeRadius = clamp(linkRadius, 30, 260);
  const radiusSq = safeRadius * safeRadius;
  let links = 0;
  ctx.lineWidth = 1;
  for (let i = 0; i < particles.length; i += 1) {
    const a = particles[i];
    for (let j = i + 1; j < particles.length; j += 1) {
      const b = particles[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < radiusSq) {
        ctx.strokeStyle = `rgba(${linkRgb}, ${((1 - Math.sqrt(distSq) / safeRadius) * 0.56).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        links += 1;
      }
    }
  }
  return links;
}

function renderScene(ctx: CanvasRenderingContext2D, width: number, height: number, particles: readonly Particle[], waves: readonly Shockwave[], pointer: PointerState, config: SimulationConfig, timeSec: number): number {
  const palette = PALETTES[config.paletteId];
  ctx.clearRect(0, 0, width, height);
  const glow = ctx.createRadialGradient(width * 0.5, height * 0.45, 10, width * 0.5, height * 0.5, Math.max(width, height) * 0.72);
  glow.addColorStop(0, palette.backdrop);
  glow.addColorStop(1, 'rgba(6, 9, 20, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  const links = renderLinks(ctx, particles, config.linkRadius, palette.linkRgb);
  for (const wave of waves) {
    ctx.strokeStyle = `rgba(${palette.waveRgb}, ${(wave.alpha * 0.78).toFixed(3)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (pointer.active) {
    ctx.strokeStyle = `rgba(${palette.pointerRgb}, 0.38)`;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.arc(pointer.x, pointer.y, 20, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const p of particles) {
    const r = p.radius * (0.85 + Math.sin(timeSec * 2.4 + p.phase) * 0.18);
    ctx.fillStyle = palette.nodes[p.colorIndex] ?? palette.nodes[0];
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return links;
}

/** Pure Canvas 2D constellation, pointer physics, and shockwave simulation engine. */
export class CanvasSimulation {
  private readonly ctx: CanvasRenderingContext2D | null;
  private config: SimulationConfig;
  private particles: Particle[] = [];
  private shockwaves: Shockwave[] = [];
  private pointer: PointerState = { active: false, x: 0, y: 0, mode: 'attract' };
  private width = 640;
  private height = 380;
  private metrics: SimulationMetrics = { fps: 60, activeParticles: 0, activeLinks: 0, interactionCount: 0 };
  private rafId: number | null = null;
  private lastFrameMs = 0;
  private fpsFrames = 0;
  private fpsWindowStart = 0;

  constructor(private readonly canvas: HTMLCanvasElement, initialConfig: SimulationConfig) {
    this.ctx = canvas.getContext('2d');
    this.config = { ...initialConfig };
    this.resize();
    this.updateConfig(initialConfig);
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(280, Math.round(rect.width || this.canvas.clientWidth || 640));
    this.height = Math.max(220, Math.round(rect.height || this.canvas.clientHeight || 380));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const p of this.particles) {
      p.x = clamp(p.x, p.radius, this.width - p.radius);
      p.y = clamp(p.y, p.radius, this.height - p.radius);
    }
  }

  updateConfig(nextConfig: SimulationConfig): void {
    this.config = { ...nextConfig };
    syncParticlePool(this.particles, this.config.particleCount, this.width, this.height);
    this.metrics.activeParticles = this.particles.length;
  }

  setPointer(x: number, y: number, mode: PointerMode = 'attract'): void { this.pointer = { active: true, x, y, mode }; }
  clearPointer(): void { this.pointer.active = false; }

  triggerShockwave(x: number, y: number): void {
    const maxRadius = Math.max(150, Math.min(this.width, this.height) * 0.48);
    this.shockwaves.push({ x, y, radius: 6, maxRadius, alpha: 0.95 });
    if (this.shockwaves.length > 10) this.shockwaves.shift();
    this.metrics.interactionCount += 1;
  }

  reset(): void {
    this.particles = [];
    this.shockwaves = [];
    this.metrics.interactionCount = 0;
    this.updateConfig(this.config);
  }

  start(): void {
    if (this.rafId !== null) return;
    this.lastFrameMs = performance.now();
    this.fpsWindowStart = this.lastFrameMs;
    this.fpsFrames = 0;
    this.rafId = window.requestAnimationFrame(this.tick);
  }

  stop(): void {
    if (this.rafId === null) return;
    window.cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  getMetrics(): SimulationMetrics { return { ...this.metrics }; }

  private tick = (now: number): void => {
    // Clamp step factor so backgrounded tabs do not teleport particles across bounds.
    const dtFactor = clamp((now - this.lastFrameMs) / 16.667, 0.2, 3.0);
    this.lastFrameMs = now;
    this.fpsFrames += 1;
    const elapsed = now - this.fpsWindowStart;
    if (elapsed >= 250) {
      this.metrics.fps = clamp(Math.round((this.fpsFrames * 1000) / elapsed), 0, 144);
      this.fpsFrames = 0;
      this.fpsWindowStart = now;
    }
    if (!this.config.isPaused) advanceParticles(this.particles, this.width, this.height, this.config, this.pointer, dtFactor);
    advanceShockwaves(this.shockwaves, this.particles, dtFactor);
    if (this.ctx) {
      this.metrics.activeLinks = renderScene(this.ctx, this.width, this.height, this.particles, this.shockwaves, this.pointer, this.config, now * 0.001);
      this.metrics.activeParticles = this.particles.length;
    }
    this.rafId = window.requestAnimationFrame(this.tick);
  };
}
