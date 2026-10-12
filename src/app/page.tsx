import { ThemeToggle } from '@/components/chrome/ThemeToggle';

export default function Home() {
  return (
    <main style={{ display: 'grid', placeItems: 'center', height: '100vh', gap: 16 }}>
      <div style={{ display: 'grid', justifyItems: 'center', gap: 18 }}>
        <h1 className="d" style={{ fontSize: 40, letterSpacing: '-0.03em' }}>
          Halden Atelier
        </h1>
        <p className="muted">Scaffold ready. The studio is being built.</p>
        <ThemeToggle />
      </div>
    </main>
  );
}
