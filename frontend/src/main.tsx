import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './store.css';
import { Catalog, Home, Search } from './catalog';
import { readJson, useData } from './data';
import { AccountForm, AccountMenu } from './account';
import { euros, Orders, Payment } from './orders';
import { cartKey, loadCart } from './cart';

type Product = { id: number; name: string };
type Offer = {
  id: number;
  product_id: number;
  product_name: string;
  seller_name: string;
  price_cents: number;
  available_keys: number;
};
type ProductDetails = Product & { description: string; platform: string; region: string; offers: Offer[] };
type CartOffer = { id: number; offer: Offer | null };

function Details({ id, cart, add }: { id: string; cart: number[]; add: (id: number) => void }) {
  const { data: product, error } = useData(signal => readJson<ProductDetails>('/api/products/' + id, signal), [id]);
  if (error) return <p role="alert">{error}</p>;
  if (!product) return <p role="status">Loading game…</p>;

  return <>
    <h1>{product.name}</h1>
    <p className="product-meta">{product.platform} · {product.region}</p>
    <p>{product.description}</p>
    <h2>Seller offers</h2>
    {product.offers.length === 0 && <p>No seller offers yet.</p>}
    <ul>
      {product.offers.map(offer => <li className="offer" key={offer.id}>
        <div><strong>{offer.seller_name}</strong><br />{offer.available_keys} available</div>
        <span>{euros.format(offer.price_cents / 100)}</span>
        <button disabled={offer.available_keys === 0 || cart.includes(offer.id)} onClick={() => add(offer.id)}>
          {cart.includes(offer.id) ? 'In cart' : offer.available_keys === 0 ? 'Sold out' : 'Add to cart'}
        </button>
      </li>)}
    </ul>
  </>;
}

function Cart({ ids, remove, checkout = false }: { ids: number[]; remove: (id: number) => void; checkout?: boolean }) {
  const { data: selections, error } = useData(signal => Promise.all(ids.map(async id => {
    const response = await fetch('/api/offers/' + id, { signal, headers: { Accept: 'application/json' } });
    if (response.status === 404) return { id, offer: null };
    if (!response.ok) throw new Error('Could not load the cart. Refresh to try again.');
    return { id, offer: await response.json() as Offer };
  })), [ids]);
  const ready = !error && ids.length > 0 && selections?.length === ids.length && selections.every(row => ids.includes(row.id));
  const available = selections?.every(row => row.offer && row.offer.available_keys > 0);

  return <>
    <h1>{checkout ? 'Checkout' : 'Cart'}</h1>
    {ids.length === 0 && <p>Your cart is empty.</p>}
    {ids.length > 0 && error && <p role="alert">{error}</p>}
    {ids.length > 0 && !error && !selections && <p role="status">Loading cart…</p>}
    {!error && <ul>
      {selections?.filter(({ id }) => ids.includes(id)).map(({ id, offer }: CartOffer) => <li className="offer" key={id}>
        <div>{offer ? <>
          <a href={'/products/' + offer.product_id}>{offer.product_name}</a>
          <br />{offer.seller_name}{offer.available_keys === 0 && ' · Sold out'}
        </> : 'This offer is no longer available.'}</div>
        {offer && <span>{euros.format(offer.price_cents / 100)}</span>}
        {!checkout && <button onClick={() => remove(id)}>Remove</button>}
      </li>)}
    </ul>}
    {ready && !available && <p>Remove unavailable offers from <a href="/cart">your cart</a> to continue.
      {' '}Already confirmed a purchase? <a href="/orders">View order history</a>.</p>}
    {ready && !checkout && available && <a href="/checkout">Checkout</a>}
    {ready && checkout && selections.every(row => row.offer) &&
      <Payment key={ids.join(',')} available={!!available}
        items={selections.map(({ offer }) => ({ offer_id: offer!.id, price_cents: offer!.price_cents }))} />}
  </>;
}

function Store() {
  const [ids, setIds] = useState(loadCart);
  const [storageError, setStorageError] = useState(false);
  const product = /^\/products\/([0-9]+)\/?$/.exec(location.pathname);
  const isCart = /^\/cart\/?$/.test(location.pathname);
  const path = location.pathname.replace(/\/$/, '');
  const isAccount = path === '/login' || path === '/register';

  useEffect(() => {
    function sync(event: StorageEvent) {
      if (event.key === cartKey || event.key === null) setIds(loadCart());
    }
    function restore(event: PageTransitionEvent) {
      if (event.persisted) setIds(loadCart());
    }
    window.addEventListener('storage', sync);
    window.addEventListener('pageshow', restore);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('pageshow', restore);
    };
  }, []);

  function saveCart(next: number[]) {
    try {
      localStorage.setItem(cartKey, JSON.stringify(next));
      setIds(next);
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }

  return <main>
    <nav aria-label="Store">
      <a className="store-brand" href="/">Indie Relay</a>
      <Search />
      <a href="/catalog">Catalog</a>
      <a href="/cart">Cart ({ids.length})</a>
      <AccountMenu />
    </nav>
    {storageError && <p role="alert">Your browser could not save the cart.</p>}
    {isCart && <Cart ids={ids} remove={id => saveCart(ids.filter(item => item !== id))} />}
    {product && <Details id={product[1]} cart={ids} add={id => {
      if (!ids.includes(id)) saveCart([...ids, id]);
    }} />}
    {isAccount && <AccountForm register={path === '/register'} />}
    {path === '/checkout' && <Cart ids={ids} checkout remove={() => {}} />}
    {(path === '/orders' || path.startsWith('/orders/')) && <Orders id={path.split('/')[2]} />}
    {path === '' && <Home />}
    {path === '/catalog' && <Catalog />}
  </main>;
}

createRoot(document.getElementById('root')!).render(<Store />);
