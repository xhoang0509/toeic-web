import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const base = import.meta.env.BASE_URL || '/';
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  const sitemapURL = new URL(`${cleanBase}sitemap-index.xml`, site);
  return new Response(
    `User-agent: *
Allow: /
Disallow: ${cleanBase}admin

Sitemap: ${sitemapURL.href}
`,
    {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    }
  );
};
