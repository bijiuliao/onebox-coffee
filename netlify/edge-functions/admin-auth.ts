import type { Context } from '@netlify/edge-functions';

// Gates the /admin* pages themselves (not just the API) behind a browser-native
// Basic Auth prompt, so the admin UI shell isn't publicly loadable either.
export default async (request: Request, context: Context) => {
  const expectedUser = Netlify.env.get('ADMIN_USER') || 'admin';
  const expectedPass = Netlify.env.get('ADMIN_PASSWORD');

  if (!expectedPass) {
    return new Response('ADMIN_PASSWORD is not configured on this site', { status: 500 });
  }

  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Basic ')) {
    const decoded = atob(auth.slice(6));
    const sep = decoded.indexOf(':');
    if (decoded.slice(0, sep) === expectedUser && decoded.slice(sep + 1) === expectedPass) {
      return context.next();
    }
  }

  return new Response('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="onebox admin"' },
  });
};
