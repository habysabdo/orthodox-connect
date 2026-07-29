import { useEffect, useRef } from 'react';

/**
 * Animated "broadcast" canvas. For seed streams and user streams where no
 * webcam permission is granted, this renders a warm, moving gold/candle-light
 * pattern so the viewer sees something alive instead of a black box.
 *
 * `onCanvasReady` hands the live canvas to the caller once it is drawing, which
 * is how the Go Live modal records a simulated broadcast (`captureStream()`).
 */
export function SimulatedCanvas({
  className = '',
  onCanvasReady,
}: {
  className?: string;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Held in a ref so a caller passing an inline callback cannot restart the
  // animation loop on every render.
  const onCanvasReadyRef = useRef(onCanvasReady);
  onCanvasReadyRef.current = onCanvasReady;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let t = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, rect.width * dpr);
      canvas.height = Math.max(1, rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      t += 0.012;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      // Deep background
      ctx.fillStyle = '#0a0c12';
      ctx.fillRect(0, 0, w, h);

      // Moving radial gold glows (candle-like)
      const glows = [
        { x: w * (0.3 + 0.2 * Math.sin(t)), y: h * (0.4 + 0.15 * Math.cos(t * 0.8)), r: Math.min(w, h) * 0.5, c: 'rgba(212,175,55,0.22)' },
        { x: w * (0.7 + 0.15 * Math.cos(t * 1.2)), y: h * (0.6 + 0.2 * Math.sin(t * 0.6)), r: Math.min(w, h) * 0.45, c: 'rgba(180,120,40,0.18)' },
        { x: w * (0.5 + 0.25 * Math.sin(t * 0.4)), y: h * (0.5 + 0.1 * Math.cos(t * 1.1)), r: Math.min(w, h) * 0.35, c: 'rgba(247,236,195,0.10)' },
      ];
      for (const g of glows) {
        const grad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, Math.max(1, g.r));
        grad.addColorStop(0, g.c);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }

      // Cross watermark, slowly breathing
      const cx = w / 2;
      const cy = h / 2;
      const scale = Math.min(w, h) * 0.18 * (1 + 0.04 * Math.sin(t * 2));
      ctx.save();
      ctx.globalAlpha = 0.12 + 0.04 * Math.sin(t * 2);
      ctx.fillStyle = '#f0d98a';
      ctx.translate(cx, cy);
      ctx.fillRect(-scale * 0.08, -scale, scale * 0.16, scale * 2);
      ctx.fillRect(-scale * 0.5, -scale * 0.35, scale, scale * 0.18);
      ctx.fillRect(-scale * 0.4, -scale * 0.2, scale * 0.8, scale * 0.14);
      ctx.restore();

      // Subtle scan shimmer
      ctx.globalAlpha = 0.04;
      ctx.fillStyle = '#ffffff';
      const band = (Math.sin(t) * 0.5 + 0.5) * h;
      ctx.fillRect(0, band - 2, w, 4);
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(draw);
    };
    draw();
    onCanvasReadyRef.current?.(canvas);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} className={className} />;
}
