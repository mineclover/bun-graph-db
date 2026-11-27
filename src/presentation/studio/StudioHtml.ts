export interface StudioHtmlOptions {
	title?: string;
	version?: string;
	defaultEndpointBase?: string;
}

/**
 * Self-contained, offline-friendly Web Studio / Inspector HTML shell.
 * Inspects health, tables, columns, IA blueprints/outlines, AI Memory, metrics, and audit logs
 * with interactive HTML data tables and collapsible raw JSON inspection.
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
  <meta name="color-scheme" content="light dark" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --bg-light: #f4f7fb;
      --bg-dark: #0b1020;
      --panel-light: #ffffff;
      --panel-dark: #131a2e;
      --panel-alt-light: #eef2f8;
      --panel-alt-dark: #0a0f1e;
      --border-light: #d2dbe9;
      --border-dark: #26314f;
      --text-light: #101828;
      --text-dark: #e6ecff;
      --muted-light: #475467;
      --muted-dark: #93a3c7;
      --accent-light: #2563eb;
      --accent-dark: #5b8cff;
      --ok-light: #15803d;
      --ok-dark: #30d158;
      --err-light: #b91c1c;
      --err-dark: #ff453a;

      --bg: var(--bg-light);
      --panel: var(--panel-light);
      --panel-alt: var(--panel-alt-light);
      --border: var(--border-light);
      --text: var(--text-light);
      --muted: var(--muted-light);
      --accent: var(--accent-light);
      --ok: var(--ok-light);
      --err: var(--err-light);

      @media (prefers-color-scheme: dark) {
        --bg: var(--bg-dark);
        --panel: var(--panel-dark);
        --panel-alt: var(--panel-alt-dark);
        --border: var(--border-dark);
        --text: var(--text-dark);
        --muted: var(--muted-dark);
        --accent: var(--accent-dark);
        --ok: var(--ok-dark);
        --err: var(--err-dark);
      }

      @supports (color: light-dark(white, black)) {
        --bg: light-dark(var(--bg-light), var(--bg-dark));
        --panel: light-dark(var(--panel-light), var(--panel-dark));
        --panel-alt: light-dark(var(--panel-alt-light), var(--panel-alt-dark));
        --border: light-dark(var(--border-light), var(--border-dark));
        --text: light-dark(var(--text-light), var(--text-dark));
        --muted: light-dark(var(--muted-light), var(--muted-dark));
        --accent: light-dark(var(--accent-light), var(--accent-dark));
        --ok: light-dark(var(--ok-light), var(--ok-dark));
        --err: light-dark(var(--err-light), var(--err-dark));
      }

      color-scheme: light dark;
      accent-color: var(--accent);
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
    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 24px;
      border-bottom: 1px solid var(--border);
      background: var(--panel);
    }
    header h1 { margin: 0; font-size: 18px; font-weight: 700; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 12px;
      border: 1px solid var(--border);
      color: var(--muted);
    }
    .badge.ok { border-color: var(--ok); color: var(--ok); }
    .auth-bar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    input, select, textarea, button {
      font: inherit;
      color: inherit;
      background: var(--panel-alt);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 6px 10px;
      min-height: 32px;
    }
    button {
      background: var(--accent);
      color: #fff;
      border: 1px solid transparent;
      cursor: pointer;
      font-weight: 600;
    }
    button.secondary { background: var(--panel-alt); color: var(--text); border: 1px solid var(--border); }
    button:focus-visible, input:focus-visible, select:focus-visible, .table-wrapper:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    main {
      max-width: 1320px;
      margin: 0 auto;
      padding: 20px 24px 48px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(460px, 1fr));
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
      min-width: 0;
    }
    section.wide { grid-column: 1 / -1; }
    h2 { margin: 0; font-size: 15px; display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
    .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .row > input, .row > select { flex: 1; min-width: 120px; }
    .table-wrapper {
      overflow: auto;
      max-inline-size: 100%;
      max-block-size: min(340px, 50vh);
      container-type: inline-size;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--panel);
    }
    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: 13px;
    }
    thead {
      position: sticky;
      inset-block-start: 0;
      z-index: 2;
      background: var(--panel-alt);
    }
    th, td {
      padding: 7px 10px;
      text-align: left;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
    }
    thead th {
      font-size: 12px;
      font-weight: 700;
      color: var(--muted);
      border-bottom: 2px solid var(--border);
    }
    tbody th {
      position: sticky;
      inset-inline-start: 0;
      z-index: 1;
      background: var(--panel);
      font-family: var(--mono);
      font-size: 12px;
      color: var(--muted);
      white-space: nowrap;
    }
    tr.clickable { cursor: pointer; }
    tr.clickable:hover td, tr.clickable:hover th { background: var(--panel-alt); }
    details summary { cursor: pointer; font-size: 12px; font-weight: 600; color: var(--muted); }
    pre {
      margin: 6px 0 0;
      padding: 12px;
      background: var(--panel-alt);
      border: 1px solid var(--border);
      border-radius: 6px;
      font-family: var(--mono);
      font-size: 12px;
      overflow: auto;
      max-height: 240px;
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
      <label class="visually-hidden" for="tokenInput">Optional Bearer Token</label>
      <input id="tokenInput" type="password" placeholder="Optional Bearer token (sessionStorage)" />
      <button type="button" id="saveTokenBtn" class="secondary">Apply Token</button>
      <button type="button" id="refreshAllBtn">Refresh</button>
    </div>
  </header>

  <main>
    <section>
      <h2>Overview &amp; Blueprint Presets <button type="button" class="secondary" id="loadHealthBtn">Check /health</button></h2>
      <div class="row">
        <label class="visually-hidden" for="presetSelect">Blueprint Preset</label>
        <select id="presetSelect">
          <option value="knowledge">knowledge</option>
          <option value="product-spec">product-spec</option>
          <option value="decision-log">decision-log</option>
        </select>
        <button type="button" id="applyPresetBtn">Apply Preset via MCP</button>
      </div>
      <div id="healthSummary" class="row"></div>
      <details>
        <summary>Raw Health / Preset JSON</summary>
        <pre id="healthOut">Loading...</pre>
      </details>
    </section>

    <section>
      <h2>Tables, Columns &amp; Nodes <button type="button" class="secondary" id="loadTablesBtn">Load Tables</button></h2>
      <div class="row">
        <label class="visually-hidden" for="tableIdInput">Table ID or identifier</label>
        <input id="tableIdInput" placeholder="Table ID or identifier" />
        <button type="button" class="secondary" id="loadColumnsBtn">Columns</button>
        <button type="button" class="secondary" id="searchNodesBtn">Search Nodes</button>
      </div>
      <div id="tablesTableWrap" class="table-wrapper" tabindex="0" role="region" aria-label="Schema Tables and Nodes">
        <table>
          <thead><tr><th scope="col">ID</th><th scope="col">Identifier</th><th scope="col">Description</th></tr></thead>
          <tbody id="tablesTbody"></tbody>
        </table>
      </div>
      <details>
        <summary>Raw Tables / Columns JSON</summary>
        <pre id="tablesOut">Loading tables...</pre>
      </details>
    </section>

    <section>
      <h2>IA Outline, Audit &amp; Structured Query</h2>
      <div class="row">
        <button type="button" class="secondary" id="iaInspectBtn">IA Inspect</button>
        <button type="button" class="secondary" id="iaAuditBtn">IA Audit</button>
        <button type="button" class="secondary" id="iaOutlineBtn">IA Outline</button>
      </div>
      <form id="iaQueryForm" class="row">
        <label class="visually-hidden" for="iaQueryInput">IA Table Identifier</label>
        <input id="iaQueryInput" placeholder="table identifier (e.g. ia_topics or ia_documents)" />
        <button type="submit" id="iaQueryBtn">Query Structured</button>
      </form>
      <div id="iaTableWrap" class="table-wrapper" tabindex="0" role="region" aria-label="IA Query Results">
        <table>
          <thead><tr><th scope="col">Item</th><th scope="col">Detail</th></tr></thead>
          <tbody id="iaTbody"></tbody>
        </table>
      </div>
      <details>
        <summary>Raw IA JSON</summary>
        <pre id="iaOut">Run an IA MCP action.</pre>
      </details>
    </section>

    <section>
      <h2>AI Agent Memory Explorer</h2>
      <div class="row">
        <button type="button" class="secondary" id="memStatsBtn">Memory Stats</button>
        <label class="visually-hidden" for="memQueryInput">Recall query or topic</label>
        <input id="memQueryInput" placeholder="Recall query or topic..." />
        <button type="button" id="memRecallBtn">Recall</button>
      </div>
      <form id="memRememberForm" class="row">
        <label class="visually-hidden" for="memRememberInput">New memory content</label>
        <input id="memRememberInput" placeholder="Remember new fact/decision/note..." />
        <button type="submit" id="memRememberBtn">Remember</button>
      </form>
      <div id="memTableWrap" class="table-wrapper" tabindex="0" role="region" aria-label="AI Agent Memories">
        <table>
          <thead><tr><th scope="col">ID</th><th scope="col">Kind</th><th scope="col">Content</th><th scope="col">Topic</th><th scope="col">Score</th></tr></thead>
          <tbody id="memTbody"></tbody>
        </table>
      </div>
      <details>
        <summary>Raw AI Memory JSON</summary>
        <pre id="memOut">Loading AI Agent Memories...</pre>
      </details>
    </section>

    <section class="wide">
      <h2>Observability &amp; Security Audit <span class="row"><button type="button" class="secondary" id="loadMetricsBtn">/metrics (JSON)</button><button type="button" class="secondary" id="loadAuditBtn">/api/audit-log</button></span></h2>
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
          'MCP-Protocol-Version': '2025-11-25'
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

    function extractMcpPayload(res) {
      const result = res && res.data && res.data.result;
      if (result && result.structuredContent) return result.structuredContent;
      const text = result && Array.isArray(result.content) && result.content[0] ? result.content[0].text : null;
      if (text) {
        try { return JSON.parse(text); } catch { return text; }
      }
      return res && res.data ? res.data : res;
    }

    function renderRows(wrapId, columns, rows, onRowClick) {
      const wrap = document.getElementById(wrapId);
      const table = wrap.querySelector('table');
      const theadRow = table.tHead.rows[0];
      const tbody = table.tBodies[0];

      const ths = columns.map((col) => {
        const th = document.createElement('th');
        th.scope = 'col';
        th.textContent = col;
        return th;
      });
      theadRow.replaceChildren(...ths);

      const trs = rows.map((rowData) => {
        const tr = document.createElement('tr');
        if (onRowClick) {
          tr.className = 'clickable';
          tr.onclick = () => onRowClick(rowData);
        }
        rowData.cells.forEach((cellVal, idx) => {
          const cell = document.createElement(idx === 0 ? 'th' : 'td');
          if (idx === 0) cell.scope = 'row';
          cell.textContent = cellVal === undefined || cellVal === null || cellVal === '' ? '-' : String(cellVal);
          tr.appendChild(cell);
        });
        return tr;
      });
      tbody.replaceChildren(...trs);
    }

    async function loadHealth() {
      const res = await apiJson('/health');
      const badge = document.getElementById('healthBadge');
      badge.textContent = res.status === 200 ? 'OK' : 'HTTP ' + res.status;
      badge.className = 'badge ' + (res.status === 200 ? 'ok' : '');
      const sum = document.getElementById('healthSummary');
      if (res.data && typeof res.data === 'object') {
        sum.innerHTML = '';
        for (const [k, v] of [['Driver', res.data.driver], ['Version', res.data.version], ['Bind Limit', res.data.maxBindParams]]) {
          if (v !== undefined) {
            const p = document.createElement('span');
            p.className = 'badge';
            p.textContent = k + ': ' + v;
            sum.appendChild(p);
          }
        }
      }
      show('healthOut', res.data);
    }

    async function loadTables() {
      const res = await apiJson('/api/tables');
      show('tablesOut', res.data);
      const list = (res.data && res.data.data && Array.isArray(res.data.data.tables) && res.data.data.tables)
        || (res.data && Array.isArray(res.data.tables) && res.data.tables)
        || (res.data && res.data.data && Array.isArray(res.data.data.nodes) && res.data.data.nodes)
        || (Array.isArray(res.data) ? res.data : []);
      renderRows(
        'tablesTableWrap',
        ['ID', 'Identifier', 'Description'],
        list.map((t) => ({ raw: t, cells: ['#' + t.id, t.identifier, t.description || ''] })),
        (row) => {
          document.getElementById('tableIdInput').value = row.raw.identifier || row.raw.id;
          document.getElementById('iaQueryInput').value = row.raw.identifier || row.raw.id;
        },
      );
    }

    async function loadMemories() {
      const query = document.getElementById('memQueryInput').value.trim();
      const res = await callMcp('memory-recall', { query: query || undefined, limit: 20 });
      show('memOut', res);
      const payload = extractMcpPayload(res);
      const hits = (payload && Array.isArray(payload.hits)) ? payload.hits : [];
      renderRows(
        'memTableWrap',
        ['ID', 'Kind', 'Content', 'Topic', 'Score'],
        hits.map((h) => {
          const m = h.memory || h;
          return {
            raw: h,
            cells: [
              '#' + (m.id || '?'),
              m.kind || '-',
              m.content || '',
              Array.isArray(m.topicPath) ? m.topicPath.join(' / ') : '',
              typeof h.score === 'number' ? h.score.toFixed(3) : '-',
            ],
          };
        }),
      );
    }

    document.getElementById('saveTokenBtn').onclick = () => {
      sessionStorage.setItem('bgdb_studio_token', tokenEl.value.trim());
      loadHealth();
      loadTables();
      loadMemories();
    };
    document.getElementById('refreshAllBtn').onclick = () => { loadHealth(); loadTables(); loadMemories(); };
    document.getElementById('loadHealthBtn').onclick = loadHealth;
    document.getElementById('loadTablesBtn').onclick = loadTables;

    document.getElementById('applyPresetBtn').onclick = async () => {
      const preset = document.getElementById('presetSelect').value;
      show('healthOut', await callMcp('ia-apply-blueprint', { preset }));
      await loadTables();
    };

    document.getElementById('loadColumnsBtn').onclick = async () => {
      const id = document.getElementById('tableIdInput').value.trim();
      if (!id) return;
      const res = await apiJson('/api/tables/' + encodeURIComponent(id) + '/columns');
      show('tablesOut', res.data);
      const cols = (res.data && res.data.columns) || (res.data && res.data.data && res.data.data.columns) || [];
      if (Array.isArray(cols)) {
        renderRows('tablesTableWrap', ['Column', 'Type', 'Role', 'Required'], cols.map((c) => ({
          cells: [c.identifier, c.dataType || c.typeIdentifier || '-', (c.options && c.options.role) || '-', String(Boolean(c.isRequired))],
        })));
      }
    };

    document.getElementById('searchNodesBtn').onclick = async () => {
      const id = document.getElementById('tableIdInput').value.trim();
      const q = id ? '?tableId=' + encodeURIComponent(id) : '';
      const res = await apiJson('/api/nodes/search' + q);
      show('tablesOut', res.data);
      const nodes = (res.data && res.data.data && res.data.data.nodes) || (res.data && res.data.nodes) || [];
      if (Array.isArray(nodes)) {
        renderRows('tablesTableWrap', ['ID', 'Title', 'Content', 'Table'], nodes.map((n) => ({
          cells: ['#' + n.id, n.title || '-', n.content || '', n.tableId || '-'],
        })));
      }
    };

    document.getElementById('iaInspectBtn').onclick = async () => {
      const res = await callMcp('ia-inspect', {});
      show('iaOut', res);
      const p = extractMcpPayload(res);
      if (p && Array.isArray(p.tables)) {
        renderRows('iaTableWrap', ['Table', 'Nodes', 'Attributes', 'Tree Valid'], p.tables.map((t) => ({
          cells: [t.identifier, t.nodeCount, t.attributeCount, String(t.treeValidation ? t.treeValidation.valid : '-')],
        })));
      }
    };
    document.getElementById('iaAuditBtn').onclick = async () => {
      const res = await callMcp('ia-audit', {});
      show('iaOut', res);
      const p = extractMcpPayload(res);
      if (p && Array.isArray(p.issues)) {
        const rows = p.issues.length > 0
          ? p.issues.map((i) => ({ cells: [i.severity, i.tableIdentifier, i.code, i.message] }))
          : [{ cells: ['ok', 'all', 'HEALTHY', 'No IA integrity issues detected'] }];
        renderRows('iaTableWrap', ['Severity', 'Table', 'Code', 'Message'], rows);
      }
    };
    document.getElementById('iaOutlineBtn').onclick = async () => {
      const tableIdentifier = document.getElementById('iaQueryInput').value.trim() || 'ia_topics';
      const res = await callMcp('ia-get-outline', { tableIdentifier });
      show('iaOut', res);
      const p = extractMcpPayload(res);
      if (p && Array.isArray(p.roots)) {
        const flat = [];
        const walk = (nodes) => {
          for (const n of nodes) {
            flat.push({ cells: ['—'.repeat(n.depth || 0) + ' ' + (n.title || n.id), n.content || '', String(n.childCount || 0)] });
            if (Array.isArray(n.children)) walk(n.children);
          }
        };
        walk(p.roots);
        renderRows('iaTableWrap', ['Title', 'Content', 'Children'], flat);
      }
    };
    document.getElementById('iaQueryForm').onsubmit = async (e) => {
      e.preventDefault();
      const tableIdentifier = document.getElementById('iaQueryInput').value.trim() || 'ia_documents';
      const res = await callMcp('ia-query-structured', { tableIdentifier, includeFacets: true });
      show('iaOut', res);
      const p = extractMcpPayload(res);
      if (p && Array.isArray(p.hits)) {
        renderRows('iaTableWrap', ['ID', 'Title', 'Content'], p.hits.map((h) => ({
          cells: ['#' + h.node.id, h.node.title || '-', h.node.content || ''],
        })));
      }
    };

    document.getElementById('memStatsBtn').onclick = async () => {
      const res = await callMcp('memory-stats', {});
      show('memOut', res);
      const p = extractMcpPayload(res);
      if (p && p.byKind) {
        renderRows('memTableWrap', ['Metric', 'Value'], [
          { cells: ['total', p.total] },
          ...Object.entries(p.byKind).map(([k, v]) => ({ cells: ['kind:' + k, v] })),
        ]);
      }
    };
    document.getElementById('memRecallBtn').onclick = loadMemories;

    const rememberInput = document.getElementById('memRememberInput');
    rememberInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (event.isComposing || event.keyCode === 229) return;
        document.getElementById('memRememberForm').requestSubmit();
      }
    });
    document.getElementById('memRememberForm').onsubmit = async (e) => {
      e.preventDefault();
      const content = rememberInput.value.trim();
      if (!content) return;
      const res = await callMcp('memory-remember', { content, kind: 'semantic' });
      show('memOut', res);
      rememberInput.value = '';
      await loadMemories();
    };

    document.getElementById('loadMetricsBtn').onclick = async () => show('opsOut', await apiJson('/metrics?format=json'));
    document.getElementById('loadAuditBtn').onclick = async () => show('opsOut', await apiJson('/api/audit-log?limit=50'));

    loadHealth();
    loadTables();
    loadMemories();
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
