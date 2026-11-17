'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  ['/', 'Now'],
  ['/library', 'Library'],
  ['/playlists', 'Playlists'],
  ['/discover', 'Discover'],
  ['/settings', 'Settings'],
] as const;

export default function Tabs() {
  const path = usePathname();
  return (
    <nav className="tabs">
      {TABS.map(([href, label]) => (
        <Link key={href} href={href} className={path === href ? 'active' : ''}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
