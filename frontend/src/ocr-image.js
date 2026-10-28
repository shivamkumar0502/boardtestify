// Coordinates are fractions of the upright image, shared by preview and OCR.
export const fullPhoto = { x: 0, y: 0, width: 1, height: 1 };
export async function uprightPhoto(file, rotation = 0, maxSide = 3200) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(
      "This photo could not be opened. Export it as JPEG or PNG and retry.",
    );
  }
  try {
    if (bitmap.width * bitmap.height > 24000000)
      throw new Error(
        "Crop the photo to one question column before extracting.",
      );
    const turn = ((rotation % 360) + 360) % 360;
    const swap = turn === 90 || turn === 270;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round((swap ? bitmap.height : bitmap.width) * scale);
    canvas.height = Math.round((swap ? bitmap.width : bitmap.height) * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((turn * Math.PI) / 180);
    ctx.drawImage(
      bitmap,
      (-bitmap.width * scale) / 2,
      (-bitmap.height * scale) / 2,
      bitmap.width * scale,
      bitmap.height * scale,
    );
    return canvas;
  } finally {
    bitmap.close();
  }
}
export function selectedPhoto(source, crop = fullPhoto) {
  const x = Math.max(0, Math.min(0.99, crop.x)),
    y = Math.max(0, Math.min(0.99, crop.y));
  const width = Math.max(0.01, Math.min(1 - x, crop.width)),
    height = Math.max(0.01, Math.min(1 - y, crop.height));
  const sw = source.width * width,
    sh = source.height * height;
  // Enlarge small text modestly and retain larger crops rather than forcing 2200px.
  const scale = Math.min(3, 3200 / Math.max(sw, sh), Math.max(1, 1600 / sw));
  const canvas = document.createElement("canvas"),
    border = 24;
  canvas.width = Math.round(sw * scale) + border * 2;
  canvas.height = Math.round(sh * scale) + border * 2;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(
    source,
    x * source.width,
    y * source.height,
    sw,
    sh,
    border,
    border,
    canvas.width - border * 2,
    canvas.height - border * 2,
  );
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const grey = Math.round(
      0.299 * pixels.data[i] +
        0.587 * pixels.data[i + 1] +
        0.114 * pixels.data[i + 2],
    );
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = grey;
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}
