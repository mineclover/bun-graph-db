export interface StudioHtmlOptions {
	title?: string;
	version?: string;
	defaultEndpointBase?: string;
}

/**
 * Self-contained, offline-friendly Web Studio / Inspector HTML shell.
 * Inspects health, tables, columns, IA blueprints/outlines, AI Memory, metrics, and audit logs.
 */
export function renderStudioHtml(options: StudioHtmlOptions = {}): string {
	const title = options.title ?? "Bun Graph DB Studio";
	const version = options.version ?? "1.0.0";
	const baseUrl = options.defaultEndpointBase ?? "";

	return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #0b1020;
      --panel: #131a2e;
      --border: #26314f;
      --text: #e6ecff;
      --muted: #93a3c7;
      --accent: #5b8cff;
      --ok: #30d158;
      --warn: #ffd60a;
      --err: #ff453a;
      --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      --sans: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: var(--sans);
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }
    header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 24px;
      border-bottom: 1px solid var(--border);
      background: #0e1528;
    }
    header h1 { margin: 0; font-size: 18px; font-weight: 700; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 12px;
      border: 1px solid var(--border);
      color: var(--muted);
    }
    .badge.ok { border-color: var(--ok); color: var(--ok); }
    .auth-bar { display: flex; gap: 8px; align-items: center; }
    input, select, textarea, button {
      font: inherit;
      color: inherit;
      background: #0a0f1e;
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 6px 10px;
    }
    button {
      background: var(--accent);
      color: #fff;
      border: none;
      cursor: pointer;
      font-weight: 600;
    }
    button.secondary { background: #1e2845; border: 1px solid var(--border); }
    main {
      max-width: 1240px;
      margin: 0 auto;
      padding: 20px 24px 48px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      gap: 16px;
    }
    section {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    section.wide { grid-column: 1 / -1; }
    h2 { margin: 0; font-size: 15px; display: flex; justify-content: space-between; align-items: center; }
    .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .row > input, .row > select { flex: 1; min-width: 120px; }
    pre {
      margin: 0;
      padding: 12px;
      background: #070b15;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-family: var(--mono);
      font-size: 12px;
      overflow: auto;
      max-height: 280px;
      white-space: pre-wrap;
    }
  </style>
</head>
<body data-studio-version="${escapeHtml(version)}" data-base-url="${escapeHtml(baseUrl)}">
  <header>
    <div>
      <h1>Bun Graph DB Studio <span class="badge">v${escapeHtml(version)}</span> <span id="healthBadge" class="badge">checking...</span></h1>
    </div>
    <div class="auth-bar">
      <input id="tokenInput" type="password" placeholder="Optional Bearer token (sessionStorage)" />
      <button id="saveTokenBtn" class="secondary">Apply Token</button>
      <button id="refreshAllBtn">Refresh</button>
    </div>
  </header>

  <main>
    <section>
      <h2>Overview &amp; Blueprint Presets <button class="secondary" id="loadHealthBtn">Check /health</button></h2>
      <div class="row">
        <select id="presetSelect">
          <option value="knowledge">knowledge</option>
          <option value="product-spec">product-spec</option>
          <option value="decision-log">decision-log</option>
        </select>
        <button id="applyPresetBtn">Apply Preset via MCP</button>
      </div>
      <pre id="healthOut">Loading...</pre>
    </section>

    <section>
      <h2>Tables, Columns &amp; Nodes <button class="secondary" id="loadTablesBtn">Load Tables</button></h2>
      <div class="row">
        <input id="tableIdInput" placeholder="Table ID or identifier" />
        <button class="secondary" id="loadColumnsBtn">Columns</button>
        <button class="secondary" id="searchNodesBtn">Search Nodes</button>
      </div>
      <pre id="tablesOut">Click "Load Tables" to inspect schema.</pre>
    </section>

    <section>
      <h2>IA Outline, Audit &amp; Structured Query</h2>
      <div class="row">
        <button class="secondary" id="iaInspectBtn">IA Inspect</button>
        <button class="secondary" id="iaAuditBtn">IA Audit</button>
        <button class="secondary" id="iaOutlineBtn">IA Outline</button>
      </div>
      <div class="row">
        <input id="iaQueryInput" placeholder="table identifier (e.g. topics or specs)" />
        <button id="iaQueryBtn">Query Structured</button>
      </div>
      <pre id="iaOut">Run an IA MCP action.</pre>
    </section>

    <section>
      <h2>AI Agent Memory Explorer</h2>
      <div class="row">
        <button class="secondary" id="memStatsBtn">Memory Stats</button>
        <input id="memQueryInput" placeholder="Recall query or topic..." />
        <button id="memRecallBtn">Recall</button>
      </div>
      <div class="row">
        <input id="memRememberInput" placeholder="Remember new fact/decision/note..." />
        <button id="memRememberBtn">Remember</button>
      </div>
      <pre id="memOut">Inspect 5-signal AI Agent Memory.</pre>
    </section>

    <section class="wide">
      <h2>Observability &amp; Security Audit <span class="row"><button class="secondary" id="loadMetricsBtn">/metrics (JSON)</button><button class="secondary" id="loadAuditBtn">/api/audit-log</button></span></h2>
      <pre id="opsOut">Admin token required in production for /metrics and /api/audit-log.</pre>
    </section>
  </main>

  <script>
    const BASE = document.body.dataset.baseUrl || '';
    const tokenEl = document.getElementById('tokenInput');
    tokenEl.value = sessionStorage.getItem('bgdb_studio_token') || '';

    function headers(extra = {}) {
      const h = { ...extra };
      const tok = tokenEl.value.trim();
      if (tok) h['Authorization'] = 'Bearer ' + tok;
      return h;
    }

    async function apiJson(path, opts = {}) {
      const res = await fetch(BASE + path, { ...opts, headers: headers(opts.headers || {}) });
      const text = await res.text();
      try { return { status: res.status, data: JSON.parse(text) }; }
      catch { return { status: res.status, data: text }; }
    }

    async function callMcp(toolName, args = {}) {
      return await apiJson('/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'MCP-Protocol-Version': '2026-07-28'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: { name: toolName, arguments: args }
        })
      });
    }

    function show(id, value) {
      document.getElementById(id).textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    }

    async function loadHealth() {
      const res = await apiJson('/health');
      const badge = document.getElementById('healthBadge');
      badge.textContent = res.status === 200 ? 'OK' : 'HTTP ' + res.status;
      badge.className = 'badge ' + (res.status === 200 ? 'ok' : '');
      show('healthOut', res.data);
    }

    async function loadTables() {
      const res = await apiJson('/api/tables');
      show('tablesOut', res.data);
    }

    document.getElementById('saveTokenBtn').onclick = () => {
      sessionStorage.setItem('bgdb_studio_token', tokenEl.value.trim());
      loadHealth();
    };
    document.getElementById('refreshAllBtn').onclick = () => { loadHealth(); loadTables(); };
    document.getElementById('loadHealthBtn').onclick = loadHealth;
    document.getElementById('loadTablesBtn').onclick = loadTables;

    document.getElementById('applyPresetBtn').onclick = async () => {
      const preset = document.getElementById('presetSelect').value;
      show('healthOut', await callMcp('ia-apply-blueprint', { preset }));
    };
    document.getElementById('loadColumnsBtn').onclick = async () => {
      const id = document.getElementById('tableIdInput').value.trim();
      if (!id) return;
      show('tablesOut', await apiJson('/api/tables/' + encodeURIComponent(id) + '/columns'));
    };
    document.getElementById('searchNodesBtn').onclick = async () => {
      const id = document.getElementById('tableIdInput').value.trim();
      const q = id ? '?tableId=' + encodeURIComponent(id) : '';
      show('tablesOut', await apiJson('/api/nodes/search' + q));
    };

    document.getElementById('iaInspectBtn').onclick = async () => show('iaOut', await callMcp('ia-inspect', {}));
    document.getElementById('iaAuditBtn').onclick = async () => show('iaOut', await callMcp('ia-audit', {}));
    document.getElementById('iaOutlineBtn').onclick = async () => {
      const tableIdentifier = document.getElementById('iaQueryInput').value.trim() || undefined;
      show('iaOut', await callMcp('ia-get-outline', tableIdentifier ? { tableIdentifier } : {}));
    };
    document.getElementById('iaQueryBtn').onclick = async () => {
      const tableIdentifier = document.getElementById('iaQueryInput').value.trim();
      show('iaOut', await callMcp('ia-query-structured', tableIdentifier ? { tableIdentifier, includeFacets: true } : { includeFacets: true }));
    };

    document.getElementById('memStatsBtn').onclick = async () => show('memOut', await callMcp('memory-stats', {}));
    document.getElementById('memRecallBtn').onclick = async () => {
      const query = document.getElementById('memQueryInput').value.trim();
      show('memOut', await callMcp('memory-recall', { query: query || undefined, limit: 10 }));
    };
    document.getElementById('memRememberBtn').onclick = async () => {
      const content = document.getElementById('memRememberInput').value.trim();
      if (!content) return;
      show('memOut', await callMcp('memory-remember', { content, kind: 'fact' }));
    };

    document.getElementById('loadMetricsBtn').onclick = async () => show('opsOut', await apiJson('/metrics?format=json'));
    document.getElementById('loadAuditBtn').onclick = async () => show('opsOut', await apiJson('/api/audit-log?limit=50'));

    loadHealth();
  </script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}
