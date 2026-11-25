import { useEffect, useState, type FormEvent } from 'react';

type User = { id: number; email: string };
type Session = { user: User | null; csrfToken: string };

export async function readSession(): Promise<Session> {
  const response = await fetch('/api/session', { headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load your session. Refresh and try again.');
  return response.json();
}

async function submitAccount(action: string, data: Record<string, string> = {}) {
  const { csrfToken } = await readSession();
  const response = await fetch('/api/' + action, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': csrfToken },
    body: JSON.stringify(data),
  });
  if (response.ok) return;
  if (response.status === 429) throw new Error('Too many attempts. Try again in a minute.');
  if (response.status === 419) throw new Error('Your session expired. Please try again.');
  if (response.status === 422) {
    const result: { errors: Record<string, string[]> } = await response.json();
    throw new Error(Object.values(result.errors).flat().join(' '));
  }
  throw new Error('Could not complete the request. Please try again.');
}

export function AccountMenu() {
  const [user, setUser] = useState<User | null>();
  const [error, setError] = useState('');
  useEffect(() => {
    readSession().then(session => setUser(session.user)).catch(() => setError('Could not load account.'));
  }, []);

  async function logout() {
    try {
      await submitAccount('logout');
      window.location.assign('/');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Sign out failed.');
    }
  }

  return <div className="account-menu">
    {user && <><a href="/orders">Order history</a><span>{user.email}</span><button onClick={logout}>Sign out</button></>}
    {user === null && <a href="/login">Sign in</a>}
    {error && <span role="alert">{error}</span>}
  </div>;
}

export function AccountForm({ register }: { register: boolean }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const fields = { email: String(form.get('email')), password: String(form.get('password')) };
    setBusy(true);
    setError('');
    try {
      await submitAccount(register ? 'register' : 'login', register
        ? { ...fields, password_confirmation: String(form.get('password_confirmation')) } : fields);
      window.location.assign('/cart');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Please try again.');
      setBusy(false);
    }
  }

  const title = register ? 'Create account' : 'Sign in';
  return <section className="account-card" aria-labelledby="account-title">
    <h1 id="account-title">{title}</h1>
    <form className="account-form" onSubmit={submit}>
      <label>Email<input name="email" type="email" autoComplete="email" required /></label>
      <label>Password<input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'}
        minLength={register ? 12 : undefined} required /></label>
      {register && <>
        <small>Use at least 12 characters.</small>
        <label>Confirm password<input name="password_confirmation" type="password" autoComplete="new-password" required /></label>
      </>}
      {error && <p role="alert">{error}</p>}
      <button disabled={busy}>{title}</button>
      <a href={register ? '/login' : '/register'}>{register ? 'Sign in instead' : 'Create an account'}</a>
    </form>
  </section>;
}
