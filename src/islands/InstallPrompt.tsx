import { useEffect, useState } from 'react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);

  useEffect(() => {
    function handler(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!deferredPrompt) return null;

  return (
    <button
      className="fixed bottom-20 right-4 z-50 min-h-11 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-black shadow-lg md:bottom-4"
      onClick={async () => {
        const promptEvent = deferredPrompt as any;
        promptEvent.prompt();
        await promptEvent.userChoice;
        setDeferredPrompt(null);
      }}
    >
      Installer l'app
    </button>
  );
}
