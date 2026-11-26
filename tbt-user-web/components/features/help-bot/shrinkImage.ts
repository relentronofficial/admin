/** Longest side of a screenshot sent to TBT Assistant. */
const MAX_SIDE = 1280;
/** The backend takes up to ~1.5 MB of data URL; stay well under it. */
const MAX_CHARS = 1_400_000;

/** A picture as a JPEG data URL small enough to send with a question. */
export async function shrinkImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("not an image");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("unreadable"));
      i.src = url;
    });
    let scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    for (let quality = 0.82; ; quality -= 0.12) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas");
      ctx.fillStyle = "#fff"; // transparent PNGs would turn black in JPEG
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/jpeg", Math.max(0.4, quality));
      if (data.length <= MAX_CHARS) return data;
      if (quality <= 0.46) scale *= 0.7;
      if (scale < 0.1) throw new Error("too big");
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}
