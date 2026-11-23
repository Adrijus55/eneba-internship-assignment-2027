import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './store.css';

type Product = { id: number; name: string };

function Store() {
  const [products, setProducts] = useState<Product[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts() {
      try {
        const response = await fetch('/api/products', { signal: controller.signal });
        if (!response.ok) throw new Error('Product request failed');
        setProducts(await response.json());
        setStatus('ready');
      } catch {
        if (!controller.signal.aborted) setStatus('error');
      }
    }

    void loadProducts();
    return () => controller.abort();
  }, []);

  return <main>
    <h1>Game store</h1>
    {status === 'loading' && <p role="status">Loading games…</p>}
    {status === 'error' && <p role="alert">Games could not be loaded. Please refresh to try again.</p>}
    {status === 'ready' && (products.length
      ? <ul>{products.map(product => <li key={product.id}>{product.name}</li>)}</ul>
      : <p>No games are available yet.</p>)}
  </main>;
}

createRoot(document.getElementById('root')!).render(<Store />);
