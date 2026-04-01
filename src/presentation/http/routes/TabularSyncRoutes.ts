import type { ILogger } from '@/application/ports/ILogger.js'
import type { BestEffortTabularSyncHook } from '@/application/services/BestEffortTabularSyncHook.js'
import type { TabularSyncConfig } from '@/infrastructure/excel/TabularSyncConfig.js'
import { TabularSyncConnectionInspector } from '@/infrastructure/excel/TabularSyncConnectionInspector.js'
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
      .grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin-bottom: 20px; }
      .stat { border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; background: #fafafa; }
      .stat .label { color: #6b7280; font-size: 12px; margin-bottom: 6px; }
      .stat .value { font-size: 22px; font-weight: 600; }
      input, textarea, button, select { font: inherit; padding: 8px 10px; }
      textarea { width: 100%; min-height: 220px; }
      .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { text-align: left; padding: 10px; border-bottom: 1px solid #e5e7eb; }
      code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; }
      .muted { color: #6b7280; }
      .actions { display: flex; gap: 8px; }
      .danger { color: #b91c1c; }
      .success { color: #047857; }
      .preset-row { display: flex; gap: 8px; margin-bottom: 12px; }
      .stack { display: flex; flex-direction: column; gap: 10px; }
      .two-col { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      .hint { color: #6b7280; font-size: 13px; margin-top: 6px; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; }
      .badge-ok { background: #ecfdf5; color: #047857; }
      .badge-warn { background: #fef3c7; color: #92400e; }
      .hidden { display: none; }
    </style>
  </head>
  <body>
    <h1>Tabular Sync Config Admin</h1>
    <p class="muted">Active config와 저장된 config를 조회하고 활성화/저장할 수 있습니다.</p>

    <div class="row">
      <button id="refreshButton" type="button">Refresh</button>
      <label><input id="autoRefreshToggle" type="checkbox" /> auto refresh (5s)</label>
      <span id="lastRefresh" class="muted">last refresh: -</span>
    </div>

    <div class="grid">
      <div class="stat"><div class="label">Active Config</div><div id="statActiveConfig" class="value">-</div></div>
      <div class="stat"><div class="label">Pending</div><div id="statPending" class="value">0</div></div>
      <div class="stat"><div class="label">Executions</div><div id="statExecutions" class="value">0</div></div>
      <div class="stat"><div class="label">Failures</div><div id="statFailures" class="value">0</div></div>
      <div class="stat"><div class="label">Success Rate</div><div id="statSuccessRate" class="value">0%</div></div>
    </div>

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
      <h2>Mapping Preview</h2>
      <table>
        <thead>
          <tr><th>Table</th><th>Target</th><th>Kind</th><th>Sheet</th><th>Enabled</th></tr>
        </thead>
        <tbody id="mappingRows"></tbody>
      </table>
    </div>

    <div class="card">
      <h2>Recent Events</h2>
      <table>
        <thead>
          <tr><th>Table</th><th>Mode</th><th>Status</th><th>Error</th><th>At</th></tr>
        </thead>
        <tbody id="eventRows"></tbody>
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
      <h2>Quick Setup</h2>
      <p class="muted">Google Sheets 또는 Excel 대상 연결을 쉽게 시작할 수 있는 draft config 생성기입니다.</p>
      <div class="row">
        <span id="quickTargetBadge" class="badge badge-ok">Google Sheets Recommended</span>
        <span id="quickSetupHelp" class="hint">Spreadsheet URL 또는 Spreadsheet ID를 넣고 draft를 생성하세요.</span>
      </div>
      <div class="two-col">
        <div class="stack">
          <label>Connection Type</label>
          <select id="quickTargetKind">
            <option value="google-sheets">Google Sheets</option>
            <option value="excel-file">Excel File</option>
          </select>
        </div>
        <div class="stack">
          <label>Config Key</label>
          <input id="quickConfigKey" value="google-main" />
        </div>
        <div class="stack">
          <label>Target ID</label>
          <input id="quickTargetId" value="google-main" />
        </div>
        <div class="stack">
          <label>Table Identifier</label>
          <input id="quickTableIdentifier" value="users" />
        </div>
        <div class="stack">
          <label>Sheet Name</label>
          <input id="quickSheetName" value="users" />
        </div>
        <div id="quickGoogleToolsBaseUrlBlock" class="stack">
          <label>Google Tools Base URL</label>
          <input id="quickGoogleToolsBaseUrl" value="http://localhost:5678" />
        </div>
        <div id="quickSpreadsheetUrlBlock" class="stack">
          <label>Spreadsheet URL</label>
          <input id="quickSpreadsheetUrl" placeholder="https://docs.google.com/spreadsheets/d/..." />
        </div>
        <div id="quickSpreadsheetIdBlock" class="stack">
          <label>Spreadsheet ID</label>
          <input id="quickSpreadsheetId" placeholder="spreadsheet id" />
          <span id="quickResolvedSpreadsheetId" class="hint">resolved id: -</span>
        </div>
        <div id="quickWorkbookPathBlock" class="stack">
          <label>Excel Workbook Path</label>
          <input id="quickWorkbookPath" placeholder="/Users/.../demo.xlsx" />
        </div>
        <div id="quickTransportBlock" class="stack">
          <label>Transport</label>
          <select id="quickTransport">
            <option value="google-tools-http">google-tools-http (Recommended)</option>
            <option value="pipe-builder-table-adapter">pipe-builder-table-adapter (Advanced)</option>
          </select>
        </div>
      </div>
      <div class="row" style="margin-top:12px;">
        <button id="buildGoogleDraftButton" type="button">Build Google Draft</button>
        <button id="buildExcelDraftButton" type="button">Build Excel Draft</button>
        <span id="quickSetupStatus" class="muted"></span>
      </div>
      <p class="hint">Google Sheets는 spreadsheet URL 또는 spreadsheet ID 중 하나만 있으면 됩니다. Excel File은 현재 연결 설정/preview/test 중심으로 먼저 지원하고 있습니다.</p>
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
        <button id="previewActiveButton" type="button">Preview Active Mapping</button>
        <button id="testDraftButton" type="button">Test Draft Config</button>
        <span id="saveStatus" class="muted"></span>
      </div>
    </div>

    <div class="card">
      <h2>Connection Test</h2>
      <table>
        <thead>
          <tr><th>Table</th><th>Target</th><th>Kind</th><th>Sheet</th><th>Result</th><th>Rows</th><th>Message</th></tr>
        </thead>
        <tbody id="connectionRows"></tbody>
      </table>
    </div>

    <script>
      let activeWindowPreset = '';
      let autoRefreshTimer = null;

      function extractSpreadsheetId(spreadsheetUrl) {
        if (!spreadsheetUrl) return '';
        const match = spreadsheetUrl.match(/\\/spreadsheets\\/d\\/([a-zA-Z0-9-_]+)/);
        return match ? match[1] : '';
      }

      function renderQuickSetupState() {
        const kind = document.getElementById('quickTargetKind').value;
        const spreadsheetUrl = document.getElementById('quickSpreadsheetUrl').value.trim();
        const spreadsheetIdInput = document.getElementById('quickSpreadsheetId').value.trim();
        const resolvedId = spreadsheetIdInput || extractSpreadsheetId(spreadsheetUrl);

        const isGoogle = kind === 'google-sheets';
        document.getElementById('quickGoogleToolsBaseUrlBlock').classList.toggle('hidden', !isGoogle);
        document.getElementById('quickSpreadsheetUrlBlock').classList.toggle('hidden', !isGoogle);
        document.getElementById('quickSpreadsheetIdBlock').classList.toggle('hidden', !isGoogle);
        document.getElementById('quickTransportBlock').classList.toggle('hidden', !isGoogle);
        document.getElementById('quickWorkbookPathBlock').classList.toggle('hidden', isGoogle);

        document.getElementById('quickResolvedSpreadsheetId').textContent = 'resolved id: ' + (resolvedId || '-');

        const badge = document.getElementById('quickTargetBadge');
        const help = document.getElementById('quickSetupHelp');
        badge.className = 'badge ' + (isGoogle ? 'badge-ok' : 'badge-warn');
        badge.textContent = isGoogle ? 'Google Sheets Recommended' : 'Excel Preview Only';
        help.textContent = isGoogle
          ? 'Spreadsheet URL 또는 Spreadsheet ID를 넣고 Google Sheets draft를 생성하세요.'
          : 'Excel file writer는 아직 미구현입니다. 경로/매핑 preview와 config 저장 용도로 먼저 사용하세요.';
      }

      function buildQuickConfig(kind) {
        const configKey = document.getElementById('quickConfigKey').value.trim() || 'tabular-main';
        const targetId = document.getElementById('quickTargetId').value.trim() || 'tabular-main';
        const tableIdentifier = document.getElementById('quickTableIdentifier').value.trim() || 'users';
        const sheetName = document.getElementById('quickSheetName').value.trim() || tableIdentifier;
        const transport = document.getElementById('quickTransport').value;
        const spreadsheetUrl = document.getElementById('quickSpreadsheetUrl').value.trim();
        const spreadsheetId = document.getElementById('quickSpreadsheetId').value.trim() || extractSpreadsheetId(spreadsheetUrl);
        const workbookPath = document.getElementById('quickWorkbookPath').value.trim();
        const googleToolsBaseUrl = document.getElementById('quickGoogleToolsBaseUrl').value.trim() || 'http://localhost:5678';

        const config = kind === 'excel-file'
          ? {
              defaultTargetId: targetId,
              targets: [
                {
                  id: targetId,
                  kind: 'excel-file',
                  workbookPath: workbookPath || '/Users/junwoobang/Documents/demo.xlsx'
                }
              ],
              routes: [
                {
                  tableIdentifier,
                  targetId,
                  sheetName,
                }
              ]
            }
          : {
              defaultTargetId: targetId,
              targets: [
                {
                  id: targetId,
                  kind: 'google-sheets',
                  transport,
                  spreadsheetId: spreadsheetId || undefined,
                  spreadsheetUrl: spreadsheetUrl || undefined,
                  googleToolsBaseUrl
                }
              ],
              routes: [
                {
                  tableIdentifier,
                  targetId,
                  sheetName,
                }
              ]
            };

        document.getElementById('configKey').value = configKey;
        document.getElementById('configJson').value = JSON.stringify(config, null, 2);
        document.getElementById('quickSetupStatus').textContent =
          kind === 'excel-file'
            ? 'Excel draft inserted into config editor (preview-only)'
            : 'Google Sheets draft inserted into config editor';
      }

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
        const statusData = statusPayload.status || {};
        const activeConfig = activePayload.config || null;

        document.getElementById('active').textContent = JSON.stringify(activePayload, null, 2);
        document.getElementById('syncStatus').textContent = JSON.stringify(statusPayload, null, 2);
        document.getElementById('lastRefresh').textContent = 'last refresh: ' + new Date().toLocaleTimeString();

        const totalExecutions = Number(statusData.totalExecutions || 0);
        const totalSucceeded = Number(statusData.totalSucceeded || 0);
        const totalFailed = Number(statusData.totalFailed || 0);
        const successRate = totalExecutions > 0 ? ((totalSucceeded / totalExecutions) * 100).toFixed(1) : '0.0';
        document.getElementById('statActiveConfig').textContent = activeConfig?.configKey || '-';
        document.getElementById('statPending').textContent = String(statusData.pendingCount || 0);
        document.getElementById('statExecutions').textContent = String(totalExecutions);
        document.getElementById('statFailures').textContent = String(totalFailed);
        document.getElementById('statSuccessRate').textContent = successRate + '%';

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
        if (summaryRows.length === 0) {
          summaryTbody.innerHTML = '<tr><td colspan="8" class="muted">No summary rows yet</td></tr>';
        }

        const previewResponse = await fetch('/api/tabular-sync-preview');
        const previewPayload = await previewResponse.json();
        const mappingRows = previewPayload.preview || [];
        const mappingTbody = document.getElementById('mappingRows');
        mappingTbody.innerHTML = '';
        mappingRows.forEach((row) => {
          const tr = document.createElement('tr');
          tr.innerHTML = '<td><code>' + row.tableIdentifier + '</code></td>' +
            '<td><code>' + row.targetId + '</code></td>' +
            '<td>' + row.targetKind + '</td>' +
            '<td>' + row.sheetName + '</td>' +
            '<td>' + String(row.enabled) + '</td>';
          mappingTbody.appendChild(tr);
        });
        if (mappingRows.length === 0) {
          mappingTbody.innerHTML = '<tr><td colspan="5" class="muted">No active mapping preview</td></tr>';
        }

        const eventRows = statusData.persistedEvents || [];
        const eventTbody = document.getElementById('eventRows');
        eventTbody.innerHTML = '';
        eventRows.forEach((row) => {
          const statusClass = row.status === 'failure' ? 'danger' : 'success';
          const tr = document.createElement('tr');
          tr.innerHTML = '<td><code>' + row.tableIdentifier + '</code></td>' +
            '<td>' + row.mode + '</td>' +
            '<td class="' + statusClass + '">' + row.status + '</td>' +
            '<td>' + (row.errorMessage || '') + '</td>' +
            '<td>' + row.createdAt + '</td>';
          eventTbody.appendChild(tr);
        });
        if (eventRows.length === 0) {
          eventTbody.innerHTML = '<tr><td colspan="5" class="muted">No events yet</td></tr>';
        }

        const connectionTbody = document.getElementById('connectionRows');
        if (!connectionTbody.innerHTML) {
          connectionTbody.innerHTML = '<tr><td colspan="7" class="muted">Run a connection test to see results</td></tr>';
        }

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
        if (failures.length === 0) {
          failureTbody.innerHTML = '<tr><td colspan="5" class="muted">No recent failures</td></tr>';
        }

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
      document.getElementById('quickTargetKind').addEventListener('change', renderQuickSetupState);
      document.getElementById('quickSpreadsheetUrl').addEventListener('input', renderQuickSetupState);
      document.getElementById('quickSpreadsheetId').addEventListener('input', renderQuickSetupState);
      document.getElementById('buildGoogleDraftButton').addEventListener('click', () => buildQuickConfig('google-sheets'));
      document.getElementById('buildExcelDraftButton').addEventListener('click', () => buildQuickConfig('excel-file'));
      document.getElementById('previewActiveButton').addEventListener('click', async () => {
        await loadConfigs();
      });
      document.getElementById('testDraftButton').addEventListener('click', async () => {
        const raw = document.getElementById('configJson').value;
        const tbody = document.getElementById('connectionRows');
        try {
          const config = JSON.parse(raw);
          const response = await fetch('/api/tabular-sync-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config }),
          });
          const payload = await response.json();
          const rows = payload.results || [];
          tbody.innerHTML = '';
          rows.forEach((row) => {
            const resultClass = row.success ? 'success' : 'danger';
            const tr = document.createElement('tr');
            tr.innerHTML = '<td><code>' + row.tableIdentifier + '</code></td>' +
              '<td><code>' + row.targetId + '</code></td>' +
              '<td>' + row.targetKind + '</td>' +
              '<td>' + row.sheetName + '</td>' +
              '<td class="' + resultClass + '">' + (row.success ? 'ok' : 'failed') + '</td>' +
              '<td>' + row.rowCount + '</td>' +
              '<td>' + row.message + '</td>';
            tbody.appendChild(tr);
          });
          if (rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="muted">No routes to test</td></tr>';
          }
        } catch (error) {
          tbody.innerHTML = '<tr><td colspan="7" class="danger">' + error.message + '</td></tr>';
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
      document.getElementById('refreshButton').addEventListener('click', () => loadConfigs());
      document.getElementById('autoRefreshToggle').addEventListener('change', (event) => {
        if (autoRefreshTimer) {
          clearInterval(autoRefreshTimer);
          autoRefreshTimer = null;
        }
        if (event.target.checked) {
          autoRefreshTimer = setInterval(() => loadConfigs(), 5000);
        }
      });

      renderQuickSetupState();
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
  const inspector = new TabularSyncConnectionInspector()
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

    if (request.method === 'GET' && pathname === '/api/tabular-sync-preview') {
      const activeConfig = store.getActiveConfig()
      return Response.json({
        success: true,
        preview: activeConfig ? inspector.preview(activeConfig) : [],
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

    if (request.method === 'POST' && pathname === '/api/tabular-sync-test') {
      const body = (await request.json()) as {
        config?: TabularSyncConfig
      }

      if (!body.config) {
        return Response.json({ success: false, error: 'config is required' }, { status: 400 })
      }

      try {
        const results = await inspector.test(body.config)
        return Response.json({
          success: true,
          results,
        })
      } catch (error) {
        logger.warn('Failed to run tabular sync connection test', {
          error: error instanceof Error ? error.message : String(error),
        })
        return Response.json(
          { success: false, error: error instanceof Error ? error.message : String(error) },
          { status: 400 },
        )
      }
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
