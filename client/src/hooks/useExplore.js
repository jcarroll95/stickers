import { useState, useCallback, useEffect } from 'react';
import apiClient from '../services/apiClient';
import { parseError } from '../utils/errorUtils';

export function useExplore(initialPage = 1) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(initialPage);
  const [hasPrev, setHasPrev] = useState(false);
  const [hasNext, setHasNext] = useState(false);

  const loadPage = useCallback(async (p) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/stickerboards?page=${p}&limit=9`);
      const data = response;
      setItems(data.data || (Array.isArray(data) ? data : []));
      setPage(data.pagination?.page || p);
      setHasPrev(!!data.pagination?.prev);
      setHasNext(!!data.pagination?.next);

    } catch (err) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPage(page);
  }, [page, loadPage]);

  return { items, loading, error, page, setPage, hasPrev, hasNext, loadPage };
}
