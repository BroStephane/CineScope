import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
      <motion.button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Plus de sections"
        onClick={() => setOpen((o) => !o)}
        whileTap={{ scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={`relative flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 text-[10px] transition-colors duration-300 ${
          active ? 'glass-pill glass-pill-active text-white' : 'text-white/70'
        }`}
      >
        {active && (
          <span className="absolute -top-1 left-1/2 h-1 w-5 -translate-x-1/2 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" />
        )}
        <motion.span
          key={open ? 'close' : 'open'}
          initial={{ rotate: -45, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        >
          {open ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
        </motion.span>
        <span className="w-full truncate text-center">Plus</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Plus de sections"
            initial={{ opacity: 0, scale: 0.7, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.7, y: 12 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            style={{ transformOrigin: 'bottom right' }}
            className="glass-strong absolute bottom-full right-0 z-50 mb-3 w-48 overflow-hidden rounded-2xl p-1.5"
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
                  className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm transition-colors active:scale-95 ${
                    itemActive ? 'bg-accent/20 text-white' : 'text-white/80'
                  }`}
                >
                  <Icon size={20} aria-hidden="true" className={itemActive ? 'text-accent' : ''} />
                  {item.label}
                </a>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
