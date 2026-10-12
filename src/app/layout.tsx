import type { Metadata, Viewport } from 'next';
import { Instrument_Sans, Michroma } from 'next/font/google';
import Script from 'next/script';
import { AppShell } from '@/components/shell/AppShell';
import { themeBootScript } from '@/lib/theme';
import '@/styles/globals.css';

const michroma = Michroma({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-michroma',
  display: 'swap',
});
const instrument = Instrument_Sans({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-instrument',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AutoForge: design your own car',
  description:
    'Design the car you want, part by part: pick one of ten body styles, then shape the paint, graphics, wheels, mods, seats and light, seen live in 3D and priced for where you live.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#D8DBDE' },
    { media: '(prefers-color-scheme: dark)', color: '#161A20' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${michroma.variable} ${instrument.variable}`} suppressHydrationWarning>
      <body>
        <Script id="theme-boot" strategy="beforeInteractive">
          {themeBootScript}
        </Script>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
