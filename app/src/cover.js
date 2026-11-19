// Cover Drive render engine: turns the editor state into GTA-style poster art on
// any canvas. Layouts are multi-panel (triptych / split / hero + strip), each panel
// holds one photo the user can crop by zoom and pan, then a colour grade is painted
// over the panels and a bold caption is lettered on top. Original art only: the
// lettering uses Anton, an OFL font shipped under app/fonts/.

import { gradeById, paintGrade } from './grades.js';

export const SIZES = {
  '1080x1080': { w: 1080, h: 1080, label: '1080 × 1080' },
  '1080x1350': { w: 1080, h: 1350, label: '1080 × 1350' },
  '1920x1080': { w: 1920, h: 1080, label: '1920 × 1080' },
};

export const LAYOUTS = {
  // Three panels: one tall on the left, two stacked on the right.
  triptych: {
    name: 'Triptych',
    rects: [
      { x: 0, y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  // Two panels side by side.
  split: {
    name: 'Split',
    rects: [
      { x: 0, y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 1 },
    ],
  },
  // One full-bleed hero photo with a second photo as a strip along the bottom.
  hero: {
    name: 'Hero + strip',
    rects: [
      { x: 0, y: 0, w: 1, h: 0.74 },
      { x: 0, y: 0.74, w: 1, h: 0.26 },
    ],
  },
};

export function layoutById(id) {
  return LAYOUTS[id] || LAYOUTS.triptych;
}

export function panelCount(layoutId) {
  return layoutById(layoutId).rects.length;
}

// Panel rects in canvas pixels, with a thin gutter between panels.
export function panelRects(layoutId, w, h) {
  const gutter = Math.max(4, Math.round(w * 0.006));
  return layoutById(layoutId).rects.map((r) => ({
    x: Math.round(r.x * w) + (r.x > 0 ? gutter / 2 : 0),
    y: Math.round(r.y * h) + (r.y > 0 ? gutter / 2 : 0),
    w: Math.round(r.w * w) - (r.x > 0 ? gutter / 2 : 0) - (r.x + r.w < 1 ? gutter / 2 : 0),
    h: Math.round(r.h * h) - (r.y > 0 ? gutter / 2 : 0) - (r.y + r.h < 1 ? gutter / 2 : 0),
  }));
}

// Draw one photo into a panel, cover-fit, then zoomed and panned by the user.
// panel: { photo, zoom (1..2.6), panX (-100..100), panY (-100..100) }.
export function drawPhotoPanel(ctx, img, rect, panel, grade) {
  if (!img) return;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const base = Math.max(rect.w / iw, rect.h / ih);
  const scale = base * (panel.zoom || 1);
  const dw = iw * scale;
  const dh = ih * scale;
  // Pan is clamped so the photo can never slide far enough to expose the
  // panel's background: the most it may move is the overflow on each axis.
  const maxOx = Math.max(0, (dw - rect.w) / 2);
  const maxOy = Math.max(0, (dh - rect.h) / 2);
  const ox = Math.max(-maxOx, Math.min(maxOx, ((panel.panX || 0) / 100) * rect.w * 0.4));
  const oy = Math.max(-maxOy, Math.min(maxOy, ((panel.panY || 0) / 100) * rect.h * 0.4));
  const dx = rect.x + (rect.w - dw) / 2 + ox;
  const dy = rect.y + (rect.h - dh) / 2 + oy;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.filter = `saturate(${grade.saturate}) contrast(${grade.contrast}) brightness(${grade.brightness})`;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

// Diagonal accent stripes across the top corner, in the poster's palette.
function drawAccentStripes(ctx, w, h, gradeId) {
  const colors = gradeId === 'neon'
    ? ['rgba(34, 211, 238, 0.85)', 'rgba(255, 45, 120, 0.85)', 'rgba(255, 234, 0, 0.85)']
    : gradeId === 'gold'
      ? ['rgba(255, 209, 102, 0.9)', 'rgba(255, 159, 28, 0.9)', 'rgba(255, 255, 255, 0.9)']
      : ['rgba(255, 122, 60, 0.9)', 'rgba(255, 45, 120, 0.9)', 'rgba(255, 255, 255, 0.9)'];
  const stripeW = w * 0.028;
  const startX = w * 0.06;
  ctx.save();
  ctx.globalAlpha = 0.92;
  colors.forEach((color, i) => {
    ctx.fillStyle = color;
    const x = startX + i * stripeW * 1.7;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + stripeW, 0);
    ctx.lineTo(x + stripeW - h * 0.055, h * 0.055);
    ctx.lineTo(x - h * 0.055, h * 0.055);
    ctx.closePath();
    ctx.fill();
  });
  ctx.restore();
}

function fitTitleLines(ctx, title, maxWidth) {
  const words = title.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Bold poster lettering: Anton, tight tracking, dark outline and a hard shadow.
// style: 'sunset' | 'neon' | 'solid'.
function drawCaption(ctx, w, h, state) {
  const title = (state.title || '').trim() || 'SUNSET DRIVE';
  const subtitle = (state.subtitle || '').trim();
  const scale = (state.titleSize || 100) / 100;
  const margin = Math.round(w * 0.055);
  const maxWidth = w - margin * 2;

  let fontPx = Math.round(w * 0.115 * scale);
  ctx.font = `${fontPx}px Anton, "Archivo Black", sans-serif`;
  try { ctx.letterSpacing = `${Math.round(fontPx * 0.02)}px`; } catch { /* older canvas: no tracking */ }
  while (fontPx > 28 && ctx.measureText(title).width > maxWidth) {
    fontPx = Math.round(fontPx * 0.92);
    ctx.font = `${fontPx}px Anton, "Archivo Black", sans-serif`;
  }
  const lines = fitTitleLines(ctx, title.toUpperCase(), maxWidth);
  const lineHeight = Math.round(fontPx * 0.98);
  const subPx = Math.max(18, Math.round(w * 0.028 * scale));
  const titleDescent = Math.round(fontPx * 0.22);
  const capTop = Math.round(fontPx * 0.72);
  // Baselines, measured from the first title line down: the last title baseline,
  // then the subtitle baseline one gap below the title's descent.
  const subGap = subtitle ? Math.round(subPx * 1.15) : 0;
  const blockBelowFirstBaseline = (lines.length - 1) * lineHeight + titleDescent + subGap + (subtitle ? subPx : 0);

  // Place the block: bottom-anchored it ends at the margin, top-anchored it
  // starts at the margin. baseY is the first title line's baseline either way.
  // (Named isTop: bare `top` would resolve to window.top, which is truthy.)
  const isTop = state.captionPos === 'top';
  const baseY = isTop
    ? margin + capTop
    : h - margin - Math.round(subPx * 0.25) - blockBelowFirstBaseline;

  // A soft dark band behind the caption so lettering reads on any photo.
  const blockTop = baseY - capTop;
  const blockBottom = baseY + blockBelowFirstBaseline + Math.round(subPx * 0.25);
  const bandPad = Math.round(h * 0.03);
  const bandTop = isTop ? 0 : blockTop - bandPad;
  const bandH = (isTop ? blockBottom + bandPad : blockBottom + Math.round(h * 0.02)) - bandTop;
  const band = ctx.createLinearGradient(0, bandTop, 0, bandTop + bandH);
  if (top) {
    band.addColorStop(0, 'rgba(8, 3, 10, 0.72)');
    band.addColorStop(1, 'rgba(8, 3, 10, 0)');
  } else {
    band.addColorStop(0, 'rgba(8, 3, 10, 0)');
    band.addColorStop(1, 'rgba(8, 3, 10, 0.78)');
  }
  ctx.fillStyle = band;
  ctx.fillRect(0, bandTop, w, bandH);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const outline = Math.max(2, Math.round(fontPx * 0.09));
  lines.forEach((line, i) => {
    const y = baseY + i * lineHeight;
    ctx.save();
    if (state.captionStyle === 'neon') {
      ctx.shadowColor = '#ff2d78';
      ctx.shadowBlur = Math.round(fontPx * 0.45);
    } else {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
      ctx.shadowBlur = Math.round(fontPx * 0.12);
      ctx.shadowOffsetY = Math.round(fontPx * 0.05);
    }
    ctx.lineJoin = 'round';
    ctx.strokeStyle = state.captionStyle === 'solid' ? '#14060f' : '#160a18';
    ctx.lineWidth = outline;
    ctx.strokeText(line, margin, y);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(line, margin, y);
    // A sunset underline under the first line, echoing the grade.
    if (i === 0 && state.captionStyle === 'sunset') {
      const underline = ctx.createLinearGradient(margin, 0, margin + ctx.measureText(line).width, 0);
      underline.addColorStop(0, '#ff7a3c');
      underline.addColorStop(1, '#ff2d78');
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.fillStyle = underline;
      ctx.fillRect(margin, y + Math.round(fontPx * 0.16), ctx.measureText(line).width, Math.max(4, Math.round(fontPx * 0.07)));
    }
    ctx.restore();
  });

  if (subtitle) {
    const subY = baseY + (lines.length - 1) * lineHeight + titleDescent + subGap + Math.round(subPx * 0.72);
    ctx.save();
    ctx.font = `700 ${subPx}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = Math.round(subPx * 0.3);
    ctx.fillStyle = state.captionStyle === 'neon' ? '#ffe9f4' : '#fff3e6';
    ctx.fillText(subtitle, margin, subY);
    ctx.restore();
  }
  try { ctx.letterSpacing = '0px'; } catch { /* ignore */ }
}

// Render the whole cover into ctx at canvas size (w, h).
// state: { layout, grade, title, subtitle, titleSize, captionPos, captionStyle, panels[] }
// photos: { key: HTMLImageElement } — keys match panel.photo values.
export function drawCover(ctx, w, h, state, photos) {
  const grade = gradeById(state.grade);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#14060f';
  ctx.fillRect(0, 0, w, h);

  const rects = panelRects(state.layout, w, h);
  rects.forEach((rect, i) => {
    const panel = state.panels[i] || { photo: 'boulevard', zoom: 1, panX: 0, panY: 0 };
    drawPhotoPanel(ctx, photos[panel.photo], rect, panel, grade);
  });

  paintGrade(ctx, w, h, state.grade);
  drawAccentStripes(ctx, w, h, state.grade);

  // Thin poster frame.
  const frame = Math.max(3, Math.round(w * 0.004));
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = frame;
  ctx.strokeRect(frame / 2, frame / 2, w - frame, h - frame);

  drawCaption(ctx, w, h, state);
}

// Render to a fresh canvas at the exact export size and return it.
export function renderExportCanvas(state, photos) {
  const size = SIZES[state.size] || SIZES['1080x1080'];
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  drawCover(canvas.getContext('2d'), size.w, size.h, state, photos);
  return canvas;
}
