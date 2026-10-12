'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { navigate } from '@/lib/navigation';
import type { Screen } from '@/store/ui';

/** Returns go(screen): navigates with the page transition. */
export function useGo() {
  const router = useRouter();
  return useCallback((to: Screen) => navigate(to, (href) => router.push(href, { scroll: false })), [router]);
}
