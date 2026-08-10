type Listener = () => void;

const listeners: Record<string, Set<Listener>> = {};

/** 탭을 이미 보고 있는 상태에서 그 탭 아이콘을 다시 누르면 각 화면이 첫 화면으로 되돌아가도록 구독한다. */
export function onTabReset(tabKey: string, listener: Listener): () => void {
  if (!listeners[tabKey]) listeners[tabKey] = new Set();
  listeners[tabKey].add(listener);
  return () => {
    listeners[tabKey]?.delete(listener);
  };
}

export function emitTabReset(tabKey: string) {
  listeners[tabKey]?.forEach((listener) => listener());
}
