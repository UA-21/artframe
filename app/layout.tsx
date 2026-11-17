import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'ArtFrame', description: 'Turn your TV into an art frame' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#121210' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
