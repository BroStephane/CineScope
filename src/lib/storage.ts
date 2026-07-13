const memoryFallback = new Map<string, string>();
let localStorageAvailable: boolean | null = null;

function isLocalStorageAvailable(): boolean {
  if (localStorageAvailable !== null) return localStorageAvailable;
  try {
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    localStorageAvailable = true;
  } catch {
    localStorageAvailable = false;
  }
  return localStorageAvailable;
}

export function getItem(key: string): string | null {
  if (isLocalStorageAvailable()) {
    return window.localStorage.getItem(key);
  }
  return memoryFallback.get(key) ?? null;
}

export function setItem(key: string, value: string): void {
  if (isLocalStorageAvailable()) {
    window.localStorage.setItem(key, value);
    return;
  }
  memoryFallback.set(key, value);
}

export function removeItem(key: string): void {
  if (isLocalStorageAvailable()) {
    window.localStorage.removeItem(key);
    return;
  }
  memoryFallback.delete(key);
}

export function isPersistent(): boolean {
  return isLocalStorageAvailable();
}
