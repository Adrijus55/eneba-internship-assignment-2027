import { useEffect, useState } from 'react';
import { readSession } from './account';
import { cartKey, loadCart } from './cart';
import { useData } from './data';

type Item = { offer_id: number; price_cents: number };
type Attempt = { request_id: string; items: Item[] };
type Summary = { id: number; created_at: string; total_cents: number };
type Receipt = { id: number; items: { product_name: string; seller_name: string; price_cents: number; code: string }[] };

export const euros = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });

export function Payment({ items, available }: { items: Item[]; available: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sorted = [...items].sort((a,b) => a.offer_id - b.offer_id);
  const selection = sorted.map(item => item.offer_id).join(',');
  const { data: payment, error: loadError } = useData(async () => {
    const session = await readSession();
    if (!session.user) { location.assign('/login'); return; }
    const slot = 'eneba-purchase-' + session.user.id + '-' + selection;
    return { slot, token: session.csrfToken, pending: localStorage.getItem(slot) !== null };
  }, [selection, available]);

  async function confirm(slot: string, token: string) {
    // Another tab may have finished this cart while this tab was waiting.
    if (loadCart().sort((a,b) => a - b).join(',') !== selection) {
      throw new Error('Your cart changed. Review it before confirming.');
    }
    const saved = localStorage.getItem(slot);
    if (!available && !saved) throw new Error('This offer is unavailable. Review your cart.');
    const attempt: Attempt = saved ? JSON.parse(saved) : { request_id: crypto.randomUUID(), items: sorted };
    localStorage.setItem(slot, JSON.stringify(attempt));
    let response: Response;
    try {
      response = await fetch('/api/checkout', {
        method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': token },
        body: JSON.stringify(attempt),
      });
    } catch {
      throw new Error('The store did not return a receipt. Retry this purchase or check your order history.');
    }
    if (response.status === 401) { location.assign('/login'); return; }
    if (response.status === 419) throw new Error('Your session changed. Refresh before trying again.');
    if (response.status === 409) {
      localStorage.removeItem(slot);
      throw new Error((await response.json()).message + ' Refresh before trying again.');
    }
    if (!response.ok) throw new Error('Could not confirm the purchase. Please try again.');
    const { order_id } = await response.json();
    const remaining = loadCart().filter(id => !sorted.some(item => item.offer_id === id));
    localStorage.setItem(cartKey, JSON.stringify(remaining));
    localStorage.removeItem(slot);
    location.assign('/orders/' + order_id);
  }

  async function pay() {
    if (busy || !payment) return;
    setBusy(true);
    setError('');
    try {
      await navigator.locks.request('eneba-cart-checkout', () => confirm(payment.slot, payment.token));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Please try again.');
      setBusy(false);
    }
  }
  if (loadError) return <p role="alert">{loadError}</p>;
  if (!payment) return <p role="status">Checking purchase…</p>;
  if (!available && !payment.pending) return null;
  return <>
    {available && <p>Total <strong>{euros.format(items.reduce((sum, item) => sum + item.price_cents, 0) / 100)}</strong></p>}
    <button disabled={busy} onClick={pay}>{available ? 'Confirm simulated purchase' : 'Recover previous receipt'}</button>
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
