const OCR_ENDPOINT = "/api/ocr";
const DEFAULT_MAX_SIDE = 1600;
const OCR_UPLOAD_LIMIT_BYTES = 500 * 1024;
const DEFAULT_TARGET_UPLOAD_BYTES = 460 * 1024;
const DEFAULT_MIN_SIDE = 520;
const QUALITY_STEPS = [0.82, 0.72, 0.62, 0.52, 0.44, 0.36];
const SUPPORTED_INPUT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const OCR_ERROR_MESSAGES = {
  no_text_detected: "没有识别到清晰的英文。请把纸张拍正、拍近，并避免阴影。",
  image_too_blurry: "图片里的文字不够清楚。请重新拍一张更近、更亮的照片。",
  file_too_large: "图片太大了。请只拍英文题目区域，或裁剪后再上传。",
  unsupported_file_type: "这个图片格式暂时不支持。请上传 JPG、PNG 或 WebP 图片。",
  network_error: "网络连接不稳定。你可以先手动输入句子，稍后再试。",
  offline: "OCR 需要网络连接。你可以先手动输入句子。",
  service_unavailable: "OCR 服务暂时不可用。你可以先手动输入句子，稍后再试。",
  too_many_requests: "OCR 请求太多了。请稍等一会儿再试。",
  unknown: "图片识别失败。你可以先手动输入句子。"
};

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

export function createOcrError(code, message) {
  const error = new Error(message || OCR_ERROR_MESSAGES[code] || OCR_ERROR_MESSAGES.unknown);
  error.code = code || "unknown";
  return error;
}

export function getOcrErrorMessage(error) {
  const code = typeof error === "string" ? error : error?.code;
  return OCR_ERROR_MESSAGES[code] || error?.message || OCR_ERROR_MESSAGES.unknown;
}

export function mapOcrResponseError(status, body = {}) {
  if (status === 413) return "file_too_large";
  if (status === 415) return "unsupported_file_type";
  if (status === 429) return "too_many_requests";
  if (status >= 500) return "service_unavailable";
  return body.error || body.code || "unknown";
}

export function isSupportedOcrImage(file) {
  return SUPPORTED_INPUT_TYPES.has(file?.type);
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
    throw createOcrError("file_too_large");
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
  if (!isSupportedOcrImage(file)) throw createOcrError("unsupported_file_type");
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw createOcrError("offline");

  options.onProgress?.("compressing");
  const image = await compressImageFile(file, options);
  options.onProgress?.("uploading", image);

  const formData = new FormData();
  formData.append("file", image.file);
  let response;
  let data = {};
  try {
    response = await fetch(OCR_ENDPOINT, { method: "POST", body: formData });
    data = await response.json().catch(() => ({}));
  } catch (e) {
    throw createOcrError("network_error");
  }

  if (!response.ok) {
    throw createOcrError(mapOcrResponseError(response.status, data));
  }

  const text = cleanOcrText(data.text || "");
  if (!text) throw createOcrError(data.error || "no_text_detected");

  return {
    text,
    originalSize: image.originalSize,
    uploadSize: image.uploadSize,
    compressed: image.compressed
  };
}
