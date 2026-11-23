import { useEffect, useState } from 'react';
import { readSession } from './account';

type Item = { offer_id: number; price_cents: number };
type Attempt = { request_id: string; items: Item[] };
type Summary = { id: number; created_at: string; total_cents: number };
type Receipt = { id: number; items: { product_name: string; seller_name: string; price_cents: number; code: string }[] };

export const euros = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });

export function Payment({ items, complete }: { items: Item[]; complete: (id: number) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function pay() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const session = await readSession();
      if (!session.user) { location.assign('/login'); return; }
      const sorted = [...items].sort((a,b) => a.offer_id - b.offer_id);
      const slot = 'eneba-purchase-' + session.user.id + '-' + sorted.map(item => item.offer_id).join(',');
      const saved = localStorage.getItem(slot);
      const attempt: Attempt = saved ? JSON.parse(saved) : { request_id: crypto.randomUUID(), items: sorted };
      localStorage.setItem(slot, JSON.stringify(attempt));
      const response = await fetch('/api/checkout', {
        method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': session.csrfToken },
        body: JSON.stringify(attempt),
      });
      if (response.status === 401) { location.assign('/login'); return; }
      if (response.status === 409) {
        localStorage.removeItem(slot);
        throw new Error((await response.json()).message + ' Refresh before trying again.');
      }
      if (!response.ok) throw new Error('Could not confirm the purchase. Please try again.');
      const { order_id } = await response.json();
      complete(order_id);
      localStorage.removeItem(slot);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Please try again.');
      setBusy(false);
    }
  }
  return <>
    <p>Total <strong>{euros.format(items.reduce((sum, item) => sum + item.price_cents, 0) / 100)}</strong></p>
    <button disabled={busy} onClick={pay}>Confirm simulated purchase</button>
    {error && <p role="alert">{error}</p>}
  </>;
}

export function Orders({ id }: { id?: string }) {
  const [orders, setOrders] = useState<Summary[]>();
  const [receipt, setReceipt] = useState<Receipt>();
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    function restore(event: PageTransitionEvent) {
      if (event.persisted) location.reload();
    }
    window.addEventListener('pageshow', restore);
    async function load() {
      const response = await fetch(id ? '/api/orders/' + id : '/api/orders', {
        signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/json' },
      });
      if (response.status === 401) { location.assign('/login'); return; }
      if (!response.ok) throw new Error(response.status === 404 ? 'Order not found.' : 'Could not load orders.');
      if (id) setReceipt(await response.json());
      else setOrders(await response.json());
    }
    load().catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => {
      controller.abort();
      window.removeEventListener('pageshow', restore);
    };
  }, [id]);
  return <>
    <h1>{id ? 'Order #' + id : 'Order history'}</h1>
    {error && <p role="alert">{error}</p>}
    {!error && !orders && !receipt && <p role="status">Loading…</p>}
    {orders?.length === 0 && <p>You have no purchases yet.</p>}
    {orders && <ul>{orders.map(order => <li key={order.id}>
      <a href={'/orders/' + order.id}>Order #{order.id}</a> · {euros.format(order.total_cents / 100)}
    </li>)}</ul>}
    {receipt && <ul>{receipt.items.map(item => <li key={item.code}>
      <strong>{item.product_name}</strong> · {item.seller_name} · {euros.format(item.price_cents / 100)}
      <p>Digital key <code>{item.code}</code></p>
    </li>)}</ul>}
  </>;
}
