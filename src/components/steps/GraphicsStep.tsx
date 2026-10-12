'use client';

import { useRef } from 'react';
import { GRAPHICS, LIVERY_COLOURS, keysOf, type GraphicId } from '@/data/options';
import { paintHex, priceTag } from '@/engine';
import { Block, Cards, Note, Swatches, controlStyles as s } from '@/components/config/controls';
import { Button } from '@/components/ui/Button';
import { useBuild } from '@/store/build';
import { toast } from '@/store/toasts';
import { readImage, useUploads, type ArtPlace } from '@/store/uploads';
import { GraphicPreview } from './GraphicPreview';
import styles from './GraphicsStep.module.css';

function UploadControl({ place }: { place: ArtPlace }) {
  const file = useRef<HTMLInputElement>(null);
  const image = useUploads((u) => u[place]);
  const key = place === 'door' ? 'doorArt' : 'rearArt';
  const pick = async (f: File | undefined) => {
    if (!f) return;
    try {
      useUploads.getState().set(place, await readImage(f));
      if (useBuild.getState().build[key] !== 'upload') useBuild.getState().set(key, 'upload');
    } catch (e) {
      toast((e as Error).message, 'warn');
    }
  };
  return (
    <div className={styles.upload}>
      <input
        ref={file}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="sr"
        aria-label={`Upload a ${place} design`}
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={`Your ${place} design`} />
      ) : (
        <span className={styles.ph} aria-hidden="true" />
      )}
      <div>
        <Button variant="ghost" size="sm" onClick={() => file.current?.click()}>
          {image ? 'Replace image' : 'Upload your own'}
        </Button>
        {image && (
          <button className={styles.remove} onClick={() => useUploads.getState().set(place, null)}>
            Remove
          </button>
        )}
        <small className="muted">PNG with transparency works best. Stays on this device.</small>
      </div>
    </div>
  );
}

export function GraphicsStep() {
  const b = useBuild((st) => st.build);
  const uploads = useUploads();
  const colour = LIVERY_COLOURS[b.artCol].c;
  const ids = keysOf(GRAPHICS);
  const cards = (place: ArtPlace) =>
    ids.map((id: GraphicId) => ({
      v: id,
      n: GRAPHICS[id].n,
      sub: priceTag(GRAPHICS[id].p, b.region),
      icon:
        id === 'none' ? undefined : (
          <GraphicPreview
            id={id}
            place={place}
            colour={colour}
            number={b.raceNo}
            panel={paintHex(b)}
            upload={uploads[place]}
          />
        ),
    }));
  const usesNumber = b.doorArt === 'number' || b.rearArt === 'number';
  const missing = (b.doorArt === 'upload' && !uploads.door) || (b.rearArt === 'upload' && !uploads.rear);
  return (
    <>
      <Block title="Doors" em="doorArt">
        <Cards k="doorArt" items={cards('door')} />
      </Block>
      <UploadControl place="door" />
      <Block title="Rear" em="rearArt">
        <Cards k="rearArt" items={cards('rear')} />
      </Block>
      <UploadControl place="rear" />
      {missing && <Note>Upload an image to see your own design on the car.</Note>}
      <Block title="Graphic colour" em="artCol">
        <Swatches
          k="artCol"
          items={keysOf(LIVERY_COLOURS).map((k) => ({
            v: k,
            n: LIVERY_COLOURS[k].n,
            c: LIVERY_COLOURS[k].c,
          }))}
        />
      </Block>
      {usesNumber && (
        <Block title="Race number" em="raceNo">
          <div className={styles.number}>
            <button
              className={s.mood}
              aria-label="Lower number"
              onClick={() => useBuild.getState().set('raceNo', Math.max(0, b.raceNo - 1))}
            >
              −
            </button>
            <input
              type="number"
              min={0}
              max={99}
              value={b.raceNo}
              aria-label="Race number"
              onChange={(e) =>
                e.target.value !== '' && useBuild.getState().set('raceNo', Number(e.target.value))
              }
            />
            <button
              className={s.mood}
              aria-label="Raise number"
              onClick={() => useBuild.getState().set('raceNo', Math.min(99, b.raceNo + 1))}
            >
              +
            </button>
          </div>
        </Block>
      )}
    </>
  );
}
