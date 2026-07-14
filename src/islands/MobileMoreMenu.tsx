import { useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { navIcons } from '../lib/navIcons';
import type { NavItem } from '../lib/navItems';

interface MobileMoreMenuProps {
  items: NavItem[];
  currentPath: string;
}

export default function MobileMoreMenu({ items, currentPath }: MobileMoreMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const active = items.some((item) => item.href === currentPath);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative flex min-w-0 flex-col items-center justify-center">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Plus de sections"
        onClick={() => setOpen((o) => !o)}
        className={`flex min-h-11 w-full flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1 text-[9px] ${
          active ? 'glass-pill glass-pill-active text-white' : 'text-white/70'
        }`}
      >
        {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        <span className="w-full truncate text-center">Plus</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Plus de sections"
          className="glass-strong absolute bottom-full right-0 z-50 mb-2 w-44 overflow-hidden rounded-2xl p-1"
        >
          {items.map((item) => {
            const Icon = navIcons[item.icon];
            const itemActive = currentPath === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                role="menuitem"
                aria-current={itemActive ? 'page' : undefined}
                className={`flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm ${
                  itemActive ? 'text-white' : 'text-white/80'
                }`}
              >
                <Icon size={18} aria-hidden="true" />
                {item.label}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
