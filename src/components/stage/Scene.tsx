'use client';

import { useFrame, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { useEffect, useRef } from 'react';
import type * as THREE from 'three';
import { StageDirector, type OverlayElements } from '@/three/director';

/** Creates the stage director for this canvas, ticks it every frame and disposes it on unmount. */
export function Scene({ overlays }: { overlays: OverlayElements }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const director = useRef<StageDirector | null>(null);

  useEffect(() => {
    const d = new StageDirector(gl, scene, camera as THREE.PerspectiveCamera, overlays);
    director.current = d;
    if (process.env.NODE_ENV !== 'production') Object.assign(window, { __stage: d, __gsap: gsap });
    return () => {
      d.dispose();
      director.current = null;
    };
  }, [gl, scene, camera, overlays]);

  useEffect(() => director.current?.resize(), [width, height]);

  useFrame((state, delta) =>
    director.current?.frame(delta, state.clock.elapsedTime, state.size.width, state.size.height),
  );

  return null;
}
