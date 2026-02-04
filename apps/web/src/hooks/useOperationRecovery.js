import { useEffect, useCallback, useState } from 'react';
import {
  getPendingOperations,
  completeOperation,
  cleanupOldOperations
} from '../utils/operationIdGenerator.js';
import apiClient from '../services/apiClient.jsx';

/**
 * Hook to recover and reconcile pending operations on app load
 * Checks localStorage for pending operations and validates them with the server
 */
export function useOperationRecovery() {
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveredCount, setRecoveredCount] = useState(0);

  const recoverOperations = useCallback(async () => {
    setIsRecovering(true);

    try {
      // Clean up old operations first (older than 24 hours)
      cleanupOldOperations();

      const pending = getPendingOperations();
      const opIds = Object.keys(pending);

      if (opIds.length === 0) {
        setIsRecovering(false);
        return;
      }

      console.log(`[OperationRecovery] Found ${opIds.length} pending operations`);

      let recovered = 0;

      // Check each pending operation with the server
      for (const opId of opIds) {
        const operation = pending[opId];

        try {
          // Attempt to query the operation status
          // We'll retry the operation with the same opId
          // If it was completed, server will return cached result
          // If it's still pending or failed, we can decide what to do

          if (operation.type === 'placeSticker' && operation.payload) {
            const response = await apiClient.post(
              `/stickerboards/${operation.boardId}/stix`,
              operation.payload // includes opId
            );

            if (response.data.success || response.data.cached) {
              // Operation completed successfully or was already completed
              completeOperation(opId);
              recovered++;
              console.log(`[OperationRecovery] Recovered operation ${opId}`);
            }
          }
        } catch (err) {
          // Check if it's a 409 (already completed or in progress)
          if (err.response?.status === 409) {
            completeOperation(opId);
            recovered++;
            console.log(`[OperationRecovery] Operation ${opId} already processed`);
          } else {
            // For other errors, log but don't remove from pending
            // User can manually retry later
            console.warn(`[OperationRecovery] Failed to recover ${opId}:`, err.message);
          }
        }
      }

      setRecoveredCount(recovered);
      console.log(`[OperationRecovery] Recovered ${recovered} of ${opIds.length} operations`);
    } catch (err) {
      console.error('[OperationRecovery] Recovery process failed:', err);
    } finally {
      setIsRecovering(false);
    }
  }, []);

  // Run recovery on mount
  useEffect(() => {
    recoverOperations();
  }, [recoverOperations]);

  return {
    isRecovering,
    recoveredCount,
    recoverOperations
  };
}

/**
 * Hook to monitor and display pending operations count
 */
export function usePendingOperationsCount() {
  const [count, setCount] = useState(0);

  const updateCount = useCallback(() => {
    const pending = getPendingOperations();
    const pendingOps = Object.values(pending).filter(op => op.status === 'pending');
    setCount(pendingOps.length);
  }, []);

  useEffect(() => {
    updateCount();

    // Listen for operation events
    const handleFinalized = () => updateCount();
    window.addEventListener('stickerboard:finalized', handleFinalized);

    // Poll every 5 seconds as a backup
    const interval = setInterval(updateCount, 5000);

    return () => {
      window.removeEventListener('stickerboard:finalized', handleFinalized);
      clearInterval(interval);
    };
  }, [updateCount]);

  return count;
}
