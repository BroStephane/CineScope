import { useEffect, useRef, useState } from 'react';
import { Share2, Download } from 'lucide-react';
import { formatMinutes, type WatchStats } from '../lib/stats';

interface TasteCardProps {
  stats: WatchStats;
  genreName: string | null;
  directorName: string | null;
}

const WIDTH = 800;
const HEIGHT = 1000;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export default function TasteCard({ stats, genreName, directorName }: TasteCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  function draw(): HTMLCanvasElement | null {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return null;
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    bg.addColorStop(0, '#14141c');
    bg.addColorStop(1, '#0a0a0f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const glow = ctx.createRadialGradient(WIDTH / 2, 140, 20, WIDTH / 2, 140, 420);
    glow.addColorStop(0, 'rgba(124,92,255,0.35)');
    glow.addColorStop(1, 'rgba(124,92,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 46px Georgia, serif';
    ctx.fillText('CineScope', WIDTH / 2, 130);
    ctx.fillStyle = '#7c5cff';
    ctx.font = '600 20px Arial, sans-serif';
    ctx.fillText('M A   C A R T E   C I N É', WIDTH / 2, 168);

    const rows: [string, string][] = [
      ['🎬  Films vus', String(stats.totalWatched)],
      ['⏱️  Temps total', formatMinutes(stats.totalMinutes)],
      ['🎭  Genre favori', genreName ?? '—'],
      ['🎥  Réalisateur signature', directorName ?? '—'],
      ['📅  Décennie préférée', stats.favoriteDecade ? `Années ${stats.favoriteDecade}` : '—'],
    ];

    let y = 260;
    for (const [label, value] of rows) {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      roundRect(ctx, 60, y, WIDTH - 120, 96, 20);
      ctx.fill();

      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = '500 19px Arial, sans-serif';
      ctx.fillText(label, 92, y + 36);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 30px Arial, sans-serif';
      ctx.fillText(value, 92, y + 74);
      y += 120;
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '400 16px Arial, sans-serif';
    ctx.fillText('cinescope', WIDTH / 2, HEIGHT - 40);

    return canvas;
  }

  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats, genreName, directorName]);

  function toBlob(): Promise<Blob | null> {
    const canvas = draw();
    return new Promise((resolve) => (canvas ? canvas.toBlob(resolve) : resolve(null)));
  }

  async function handleDownload() {
    const blob = await toBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cinescope-ma-carte.png';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleShare() {
    const blob = await toBlob();
    if (!blob) return;
    const file = new File([blob], 'cinescope-ma-carte.png', { type: 'image/png' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Ma carte ciné CineScope' });
      } catch {
        // user cancelled the native share sheet — nothing to do
      }
      return;
    }
    await handleDownload();
    setFeedback('Image téléchargée !');
    setTimeout(() => setFeedback(null), 3000);
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="w-full max-w-sm rounded-2xl"
        style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
      />
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          onClick={handleShare}
          className="glass-pill flex min-h-11 items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-white"
        >
          <Share2 size={16} aria-hidden="true" />
          Partager
        </button>
        <button
          onClick={handleDownload}
          className="glass-pill flex min-h-11 items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-white"
        >
          <Download size={16} aria-hidden="true" />
          Télécharger
        </button>
      </div>
      {feedback && (
        <p aria-live="polite" className="mt-1 text-xs text-white/50">
          {feedback}
        </p>
      )}
    </div>
  );
}
