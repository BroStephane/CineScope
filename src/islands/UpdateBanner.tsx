import { useRegisterSW } from 'virtual:pwa-register/react';

export default function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-surface/95 px-4 py-2 text-sm shadow-lg backdrop-blur md:bottom-4">
      <span>Nouvelle version disponible</span>
      <button
        className="min-h-11 rounded-full bg-accent px-3 py-1 font-semibold text-black"
        onClick={() => updateServiceWorker(true)}
      >
        Rafraîchir
      </button>
    </div>
  );
}
