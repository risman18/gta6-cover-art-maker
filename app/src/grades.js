// Colour grades for Cover Drive. Each grade is an original look built from canvas
// gradients and blend modes: a warm Vice-style sunset, a magenta/cyan neon night,
// and a honeyed golden hour. No photo is ever modified on disk; the grade is only
// painted over the cover at render time.

export const GRADES = [
  {
    id: 'sunset',
    name: 'Vice Sunset',
    // How the photo itself is treated before the overlays are painted.
    saturate: 1.28,
    contrast: 1.08,
    brightness: 1.02,
  },
  {
    id: 'neon',
    name: 'Neon Nights',
    saturate: 1.35,
    contrast: 1.12,
    brightness: 0.98,
  },
  {
    id: 'gold',
    name: 'Golden Hour',
    saturate: 1.18,
    contrast: 1.05,
    brightness: 1.06,
  },
];

export function gradeById(id) {
  return GRADES.find((g) => g.id === id) || GRADES[0];
}

// Paint a grade's light over the whole cover. Called after the panels are drawn
// and before the caption, so the lettering stays crisp on top of the colour.
export function paintGrade(ctx, w, h, gradeId) {
  if (gradeId === 'sunset') {
    paintSunsetGrade(ctx, w, h);
  } else if (gradeId === 'neon') {
    paintNeonGrade(ctx, w, h);
  } else {
    paintGoldGrade(ctx, w, h);
  }
  paintVignette(ctx, w, h);
}

function paintSunsetGrade(ctx, w, h) {
  // Low sun glow, warm at the bottom, violet at the top.
  const glow = ctx.createRadialGradient(w * 0.5, h * 0.92, 0, w * 0.5, h * 0.92, w * 0.75);
  glow.addColorStop(0, 'rgba(255, 122, 60, 0.42)');
  glow.addColorStop(0.55, 'rgba(255, 45, 120, 0.16)');
  glow.addColorStop(1, 'rgba(255, 45, 120, 0)');
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, 'rgba(124, 58, 237, 0.20)');
  sky.addColorStop(0.55, 'rgba(255, 45, 120, 0.10)');
  sky.addColorStop(1, 'rgba(255, 122, 60, 0.26)');
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
}

function paintNeonGrade(ctx, w, h) {
  // Magenta from the left, cyan from the right, meeting in the middle.
  const left = ctx.createLinearGradient(0, 0, w, 0);
  left.addColorStop(0, 'rgba(255, 45, 120, 0.34)');
  left.addColorStop(0.5, 'rgba(124, 58, 237, 0.10)');
  left.addColorStop(1, 'rgba(34, 211, 238, 0.30)');
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = left;
  ctx.fillRect(0, 0, w, h);

  const band = ctx.createLinearGradient(0, h * 0.6, 0, h);
  band.addColorStop(0, 'rgba(255, 45, 120, 0)');
  band.addColorStop(1, 'rgba(255, 45, 120, 0.22)');
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
}

function paintGoldGrade(ctx, w, h) {
  // Honey light falling from the top, amber pooling at the bottom.
  const top = ctx.createLinearGradient(0, 0, 0, h);
  top.addColorStop(0, 'rgba(255, 209, 102, 0.30)');
  top.addColorStop(0.5, 'rgba(255, 159, 28, 0.10)');
  top.addColorStop(1, 'rgba(224, 123, 0, 0.24)');
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(w * 0.5, 0, 0, w * 0.5, 0, w * 0.8);
  glow.addColorStop(0, 'rgba(255, 243, 176, 0.30)');
  glow.addColorStop(1, 'rgba(255, 243, 176, 0)');
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
}

function paintVignette(ctx, w, h) {
  const v = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.42,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  v.addColorStop(0, 'rgba(0, 0, 0, 0)');
  v.addColorStop(1, 'rgba(10, 4, 12, 0.38)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}
