import { create } from 'zustand';

export type ToastKind = 'ok' | 'warn';
export interface Toast {
  id: number;
  msg: string;
  kind: ToastKind;
}

interface ToastState {
  toasts: Toast[];
  push: (msg: string, kind?: ToastKind) => void;
  dismiss: (id: number) => void;
}

let seq = 0;
const MAX = 3;

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (msg, kind = 'ok') => {
    if (!msg) return;
    set((s) => ({ toasts: [...s.toasts, { id: ++seq, msg, kind }].slice(-MAX) }));
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = (msg: string, kind?: ToastKind) => useToasts.getState().push(msg, kind);

/** Queues toasts with a delay between them, so several swaps read one at a time. */
export function toastSequence(items: { msg: string; kind?: ToastKind; at: number }[]) {
  for (const it of items) setTimeout(() => toast(it.msg, it.kind), it.at * 1000);
}
