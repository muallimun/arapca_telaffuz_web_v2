import { useEffect, useId, useRef } from "react";

interface ModalStackEntry {
  id: string;
  onClose?: () => void;
}

const activeModalStack: ModalStackEntry[] = [];
let escapeListenerAttached = false;

export interface EscapeKeyLikeEvent {
  key?: string;
  defaultPrevented?: boolean;
  preventDefault?: () => void;
  stopPropagation?: () => void;
  stopImmediatePropagation?: () => void;
}

/**
 * Yığının en üstündeki aktif modal/katman için Escape kapatma eylemini tetikler
 * ve olayın alttaki katmanlara yayılmasını (e.stopPropagation / stopImmediatePropagation) keser.
 */
export function dispatchEscapeToTopModal(event?: EscapeKeyLikeEvent): boolean {
  if (activeModalStack.length === 0) return false;
  const topEntry = activeModalStack[activeModalStack.length - 1];
  if (!topEntry) return false;

  event?.preventDefault?.();
  event?.stopPropagation?.();
  event?.stopImmediatePropagation?.();
  topEntry.onClose?.();
  return true;
}

function handleWindowCaptureKeyDown(e: KeyboardEvent): void {
  if (e.key !== "Escape") return;
  if (activeModalStack.length === 0) return;

  const topEntry = activeModalStack[activeModalStack.length - 1];
  if (!topEntry || !isTopModal(topEntry.id)) return;

  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  topEntry.onClose?.();
}

function syncGlobalEscapeListener(): void {
  if (typeof window === "undefined") return;
  if (activeModalStack.length > 0 && !escapeListenerAttached) {
    window.addEventListener("keydown", handleWindowCaptureKeyDown, {
      capture: true,
    });
    escapeListenerAttached = true;
  } else if (activeModalStack.length === 0 && escapeListenerAttached) {
    window.removeEventListener("keydown", handleWindowCaptureKeyDown, {
      capture: true,
    });
    escapeListenerAttached = false;
  }
}

/**
 * Yeni açılan bir modal/katmanı LIFO yığınının en üstüne kaydeder.
 * Temizleme (unregister) fonksiyonunu döndürür.
 */
export function registerModal(id: string, onClose?: () => void): () => void {
  const existingIdx = activeModalStack.findIndex((item) => item.id === id);
  if (existingIdx !== -1) {
    activeModalStack.splice(existingIdx, 1);
  }
  activeModalStack.push({ id, onClose });
  syncGlobalEscapeListener();

  return () => {
    unregisterModal(id);
  };
}

/**
 * Belirtilen kimliğe sahip katmanı modal yığınından çıkarır.
 */
export function unregisterModal(id: string): void {
  const idx = activeModalStack.findIndex((item) => item.id === id);
  if (idx !== -1) {
    activeModalStack.splice(idx, 1);
    syncGlobalEscapeListener();
  }
}

/**
 * Verilen kimliğin şu anda en üstteki aktif katman olup olmadığını döndürür.
 */
export function isTopModal(id: string): boolean {
  if (activeModalStack.length === 0) return false;
  return activeModalStack[activeModalStack.length - 1]?.id === id;
}

/**
 * Test ve tanılama amaçlı mevcut yığın kimliklerinin kopyasını döndürür.
 */
export function getModalStackIds(): string[] {
  return activeModalStack.map((entry) => entry.id);
}

/**
 * Test ortamında yığını sıfırlar.
 */
export function clearModalStackForTests(): void {
  activeModalStack.length = 0;
  syncGlobalEscapeListener();
}

/**
 * Merkezi Escape tuşu kancası: Yalnızca en üstteki aktif modal/katman kapanır,
 * alttaki oyun, çekmece veya diyalog ekranları etkilenmez.
 */
export function useEscapeKey(
  onClose: () => void,
  isActive = true,
  customId?: string
): void {
  const reactId = useId();
  const modalId = customId || `modal_${reactId}`;
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isActive) return;
    return registerModal(modalId, () => {
      onCloseRef.current();
    });
  }, [isActive, modalId]);
}
