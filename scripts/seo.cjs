// Static-site SEO build/check. Uses real routes and HTML metadata, never a second URL list.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const routes = require('../routes.js');
const root = path.resolve(__dirname, '..');
const origin = 'https://narihealth.in';
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const decode = value => value.replace(/&#x([0-9a-f]+);|&#(\d+);|&(amp|quot|apos|lt|gt);/gi,
  (_, hex, num, named) => hex ? String.fromCodePoint(parseInt(hex, 16)) : num ? String.fromCodePoint(Number(num)) : ({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'})[named.toLowerCase()]);
const plain = value => decode(value.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(m => [m[1], decode(m[2] ?? m[3])]));
function inspect() {
  const pages = [], titles = new Set(), descriptions = new Set();
  for (const route of routes) {
    const html = read(route + '.html');
    const meta = Object.fromEntries([...html.matchAll(/<meta\b[^>]*>/g)].map(m => {const a = attrs(m[0]); return [a.name || a.property, a.content];}));
    if (/^(?:admin|doctor)(?:\/|$)|^(?:login|member(?:-login)?)$/.test(route)) {
      assert.match(meta.robots || '', /noindex/, route + ': private route must be noindex');
    }
    if (/noindex/.test(meta.robots || '')) continue;
    const title = plain(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '');
    assert(title && !titles.has(title), route + ': missing/duplicate title'); titles.add(title);
    assert(meta.description && !descriptions.has(meta.description), route + ': missing/duplicate description'); descriptions.add(meta.description);
    assert.equal((html.match(/<h1\b/g) || []).length, 1, route + ': one H1 required');
    const canonical = [...html.matchAll(/<link\b[^>]*>/g)].map(m => attrs(m[0])).filter(a => a.rel === 'canonical');
    assert.equal(canonical.length, 1, route + ': one canonical required');
    const url = origin + '/' + (route === 'index' ? '' : route);
    assert.equal(canonical[0].href, url, route + ': canonical must use clean HTTPS URL');
    for (const [key, expected] of Object.entries({'og:title':title, 'og:description':meta.description, 'og:url':url, 'twitter:title':title, 'twitter:description':meta.description, 'twitter:card':'summary_large_image'})) assert.equal(meta[key], expected, route + ': ' + key);
    for (const key of ['og:image', 'twitter:image']) {
      const image = new URL(meta[key]);
      assert.equal(image.origin, origin); assert(fs.existsSync(path.join(root, image.pathname)), route + ': social image missing');
    }
    const schemas = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
    const ids = new Set();
    for (const schema of schemas) {
      assert.equal(schema['@context'], 'https://schema.org');
      if (schema['@id']) {assert(!ids.has(schema['@id']), route + ': duplicate schema entity'); ids.add(schema['@id']);}
      if (schema['@type'] === 'FAQPage') {
        const body = plain(html.split(/<body\b[^>]*>/)[1] || '');
        for (const question of schema.mainEntity) {
          assert(body.includes(plain(question.name)), route + ': FAQ question not visible');
          assert(body.includes(plain(question.acceptedAnswer.text)), route + ': FAQ answer not visible');
        }
      }
      if (schema['@type'] === 'MedicalOrganization') {
        assert.equal(schema['@id'], origin + '/#business');
        assert(!schema.address && !schema.aggregateRating, 'No unverified offices or ratings');
        for (const person of schema.member || []) assert.equal(person['@type'], 'Person');
      }
    }
    // Validate crawlable destinations and fragments, without requesting third-party sites.
    for (const match of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)) {
      const target = new URL(decode(match[1]), url);
      if (target.origin !== origin) continue;
      const targetRoute = target.pathname.replace(/^\//, '').replace(/\/$/, '').replace(/\.html$/, '') || 'index';
      if (!routes.includes(targetRoute)) {
        assert(fs.existsSync(path.join(root, target.pathname)), route + ': broken link ' + match[1]);
        continue;
      }
      if (target.hash) {
        const destination = read(targetRoute + '.html');
        assert(destination.includes('id="' + decodeURIComponent(target.hash.slice(1)) + '"'), route + ': missing fragment ' + match[1]);
      }
    }
    pages.push({route, url});
  }
  return pages;
}
function sitemap(pages) {
  // Omit lastmod until editorial dates are maintained. Build/check-out time is not a content update.
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + pages.map(p => `  <url><loc>${p.url}</loc></url>\n`).join('') + '</urlset>\n';
}
function checkRobots(pages) {
  const text = read('robots.txt');
  for (const agent of ['*', 'OAI-SearchBot']) {
    const group = text.split(/User-agent:\s*/i).find(g => g.split('\n')[0].trim() === agent);
    assert(group, 'Missing robots group: ' + agent);
    const blocked = [...group.matchAll(/^Disallow:\s*(\S+)/gm)].map(m => m[1]);
    assert.match(group, /^Allow: \/$/m);
    for (const page of pages) assert(!blocked.some(prefix => new URL(page.url).pathname.startsWith(prefix)), agent + ': public URL blocked');
    for (const privatePath of ['/admin', '/admin/', '/doctor', '/doctor/', '/login', '/member-login', '/member', '/member.html', '/private/', '/dashboard/']) assert(blocked.some(prefix => privatePath.startsWith(prefix)), agent + ': private URL not blocked: ' + privatePath);
  }
  assert(text.includes('Sitemap: ' + origin + '/sitemap.xml'));
}
if (require.main === module) {
  const pages = inspect(); checkRobots(pages);
  const xml = sitemap(pages);
  if (process.argv.includes('--write')) fs.writeFileSync(path.join(root, 'sitemap.xml'), xml);
  else assert.equal(read('sitemap.xml'), xml, 'Sitemap is stale: run npm run build');
  console.log(`SEO checks passed: ${pages.length} indexable canonical pages; metadata, schemas, links and crawler rules verified.`);
}
module.exports = { inspect, sitemap, checkRobots };
