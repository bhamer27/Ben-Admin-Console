import { useState, useEffect, useCallback } from "react";

interface FetchState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  configured: boolean;
  refetch: () => void;
}

export function useFetch<T>(
  url: string,
  options?: { refreshInterval?: number },
): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(url, { credentials: "include" })
      .then(async (res) => {
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          if (json?.configured === false) {
            setConfigured(false);
            setError(json.error ?? "Not configured");
          } else {
            setConfigured(true);
            setError(json.error ?? `Error ${res.status}`);
          }
          setData(null);
        } else {
          setData(json as T);
          setConfigured(true);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [url, tick]);

  useEffect(() => {
    if (!options?.refreshInterval) return;
    const id = setInterval(refetch, options.refreshInterval);
    return () => clearInterval(id);
  }, [options?.refreshInterval, refetch]);

  return { data, error, loading, configured, refetch };
}
