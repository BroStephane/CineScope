import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface Genre {
  id: number;
  name: string;
}

interface GenreDropdownProps {
  genres: Genre[];
  selectedIds: number[];
  onToggle: (id: number) => void;
}

export default function GenreDropdown({ genres, selectedIds, onToggle }: GenreDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`glass-input flex min-h-11 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ${
          selectedIds.length > 0 ? 'text-white' : 'text-white/80'
        }`}
      >
        Genres{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
        <ChevronDown size={14} aria-hidden="true" className={open ? 'rotate-180' : ''} />
      </button>

      {open && (
        <div
          role="group"
          aria-label="Filtrer par genres"
          className="glass-strong absolute left-0 z-50 mt-2 max-h-72 w-56 overflow-y-auto rounded-2xl p-2"
        >
          {genres.map((g) => (
            <label
              key={g.id}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2 text-sm text-white/80 hover:bg-white/5"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(g.id)}
                onChange={() => onToggle(g.id)}
                className="h-4 w-4 rounded border-white/30 bg-transparent accent-accent"
              />
              {g.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
