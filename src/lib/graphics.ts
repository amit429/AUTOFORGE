/**
 * Door and rear graphics, drawn into a transparent canvas. The same drawings texture the 3D
 * decals and the option-card previews, so what you pick is exactly what goes on the car.
 *
 * Door artwork is drawn with the car's front on the right of the canvas; the left-side door
 * gets a mirrored copy so designs always start at the front of the car.
 */
import type { GraphicId } from '@/data/options';
import { hexToRgb } from './color';

export interface ArtOptions {
  colour: string;
  number: number;
  /** User artwork for the 'upload' design. */
  image?: CanvasImageSource | null;
  /** 'door' artwork runs along the side; 'rear' is centred across the tail. */
  place: 'door' | 'rear';
}

/** Black or white, whichever reads better on top of `hex`. */
function contrast(hex: string) {
  const [r, g, b] = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#111214' : '#f4f5f6';
}

export function drawGraphic(
  ctx: CanvasRenderingContext2D,
  id: GraphicId,
  W: number,
  H: number,
  o: ArtOptions,
) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = o.colour;
  ctx.strokeStyle = o.colour;
  const disp = getComputedStyle(document.documentElement).getPropertyValue('--font-d') || 'Arial';
  const rear = o.place === 'rear';
  switch (id) {
    case 'number': {
      const r = H * 0.4;
      const cx = rear ? W / 2 : W * 0.5;
      ctx.beginPath();
      ctx.arc(cx, H / 2, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = contrast(o.colour);
      ctx.font = `${Math.round(r * 1.05)}px ${disp}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(o.number), cx, H / 2 + r * 0.06);
      break;
    }
    case 'flames': {
      // Tongues of flame licking back from the front edge.
      const tongues = rear ? 7 : 6;
      for (let i = 0; i < tongues; i++) {
        const y = H * (0.18 + (0.64 * i) / (tongues - 1));
        const len = W * (0.45 + 0.35 * Math.sin(i * 1.7 + 0.6) ** 2);
        const th = H * 0.1;
        const x0 = rear ? W * 0.02 : W;
        const dir = rear ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(x0, y - th);
        ctx.bezierCurveTo(
          x0 + dir * len * 0.4,
          y - th * 1.8,
          x0 + dir * len * 0.7,
          y + th * 0.4,
          x0 + dir * len,
          y - th * 0.2,
        );
        ctx.bezierCurveTo(
          x0 + dir * len * 0.75,
          y + th * 1.1,
          x0 + dir * len * 0.35,
          y + th * 1.6,
          x0,
          y + th,
        );
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'slash': {
      for (let i = 0; i < 3; i++) {
        const x = (rear ? W * 0.3 : W * 0.55) + i * W * 0.11;
        ctx.beginPath();
        ctx.moveTo(x, H * 0.92);
        ctx.lineTo(x + W * 0.06, H * 0.92);
        ctx.lineTo(x + W * 0.16, H * 0.08);
        ctx.lineTo(x + W * 0.1, H * 0.08);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'sweep': {
      ctx.lineCap = 'round';
      for (const [w, a, off] of [
        [H * 0.12, 1, 0],
        [H * 0.04, 0.8, H * 0.16],
      ] as const) {
        ctx.globalAlpha = a;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(W * 0.98, H * 0.78 - off);
        ctx.bezierCurveTo(W * 0.6, H * 0.85 - off, W * 0.35, H * 0.25 - off, W * 0.02, H * 0.3 - off);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'tribal': {
      const blade = (x: number, y: number, s: number, flip: number) => {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x - s * 0.6, y - flip * s * 0.5, x - s * 1.4, y - flip * s * 0.1);
        ctx.quadraticCurveTo(x - s * 0.7, y - flip * s * 0.15, x - s * 0.2, y + flip * s * 0.25);
        ctx.closePath();
        ctx.fill();
      };
      const cx = rear ? W * 0.62 : W * 0.95;
      for (let i = 0; i < 4; i++) {
        blade(cx - i * W * 0.17, H * 0.5, H * (0.9 - i * 0.12), 1);
        blade(cx - i * W * 0.17, H * 0.52, H * (0.9 - i * 0.12), -1);
      }
      break;
    }
    case 'checker': {
      const s = H / 6;
      for (let j = 0; j < 6; j++)
        for (let i = 0; i < Math.ceil(W / s); i++) {
          if ((i + j) % 2) continue;
          const t = rear ? 1 - Math.abs(i * s - W / 2) / (W / 2) : (i * s) / W;
          if (t < 0.15) continue;
          ctx.globalAlpha = Math.min(1, t * 1.3);
          const k = 0.35 + 0.65 * t;
          ctx.fillRect(i * s + (s * (1 - k)) / 2, j * s + (s * (1 - k)) / 2, s * k, s * k);
        }
      ctx.globalAlpha = 1;
      break;
    }
    case 'script': {
      ctx.font = `${Math.round(H * (rear ? 0.36 : 0.42))}px ${disp}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.save();
      ctx.translate(W / 2, H / 2);
      if (!rear) ctx.transform(1, 0, -0.25, 1, 0, 0);
      ctx.fillText('HALDEN', 0, 0);
      ctx.restore();
      break;
    }
    case 'upload': {
      const img = o.image;
      if (!img) break;
      const iw = (img as HTMLImageElement).naturalWidth || (img as HTMLCanvasElement).width;
      const ih = (img as HTMLImageElement).naturalHeight || (img as HTMLCanvasElement).height;
      if (!iw || !ih) break;
      const k = Math.min((W * 0.94) / iw, (H * 0.94) / ih);
      ctx.drawImage(img, (W - iw * k) / 2, (H - ih * k) / 2, iw * k, ih * k);
      break;
    }
    default:
      break;
  }
}

/** A canvas holding the artwork, optionally mirrored left-to-right. */
export function graphicCanvas(id: GraphicId, W: number, H: number, o: ArtOptions, mirror = false) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  if (mirror) {
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
  }
  drawGraphic(ctx, id, W, H, o);
  return c;
}
