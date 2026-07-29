import type { Config, Context } from '@netlify/edge-functions';

type Metadata = { title: string; description: string; image: string };

function escapeAttribute(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function upsertMeta(html: string, property: string, content: string) {
  const tag = `<meta property="${property}" content="${escapeAttribute(content)}" />`;
  const pattern = new RegExp(`<meta[^>]+property=["']${property}["'][^>]*>`, 'i');
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `  ${tag}\n</head>`);
}

export default async (req: Request, context: Context) => {
  const id = context.params.id;
  const response = await context.next();
  if (!id || !response.headers.get('content-type')?.includes('text/html')) return response;

  const metaResponse = await fetch(new URL(`/api/post-meta/${encodeURIComponent(id)}`, req.url));
  if (!metaResponse.ok) return response;
  const metadata = await metaResponse.json() as Metadata;
  const canonicalUrl = new URL(req.url);
  canonicalUrl.search = '';
  const imageUrl = new URL(metadata.image, canonicalUrl.origin).toString();
  let html = await response.text();
  html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeAttribute(metadata.title)}</title>`);
  html = upsertMeta(html, 'og:type', 'article');
  html = upsertMeta(html, 'og:site_name', 'OrthodoxConnect');
  html = upsertMeta(html, 'og:title', metadata.title);
  html = upsertMeta(html, 'og:description', metadata.description);
  html = upsertMeta(html, 'og:image', imageUrl);
  html = upsertMeta(html, 'og:url', canonicalUrl.toString());
  html = upsertMeta(html, 'twitter:card', 'summary_large_image');
  html = upsertMeta(html, 'twitter:title', metadata.title);
  html = upsertMeta(html, 'twitter:description', metadata.description);
  html = upsertMeta(html, 'twitter:image', imageUrl);
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'public, max-age=0, s-maxage=300');
  headers.delete('content-length');
  return new Response(html, { status: response.status, headers });
};

export const config: Config = { path: '/post/:id', onError: 'bypass' };
