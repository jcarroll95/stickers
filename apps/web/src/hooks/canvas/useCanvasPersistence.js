import { useState, useCallback } from 'react';
import apiClient from '../../services/apiClient.jsx';
import {
  generateOpId,
  storePendingOperation,
  completeOperation,
  failOperation
} from '../../utils/operationIdGenerator.js';

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

    // Generate operation ID for idempotency
    const opId = generateOpId();

    try {
      const maxZ = (persistedStickers || [])
        .filter(s => s?.stuck)
        .reduce((acc, s) => Math.max(acc, s.zIndex || 0), 0);

      const payload = {
        stickerId: last.stickerId,
        x: last.x,
        y: last.y,
        scale: last.scale,
        rotation: last.rotation,
        zIndex: maxZ + 1,
        opId // Include operation ID
      };

      // Store as pending operation
      storePendingOperation(opId, {
        type: 'placeSticker',
        boardId,
        payload
      });

      const response = await apiClient.post(`/stickerboards/${boardId}/stix`, payload);

      // Check if operation was already completed (cached response)
      if (response.data.cached) {
        console.log('[useCanvasPersistence] Operation already completed:', opId);
      }

      // Mark operation as complete
      completeOperation(opId);

      const next = placements.slice(0, -1);
      persistPlacements(next);
      window.dispatchEvent(new CustomEvent('stickerboard:finalized', { detail: { boardId, opId } }));
    } catch (err) {
      console.error('[useCanvasPersistence] Finalize failed:', err);

      // Handle specific error cases
      if (err.response?.status === 409) {
        // Operation already in progress or completed
        console.warn('[useCanvasPersistence] Operation conflict (409):', opId);
        completeOperation(opId); // Remove from pending since server has it
      } else {
        // Mark as failed for potential retry
        failOperation(opId, err.message);
      }

      // Re-throw to allow caller to handle
      throw err;
    }
  }, [boardId, isControlled, placements, persistPlacements, persistedStickers]);

  return { placements, setPlacements, persistPlacements, finalizeLatestPlacement };
}
