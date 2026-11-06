// socialExport.js — turn a captured menu sheet into Instagram-ready PNGs.
//
// The sheet is centred on a canvas of the target size, filled with the
// menu's own background colour so it reads as one seamless image.

export const SOCIAL_FORMATS = {
  post:  { label: 'Instagram post',  width: 1080, height: 1350 }, // 4:5 portrait feed post
  story: { label: 'Instagram story', width: 1080, height: 1920 }, // 9:16 story / reel cover
};

/**
 * Compose `source` (a canvas of the menu sheet) onto a social-size canvas.
 * `padding` is the minimum margin around the sheet, as a fraction of width.
 */
export function composeForSocial(source, { width, height, background, padding = 0.06 }) {
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d');

  ctx.fillStyle = background || '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const margin = Math.round(width * padding);
  const scale = Math.min((width - margin * 2) / source.width, (height - margin * 2) / source.height);
  const w = Math.round(source.width * scale);
  const h = Math.round(source.height * scale);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, Math.round((width - w) / 2), Math.round((height - h) / 2), w, h);
  return out;
}

export function downloadCanvas(canvas, filename) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('Could not create image'));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      resolve();
    }, 'image/png');
  });
}
