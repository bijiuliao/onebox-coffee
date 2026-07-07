import type { Config } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { pathSegments } from './lib/coffees';

export default async (req: Request) => {
  const key = decodeURIComponent(pathSegments(req)[2] ?? '');
  if (!key) return new Response('missing key', { status: 400 });

  const store = getStore('coffee-covers');
  const result = await store.getWithMetadata(key, { type: 'arrayBuffer' });
  if (!result) return new Response('not found', { status: 404 });

  const contentType = (result.metadata?.contentType as string) || 'application/octet-stream';
  return new Response(result.data as ArrayBuffer, {
    status: 200,
    headers: {
      'content-type': contentType,
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
};

export const config: Config = {
  path: '/api/cover-image/:key',
};
