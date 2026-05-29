const OCR_ENDPOINT = "https://api.ocr.space/parse/image";
const DEFAULT_MAX_SIDE = 1600;
const OCR_UPLOAD_LIMIT_BYTES = 500 * 1024;
const DEFAULT_TARGET_UPLOAD_BYTES = 460 * 1024;
const DEFAULT_MIN_SIDE = 520;
const QUALITY_STEPS = [0.82, 0.72, 0.62, 0.52, 0.44, 0.36];

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

function fitImageSize(sourceWidth, sourceHeight, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale))
  };
}

export function createCompressionPlan(sourceWidth, sourceHeight, options = {}) {
  const sourceMaxSide = Math.max(sourceWidth, sourceHeight);
  const maxSide = Math.min(options.maxSide || DEFAULT_MAX_SIDE, sourceMaxSide);
  const minSide = Math.min(options.minSide || DEFAULT_MIN_SIDE, maxSide);
  const qualities = options.qualitySteps || QUALITY_STEPS;
  const plan = [];
  const used = new Set();
  let side = maxSide;

  while (side >= minSide) {
    const { width, height } = fitImageSize(sourceWidth, sourceHeight, side);
    for (const quality of qualities) {
      const key = `${width}x${height}@${quality}`;
      if (!used.has(key)) {
        used.add(key);
        plan.push({ width, height, quality });
      }
    }
    if (side === minSide) break;
    side = Math.max(minSide, Math.floor(side * 0.78));
  }

  return plan;
}

async function renderJpeg(image, width, height, quality) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("浏览器不支持图片压缩");

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  return canvasToBlob(canvas, "image/jpeg", quality);
}

export async function compressImageFile(file, options = {}) {
  const maxBytes = options.maxBytes || DEFAULT_TARGET_UPLOAD_BYTES;
  const hardLimitBytes = options.hardLimitBytes || OCR_UPLOAD_LIMIT_BYTES;
  const image = await loadImage(file);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const plan = createCompressionPlan(sourceWidth, sourceHeight, options);
  let best = null;
  let bestStep = null;

  for (const step of plan) {
    const blob = await renderJpeg(image, step.width, step.height, step.quality);
    if (!best || blob.size < best.size) {
      best = blob;
      bestStep = step;
    }
    if (blob.size <= maxBytes) break;
  }

  if (!best || !bestStep) throw new Error("图片压缩失败");

  if (best.size > hardLimitBytes) {
    throw new Error(`图片压缩后仍超过 ${formatBytes(hardLimitBytes)}，请裁剪后再上传。`);
  }

  const compressed = new File([best], "lucia-ocr.jpg", { type: "image/jpeg" });

  return {
    file: compressed,
    originalSize: file.size,
    uploadSize: compressed.size,
    width: bestStep.width,
    height: bestStep.height,
    compressed: true
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
