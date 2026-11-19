// Cover Drive editor: wires the controls in index.html to the render engine in
// cover.js. Photos are loaded from the user's machine (FileReader) or from the
// built-in samples; nothing is ever uploaded anywhere.

import { SIZES, panelCount, panelRects, drawCover, renderExportCanvas } from './cover.js';

const preview = document.getElementById('preview');
const pctx = preview.getContext('2d');

// Default state: two free sample photos, triptych layout, Vice Sunset grade, so
// the editor opens with a finished-looking cover already on screen.
const state = {
  layout: 'triptych',
  size: '1080x1080',
  grade: 'sunset',
  title: 'SUNSET DRIVE',
  subtitle: 'One last ride down Ocean Drive',
  titleSize: 100,
  captionPos: 'bottom',
  captionStyle: 'sunset',
  panels: [
    { photo: 'boulevard', zoom: 1, panX: 0, panY: 0 },
    { photo: 'pier', zoom: 1, panX: 0, panY: 30 },
    { photo: 'boulevard', zoom: 1.25, panX: 0, panY: -10 },
  ],
};

const photos = {}; // key -> HTMLImageElement
const availablePhotos = [
  { key: 'boulevard', label: 'Boulevard (sample)' },
  { key: 'pier', label: 'Pier (sample)' },
];
let selectedPanel = 0;

const $ = (id) => document.getElementById(id);

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function loadSamples() {
  try {
    photos.boulevard = await loadImage('samples/boulevard.jpg');
    photos.pier = await loadImage('samples/pier.jpg');
    $('uploadStatus').textContent = 'Samples loaded: Boulevard + Pier. Upload your own to replace them.';
  } catch {
    $('uploadStatus').textContent = 'Sample photos could not load — upload your own photo to begin.';
  }
  render();
}

function render() {
  const size = SIZES[state.size];
  if (preview.width !== size.w || preview.height !== size.h) {
    preview.width = size.w;
    preview.height = size.h;
  }
  drawCover(pctx, size.w, size.h, state, photos);
}

// ---------- Panel editor ----------

function rebuildPanelTabs() {
  const tabs = $('panelTabs');
  tabs.innerHTML = '';
  const count = panelCount(state.layout);
  if (selectedPanel >= count) selectedPanel = 0;
  for (let i = 0; i < count; i++) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'panel-tab' + (i === selectedPanel ? ' is-active' : '');
    tab.textContent = `Panel ${i + 1}`;
    tab.setAttribute('role', 'tab');
    tab.addEventListener('click', () => {
      selectedPanel = i;
      rebuildPanelTabs();
      syncPanelEditor();
    });
    tabs.appendChild(tab);
  }
}

function rebuildPhotoOptions() {
  const select = $('panelPhoto');
  select.innerHTML = '';
  for (const p of availablePhotos) {
    const opt = document.createElement('option');
    opt.value = p.key;
    opt.textContent = p.label;
    select.appendChild(opt);
  }
  select.value = state.panels[selectedPanel].photo;
}

function syncPanelEditor() {
  const panel = state.panels[selectedPanel];
  rebuildPhotoOptions();
  $('panelZoom').value = Math.round(panel.zoom * 100);
  $('panelPanX').value = panel.panX;
  $('panelPanY').value = panel.panY;
  $('zoomValue').textContent = `${Math.round(panel.zoom * 100)}%`;
  $('panXValue').textContent = String(panel.panX);
  $('panYValue').textContent = String(panel.panY);
  $('titleSizeValue').textContent = `${state.titleSize}%`;
}

function markStepDone(step) {
  const li = document.querySelector(`.steps li[data-step="${step}"]`);
  if (li) li.classList.add('done');
}

// ---------- Controls ----------

function bindChoiceButtons(containerId, attr, onPick) {
  $(containerId).addEventListener('click', (event) => {
    const btn = event.target.closest(`[data-${attr}]`);
    if (!btn) return;
    $(containerId).querySelectorAll('.is-active').forEach((el) => el.classList.remove('is-active'));
    btn.classList.add('is-active');
    onPick(btn.dataset[attr]);
  });
}

bindChoiceButtons('layoutRow', 'layout', (layout) => {
  state.layout = layout;
  rebuildPanelTabs();
  syncPanelEditor();
  markStepDone(2);
  render();
});

bindChoiceButtons('gradeRow', 'grade', (grade) => {
  state.grade = grade;
  markStepDone(3);
  render();
});

// The size buttons live inside .size-group (see the handler below).
document.querySelector('.size-group').addEventListener('click', (event) => {
  const btn = event.target.closest('[data-size]');
  if (!btn) return;
  document.querySelectorAll('.size-btn').forEach((el) => el.classList.remove('is-active'));
  btn.classList.add('is-active');
  state.size = btn.dataset.size;
  render();
});

$('panelPhoto').addEventListener('change', (event) => {
  state.panels[selectedPanel].photo = event.target.value;
  markStepDone(1);
  render();
});

$('panelZoom').addEventListener('input', (event) => {
  state.panels[selectedPanel].zoom = Number(event.target.value) / 100;
  $('zoomValue').textContent = `${event.target.value}%`;
  render();
});

$('panelPanX').addEventListener('input', (event) => {
  state.panels[selectedPanel].panX = Number(event.target.value);
  $('panXValue').textContent = event.target.value;
  render();
});

$('panelPanY').addEventListener('input', (event) => {
  state.panels[selectedPanel].panY = Number(event.target.value);
  $('panYValue').textContent = event.target.value;
  render();
});

$('titleInput').addEventListener('input', (event) => {
  state.title = event.target.value;
  markStepDone(3);
  render();
});

$('subtitleInput').addEventListener('input', (event) => {
  state.subtitle = event.target.value;
  markStepDone(3);
  render();
});

$('titleSize').addEventListener('input', (event) => {
  state.titleSize = Number(event.target.value);
  $('titleSizeValue').textContent = `${event.target.value}%`;
  render();
});

$('captionPos').addEventListener('change', (event) => {
  state.captionPos = event.target.value;
  render();
});

$('captionStyle').addEventListener('change', (event) => {
  state.captionStyle = event.target.value;
  render();
});

// Clicking a sample loads it into the selected panel.
$('sampleRow').addEventListener('click', (event) => {
  const btn = event.target.closest('[data-sample]');
  if (!btn) return;
  state.panels[selectedPanel].photo = btn.dataset.sample;
  markStepDone(1);
  syncPanelEditor();
  render();
});

// ---------- Uploads: read on this machine, never sent anywhere ----------

function bindUpload(inputId, key, label) {
  $(inputId).addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      loadImage(reader.result).then((img) => {
        photos[key] = img;
        if (!availablePhotos.some((p) => p.key === key)) {
          availablePhotos.push({ key, label });
        }
        state.panels[selectedPanel].photo = key;
        $('uploadStatus').textContent = `${label} loaded from your machine — it stays here, never uploaded.`;
        markStepDone(1);
        syncPanelEditor();
        render();
      });
    };
    reader.readAsDataURL(file);
  });
}

bindUpload('upload1', 'upload1', 'Photo 1');
bindUpload('upload2', 'upload2', 'Photo 2');

// ---------- Drag to pan the selected panel's photo ----------

let dragging = null;

function canvasPoint(event) {
  const rect = preview.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (preview.width / rect.width),
    y: (event.clientY - rect.top) * (preview.height / rect.height),
  };
}

function panelAt(point) {
  const rects = panelRects(state.layout, preview.width, preview.height);
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (point.x >= r.x && point.x <= r.x + r.w && point.y >= r.y && point.y <= r.y + r.h) return i;
  }
  return -1;
}

preview.addEventListener('pointerdown', (event) => {
  const point = canvasPoint(event);
  const hit = panelAt(point);
  if (hit === -1) return;
  selectedPanel = hit;
  rebuildPanelTabs();
  syncPanelEditor();
  dragging = { x: point.x, y: point.y, panX: state.panels[hit].panX, panY: state.panels[hit].panY };
  preview.setPointerCapture(event.pointerId);
});

preview.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  const point = canvasPoint(event);
  const rects = panelRects(state.layout, preview.width, preview.height);
  const rect = rects[selectedPanel];
  const panel = state.panels[selectedPanel];
  panel.panX = Math.max(-100, Math.min(100, Math.round(dragging.panX + ((point.x - dragging.x) / rect.w) * 250)));
  panel.panY = Math.max(-100, Math.min(100, Math.round(dragging.panY + ((point.y - dragging.y) / rect.h) * 250)));
  syncPanelEditor();
  render();
});

preview.addEventListener('pointerup', () => { dragging = null; });
preview.addEventListener('pointercancel', () => { dragging = null; });

// ---------- Export ----------

function downloadCanvas(canvas, filename) {
  canvas.toBlob((blob) => {
    if (!blob) {
      $('exportStatus').textContent = 'Export failed in this browser — try again.';
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    $('exportStatus').textContent = `Exported ${filename} — ${SIZES[state.size].label} PNG, ready to post.`;
    markStepDone(4);
  }, 'image/png');
}

$('exportBtn').addEventListener('click', () => {
  const size = SIZES[state.size];
  const canvas = renderExportCanvas(state, photos);
  downloadCanvas(canvas, `cover-drive-${size.w}x${size.h}.png`);
});

// Hook for the maker's own screenshot runs: returns the exact exported PNG as a
// data URL (same canvas the Export button downloads). Not part of the UI.
window.__coverDrive = {
  state,
  photos,
  exportDataURL(sizeId) {
    const saved = state.size;
    if (sizeId && SIZES[sizeId]) state.size = sizeId;
    const url = renderExportCanvas(state, photos).toDataURL('image/png');
    state.size = saved;
    return url;
  },
  setState(patch) {
    Object.assign(state, patch);
    // Keep the buttons and inputs in step with the state (the layout, grade
    // and size buttons otherwise keep showing the previous choice).
    document.querySelectorAll('[data-layout]').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.layout === state.layout);
    });
    document.querySelectorAll('[data-grade]').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.grade === state.grade);
    });
    document.querySelectorAll('[data-size]').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.size === state.size);
    });
    $('titleInput').value = state.title;
    $('subtitleInput').value = state.subtitle;
    $('titleSize').value = state.titleSize;
    $('captionPos').value = state.captionPos;
    $('captionStyle').value = state.captionStyle;
    rebuildPanelTabs();
    syncPanelEditor();
    render();
  },
  render,
};

// Re-render once the display font arrives so the caption lettering is exact.
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(render);
}
rebuildPanelTabs();
syncPanelEditor();
loadSamples();
