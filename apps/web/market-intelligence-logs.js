import { initEnterpriseSidebar } from "./enterprise-sidebar.js";

const API = `${location.protocol}//${location.hostname}:8080`;
let currentPage = 1;
let pageSize = 50;
let currentFilters = {};
let selectedLogId = null;
let activeTab = 'logs-table';
const LIVE_REFRESH_MS = 15000;

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  return response.json();
}

async function loadLogsSummary() {
  try {
    const summary = await fetchJSON(`${API}/api/market-intelligence/logs/summary?environment=production`);
    document.getElementById('total-logs-today').textContent = summary.totalLogsToday.toLocaleString();
    document.getElementById('successful-events').textContent = summary.successfulEvents.toLocaleString();
    document.getElementById('failed-events').textContent = summary.failedEvents.toLocaleString();
    document.getElementById('warnings').textContent = summary.warnings.toLocaleString();
    document.getElementById('critical-errors').textContent = summary.criticalErrors.toLocaleString();
    document.getElementById('sync-events').textContent = summary.syncEvents.toLocaleString();
    document.getElementById('validation-events').textContent = summary.validationEvents.toLocaleString();
    document.getElementById('scoring-events').textContent = summary.scoringEvents.toLocaleString();
    document.getElementById('handoff-events').textContent = summary.handoffEvents.toLocaleString();
    document.getElementById('user-actions').textContent = summary.userActions.toLocaleString();
    document.getElementById('provider-errors').textContent = summary.providerErrors.toLocaleString();
    document.getElementById('unresolved-issues').textContent = summary.unresolvedIssues.toLocaleString();
    document.getElementById('last-log-received').textContent = `Last Log: ${summary.lastLogReceived ? new Date(summary.lastLogReceived).toLocaleString() : '—'}`;
    document.getElementById('critical-errors-today').textContent = `Critical Errors: ${summary.criticalErrorsToday}`;
  } catch (error) {
    console.error('[logs] Failed to load summary:', error);
  }
}

async function loadLogs({ silent = false } = {}) {
  const tbody = document.getElementById('logs-table-body');
  if (!silent) tbody.innerHTML = '<tr class="loading-row"><td colspan="15">Loading logs...</td></tr>';

  try {
    const params = new URLSearchParams({
      page: currentPage,
      pageSize,
      environment: 'production',
      ...currentFilters
    });
    const data = await fetchJSON(`${API}/api/market-intelligence/logs?${params}`);
    
    if (data.logs.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="15">No logs found matching the current filters.</td></tr>';
      document.getElementById('empty-state').classList.remove('hidden');
    } else {
      document.getElementById('empty-state').classList.add('hidden');
      tbody.innerHTML = data.logs.map(log => renderLogRow(log)).join('');
    }

    document.getElementById('page-info').textContent = `Page ${currentPage} of ${Math.ceil(data.total / pageSize)}`;
    document.getElementById('prev-page').disabled = currentPage <= 1;
    document.getElementById('next-page').disabled = currentPage >= Math.ceil(data.total / pageSize);
  } catch (error) {
    console.error('[logs] Failed to load logs:', error);
    tbody.innerHTML = '<tr class="error-row"><td colspan="15">Failed to load logs. Please try again.</td></tr>';
  }
}

function renderLogRow(log) {
  const severityClass = log.severity || 'info';
  const statusClass = log.status || 'unknown';
  return `
    <tr class="log-row" data-log-id="${log.id}">
      <td>${new Date(log.timestamp).toLocaleString()}</td>
      <td><span class="severity ${severityClass}">${log.severity}</span></td>
      <td><span class="status ${statusClass}">${log.status}</span></td>
      <td>${log.module || '—'}</td>
      <td>${log.category || '—'}</td>
      <td>${log.action || '—'}</td>
      <td class="message">${log.message || '—'}</td>
      <td>${log.entity_type || '—'}</td>
      <td>${log.entity_id || '—'}</td>
      <td>${log.user_name || '—'}</td>
      <td>${log.source || log.provider || '—'}</td>
      <td class="correlation-id">${log.correlation_id || '—'}</td>
      <td>${log.duration_ms ? `${log.duration_ms}ms` : '—'}</td>
      <td>${log.environment || '—'}</td>
      <td class="actions">
        <button class="action-button" data-action="view-details">View Details</button>
        <button class="action-button" data-action="copy-correlation">Copy ID</button>
        <button class="action-button" data-action="acknowledge">Acknowledge</button>
        <button class="action-button" data-action="resolve">Resolve</button>
        <button class="action-button" data-action="export-row">Export Row</button>
      </td>
    </tr>
  `;
}

async function loadCriticalErrors() {
  const tbody = document.getElementById('errors-table-body');
  tbody.innerHTML = '<tr class="loading-row"><td colspan="11">Loading errors...</td></tr>';

  try {
    const errors = await fetchJSON(`${API}/api/market-intelligence/logs/errors?environment=production`);
    if (errors.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="11">No critical errors found.</td></tr>';
    } else {
      tbody.innerHTML = errors.map(error => renderErrorRow(error)).join('');
    }
  } catch (error) {
    console.error('[logs] Failed to load errors:', error);
    tbody.innerHTML = '<tr class="error-row"><td colspan="11">Failed to load errors.</td></tr>';
  }
}

function refreshActiveTab({ silent = true } = {}) {
  loadLogsSummary();
  if (activeTab === 'logs-table') loadLogs({ silent });
  if (activeTab === 'critical-errors') loadCriticalErrors();
  if (activeTab === 'audit-trail') loadAuditLogs();
  if (activeTab === 'metrics') loadMetrics();
}

function renderErrorRow(error) {
  return `
    <tr class="error-row">
      <td>${new Date(error.timestamp).toLocaleString()}</td>
      <td>${error.module || '—'}</td>
      <td>${error.category || '—'}</td>
      <td>${error.error_code || '—'}</td>
      <td class="message">${error.message || '—'}</td>
      <td>${error.affected_entity_type || '—'}</td>
      <td><span class="severity ${error.severity}">${error.severity}</span></td>
      <td>${error.retry_count || 0}</td>
      <td>${error.resolved ? 'Yes' : 'No'}</td>
      <td>${error.recommended_action || '—'}</td>
      <td class="actions">
        <button class="action-button" data-action="resolve">Resolve</button>
      </td>
    </tr>
  `;
}

async function loadAuditLogs() {
  const tbody = document.getElementById('audit-table-body');
  tbody.innerHTML = '<tr class="loading-row"><td colspan="9">Loading audit logs...</td></tr>';

  try {
    const logs = await fetchJSON(`${API}/api/market-intelligence/logs/audit?environment=production`);
    if (logs.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="9">No audit logs found.</td></tr>';
    } else {
      tbody.innerHTML = logs.map(log => renderAuditRow(log)).join('');
    }
  } catch (error) {
    console.error('[logs] Failed to load audit logs:', error);
    tbody.innerHTML = '<tr class="error-row"><td colspan="9">Failed to load audit logs.</td></tr>';
  }
}

function renderAuditRow(log) {
  return `
    <tr class="audit-row">
      <td>${new Date(log.timestamp).toLocaleString()}</td>
      <td>${log.user_name || '—'}</td>
      <td>${log.action || '—'}</td>
      <td>${log.entity_type || '—'}</td>
      <td class="json-value">${log.before_value ? JSON.stringify(log.before_value) : '—'}</td>
      <td class="json-value">${log.after_value ? JSON.stringify(log.after_value) : '—'}</td>
      <td>${log.reason || '—'}</td>
      <td>${log.ip_address || '—'}</td>
      <td>${log.environment || '—'}</td>
    </tr>
  `;
}

function downloadText(filename, text, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

async function exportCurrentLogs(type = 'csv') {
  try {
    const params = new URLSearchParams({
      type,
      environment: 'production',
      ...currentFilters
    });
    const data = await fetchJSON(`${API}/api/market-intelligence/logs/export?${params}`);
    if (type === 'json') {
      downloadText(`market-intelligence-logs-${data.exportId}.json`, JSON.stringify(data.logs, null, 2), 'application/json');
      return;
    }
    const headers = ['timestamp', 'severity', 'status', 'module', 'category', 'action', 'message', 'entity_type', 'entity_id', 'user_name', 'source', 'provider', 'correlation_id', 'duration_ms', 'environment'];
    const escapeCsv = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.join(','), ...data.logs.map(log => headers.map(header => escapeCsv(log[header])).join(','))].join('\n');
    downloadText(`market-intelligence-logs-${data.exportId}.csv`, csv, 'text/csv');
  } catch (error) {
    console.error('[logs] Failed to export logs:', error);
    alert('Failed to export logs');
  }
}

async function exportSingleLog(logId) {
  try {
    const log = await fetchJSON(`${API}/api/market-intelligence/logs/${logId}`);
    downloadText(`market-intelligence-log-${logId}.json`, JSON.stringify(log, null, 2), 'application/json');
  } catch (error) {
    console.error('[logs] Failed to export log:', error);
    alert('Failed to export log');
  }
}

async function loadMetrics() {
  try {
    const metrics = await fetchJSON(`${API}/api/market-intelligence/logs/metrics?environment=production`);
    
    document.getElementById('handoff-success-rate').textContent = `${metrics.handoffSuccessRate.toFixed(1)}%`;
    document.getElementById('avg-processing-duration').textContent = `${Math.round(metrics.averageProcessingDuration)}ms`;

    // Render top failing sources
    const sourcesContainer = document.getElementById('top-failing-sources-chart');
    if (metrics.topFailingSources.length > 0) {
      sourcesContainer.innerHTML = metrics.topFailingSources.map(s => 
        `<div class="bar-item"><span>${s.source}</span><span class="bar-value">${s.failure_count}</span></div>`
      ).join('');
    }

    // Render top error categories
    const categoriesContainer = document.getElementById('top-error-categories-chart');
    if (metrics.topErrorCategories.length > 0) {
      categoriesContainer.innerHTML = metrics.topErrorCategories.map(c => 
        `<div class="bar-item"><span>${c.category}</span><span class="bar-value">${c.failure_count}</span></div>`
      ).join('');
    }
  } catch (error) {
    console.error('[logs] Failed to load metrics:', error);
  }
}

async function loadTimeline(correlationId) {
  const container = document.getElementById('timeline-container');
  container.innerHTML = '<p class="loading">Loading timeline...</p>';

  try {
    const data = await fetchJSON(`${API}/api/market-intelligence/logs/timeline?correlationId=${correlationId}`);
    if (data.timeline.length === 0) {
      container.innerHTML = '<p class="empty-state">No timeline events found for this correlation ID.</p>';
    } else {
      container.innerHTML = renderTimeline(data.timeline);
    }
  } catch (error) {
    console.error('[logs] Failed to load timeline:', error);
    container.innerHTML = '<p class="error">Failed to load timeline.</p>';
  }
}

function renderTimeline(timeline) {
  return `
    <div class="timeline-events">
      ${timeline.map(event => `
        <div class="timeline-event">
          <div class="timeline-marker"></div>
          <div class="timeline-content">
            <small>${new Date(event.timestamp).toLocaleString()}</small>
            <strong>${event.event_type}</strong>
            <p>${event.data ? JSON.stringify(event.data) : ''}</p>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

async function loadLogCategories() {
  try {
    const categories = await fetchJSON(`${API}/api/market-intelligence/logs/categories`);
    const select = document.getElementById('filter-category');
    select.innerHTML = '<option value="">All Categories</option>' +
      categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
  } catch (error) {
    console.error('[logs] Failed to load categories:', error);
  }
}

async function viewLogDetails(logId) {
  selectedLogId = logId;
  const drawer = document.getElementById('log-detail-drawer');
  
  try {
    const log = await fetchJSON(`${API}/api/market-intelligence/logs/${logId}`);
    
    document.getElementById('detail-log-id').textContent = log.id;
    document.getElementById('detail-timestamp').textContent = new Date(log.timestamp).toLocaleString();
    document.getElementById('detail-severity').textContent = log.severity;
    document.getElementById('detail-status').textContent = log.status;
    document.getElementById('detail-module').textContent = log.module;
    document.getElementById('detail-category').textContent = log.category;
    document.getElementById('detail-action').textContent = log.action;
    document.getElementById('detail-message').textContent = log.message;
    document.getElementById('detail-description').textContent = log.detailed_description || '—';
    document.getElementById('detail-entity-type').textContent = log.entity_type || '—';
    document.getElementById('detail-entity-id').textContent = log.entity_id || '—';
    document.getElementById('detail-user').textContent = log.user_name || '—';
    document.getElementById('detail-ip-address').textContent = log.ip_address || '—';
    document.getElementById('detail-source').textContent = log.source || log.provider || '—';
    document.getElementById('detail-request-id').textContent = log.request_id || '—';
    document.getElementById('detail-correlation-id').textContent = log.correlation_id || '—';
    document.getElementById('detail-duration').textContent = log.duration_ms ? `${log.duration_ms}ms` : '—';
    document.getElementById('detail-environment').textContent = log.environment;
    document.getElementById('detail-error-code').textContent = log.error_code || '—';
    document.getElementById('detail-stack-trace').textContent = log.stack_trace || '—';
    document.getElementById('detail-payload').textContent = log.payload_snapshot ? JSON.stringify(log.payload_snapshot, null, 2) : '—';
    document.getElementById('detail-before').textContent = log.before_value ? JSON.stringify(log.before_value, null, 2) : '—';
    document.getElementById('detail-after').textContent = log.after_value ? JSON.stringify(log.after_value, null, 2) : '—';
    document.getElementById('detail-recommended-action').textContent = log.recommended_action || '—';
    document.getElementById('detail-resolution-status').textContent = log.resolution_status || '—';
    document.getElementById('detail-resolved-at').textContent = log.resolved_at ? new Date(log.resolved_at).toLocaleString() : '—';
    document.getElementById('detail-resolved-by').textContent = log.resolved_by || '—';
    
    drawer.classList.add('open');
  } catch (error) {
    console.error('[logs] Failed to load log details:', error);
    alert('Failed to load log details');
  }
}

async function acknowledgeLog(logId) {
  try {
    await fetchJSON(`${API}/api/market-intelligence/logs/${logId}/acknowledge`, { method: 'POST' });
    alert('Log acknowledged');
    loadLogs();
    loadLogsSummary();
  } catch (error) {
    console.error('[logs] Failed to acknowledge log:', error);
    alert('Failed to acknowledge log');
  }
}

async function resolveLog(logId) {
  try {
    await fetchJSON(`${API}/api/market-intelligence/logs/${logId}/resolve`, { method: 'POST' });
    alert('Log resolved');
    loadLogs();
    loadLogsSummary();
  } catch (error) {
    console.error('[logs] Failed to resolve log:', error);
    alert('Failed to resolve log');
  }
}

async function createIncident(logId, incidentData) {
  try {
    await fetchJSON(`${API}/api/market-intelligence/logs/${logId}/create-incident`, {
      method: 'POST',
      body: JSON.stringify(incidentData)
    });
    alert('Incident created');
    document.getElementById('incident-modal').classList.remove('open');
    loadLogs();
  } catch (error) {
    console.error('[logs] Failed to create incident:', error);
    alert('Failed to create incident');
  }
}

function applyFilters() {
  currentFilters = {
    dateFrom: document.getElementById('filter-date-from').value,
    dateTo: document.getElementById('filter-date-to').value,
    module: document.getElementById('filter-module').value,
    category: document.getElementById('filter-category').value,
    severity: document.getElementById('filter-severity').value,
    status: document.getElementById('filter-status').value,
    userId: document.getElementById('filter-user').value,
    source: document.getElementById('filter-source').value,
    provider: document.getElementById('filter-provider').value,
    entityType: document.getElementById('filter-entity-type').value,
    entityId: document.getElementById('filter-entity-id').value,
    action: document.getElementById('filter-action').value,
    correlationId: document.getElementById('filter-correlation-id').value,
    environment: document.getElementById('filter-environment').value
  };
  currentPage = 1;
  loadLogs();
}

function clearFilters() {
  document.getElementById('filter-date-from').value = '';
  document.getElementById('filter-date-to').value = '';
  document.getElementById('filter-module').value = '';
  document.getElementById('filter-category').value = '';
  document.getElementById('filter-severity').value = '';
  document.getElementById('filter-status').value = '';
  document.getElementById('filter-user').value = '';
  document.getElementById('filter-source').value = '';
  document.getElementById('filter-provider').value = '';
  document.getElementById('filter-entity-type').value = '';
  document.getElementById('filter-entity-id').value = '';
  document.getElementById('filter-action').value = '';
  document.getElementById('filter-correlation-id').value = '';
  document.getElementById('filter-environment').value = 'production';
  currentFilters = {};
  currentPage = 1;
  loadLogs();
}

function setupEventListeners() {
  // Refresh buttons
  document.getElementById('refresh-logs').addEventListener('click', () => {
    loadLogs();
    loadLogsSummary();
  });
  document.getElementById('export-logs').addEventListener('click', () => exportCurrentLogs('csv'));
  document.getElementById('refresh-errors').addEventListener('click', loadCriticalErrors);
  document.getElementById('refresh-audit').addEventListener('click', loadAuditLogs);
  document.getElementById('refresh-metrics').addEventListener('click', loadMetrics);

  // Filter buttons
  document.getElementById('apply-filters').addEventListener('click', applyFilters);
  document.getElementById('clear-filters').addEventListener('click', clearFilters);

  // Pagination
  document.getElementById('prev-page').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      loadLogs();
    }
  });
  document.getElementById('next-page').addEventListener('click', () => {
    currentPage++;
    loadLogs();
  });

  // Page size
  document.getElementById('page-size').addEventListener('change', (e) => {
    pageSize = parseInt(e.target.value);
    currentPage = 1;
    loadLogs();
  });

  // Search
  document.getElementById('search-logs').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    document.querySelectorAll('.log-row').forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
  });

  // Tabs
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
      activeTab = button.dataset.tab;
      document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      button.classList.add('active');
      document.getElementById(button.dataset.tab).classList.add('active');
      
      if (button.dataset.tab === 'critical-errors') loadCriticalErrors();
      if (button.dataset.tab === 'audit-trail') loadAuditLogs();
      if (button.dataset.tab === 'metrics') loadMetrics();
    });
  });

  // Log table actions
  document.getElementById('logs-table-body').addEventListener('click', (e) => {
    const button = e.target.closest('.action-button');
    if (!button) return;
    
    const row = button.closest('.log-row');
    const logId = row.dataset.logId;
    const action = button.dataset.action;

    if (action === 'view-details') viewLogDetails(logId);
    if (action === 'copy-correlation') {
      const correlationId = row.querySelector('.correlation-id').textContent;
      navigator.clipboard.writeText(correlationId);
      alert('Correlation ID copied');
    }
    if (action === 'acknowledge') acknowledgeLog(logId);
    if (action === 'resolve') resolveLog(logId);
    if (action === 'export-row') exportSingleLog(logId);
  });

  // Drawer actions
  document.querySelector('.close-drawer').addEventListener('click', () => {
    document.getElementById('log-detail-drawer').classList.remove('open');
  });

  document.getElementById('copy-log-id').addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('detail-log-id').textContent);
    alert('Log ID copied');
  });

  document.getElementById('copy-correlation-id').addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('detail-correlation-id').textContent);
    alert('Correlation ID copied');
  });

  document.getElementById('view-related-logs').addEventListener('click', () => {
    const correlationId = document.getElementById('detail-correlation-id').textContent;
    if (correlationId && correlationId !== '—') {
      document.getElementById('filter-correlation-id').value = correlationId;
      applyFilters();
      document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.querySelector('[data-tab="logs-table"]').classList.add('active');
      document.getElementById('logs-table').classList.add('active');
    }
  });

  document.getElementById('acknowledge-log').addEventListener('click', () => {
    if (selectedLogId) acknowledgeLog(selectedLogId);
  });

  document.getElementById('resolve-log').addEventListener('click', () => {
    if (selectedLogId) resolveLog(selectedLogId);
  });

  document.getElementById('create-incident').addEventListener('click', () => {
    document.getElementById('incident-modal').classList.add('open');
  });
  document.getElementById('export-log').addEventListener('click', () => {
    if (selectedLogId) exportSingleLog(selectedLogId);
  });

  // Incident modal
  document.querySelector('.close-modal').addEventListener('click', () => {
    document.getElementById('incident-modal').classList.remove('open');
  });

  document.getElementById('submit-incident').addEventListener('click', () => {
    const incidentData = {
      title: document.getElementById('incident-title').value,
      severity: document.getElementById('incident-severity').value,
      affectedModule: document.getElementById('incident-module').value,
      affectedSource: document.getElementById('incident-source').value,
      description: document.getElementById('incident-description').value,
      assignedTo: document.getElementById('incident-assigned-to').value,
      assignedToName: document.getElementById('incident-assigned-to').value,
      dueDate: document.getElementById('incident-due-date').value
    };
    if (selectedLogId) createIncident(selectedLogId, incidentData);
  });

  // Timeline
  document.getElementById('load-timeline').addEventListener('click', () => {
    const correlationId = document.getElementById('timeline-correlation-id').value;
    if (correlationId) loadTimeline(correlationId);
  });

  initEnterpriseSidebar('market-nav');
}

function initialize() {
  setupEventListeners();
  loadLogsSummary();
  loadLogs();
  loadLogCategories();
  setInterval(() => refreshActiveTab({ silent: true }), LIVE_REFRESH_MS);
}

initialize();
