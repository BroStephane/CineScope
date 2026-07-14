import { ArrowLeft } from 'lucide-react';

export default function BackButton() {
  function handleBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  }

  return (
    <button
      onClick={handleBack}
      aria-label="Retour"
      className="glass-strong fixed left-4 top-[calc(1rem+env(safe-area-inset-top))] z-30 flex h-11 w-11 items-center justify-center rounded-full text-white md:top-20"
    >
      <ArrowLeft size={20} aria-hidden="true" />
    </button>
  );
}
