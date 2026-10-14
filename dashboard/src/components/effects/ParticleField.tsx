import React, { useEffect, useRef } from 'react';

/**
 * NVIDIA-style glowing particle constellation: a fixed full-viewport canvas of
 * slowly drifting green/white nodes with soft radial glow halos, connected by
 * faint proximity lines. Glow is rendered from pre-baked radial-gradient
 * sprites (no per-frame shadowBlur) for a calm 60fps ambient field.
 * Pauses when the tab is hidden or reduced-motion is set.
 */
export const ParticleField: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let running = true;
    let w = 0;
    let h = 0;
    let t = 0;

    interface Node {
      x: number; y: number; vx: number; vy: number;
      r: number;               // core radius
      kind: 0 | 1 | 2;         // 0 = green, 1 = bright lime, 2 = white
      glow: number;            // halo strength multiplier
      phase: number;           // twinkle phase
      twinkle: number;         // twinkle speed
      baseAlpha: number;
    }
    let nodes: Node[] = [];
    const mouse = { x: -9999, y: -9999 };

    const LINK_DIST = 170;

    // Pre-baked glow sprites: radial gradient, hot core -> transparent.
    const makeSprite = (inner: string, mid: string): HTMLCanvasElement => {
      const s = 128;
      const c = document.createElement('canvas');
      c.width = c.height = s;
      const g = c.getContext('2d');
      if (!g) return c;
      const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grad.addColorStop(0, inner);
      grad.addColorStop(0.28, mid);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
      return c;
    };
    const spriteGreen = makeSprite('rgba(163, 230, 53, 0.85)', 'rgba(118, 185, 0, 0.28)');
    const spriteLime = makeSprite('rgba(190, 242, 100, 0.95)', 'rgba(163, 230, 53, 0.32)');
    const spriteWhite = makeSprite('rgba(255, 255, 255, 0.7)', 'rgba(255, 255, 255, 0.14)');
    const sprites = [spriteGreen, spriteLime, spriteWhite];

    const COUNT = Math.min(110, Math.max(60, Math.floor((window.innerWidth * window.innerHeight) / 20000)));

    const seed = () => {
      nodes = Array.from({ length: COUNT }, () => {
        const roll = Math.random();
        const kind: 0 | 1 | 2 = roll < 0.55 ? 0 : roll < 0.72 ? 1 : 2;
        const bright = Math.random() < 0.16;
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.24,
          vy: (Math.random() - 0.5) * 0.24,
          r: bright ? Math.random() * 1.1 + 1.8 : Math.random() * 1.2 + 0.7,
          kind,
          glow: bright ? 1.6 : 0.8 + Math.random() * 0.5,
          phase: Math.random() * Math.PI * 2,
          twinkle: 0.4 + Math.random() * 0.8,
          baseAlpha: kind === 2 ? 0.5 : 0.75,
        };
      });
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
      draw();
    };

    const coreColor = (n: Node, a: number): string =>
      n.kind === 0
        ? `rgba(118, 185, 0, ${a.toFixed(3)})`
        : n.kind === 1
          ? `rgba(163, 230, 53, ${a.toFixed(3)})`
          : `rgba(255, 255, 255, ${(a * 0.8).toFixed(3)})`;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      // 1) Proximity links (under everything)
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          if (Math.abs(dx) > LINK_DIST || Math.abs(dy) > LINK_DIST) continue;
          const d = Math.hypot(dx, dy);
          if (d < LINK_DIST) {
            const alpha = (1 - d / LINK_DIST) * 0.16;
            ctx.strokeStyle = `rgba(118, 185, 0, ${alpha.toFixed(3)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // 2) Glow halos, additive for a soft bloom on the dark bg
      ctx.globalCompositeOperation = 'lighter';
      for (const n of nodes) {
        const tw = 0.72 + 0.28 * Math.sin(t * n.twinkle + n.phase);
        const dxm = n.x - mouse.x;
        const dym = n.y - mouse.y;
        const near = Math.max(0, 1 - Math.hypot(dxm, dym) / 220);
        const alpha = Math.min(1, n.baseAlpha * tw * n.glow * (1 + near * 0.9));
        const size = n.r * 9 * n.glow;
        ctx.globalAlpha = alpha * 0.55;
        ctx.drawImage(sprites[n.kind], n.x - size / 2, n.y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      // 3) Bright cores
      for (const n of nodes) {
        const tw = 0.72 + 0.28 * Math.sin(t * n.twinkle + n.phase);
        ctx.fillStyle = coreColor(n, Math.min(1, n.baseAlpha * tw + 0.15));
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const step = () => {
      if (!running) return;
      t += 0.016;
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -30) n.x = w + 30;
        if (n.x > w + 30) n.x = -30;
        if (n.y < -30) n.y = h + 30;
        if (n.y > h + 30) n.y = -30;
      }
      draw();
      raf = requestAnimationFrame(step);
    };

    const onVis = () => {
      running = !document.hidden;
      if (running && !reduced) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(step);
      } else {
        cancelAnimationFrame(raf);
      }
    };

    const onMouse = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const onMouseLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouse);
    document.documentElement.addEventListener('mouseleave', onMouseLeave);
    document.addEventListener('visibilitychange', onVis);
    resize();
    if (!reduced) raf = requestAnimationFrame(step);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouse);
      document.documentElement.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
    />
  );
};
