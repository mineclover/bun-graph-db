import type { ILogger } from '@/application/ports/ILogger.js'
import type { BestEffortTabularSyncHook } from '@/application/services/BestEffortTabularSyncHook.js'
import type { TabularSyncConfig } from '@/infrastructure/excel/TabularSyncConfig.js'
import type { TabularSyncConfigStore } from '@/infrastructure/excel/TabularSyncConfigStore.js'

function htmlPage(): string {
  return `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tabular Sync Config</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 32px; color: #111827; }
      h1, h2 { margin-bottom: 12px; }
      .row { display: flex; gap: 12px; margin-bottom: 12px; }
      input, textarea, button, select { font: inherit; padding: 8px 10px; }
      textarea { width: 100%; min-height: 220px; }
      .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { text-align: left; padding: 10px; border-bottom: 1px solid #e5e7eb; }
      code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; }
      .muted { color: #6b7280; }
      .actions { display: flex; gap: 8px; }
      .danger { color: #b91c1c; }
      .preset-row { display: flex; gap: 8px; margin-bottom: 12px; }
    </style>
  </head>
  <body>
    <h1>Tabular Sync Config Admin</h1>
    <p class="muted">Active config와 저장된 config를 조회하고 활성화/저장할 수 있습니다.</p>

    <div class="card">
      <h2>Active Config</h2>
      <pre id="active">Loading...</pre>
    </div>

    <div class="card">
      <h2>Sync Status</h2>
      <pre id="syncStatus">Loading...</pre>
    </div>

    <div class="card">
      <h2>Persisted Summary</h2>
      <table>
        <thead>
          <tr><th>Table</th><th>Mode</th><th>Total</th><th>Success</th><th>Failure</th><th>Rate</th><th>Latest Error</th><th>Last</th></tr>
        </thead>
        <tbody id="summaryRows"></tbody>
      </table>
    </div>

    <div class="card">
      <h2>Recent Failures</h2>
      <div class="row">
        <input id="failureTableFilter" placeholder="tableIdentifier filter" />
        <select id="failureStatusFilter">
          <option value="">all statuses</option>
          <option value="failure">failure</option>
          <option value="success">success</option>
        </select>
        <select id="failureModeFilter">
          <option value="">all modes</option>
          <option value="sync">sync</option>
          <option value="clear">clear</option>
        </select>
        <input id="failureLimitFilter" type="number" value="20" min="1" max="200" />
        <input id="failureCreatedAfterFilter" placeholder="createdAfter ISO" />
        <input id="failureCreatedBeforeFilter" placeholder="createdBefore ISO" />
      </div>
      <div class="preset-row">
        <button type="button" data-window-preset="1h">1h</button>
        <button type="button" data-window-preset="24h">24h</button>
        <button type="button" data-window-preset="7d">7d</button>
        <button type="button" data-window-preset="">clear</button>
        <span id="windowPresetLabel" class="muted">preset: none</span>
      </div>
      <table>
        <thead>
          <tr><th>Table</th><th>Mode</th><th>Error</th><th>At</th><th>Action</th></tr>
        </thead>
        <tbody id="failureRows"></tbody>
      </table>
    </div>

    <div class="card">
      <h2>Configs</h2>
      <table>
        <thead>
          <tr><th>Key</th><th>Active</th><th>Updated</th><th>Action</th></tr>
        </thead>
        <tbody id="configRows"></tbody>
      </table>
    </div>

    <div class="card">
      <h2>Save Config</h2>
      <div class="row">
        <input id="configKey" placeholder="config key" />
        <label><input id="configActive" type="checkbox" checked /> active</label>
      </div>
      <textarea id="configJson">{\n  "defaultTargetId": "google-sheets-primary",\n  "targets": [],\n  "routes": []\n}</textarea>
      <div class="row">
        <button id="saveButton">Save</button>
        <span id="saveStatus" class="muted"></span>
      </div>
    </div>

    <script>
      let activeWindowPreset = '';

      async function loadConfigs() {
        const tableIdentifier = document.getElementById('failureTableFilter').value.trim();
        const status = document.getElementById('failureStatusFilter').value;
        const mode = document.getElementById('failureModeFilter').value;
        const limit = document.getElementById('failureLimitFilter').value || '20';
        const createdAfter = document.getElementById('failureCreatedAfterFilter').value.trim();
        const createdBefore = document.getElementById('failureCreatedBeforeFilter').value.trim();
        const statusUrl = new URL('/api/tabular-sync-status', window.location.origin);
        if (tableIdentifier) statusUrl.searchParams.set('tableIdentifier', tableIdentifier);
        if (status) statusUrl.searchParams.set('status', status);
        if (mode) statusUrl.searchParams.set('mode', mode);
        if (activeWindowPreset) statusUrl.searchParams.set('windowPreset', activeWindowPreset);
        if (limit) statusUrl.searchParams.set('limit', limit);
        if (createdAfter) statusUrl.searchParams.set('createdAfter', createdAfter);
        if (createdBefore) statusUrl.searchParams.set('createdBefore', createdBefore);

        const summaryUrl = new URL('/api/tabular-sync-summary', window.location.origin);
        if (tableIdentifier) summaryUrl.searchParams.set('tableIdentifier', tableIdentifier);
        if (status) summaryUrl.searchParams.set('status', status);
        if (mode) summaryUrl.searchParams.set('mode', mode);
        if (activeWindowPreset) summaryUrl.searchParams.set('windowPreset', activeWindowPreset);
        if (limit) summaryUrl.searchParams.set('limit', limit);
        if (createdAfter) summaryUrl.searchParams.set('createdAfter', createdAfter);
        if (createdBefore) summaryUrl.searchParams.set('createdBefore', createdBefore);

        document.getElementById('windowPresetLabel').textContent = 'preset: ' + (activeWindowPreset || 'none');

        const [activeRes, listRes, statusRes, summaryRes] = await Promise.all([
          fetch('/api/tabular-sync-configs/active'),
          fetch('/api/tabular-sync-configs'),
          fetch(statusUrl.toString()),
          fetch(summaryUrl.toString()),
        ]);

        const activePayload = await activeRes.json();
        const listPayload = await listRes.json();
        const statusPayload = await statusRes.json();
        const summaryPayload = await summaryRes.json();

        document.getElementById('active').textContent = JSON.stringify(activePayload, null, 2);
        document.getElementById('syncStatus').textContent = JSON.stringify(statusPayload, null, 2);

        const summaryRows = summaryPayload.summary || [];
        const summaryTbody = document.getElementById('summaryRows');
        summaryTbody.innerHTML = '';
        summaryRows.forEach((row) => {
          const tr = document.createElement('tr');
          tr.innerHTML = '<td><code>' + row.tableIdentifier + '</code></td>' +
            '<td>' + row.mode + '</td>' +
            '<td>' + row.eventCount + '</td>' +
            '<td>' + row.successCount + '</td>' +
            '<td>' + row.failureCount + '</td>' +
            '<td>' + Number(row.successRate).toFixed(2) + '</td>' +
            '<td>' + (row.latestErrorMessage || '') + '</td>' +
            '<td>' + row.lastCreatedAt + '</td>';
          summaryTbody.appendChild(tr);
        });

        const rows = listPayload.configs || [];
        const tbody = document.getElementById('configRows');
        tbody.innerHTML = '';
        rows.forEach((row) => {
          const tr = document.createElement('tr');
          tr.innerHTML = '<td><code>' + row.configKey + '</code></td>' +
            '<td>' + String(row.isActive) + '</td>' +
            '<td>' + row.updatedAt + '</td>' +
            '<td class="actions"><button data-key="' + row.configKey + '">Activate</button></td>';
          tbody.appendChild(tr);
        });

        tbody.querySelectorAll('button[data-key]').forEach((button) => {
          button.addEventListener('click', async () => {
            const configKey = button.getAttribute('data-key');
            await fetch('/api/tabular-sync-configs/' + encodeURIComponent(configKey) + '/activate', {
              method: 'POST',
            });
            await loadConfigs();
          });
        });

        const failures = statusPayload.status?.recentFailures || [];
        const failureTbody = document.getElementById('failureRows');
        failureTbody.innerHTML = '';

        failures.forEach((failure) => {
          const tr = document.createElement('tr');
          tr.innerHTML = '<td><code>' + failure.tableIdentifier + '</code></td>' +
            '<td>' + failure.mode + '</td>' +
            '<td class="danger">' + failure.error + '</td>' +
            '<td>' + failure.occurredAt + '</td>' +
            '<td class="actions"><button data-resync="' + failure.tableIdentifier + '">Retry</button></td>';
          failureTbody.appendChild(tr);
        });

        failureTbody.querySelectorAll('button[data-resync]').forEach((button) => {
          button.addEventListener('click', async () => {
            const tableIdentifier = button.getAttribute('data-resync');
            await fetch('/api/tabular-sync-status/resync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tableIdentifier }),
            });
            await loadConfigs();
          });
        });
      }

      document.getElementById('saveButton').addEventListener('click', async () => {
        const configKey = document.getElementById('configKey').value.trim();
        const active = document.getElementById('configActive').checked;
        const raw = document.getElementById('configJson').value;
        const status = document.getElementById('saveStatus');

        try {
          const config = JSON.parse(raw);
          const response = await fetch('/api/tabular-sync-configs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ configKey, config, active }),
          });
          const payload = await response.json();
          status.textContent = payload.success ? 'Saved' : 'Save failed';
          await loadConfigs();
        } catch (error) {
          status.textContent = error.message;
        }
      });

      document.getElementById('failureTableFilter').addEventListener('change', () => loadConfigs());
      document.getElementById('failureStatusFilter').addEventListener('change', () => loadConfigs());
      document.getElementById('failureModeFilter').addEventListener('change', () => loadConfigs());
      document.getElementById('failureLimitFilter').addEventListener('change', () => loadConfigs());
      document.getElementById('failureCreatedAfterFilter').addEventListener('change', () => {
        activeWindowPreset = '';
        loadConfigs();
      });
      document.getElementById('failureCreatedBeforeFilter').addEventListener('change', () => {
        activeWindowPreset = '';
        loadConfigs();
      });
      document.querySelectorAll('button[data-window-preset]').forEach((button) => {
        button.addEventListener('click', () => {
          activeWindowPreset = button.getAttribute('data-window-preset') || '';
          loadConfigs();
        });
      });

      loadConfigs().catch((error) => {
        document.getElementById('active').textContent = String(error);
      });
    </script>
  </body>
</html>`
}

export function createTabularSyncHandler(
  store: TabularSyncConfigStore,
  logger: ILogger,
  hook?: BestEffortTabularSyncHook,
) {
  const getStatus = (filters?: {
    limit?: number
    tableIdentifier?: string
    status?: string
    mode?: string
    windowPreset?: string
    createdAfter?: string
    createdBefore?: string
  }) =>
    hook?.getStatus(filters) || {
      enabled: false,
      configSource: 'none',
      syncDebounceMs: 0,
      pendingCount: 0,
      pendingTables: [],
      totalNotifications: 0,
      totalExecutions: 0,
      totalSucceeded: 0,
      totalFailed: 0,
      lastSuccessAt: null,
      lastFailureAt: null,
      recentFailures: [],
      tables: [],
      persistedEvents: [],
      persistedSummary: [],
    }

  return async (request: Request): Promise<Response | null> => {
    const url = new URL(request.url)
    const pathname = url.pathname

    if (request.method === 'GET' && pathname === '/tabular-sync') {
      return new Response(htmlPage(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    if (request.method === 'GET' && pathname === '/api/tabular-sync-configs') {
      return Response.json({ success: true, configs: store.listConfigs() })
    }

    if (request.method === 'GET' && pathname === '/api/tabular-sync-configs/active') {
      return Response.json({ success: true, config: store.getActiveConfigRecord() })
    }

    if (request.method === 'GET' && pathname === '/api/tabular-sync-status') {
      const limit = url.searchParams.get('limit')
      const tableIdentifier = url.searchParams.get('tableIdentifier')
      const status = url.searchParams.get('status')
      const mode = url.searchParams.get('mode')
      const windowPreset = url.searchParams.get('windowPreset')
      const createdAfter = url.searchParams.get('createdAfter')
      const createdBefore = url.searchParams.get('createdBefore')
      return Response.json({
        success: true,
        status: getStatus({
          limit: limit ? Number(limit) : undefined,
          tableIdentifier: tableIdentifier || undefined,
          status: status || undefined,
          mode: mode || undefined,
          windowPreset: windowPreset || undefined,
          createdAfter: createdAfter || undefined,
          createdBefore: createdBefore || undefined,
        }),
      })
    }

    if (request.method === 'GET' && pathname === '/api/tabular-sync-summary') {
      const limit = url.searchParams.get('limit')
      const tableIdentifier = url.searchParams.get('tableIdentifier')
      const status = url.searchParams.get('status')
      const mode = url.searchParams.get('mode')
      const windowPreset = url.searchParams.get('windowPreset')
      const createdAfter = url.searchParams.get('createdAfter')
      const createdBefore = url.searchParams.get('createdBefore')
      const summary = getStatus({
        limit: limit ? Number(limit) : undefined,
        tableIdentifier: tableIdentifier || undefined,
        status: status || undefined,
        mode: mode || undefined,
        windowPreset: windowPreset || undefined,
        createdAfter: createdAfter || undefined,
        createdBefore: createdBefore || undefined,
      }).persistedSummary

      return Response.json({
        success: true,
        summary,
      })
    }

    if (request.method === 'GET' && pathname.startsWith('/api/tabular-sync-configs/')) {
      const configKey = pathname.split('/')[3]
      if (configKey && configKey !== 'active') {
        return Response.json({
          success: true,
          config: store.getConfigRecordByKey(decodeURIComponent(configKey)),
        })
      }
    }

    if (request.method === 'POST' && pathname === '/api/tabular-sync-configs') {
      const body = (await request.json()) as {
        configKey?: string
        config?: TabularSyncConfig
        active?: boolean
      }

      if (!body.configKey || !body.config) {
        return Response.json(
          { success: false, error: 'configKey and config are required' },
          { status: 400 },
        )
      }

      store.saveConfig(body.configKey, body.config, { active: body.active !== false })
      return Response.json({
        success: true,
        config: store.getConfigRecordByKey(body.configKey),
      })
    }

    if (
      request.method === 'POST' &&
      pathname.startsWith('/api/tabular-sync-configs/') &&
      pathname.endsWith('/activate')
    ) {
      const configKey = pathname.split('/')[3]
      if (!configKey) {
        return Response.json({ success: false, error: 'configKey is required' }, { status: 400 })
      }

      try {
        store.activateConfig(decodeURIComponent(configKey))
        return Response.json({
          success: true,
          config: store.getActiveConfigRecord(),
        })
      } catch (error) {
        logger.warn('Failed to activate tabular sync config', {
          configKey,
          error: error instanceof Error ? error.message : String(error),
        })
        return Response.json(
          { success: false, error: error instanceof Error ? error.message : String(error) },
          { status: 400 },
        )
      }
    }

    if (request.method === 'POST' && pathname === '/api/tabular-sync-status/resync') {
      const body = (await request.json()) as {
        tableIdentifier?: string
      }

      if (!body.tableIdentifier) {
        return Response.json({ success: false, error: 'tableIdentifier is required' }, { status: 400 })
      }

      if (!hook) {
        return Response.json(
          { success: false, error: 'tabular sync hook is not available', status: getStatus() },
          { status: 400 },
        )
      }

      const syncSucceeded = await hook.syncByIdentifier(body.tableIdentifier)

      return Response.json({
        success: syncSucceeded,
        tableIdentifier: body.tableIdentifier,
        status: getStatus(),
      })
    }

    return null
  }
}
