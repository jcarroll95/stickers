import { useState, useCallback, useMemo, useEffect } from 'react';
import apiClient from '../services/apiClient.jsx';

export function useBoardData(token) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [board, setBoard] = useState(null);

  const loadBoard = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      let boardData;
      try {
        const response = await apiClient.get(`/stickerboards/${encodeURIComponent(token)}`);
        boardData = response.data || response;
      } catch (err) {
        if (err.response?.status === 404) {
          const qRes = await apiClient.get(`/stickerboards?slug=${encodeURIComponent(token)}&limit=1`);
          const list = qRes.data || qRes;
          boardData = Array.isArray(list) ? list[0] : (list?.data?.[0] || null);
        } else {
          throw err;
        }
      }
      setBoard(boardData);
    } catch (err) {
      setError(err.message || 'Failed to load board');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  return { board, loading, error, refreshBoard: loadBoard };
}

export function useMe() {
  const [me, setMe] = useState(null);

  const loadMe = useCallback(async () => {
    try {
      const response = await apiClient.get('/auth/me');
      console.log('refreshMe() got user seed-data:', response.data?.cheersStickers);
      setMe(response.data || response);
    } catch (err) {
      setMe(null);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  return { me, refreshMe: loadMe };
}
