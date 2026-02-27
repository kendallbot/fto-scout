// FTO Scout API Proxy — Cloudflare Worker
// Deploy at: https://dash.cloudflare.com → Workers & Pages → Create
// This proxies USPTO, arXiv, and Lens.org API calls to avoid browser CORS issues

const ALLOWED_ORIGINS = ['*']; // Lock this down to your GitHub Pages URL in production
const ALLOWED_APIS = [
  'https://api.patentsview.org',
  'https://search.patentsview.org',
  'https://export.arxiv.org',
  'https://api.lens.org',
  'https://api.openalex.org',
  'https://api.semanticscholar.org',
  'https://api.crossref.org'
];

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Target-URL',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '*';

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // Health check
      if (path === '/' || path === '/health') {
        return new Response(JSON.stringify({ status: 'ok', service: 'FTO Scout API Proxy' }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }

      // ── USPTO PatentsView API ──
      if (path.startsWith('/uspto/')) {
        const usptoPath = path.replace('/uspto/', '');
        const usptoUrl = `https://api.patentsview.org/${usptoPath}${url.search}`;
        const resp = await fetch(usptoUrl, {
          method: request.method,
          headers: { 'Content-Type': 'application/json' },
          body: request.method === 'POST' ? await request.text() : undefined
        });
        const data = await resp.text();
        return new Response(data, {
          status: resp.status,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }

      // ── USPTO Search API (new endpoint) ──
      if (path.startsWith('/uspto-search/')) {
        const searchPath = path.replace('/uspto-search/', '');
        const usptoUrl = `https://search.patentsview.org/${searchPath}${url.search}`;
        const resp = await fetch(usptoUrl, {
          method: request.method,
          headers: { 'Content-Type': 'application/json' },
          body: request.method === 'POST' ? await request.text() : undefined
        });
        const data = await resp.text();
        return new Response(data, {
          status: resp.status,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }

      // ── arXiv API ──
      if (path.startsWith('/arxiv/')) {
        const arxivPath = path.replace('/arxiv/', '');
        const arxivUrl = `https://export.arxiv.org/${arxivPath}${url.search}`;
        const resp = await fetch(arxivUrl);
        const data = await resp.text();
        return new Response(data, {
          status: resp.status,
          headers: { 'Content-Type': 'application/xml', ...corsHeaders(origin) }
        });
      }

      // ── Lens.org API ──
      if (path.startsWith('/lens/')) {
        const lensPath = path.replace('/lens/', '');
        const lensUrl = `https://api.lens.org/${lensPath}`;
        const authHeader = request.headers.get('Authorization') || '';
        const resp = await fetch(lensUrl, {
          method: request.method,
          headers: {
            'Content-Type': 'application/json',
            ...(authHeader ? { 'Authorization': authHeader } : {})
          },
          body: request.method === 'POST' ? await request.text() : undefined
        });
        const data = await resp.text();
        return new Response(data, {
          status: resp.status,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }

      // ── Semantic Scholar API ──
      if (path.startsWith('/scholar/')) {
        const scholarPath = path.replace('/scholar/', '');
        const scholarUrl = `https://api.semanticscholar.org/${scholarPath}${url.search}`;
        const resp = await fetch(scholarUrl);
        const data = await resp.text();
        return new Response(data, {
          status: resp.status,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }

      // ── Generic proxy (for any allowed API) ──
      if (path === '/proxy') {
        const targetUrl = request.headers.get('X-Target-URL') || url.searchParams.get('url');
        if (!targetUrl) {
          return new Response(JSON.stringify({ error: 'Missing X-Target-URL header or url param' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
          });
        }
        // Validate target is an allowed API
        const isAllowed = ALLOWED_APIS.some(api => targetUrl.startsWith(api));
        if (!isAllowed) {
          return new Response(JSON.stringify({ error: 'Target URL not in allowlist' }), {
            status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
          });
        }
        const resp = await fetch(targetUrl, {
          method: request.method,
          headers: { 'Content-Type': request.headers.get('Content-Type') || 'application/json' },
          body: request.method === 'POST' ? await request.text() : undefined
        });
        const data = await resp.text();
        return new Response(data, {
          status: resp.status,
          headers: { 'Content-Type': resp.headers.get('Content-Type') || 'text/plain', ...corsHeaders(origin) }
        });
      }

      return new Response(JSON.stringify({ error: 'Unknown endpoint', available: ['/uspto/', '/arxiv/', '/lens/', '/scholar/', '/proxy'] }), {
        status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
      });
    }
  }
};
