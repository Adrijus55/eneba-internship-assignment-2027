import { useEffect, useState } from 'react';

export async function readJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(response.status === 404 ? 'This item could not be found.' : 'Could not load data. Refresh to try again.');
  return response.json();
}

export function useData<T>(load: (signal: AbortSignal) => Promise<T>, dependencies: readonly unknown[]) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then(result => {
      if (!controller.signal.aborted) {
        setData(result);
        setError('');
      }
    }).catch((failure: Error) => {
      if (!controller.signal.aborted) setError(failure.message);
    });
    return () => controller.abort();
  }, dependencies);

  return { data, error };
}
