const $ = (selector) => document.querySelector(selector);
const state = { status: null, objects: [], busy: false, uploading: false, refreshing: false, catalogRevision: 0, filter: 'all', view: 'overview' };
const icons = {
  storvex: '<path d="M12 3 21 7.5v9L12 21l-9-4.5v-9L12 3Z"/><path d="m3 7.5 9 5 9-5M12 12.5V21"/><path d="m7.5 5.25 9 5"/>',
  overview: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  server: '<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01M16 6.5h2M16 17.5h2"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5"/>',
  shield: '<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 16h.01"/>',
  external: '<path d="M14 3h7v7M21 3l-9 9M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  refresh: '<path d="M20 8a8.5 8.5 0 0 0-15-2L3 9m0-6v6h6M4 16a8.5 8.5 0 0 0 15 2l2-3m0 6v-6h-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  sparkles: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 2v4M18 4h4"/>',
  snowflake: '<path d="M12 2v20M3.34 7l17.32 10M3.34 17 20.66 7M9 4l3 3 3-3M9 20l3-3 3 3M3 10l4-1-1-4M21 14l-4 1 1 4M6 19l1-4-4-1M18 5l-1 4 4 1"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  tools: '<path d="M14.5 6.5a5 5 0 0 0-6.4-3L11 6.4 6.4 11 3.5 8.1a5 5 0 0 0 6.4 6.4L17 21l4-4-6.5-7.1a5 5 0 0 0 0-3.4Z"/>',
  cloud: '<path d="M6 19a5 5 0 0 1-1-10 7 7 0 0 1 13-2 6 6 0 0 1 0 12Z"/>',
};
const icon = (name) => '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (icons[name] || icons.file) + '</svg>';
function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]:not([data-icon-ready])').forEach((element) => {
    element.innerHTML = icon(element.dataset.icon);
    element.dataset.iconReady = 'true';
  });
}
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[char]));
const formatBytes = (bytes = 0) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return (bytes / 1024 ** index).toFixed(index ? 1 : 0) + ' ' + units[index];
};
const relativeTime = (iso) => {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 10) return 'Just now';
  if (seconds < 60) return seconds + 's ago';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(iso));
};
async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options, signal: options.signal || AbortSignal.timeout(60000),
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = typeof body.error === 'string' ? body.error : body.error?.message;
    throw new Error(message || 'Request failed (' + response.status + ')');
  }
  return response.json();
}
function toast(title, detail = '', error = false) {
  const element = document.createElement('div');
  element.className = 'toast' + (error ? ' error' : '');
  element.innerHTML = '<span aria-hidden="true">' + (error ? '!' : '✓') + '</span><div><strong>' + escapeHtml(title) + '</strong><small>' + escapeHtml(detail) + '</small></div>';
  $('#toast-region').append(element);
  setTimeout(() => element.remove(), 6500);
}
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',', 2)[1]);
    reader.onerror = () => reject(new Error('Unable to read the selected file'));
    reader.readAsDataURL(file);
  });
}
function normalizePolicyControls() {
  const replication = $('[name="replicationFactor"]');
  const read = $('[name="readQuorum"]');
  const write = $('[name="writeQuorum"]');
  const replicas = Number(replication.value);
  const minimum = Math.floor(replicas / 2) + 1;
  if (Number(read.value) < minimum) read.value = String(minimum);
  if (Number(write.value) < minimum) write.value = String(minimum);
  for (const option of [...read.options, ...write.options]) option.hidden = Number(option.value) > replicas;
}
const views = {
  overview: ['Overview', 'YOUR STORAGE, AT A GLANCE', 'Everything you store. Everything you need to know.'],
  objects: ['Objects', 'YOUR OBJECT CATALOG', 'Upload, find, and retrieve the data you work with.'],
  nodes: ['Infrastructure', 'INSIDE YOUR WORKSPACE', 'See your storage nodes and manage cluster health.'],
  activity: ['Activity', 'YOUR WORKSPACE HISTORY', 'Follow writes, reads, integrity checks, and recovery.'],
  plans: ['Storage plans', 'A POLICY FOR EVERY PROJECT', 'The right balance of access, replication, and overhead.'],
};
function setMenu(open) {
  const wasOpen = $('#sidebar').classList.contains('open');
  $('#sidebar').classList.toggle('open', open);
  $('#sidebar-overlay').hidden = !open;
  $('#main').inert = open;
  $('#menu-button').setAttribute('aria-expanded', String(open));
  $('#menu-button').setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  if (open) $('#sidebar .nav-link').focus();
  else if (wasOpen && matchMedia('(max-width:760px)').matches) $('#menu-button').focus();
}
function setView(view, { focus = false } = {}) {
  state.view = views[view] ? view : 'overview';
  const [title, eyebrow, description] = views[state.view];
  document.title = title + ' · Storvex';
  $('#page-title').innerHTML = escapeHtml(title) + '<span class="heading-dot">.</span>';
  $('#page-eyebrow').textContent = eyebrow;
  $('#page-description').textContent = description;
  $('#breadcrumb-current').textContent = title;
  $('[data-views="overview objects"]').classList.toggle('full-catalog', state.view === 'objects');
  $('#view-all-link').hidden = state.view === 'objects';
  document.querySelectorAll('[data-views]').forEach((section) => {
    section.hidden = !section.dataset.views.split(' ').includes(state.view);
  });
  document.querySelectorAll('.nav-link').forEach((link) => {
    const active = link.hash === '#' + state.view;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  setMenu(false);
  renderObjects();
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (focus) {
    $('#page-title').setAttribute('tabindex', '-1');
    $('#page-title').focus({ preventScroll: true });
  }
}
function openUpload(storageClass = 'hot') {
  if (state.uploading) return;
  $('[name="storageClass"]').value = storageClass;
  $('#advanced-policy').hidden = storageClass === 'cold';
  $('#upload-status').textContent = '';
  $('#upload-dialog').showModal();
}
let refreshInFlight = null;
async function refresh({ quiet = true, afterMutation = false } = {}) {
  if (afterMutation) {
    // Ignore an older catalog response that arrives after a successful mutation.
    state.catalogRevision++;
    if (refreshInFlight) await refreshInFlight;
  } else if (refreshInFlight) return refreshInFlight;
  refreshInFlight = loadWorkspace({ quiet });
  try { await refreshInFlight; }
  finally { refreshInFlight = null; }
}
async function loadWorkspace({ quiet }) {
  const revision = state.catalogRevision;
  state.refreshing = true;
  $('#refresh-button').disabled = true;
  try {
    const [status, objects] = await Promise.all([request('/api/status'), request('/api/objects')]);
    if (revision !== state.catalogRevision) return;
    state.status = status;
    state.objects = objects.objects;
    $('#connection-alert').hidden = true;
    $('#connection-pill').classList.remove('offline');
    render();
    $('#last-sync').textContent = 'Updated ' + new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date());
  } catch (error) {
    $('#connection-alert').hidden = false;
    $('#connection-pill').classList.add('offline');
    $('#cluster-health').textContent = 'Disconnected';
    $('#last-sync').textContent = 'Connection unavailable';
    if (!quiet) toast('Unable to reach Storvex', error.message, true);
  } finally {
    state.refreshing = false;
    $('#refresh-button').disabled = false;
  }
}
function render() {
  const status = state.status;
  if (!status) return;
  const online = status.nodes.filter((node) => node.status === 'healthy').length;
  $('#cluster-health').textContent = online === status.nodes.length ? 'All nodes online' : 'Cluster degraded';
  $('#object-count').textContent = status.objectCount.toLocaleString();
  $('#nav-object-count').textContent = status.objectCount;
  $('#logical-bytes').textContent = formatBytes(status.logicalBytes);
  $('#storage-overhead').textContent = formatBytes(status.physicalBytes) + ' physical storage';
  $('#availability').textContent = online + ' / ' + status.nodes.length;
  $('#recovery-time').textContent = status.metrics.lastRepairMs ? status.metrics.lastRepairMs + ' ms' : '—';
  $('#repair-count').textContent = status.metrics.repairs;
  $('#failure-count').textContent = status.metrics.failures + ' failed operations';
  $('#object-health-summary').textContent = status.degradedObjects ? status.degradedObjects + ' need attention' : status.objectCount ? 'All replicas available' : 'Ready for your first file';
  $('#object-health-summary').classList.toggle('warning', status.degradedObjects > 0);
  $('#node-health-summary').textContent = online === status.nodes.length ? 'All online' : (status.nodes.length - online) + ' need attention';
  $('#node-health-summary').classList.toggle('warning', online !== status.nodes.length);
  $('#policy-rf').textContent = status.policy.replicationFactor;
  $('#policy-rq').textContent = status.policy.readQuorum;
  $('#policy-wq').textContent = status.policy.writeQuorum;
  const processes = status.storage?.processCount || status.nodes.length;
  $('#storage-runtime').textContent = status.storage?.mode === 'http' ? processes + ' independent storage processes · 3 placement zones' : status.nodes.length + ' simulated local nodes · 3 placement zones';
  $('#metadata-summary').textContent = status.metadataControlPlane.healthyNodes + ' metadata voters online · revision ' + status.revision;
  $('#gcs-status').textContent = status.googleCloud?.enabled ? 'Optional GCS mirror: ' + status.googleCloud.bucket : 'Optional cloud mirror is not configured.';
  renderNodes(status.nodes);
  renderObjects();
  renderEvents(status.events);
}
const renderedMarkup = new WeakMap();
function setMarkup(element, markup) {
  if (renderedMarkup.get(element) === markup) return;
  const focused = document.activeElement;
  const focusAttribute = ['data-preview-key', 'data-download-key', 'data-delete-key']
    .find((attribute) => element.contains(focused) && focused.hasAttribute(attribute));
  const focusedKey = focusAttribute ? focused.getAttribute(focusAttribute) : null;
  element.innerHTML = markup;
  renderedMarkup.set(element, markup);
  if (focusedKey !== null) {
    [...element.querySelectorAll('[' + focusAttribute + ']')]
      .find((control) => control.getAttribute(focusAttribute) === focusedKey)?.focus({ preventScroll: true });
  }
}
function renderNodes(nodes) {
  const markup = ['zone-1', 'zone-2', 'zone-3'].map((zone, index) => {
    const members = nodes.filter((node) => node.zone === zone);
    const healthy = members.filter((node) => node.status === 'healthy').length;
    return '<div class="zone-column"><div class="zone-heading"><strong>Zone ' + String.fromCharCode(65 + index) + '</strong><span>' + healthy + ' / ' + members.length + ' online</span></div><div class="zone-nodes">' + members.map((node) =>
      '<span class="node-card ' + escapeHtml(node.status) + '" title="' + escapeHtml(node.id + ': ' + node.status + ', ' + formatBytes(node.usedBytes) + ', ' + node.replicas + ' objects') + '">' + icon('server') + escapeHtml(node.id.replace('node-', 'N')) + '<span class="sr-only"> ' + escapeHtml(node.status) + '</span></span>'
    ).join('') + '</div></div>';
  }).join('');
  setMarkup($('#node-grid'), markup);
}
function renderObjects() {
  const query = $('#object-search').value.toLowerCase().trim();
  const objects = state.objects.filter((object) => object.key.toLowerCase().includes(query) && (state.filter === 'all' || object.storageClass === state.filter));
  const visible = state.view === 'overview' ? objects.slice(0, 5) : objects;
  const markup = visible.map((object) => {
    const key = object.key;
    const parts = key.split('/');
    const filename = parts.pop();
    const parent = parts.length ? parts.join('/') + '/' : 'Workspace';
    const extension = filename.split('.').pop().toLowerCase();
    const type = ['mp4', 'png', 'jpg', 'jpeg', 'webp', 'svg', 'mov'].includes(extension) ? 'media' : ['json', 'jsonl', 'js', 'csv', 'txt', 'yaml'].includes(extension) ? 'code' : ['snap', 'zip', 'gz', 'tar', 'bin'].includes(extension) ? 'archive' : '';
    const cold = object.storageClass === 'cold';
    const artifactCount = object.replicas.length + (cold ? ' fragments' : ' copies');
    return '<tr><td><span class="object-name"><span class="object-file-icon ' + type + '">' + icon('file') + '</span><span><strong title="' + escapeHtml(key) + '">' + escapeHtml(filename) + '</strong><small>' + escapeHtml(parent) + ' · v' + object.version + '</small></span></span></td><td><span class="storage-tag' + (cold ? ' cold' : '') + '" title="' + artifactCount + '">' + (cold ? 'Cold' : 'Hot') + '</span></td><td>' + formatBytes(object.size) + '</td><td><span class="health-tag ' + escapeHtml(object.health) + '"><i></i>' + escapeHtml(object.health) + '</span></td><td><time datetime="' + escapeHtml(object.updatedAt) + '">' + relativeTime(object.updatedAt) + '</time></td><td><div class="object-actions"><button type="button" class="object-action" data-preview-key="' + escapeHtml(key) + '" aria-label="Preview ' + escapeHtml(key) + '" title="Preview">' + icon('eye') + '</button><a class="object-action download-link" data-download-key="' + escapeHtml(key) + '" href="/api/objects/' + encodeURIComponent(key) + '" aria-label="Download ' + escapeHtml(key) + '" title="Download ' + escapeHtml(key) + '">' + icon('download') + '</a><button type="button" class="object-action delete-action" data-delete-key="' + escapeHtml(key) + '" aria-label="Delete ' + escapeHtml(key) + '" title="Delete"' + (state.busy ? ' disabled' : '') + '>' + icon('trash') + '</button></div></td></tr>';
  }).join('');
  setMarkup($('#object-table'), markup);
  $('#catalog-count').textContent = state.objects.length;
  $('#catalog-summary').textContent = 'Showing ' + visible.length + ' of ' + objects.length + (state.filter === 'all' ? ' objects' : ' ' + state.filter + ' objects');
  $('#empty-state').classList.toggle('hidden', objects.length > 0);
  const noMatches = state.objects.length > 0;
  $('#empty-title').textContent = noMatches ? 'No objects match this view.' : 'Your next project starts here.';
  $('#empty-description').textContent = noMatches ? 'Try a different name or storage filter.' : 'Upload your first object to see it in your workspace.';
  $('#empty-state [data-upload]').hidden = noMatches;
}
function renderEvents(events) {
  const symbols = { write: 'plus', read: 'download', failure: 'info', corruption: 'info', repair: 'shield', scan: 'shield', rebalance: 'layers', recovery: 'refresh', cluster: 'storvex', delete: 'file' };
  const limit = state.view === 'activity' ? 20 : 4;
  const markup = events.slice(0, limit).map((event) => '<div class="event ' + escapeHtml(event.type) + '"><span class="event-icon">' + icon(symbols[event.type]) + '</span><div><strong>' + escapeHtml(event.title) + '</strong><small>' + escapeHtml(event.detail) + '</small></div><time datetime="' + escapeHtml(event.at) + '">' + relativeTime(event.at) + '</time></div>').join('') || '<div class="empty-state"><p>Workspace operations will appear here.</p></div>';
  setMarkup($('#event-list'), markup);
}
async function withBusy(action) {
  if (state.busy) return;
  state.busy = true;
  $('#main').setAttribute('aria-busy', 'true');
  const buttons = document.querySelectorAll('.maintenance-actions button, #store-submit, [data-delete-key]');
  buttons.forEach((button) => { button.disabled = true; });
  try { await action(); }
  catch (error) {
    toast('Operation failed', error.message, true);
    if (state.uploading) $('#upload-status').textContent = error.message;
  } finally {
    state.busy = false;
    state.uploading = false;
    $('#main').removeAttribute('aria-busy');
    document.querySelectorAll('.maintenance-actions button, #store-submit, [data-delete-key]')
      .forEach((button) => { button.disabled = false; });
  }
}
function confirmAction(title, detail, acceptLabel = 'Continue') {
  const dialog = $('#confirm-dialog');
  $('#confirm-title').textContent = title;
  $('#confirm-description').textContent = detail;
  $('#confirm-accept').textContent = acceptLabel;
  dialog.returnValue = '';
  return new Promise((resolve) => {
    $('#confirm-accept').onclick = () => dialog.close('confirm');
    $('#confirm-cancel').onclick = () => dialog.close('cancel');
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true });
    dialog.showModal();
    $('#confirm-cancel').focus();
  });
}

const previewLimits = { text: 2 * 1024 * 1024, image: 10 * 1024 * 1024 };
const rasterTypes = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif']);
const textExtensions = new Set(['txt', 'md', 'csv', 'json', 'jsonl', 'yaml', 'yml', 'log', 'js', 'ts', 'css', 'html', 'xml', 'svg']);
let previewController = null;
function previewType(object) {
  const mime = (object.contentType || '').split(';')[0].trim().toLowerCase();
  const extension = object.key.split('.').pop().toLowerCase();
  if (rasterTypes.has(mime)) return { kind: 'image', mime };
  const imageMime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif' }[extension];
  if ((!mime || mime === 'application/octet-stream') && imageMime) return { kind: 'image', mime: imageMime };
  if (mime.startsWith('text/') || ['application/json', 'application/xml', 'image/svg+xml'].includes(mime) ||
      ((!mime || mime === 'application/octet-stream') && textExtensions.has(extension))) return { kind: 'text' };
  return null;
}
async function readPreviewBytes(response, limit) {
  // Bound actual received bytes too: a newer object version may be larger.
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error('This file is too large to preview. Download it instead.');
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}
async function openPreview(key) {
  const object = state.objects.find((item) => item.key === key);
  if (!object) return;
  previewController?.abort();
  const controller = new AbortController();
  previewController = controller;
  const dialog = $('#preview-dialog');
  const body = $('#preview-body');
  $('#preview-title').textContent = key.split('/').pop();
  $('#preview-key').textContent = key;
  $('#preview-size').textContent = formatBytes(object.size);
  $('#preview-version').textContent = 'v' + object.version;
  $('#preview-storage').textContent = object.storageClass === 'cold' ? 'Cold storage' : 'Hot storage';
  $('#preview-download').href = '/api/objects/' + encodeURIComponent(key);
  $('#preview-download').setAttribute('aria-label', 'Download ' + key);
  body.replaceChildren();
  $('#preview-status').textContent = '';
  if (!dialog.open) dialog.showModal();
  const type = previewType(object);
  if (!type || object.size > previewLimits[type.kind]) {
    $('#preview-status').textContent = !type
      ? 'Preview is not available for this file type. Download the original to open it.'
      : 'This file exceeds the preview limit (' + formatBytes(previewLimits[type.kind]) + '). Download the original to open it.';
    return;
  }
  $('#preview-status').textContent = 'Reading and verifying your object…';
  body.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch('/api/objects/' + encodeURIComponent(key), {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60000)]),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(typeof error.error === 'string' ? error.error : error.error?.message || 'Unable to read this object.');
    }
    const bytes = await readPreviewBytes(response, previewLimits[type.kind]);
    let content;
    if (type.kind === 'image') {
      content = document.createElement('img');
      content.alt = 'Preview of ' + key;
      // Only allow raster MIME types. SVG and HTML are always literal text.
      content.src = 'data:' + type.mime + ';base64,' + await fileToBase64(new Blob([bytes]));
      await content.decode();
    } else {
      content = document.createElement('pre');
      content.tabIndex = 0;
      content.setAttribute('aria-label', 'File contents');
      content.textContent = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    }
    if (controller !== previewController || controller.signal.aborted) return;
    body.replaceChildren(content);
    $('#preview-version').textContent = 'v' + (response.headers.get('X-Storvex-Version') || object.version);
    $('#preview-size').textContent = formatBytes(bytes.byteLength);
    $('#preview-status').textContent = 'Object read successfully. Integrity verified by Storvex.';
  } catch (error) {
    if (controller !== previewController || controller.signal.aborted) return;
    $('#preview-status').textContent = 'Unable to preview: ' + error.message + ' You can try downloading the original.';
  } finally {
    if (controller === previewController) body.removeAttribute('aria-busy');
  }
}
$('#preview-dialog').addEventListener('close', () => {
  previewController?.abort();
  previewController = null;
  $('#preview-body').replaceChildren();
  $('#preview-body').removeAttribute('aria-busy');
});
async function deleteObject(key) {
  if (state.busy) return;
  let deleted = false;
  await withBusy(async () => {
    if (!await confirmAction('Delete this object?', 'Delete “' + key + '”? It will disappear from the catalog and can no longer be read. Stored bytes are retained for 24 hours before garbage collection. There is no restore button.', 'Delete object')) return;
    await request('/api/objects/' + encodeURIComponent(key), { method: 'DELETE' });
    deleted = true;
    state.objects = state.objects.filter((object) => object.key !== key);
    renderObjects();
    $('#object-search').focus({ preventScroll: true });
    toast('Object deleted', key + ' has been removed from your catalog.');
    await refresh({ afterMutation: true });
  });
  if (!deleted) {
    [...document.querySelectorAll('[data-delete-key]')]
      .find((button) => button.dataset.deleteKey === key)?.focus({ preventScroll: true });
  }
}

function requireStatus() {
  if (!state.status) throw new Error('Wait for the workspace to connect first.');
  return state.status;
}
async function setNode(nodeId, status) {
  await request('/api/nodes/' + encodeURIComponent(nodeId), { method: 'PATCH', body: JSON.stringify({ status }) });
  toast(status === 'healthy' ? 'Node recovered' : 'Node ' + status, nodeId + ' membership updated');
  await refresh();
}
document.addEventListener('click', (event) => {
  const route = event.target.closest('a[href^="#"]');
  if (route && views[route.hash.slice(1)]) {
    event.preventDefault();
    history.pushState(null, '', route.hash);
    setView(route.hash.slice(1), { focus: true });
    if (state.status) renderEvents(state.status.events);
  }
  const preview = event.target.closest('[data-preview-key]');
  if (preview) void openPreview(preview.dataset.previewKey);
  const deletion = event.target.closest('[data-delete-key]');
  if (deletion) void deleteObject(deletion.dataset.deleteKey);
  const upload = event.target.closest('[data-upload]');
  if (upload) openUpload(upload.dataset.upload);
  const close = event.target.closest('[data-close]');
  if (close && !state.uploading) $('#' + close.dataset.close).close();
});
window.addEventListener('popstate', () => { setView(location.hash.slice(1)); if (state.status) renderEvents(state.status.events); });
window.addEventListener('hashchange', () => { if (views[location.hash.slice(1)]) { setView(location.hash.slice(1)); if (state.status) renderEvents(state.status.events); } });
$('#menu-button').addEventListener('click', () => setMenu(!$('#sidebar').classList.contains('open')));
$('#sidebar-overlay').addEventListener('click', () => setMenu(false));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setMenu(false);
  if (event.key === 'Tab' && $('#sidebar').classList.contains('open')) {
    const links = [...$('#sidebar').querySelectorAll('a, button')].filter((element) => element.getClientRects().length);
    const first = links[0];
    const last = links.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
matchMedia('(max-width:760px)').addEventListener('change', () => setMenu(false));
$('#help-button').addEventListener('click', () => $('#about-dialog').showModal());
$('#upload-button').addEventListener('click', () => openUpload());
$('#upload-dialog').addEventListener('cancel', (event) => { if (state.uploading) event.preventDefault(); });
$('#file-input').addEventListener('change', () => {
  const file = $('#file-input').files[0];
  $('#file-label').textContent = file ? file.name + ' · ' + formatBytes(file.size) : 'Any file type · up to 20 MB';
  if (file && !$('#object-key').value) $('#object-key').value = file.name;
});
for (const selector of ['[name="replicationFactor"]', '[name="readQuorum"]', '[name="writeQuorum"]']) {
  $(selector).addEventListener('change', normalizePolicyControls);
}
$('[name="storageClass"]').addEventListener('change', (event) => { $('#advanced-policy').hidden = event.target.value === 'cold'; });
const dropZone = $('#drop-zone');
for (const name of ['dragenter', 'dragover']) dropZone.addEventListener(name, (event) => { event.preventDefault(); dropZone.classList.add('dragging'); });
for (const name of ['dragleave', 'drop']) dropZone.addEventListener(name, (event) => { event.preventDefault(); dropZone.classList.remove('dragging'); });
dropZone.addEventListener('drop', (event) => {
  const transfer = new DataTransfer();
  if (event.dataTransfer.files[0]) transfer.items.add(event.dataTransfer.files[0]);
  $('#file-input').files = transfer.files;
  $('#file-input').dispatchEvent(new Event('change'));
});
$('#upload-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const formElement = event.currentTarget;
  withBusy(async () => {
    state.uploading = true;
    normalizePolicyControls();
    const form = new FormData(formElement);
    const file = form.get('file');
    if (!(file instanceof File) || !file.size) throw new Error('Choose a non-empty file to upload.');
    // Base64 adds about one third to the request, whose server limit is 30 MB.
    if (file.size > 20 * 1024 * 1024) throw new Error('Upload files of 20 MB or smaller through this dashboard.');
    const replicationFactor = Number(form.get('replicationFactor'));
    const readQuorum = Number(form.get('readQuorum'));
    const writeQuorum = Number(form.get('writeQuorum'));
    if (readQuorum + writeQuorum <= replicationFactor) throw new Error('Read + write quorum must be greater than replicas.');
    $('#upload-status').textContent = 'Preparing your file…';
    const data = await fileToBase64(file);
    $('#upload-status').textContent = 'Uploading and committing the object…';
    const result = await request('/api/objects', { method: 'POST', body: JSON.stringify({
      key: form.get('key').trim(), data, contentType: file.type || 'application/octet-stream', storageClass: form.get('storageClass'),
      policy: { replicationFactor, readQuorum, writeQuorum },
    }) });
    $('#upload-dialog').close();
    formElement.reset();
    $('#file-label').textContent = 'Any file type · up to 20 MB';
    $('#upload-status').textContent = '';
    toast('Object uploaded', result.object.key + ' · ' + result.object.durability);
    await refresh({ afterMutation: true });
  });
});
$('#scan-button').addEventListener('click', () => withBusy(async () => {
  const { report } = await request('/api/integrity-scan', { method: 'POST' });
  toast('Integrity scan complete', report.checked + ' checked · ' + report.repaired + ' repaired · ' + report.durationMs + ' ms');
  await refresh();
}));
$('#heal-button').addEventListener('click', () => withBusy(async () => {
  const unhealthy = requireStatus().nodes.filter((node) => node.status !== 'healthy');
  await Promise.all(unhealthy.map((node) => request('/api/nodes/' + encodeURIComponent(node.id), { method: 'PATCH', body: JSON.stringify({ status: 'healthy' }) })));
  await request('/api/integrity-scan', { method: 'POST' });
  toast('Recovery complete', unhealthy.length + ' nodes restored; integrity scan finished.');
  await refresh();
}));
$('#rebalance-button').addEventListener('click', () => withBusy(async () => {
  if (!await confirmAction('Rebalance object placement?', 'Storvex will move and verify replicas to distribute data across healthy nodes.')) return;
  const { report } = await request('/api/rebalance', { method: 'POST' });
  toast('Rebalance complete', report.moved + ' of ' + report.limit + ' permitted moves completed.');
  await refresh();
}));
$('#fail-node-button').addEventListener('click', () => withBusy(async () => {
  const status = requireStatus();
  const node = status.nodes.find((item) => item.status === 'healthy' && item.replicas > 0) || status.nodes.find((item) => item.status === 'healthy');
  if (!node) throw new Error('No healthy node is available.');
  if (!await confirmAction('Stop ' + node.id + '?', 'This stops a live storage node and may reduce object availability. Continue only for controlled fault testing.')) return;
  if (status.storage?.mode === 'http') {
    await request('/api/faults/crash-node', { method: 'POST', body: JSON.stringify({ nodeId: node.id }) });
    toast('Storage process stopped', node.id + ' is unavailable. Check object availability and recover the node when ready.');
    await refresh();
  } else await setNode(node.id, 'offline');
}));
$('#partition-button').addEventListener('click', () => withBusy(async () => {
  const node = [...requireStatus().nodes].reverse().find((item) => item.status === 'healthy');
  if (!node) throw new Error('No healthy node is available.');
  if (!await confirmAction('Partition ' + node.id + '?', 'This excludes the node from reads and writes for a controlled network fault test.')) return;
  await setNode(node.id, 'partitioned');
}));
$('#corrupt-button').addEventListener('click', () => withBusy(async () => {
  const status = requireStatus();
  const object = state.objects.find((item) => item.replicas.some((id) => status.nodes.find((node) => node.id === id)?.status === 'healthy'));
  if (!object) throw new Error('Upload a test object before testing corruption.');
  const nodeId = object.replicas.find((id) => status.nodes.find((node) => node.id === id)?.status === 'healthy');
  if (!await confirmAction('Corrupt a live replica?', 'This changes a replica of ' + object.key + ' on ' + nodeId + '. Use only disposable test data, then verify integrity.')) return;
  await request('/api/faults/corrupt', { method: 'POST', body: JSON.stringify({ key: object.key, nodeId }) });
  toast('Test corruption applied', object.key + ' · Run an integrity scan to repair the replica.');
  await refresh();
}));
$('#object-search').addEventListener('input', renderObjects);
document.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => {
  state.filter = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach((item) => {
    const active = item === button;
    item.classList.toggle('active', active);
    item.setAttribute('aria-pressed', String(active));
  });
  renderObjects();
}));
$('#refresh-button').addEventListener('click', () => refresh({ quiet: false }));
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
setInterval(() => { if (!document.hidden) refresh(); }, 10000);
hydrateIcons();
normalizePolicyControls();
setView(location.hash.slice(1));
refresh({ quiet: false });
