#!/usr/bin/env node
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, posix as pathPosix } from 'node:path';

const ROOT = process.cwd();

function walk(dir, out = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.git') continue;
      walk(p, out);
    } else {
      out.push(p);
    }
  }
  return out;
}

function listHtmlFiles() {
  return walk(ROOT).filter(p => p.endsWith('.html'));
}

function normalizeSitePath(p) {
  if (!p.startsWith('/')) p = '/' + p;
  if (p === '/') return '/';
  if (!p.endsWith('/')) p += '/';
  return p;
}

function fileForRoute(route) {
  if (route === '/') return join(ROOT, 'index.html');
  return join(ROOT, route.slice(1), 'index.html');
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getAttr(tag, name) {
  const re = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const m = tag.match(re);
  return m ? (m[2] ?? m[3] ?? m[4] ?? '') : null;
}

function stripHashesAndQuery(href) {
  const iHash = href.indexOf('#');
  if (iHash !== -1) href = href.slice(0, iHash);
  const iQ = href.indexOf('?');
  if (iQ !== -1) href = href.slice(0, iQ);
  return href;
}

function isExternal(href) {
  return /^([a-z][a-z0-9+.-]*:)?\/\//i.test(href) || /^mailto:/i.test(href) || /^tel:/i.test(href) || /^javascript:/i.test(href) || /^data:/i.test(href);
}

function collectRoutes(htmlFiles) {
  const routes = new Set();
  for (const fp of htmlFiles) {
    const rel = fp.slice(ROOT.length).replace(/\\/g, '/');
    if (rel === '/index.html') routes.add('/');
    else if (rel.endsWith('/index.html')) routes.add(rel.slice(0, -'/index.html'.length) + '/');
  }
  return routes;
}

function parseIds(html) {
  const ids = new Set();
  const re = /\bid\s*=\s*("([^"]+)"|'([^']+)')/gi;
  let m;
  while ((m = re.exec(html))) ids.add(m[2] ?? m[3]);
  return ids;
}

function fail(msg) {
  console.error(msg);
  process.exitCode = 1;
}

const htmlFiles = listHtmlFiles();
if (htmlFiles.length === 0) {
  console.error('qa-gate: no .html files found');
  process.exit(2);
}

const routes = collectRoutes(htmlFiles);
const idsByFile = new Map();
for (const fp of htmlFiles) {
  const html = readFileSync(fp, 'utf8');
  idsByFile.set(fp, parseIds(html));
}

const OPTIONAL_TAGS_FOR_ROUTES = [
  /^\/go\//, // affiliate redirect/utility pages
  /^\/search\//, // search page often has different meta policy
];
function isOptionalMeta(route) {
  return OPTIONAL_TAGS_FOR_ROUTES.some(re => re.test(route));
}

// 1) Anchor markup sanity
for (const fp of htmlFiles) {
  const html = readFileSync(fp, 'utf8');

  for (const m of html.matchAll(/<a\b[^>]*>/gi)) {
    const tag = m[0];
    const hasHref = /\bhref\s*=\s*/i.test(tag);
    const hasName = /\bname\s*=\s*/i.test(tag);
    if (!hasHref && !hasName) {
      fail(`qa-gate: ${fp}: anchor tag missing href/name: ${tag.slice(0, 120)}`);
      break;
    }
    if (hasHref) {
      const href = getAttr(tag, 'href');
      if (href === '' || href === null) {
        fail(`qa-gate: ${fp}: anchor href empty: ${tag.slice(0, 120)}`);
        break;
      }
    }
  }

  if (/<\/a\b(?![^>]*>)/i.test(html)) {
    fail(`qa-gate: ${fp}: malformed </a> close tag`);
  }
}

// 2) Canonical + OG/Twitter tags (required except optional routes)
for (const fp of htmlFiles) {
  const html = readFileSync(fp, 'utf8');
  const rel = fp.slice(ROOT.length).replace(/\\/g, '/');
  const route = rel === '/index.html' ? '/' : rel.slice(0, -'index.html'.length);

  if (isOptionalMeta(route)) continue;

  const head = (html.match(/<head\b[^>]*>[\s\S]*?<\/head>/i) || [null])[0] ?? html;

  const canonical = head.match(/<link\b[^>]*rel\s*=\s*("canonical"|'canonical'|canonical)[^>]*>/i);
  if (!canonical) fail(`qa-gate: ${fp}: missing <link rel="canonical" ...>`);

  const ogTitle = head.match(/<meta\b[^>]*property\s*=\s*("og:title"|'og:title'|og:title)[^>]*>/i);
  const ogDesc = head.match(/<meta\b[^>]*property\s*=\s*("og:description"|'og:description'|og:description)[^>]*>/i);
  const ogImage = head.match(/<meta\b[^>]*property\s*=\s*("og:image"|'og:image'|og:image)[^>]*>/i);
  const ogUrl = head.match(/<meta\b[^>]*property\s*=\s*("og:url"|'og:url'|og:url)[^>]*>/i);
  if (!ogTitle) fail(`qa-gate: ${fp}: missing og:title`);
  if (!ogDesc) fail(`qa-gate: ${fp}: missing og:description`);
  if (!ogImage) fail(`qa-gate: ${fp}: missing og:image`);
  if (!ogUrl) fail(`qa-gate: ${fp}: missing og:url`);

  const twCard = head.match(/<meta\b[^>]*name\s*=\s*("twitter:card"|'twitter:card'|twitter:card)[^>]*>/i);
  const twTitle = head.match(/<meta\b[^>]*name\s*=\s*("twitter:title"|'twitter:title'|twitter:title)[^>]*>/i);
  const twDesc = head.match(/<meta\b[^>]*name\s*=\s*("twitter:description"|'twitter:description'|twitter:description)[^>]*>/i);
  const twImage = head.match(/<meta\b[^>]*name\s*=\s*("twitter:image"|'twitter:image'|twitter:image)[^>]*>/i);
  if (!twCard) fail(`qa-gate: ${fp}: missing twitter:card`);
  if (!twTitle) fail(`qa-gate: ${fp}: missing twitter:title`);
  if (!twDesc) fail(`qa-gate: ${fp}: missing twitter:description`);
  if (!twImage) fail(`qa-gate: ${fp}: missing twitter:image`);
}

// 3) Internal link 404 checks + hash target existence
for (const fp of htmlFiles) {
  const html = readFileSync(fp, 'utf8');
  const rel = fp.slice(ROOT.length).replace(/\\/g, '/');
  const fromRoute = rel === '/index.html' ? '/' : rel.slice(0, -'index.html'.length);
  const routeSelf = fromRoute;


  if (routeSelf === '/search/' ) { continue; }

  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>/gi)) {
    const href = m[2] ?? m[3] ?? m[4] ?? '';
    if (!href) continue;
    if (isExternal(href)) continue;

    if (href.startsWith('#')) {
      const id = href.slice(1);
      if (id && !idsByFile.get(fp)?.has(id)) {
        fail(`qa-gate: ${fp}: hash link #${id} missing target id`);
      }
      continue;
    }

    if (href.startsWith('/')) {
      const clean = stripHashesAndQuery(href);
      const hash = href.includes('#') ? href.slice(href.indexOf('#') + 1).split('?')[0] : '';
      const route = normalizeSitePath(clean);
      if (!routes.has(route)) {
        fail(`qa-gate: ${fp}: internal link not found (404): ${href}`);
        continue;
      }
      if (hash) {
        const targetFile = fileForRoute(route);
        const ids = idsByFile.get(targetFile);
        if (!ids || !ids.has(hash)) {
          fail(`qa-gate: ${fp}: internal hash link missing target: ${href}`);
        }
      }
      continue;
    }

    const clean = stripHashesAndQuery(href);
    const hash = href.includes('#') ? href.slice(href.indexOf('#') + 1).split('?')[0] : '';
    const base = fromRoute === '/' ? '/' : fromRoute;
    const joined = pathPosix.normalize(pathPosix.join(base, clean));
    const route = normalizeSitePath(joined);
    if (!routes.has(route)) {
      fail(`qa-gate: ${fp}: relative internal link not found (404): ${href} -> ${route}`);
      continue;
    }
    if (hash) {
      const targetFile = fileForRoute(route);
      const ids = idsByFile.get(targetFile);
      if (!ids || !ids.has(hash)) {
        fail(`qa-gate: ${fp}: internal hash link missing target: ${href} -> ${route}#${hash}`);
      }
    }
  }
}

// 4) Sitemap inclusion for key pages
const sitemapPath = join(ROOT, 'sitemap.xml');
if (!existsSync(sitemapPath)) {
  fail(`qa-gate: missing sitemap.xml at repo root`);
} else {
  const sm = readFileSync(sitemapPath, 'utf8');
  for (const route of routes) {
    // /go/* is intentionally noindex/nofollow redirect stubs, do not require in sitemap
    // /search/ is optional depending on SEO policy, do not require here
    if (route.startsWith('/go/') || route === '/search/') continue;
    const needle = new RegExp(`<loc>[^<]*${escapeRe(route)}<\\/loc>`, 'i');
    if (!needle.test(sm)) {
      fail(`qa-gate: sitemap.xml missing route: ${route}`);
    }
  }
}

if (process.exitCode && process.exitCode !== 0) {
  console.error('qa-gate: FAILED');
  process.exit(process.exitCode);
}
console.log(`qa-gate: OK (${htmlFiles.length} html files, ${routes.size} routes)`);
