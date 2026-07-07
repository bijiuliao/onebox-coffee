// Guards admin-only API operations with HTTP Basic Auth, checked against
// ADMIN_USER/ADMIN_PASSWORD Netlify environment variables. The customer-facing
// endpoints (menu browsing, checkout) never call this.
export function requireAdmin(req: Request): Response | null {
  const expectedUser = process.env.ADMIN_USER || 'admin';
  const expectedPass = process.env.ADMIN_PASSWORD;

  if (!expectedPass) {
    return new Response(JSON.stringify({ error: 'ADMIN_PASSWORD is not configured on this site' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Basic ')) {
    const decoded = atob(auth.slice(6));
    const sep = decoded.indexOf(':');
    const user = decoded.slice(0, sep);
    const pass = decoded.slice(sep + 1);
    if (user === expectedUser && pass === expectedPass) return null;
  }

  return new Response(JSON.stringify({ error: 'authentication required' }), {
    status: 401,
    headers: {
      'content-type': 'application/json',
      'WWW-Authenticate': 'Basic realm="onebox admin"',
    },
  });
}
