const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost/api';

export async function request(method: string, path: string, body: unknown = null, token?: string | null) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    // Clerk handles redirects via middleware
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    const requestError = Object.assign(new Error(err.message || 'Request failed'), {
      status: res.status,
      details: err,
    });
    throw requestError;
  }

  return res.json();
}
