/**
 * Minimal async-loader hook. Re-fetches whenever the optional `deps` change.
 * We intentionally keep this small rather than pulling in react-query — the
 * screens don't need caching/invalidation beyond what we trigger manually
 * via the returned `reload` callback.
 */
import { useCallback, useEffect, useState } from 'react';
import { extractError } from '../api/client';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  setData: (v: T) => void;
}

export function useAsync<T>(
  fn: () => Promise<T>,
  deps: ReadonlyArray<unknown> = []
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fn()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(extractError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  return { data, loading, error, reload, setData };
}
