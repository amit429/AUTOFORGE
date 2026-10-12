'use client';

import { useEffect, useRef, useState } from 'react';
import type { GraphicId } from '@/data/options';
import { drawGraphic } from '@/lib/graphics';
import { imageFor } from '@/store/uploads';

/** Card preview of a graphic on a body-coloured panel, drawn with the same code as the decal. */
export function GraphicPreview(props: {
  id: GraphicId;
  place: 'door' | 'rear';
  colour: string;
  number: number;
  panel: string;
  upload: string | null;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const { id, place, colour, number, panel, upload } = props;

  useEffect(() => {
    let live = true;
    if (id === 'upload' && upload) void imageFor(upload).then((i) => live && setImg(i));
    return () => {
      live = false;
    };
  }, [id, upload]);

  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    drawGraphic(ctx, id, c.width, c.height, {
      colour,
      number,
      place,
      image: id === 'upload' && upload ? img : null,
    });
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = panel;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.globalCompositeOperation = 'source-over';
  }, [id, place, colour, number, panel, upload, img]);

  return <canvas ref={ref} width={300} height={place === 'door' ? 140 : 160} aria-hidden="true" />;
}
