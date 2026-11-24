import { useState, type FormEvent } from 'react';
import { readJson, useData } from './data';
import { euros } from './orders';

type ProductCard = {
  id: number;
  name: string;
  platform: string;
  region: string;
  artwork: string;
  price_cents: number | null;
  list_price_cents: number | null;
};

function Cards({ products }: { products: ProductCard[] }) {
  return <ul className="catalog">
    {products.map(product => <li className="game-card" key={product.id}>
      <a href={'/products/' + product.id}>
        <div className="cover" data-art={product.artwork} aria-hidden="true" />
        <div className="game-info">
          <h3>{product.name}</h3>
          <p>{product.platform} · {product.region}</p>
          {product.price_cents === null ? <span>Sold out</span> : <>
            {product.list_price_cents !== null && product.price_cents < product.list_price_cents &&
              <del>{euros.format(product.list_price_cents / 100)}</del>}
            <strong>From {euros.format(product.price_cents / 100)}</strong>
          </>}
        </div>
      </a>
    </li>)}
  </ul>;
}

type Banner = { label: string; title: string; description: string; button_label: string };

export function Home() {
  const { data: banner, error } = useData(signal => readJson<Banner | null>('/api/home/banner', signal), []);
  return <>
    {error && <p role="alert">{error}</p>}
    {banner === undefined && !error && <p role="status">Loading promotion…</p>}
    {banner && <section className="hero">
      <div className="hero-copy">
        <p className="hero-label">{banner.label}</p>
        <h1>{banner.title}</h1>
        <p>{banner.description}</p>
        <a className="hero-button" href="/catalog">{banner.button_label}</a>
      </div>
      <div className="hero-art" aria-hidden="true"><div /></div>
    </section>}
    <HomeSection title="Best sellers" endpoint="best-sellers" />
    <HomeSection title="Deals" endpoint="deals" />
  </>;
}

function HomeSection({ title, endpoint }: { title: string; endpoint: string }) {
  const { data: products, error } = useData(signal => readJson<ProductCard[]>('/api/home/' + endpoint, signal), [endpoint]);
  return <section className="home-section">
    <h2>{title}</h2>
    {error && <p role="alert">{error}</p>}
    {!products && !error && <p role="status">Loading games…</p>}
    {products?.length === 0 && <p>No games in this section right now.</p>}
    {products && products.length > 0 && <Cards products={products} />}
  </section>;
}

export function Search() {
  const params = new URLSearchParams(location.search);
  return <form className="global-search" role="search" action="/catalog">
    <input type="search" name="q" maxLength={100} defaultValue={params.get('q') ?? ''}
      aria-label="Search games" placeholder="Search games" />
    <button>Search</button>
  </form>;
}

export function Catalog() {
  const [params] = useState(() => new URLSearchParams(location.search));
  const [filterError, setFilterError] = useState('');
  const query = params.toString();
  const search = params.get('q')?.trim();
  const { data: products, error } = useData(signal => readJson<ProductCard[]>('/api/products?' + query, signal), [query]);
  const { data: filters, error: optionsError } = useData(signal =>
    readJson<{ platforms: string[]; regions: string[] }>('/api/products/filters', signal), []);

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    if (search) next.set('q', search);
    form.forEach((value, key) => {
      if (!value) return;
      const isPrice = key === 'min_price' || key === 'max_price';
      next.set(key, isPrice ? String(Math.round(Number(value) * 100)) : String(value));
    });
    const min = next.get('min_price');
    const max = next.get('max_price');
    if (min !== null && max !== null && Number(min) > Number(max)) {
      setFilterError('The minimum price must be at most the maximum price.');
      return;
    }
    location.assign('/catalog' + (next.size ? '?' + next.toString() : ''));
  }

  return <>
    <h1>{search ? 'Results for “' + search + '”' : 'Game catalog'}</h1>
    <form className="catalog-filters" onSubmit={apply}>
      <label>Platform<select name="platform" aria-label="Platform" defaultValue={params.get('platform') ?? ''} disabled={!filters} key={'platform-' + !!filters}>
        <option value="">All platforms</option>
        {filters?.platforms.map(platform => <option key={platform}>{platform}</option>)}
      </select></label>
      <label>Region<select name="region" aria-label="Region" defaultValue={params.get('region') ?? ''} disabled={!filters} key={'region-' + !!filters}>
        <option value="">All regions</option>
        {filters?.regions.map(region => <option key={region}>{region}</option>)}
      </select></label>
      <label>Min. price (€)<input name="min_price" type="number" step="0.01" min="0" max="1000000"
        defaultValue={params.has('min_price') ? Number(params.get('min_price')) / 100 : ''} /></label>
      <label>Max. price (€)<input name="max_price" type="number" step="0.01" min="0" max="1000000"
        defaultValue={params.has('max_price') ? Number(params.get('max_price')) / 100 : ''} /></label>
      <label>Sort by<select name="sort" aria-label="Sort by" defaultValue={params.get('sort') ?? ''}>
        <option value="">Default</option>
        <option value="price_asc">Price low to high</option>
        <option value="price_desc">Price high to low</option>
      </select></label>
      <button>Apply filters</button>
      <a href={search ? '/catalog?q=' + encodeURIComponent(search) : '/catalog'}>Clear filters</a>
    </form>
    {(filterError || optionsError || error) && <p role="alert">{filterError || optionsError || error}</p>}
    {!products && !error && <p role="status">Loading games…</p>}
    {products?.length === 0 && <p>No games match your search and filters.</p>}
    {products && products.length > 0 && <Cards products={products} />}
  </>;
}
