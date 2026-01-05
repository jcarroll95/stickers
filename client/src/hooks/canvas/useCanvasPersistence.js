import { useState, useCallback } from 'react';
import apiClient from '../../services/apiClient';

export function useCanvasPersistence(boardId, isControlled, stickers, persistedStickers) {
  const storageKey = `stickerboard:${boardId}:placements`;
  
  const [placements, setPlacements] = useState(() => {
    if (Array.isArray(stickers)) return [];
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const persistPlacements = useCallback((next) => {
    if (isControlled) return;
    setPlacements(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  }, [storageKey, isControlled]);

  const finalizeLatestPlacement = useCallback(async () => {
    if (isControlled) return;
    const last = placements[placements.length - 1];
    if (!last) return;
    
    try {
      const maxZ = (persistedStickers || [])
        .filter(s => s?.stuck)
        .reduce((acc, s) => Math.max(acc, s.zIndex || 0), 0);

      await apiClient.post(`/stickerboards/${boardId}/stix`, {
        stickerId: last.stickerId,
        x: last.x,
        y: last.y,
        scale: last.scale,
        rotation: last.rotation,
        zIndex: maxZ + 1,
      });

      const next = placements.slice(0, -1);
      persistPlacements(next);
      window.dispatchEvent(new CustomEvent('stickerboard:finalized', { detail: { boardId } }));
    } catch (err) {
      console.error('[useCanvasPersistence] Finalize failed:', err);
    }
  }, [boardId, isControlled, placements, persistPlacements, persistedStickers]);

  return { placements, setPlacements, persistPlacements, finalizeLatestPlacement };
}
