const OCR_ENDPOINT = "https://api.ocr.space/parse/image";
const DEFAULT_MAX_SIDE = 1600;
const DEFAULT_QUALITY = 0.82;

export function cleanOcrText(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片读取失败"));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error("图片压缩失败"));
    }, type, quality);
  });
}

export async function compressImageFile(file, options = {}) {
  const maxSide = options.maxSide || DEFAULT_MAX_SIDE;
  const quality = options.quality || DEFAULT_QUALITY;
  const image = await loadImage(file);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("浏览器不支持图片压缩");

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, "image/jpeg", quality);
  const compressed = blob.size < file.size
    ? new File([blob], "lucia-ocr.jpg", { type: "image/jpeg" })
    : file;

  return {
    file: compressed,
    originalSize: file.size,
    uploadSize: compressed.size,
    width,
    height,
    compressed: compressed !== file
  };
}

export async function recognizeImageText(file, options = {}) {
  const apiKey = options.apiKey || "";
  if (!apiKey) throw new Error("OCR API key is not configured");

  options.onProgress?.("compressing");
  const image = await compressImageFile(file, options);
  options.onProgress?.("uploading", image);

  const formData = new FormData();
  formData.append("file", image.file);
  formData.append("apikey", apiKey);
  formData.append("language", "eng");
  formData.append("isOverlayRequired", "false");
  formData.append("detectOrientation", "true");
  formData.append("scale", "true");
  formData.append("OCREngine", "2");

  const response = await fetch(OCR_ENDPOINT, { method: "POST", body: formData });
  if (!response.ok) throw new Error(`OCR request failed: ${response.status}`);
  const data = await response.json();
  if (data.IsErroredOnProcessing) {
    const message = data.ErrorMessage || data.ErrorDetails || "OCR 识别失败";
    throw new Error(Array.isArray(message) ? message.join("；") : message);
  }

  return {
    text: cleanOcrText(data.ParsedResults?.[0]?.ParsedText || ""),
    originalSize: image.originalSize,
    uploadSize: image.uploadSize,
    compressed: image.compressed
  };
}
