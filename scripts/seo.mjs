import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function siteOrigin(value) {
  if (!value) return '';
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('SITE_URL must be the public HTTPS origin, for example https://your-site.onrender.com');
  }
  return url.origin;
}

export async function generateSeo(directory, value) {
  const origin = siteOrigin(value);
  const indexPath = path.join(directory, 'index.html');
  let html = await fs.readFile(indexPath, 'utf8');
  if (origin) {
    const data = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'WebSite',
      name: 'SolveScript', alternateName: 'Solve Script', url: `${origin}/`,
      description: 'Free Cambridge A-Level past-paper practice with annotations, timed exams and optional AI review.',
    }).replaceAll('<', '\\u003c');
    const tags = `
    <link rel="canonical" href="${origin}/" />
    <meta property="og:url" content="${origin}/" />
    <meta property="og:image" content="${origin}/solvescript-character-mark-v1.png" />
    <script type="application/ld+json">${data}</script>`;
    html = html.replace('</head>', `${tags}\n  </head>`);
    await fs.writeFile(indexPath, html);
    await fs.writeFile(path.join(directory, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url></urlset>\n`);
  }
  const robots = `User-agent: *\nAllow: /\nDisallow: /api/\n${origin ? `Sitemap: ${origin}/sitemap.xml\n` : ''}`;
  await fs.writeFile(path.join(directory, 'robots.txt'), robots);
  return origin;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const origin = await generateSeo(path.resolve('dist'), process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL);
  console.log(origin ? `SEO files generated for ${origin}` : 'SEO: set SITE_URL on the host to generate the canonical URL and sitemap.');
}
