/** A chat push arrived: the open chat screen fetches new messages at once. */
type Fn = () => void;
const listeners = new Set<Fn>();

export function onChatPoke(fn: Fn): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function pokeChat(): void {
  listeners.forEach((fn) => fn());
}

export function chatOpen(): boolean {
  return listeners.size > 0;
}
