export function parsePageParam(search: string, key = 'page'): number {
  const raw = Number(new URLSearchParams(search).get(key));
  return Number.isInteger(raw) && raw > 0 ? raw : 1;
}
