export const CAMERA_FALLBACK_MESSAGE = "无法打开摄像头，请选择图片上传";

export function createCameraCaptureController({ cameraButton, imageInput, setStatus, onFile }) {
  let stream = null;
  let panel = null;
  let modal = null;

  function stopCamera() {
    stream?.getTracks?.().forEach(track => track.stop());
    stream = null;
  }

  function closePanel() {
    panel?.remove();
    panel = null;
  }

  function closeModal() {
    stopCamera();
    modal?.remove();
    modal = null;
  }

  function showChoicePanel() {
    closePanel();
    panel = document.createElement("div");
    panel.className = "camera-choice-panel";

    const uploadBtn = document.createElement("button");
    uploadBtn.type = "button";
    uploadBtn.textContent = "选择图片";
    uploadBtn.addEventListener("click", () => {
      closePanel();
      imageInput?.click();
    });

    const cameraCaptureBtn = document.createElement("button");
    cameraCaptureBtn.type = "button";
    cameraCaptureBtn.textContent = "使用摄像头拍照";
    cameraCaptureBtn.addEventListener("click", () => {
      closePanel();
      openCamera();
    });

    panel.append(uploadBtn, cameraCaptureBtn);
    cameraButton.insertAdjacentElement?.("afterend", panel);
    if (!panel.parentNode) cameraButton.parentNode?.appendChild(panel);
  }

  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus?.(CAMERA_FALLBACK_MESSAGE, "warning");
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
    } catch (e) {
      setStatus?.(CAMERA_FALLBACK_MESSAGE, "warning");
      return;
    }
    showCameraModal();
  }

  function showCameraModal() {
    modal = document.createElement("div");
    modal.className = "camera-modal";
    const panelEl = document.createElement("div");
    panelEl.className = "camera-modal-panel";
    const video = document.createElement("video");
    video.className = "camera-preview";
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = stream;

    const actions = document.createElement("div");
    actions.className = "camera-modal-actions";
    const captureBtn = document.createElement("button");
    captureBtn.type = "button";
    captureBtn.textContent = "拍照";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = "取消";

    captureBtn.addEventListener("click", async () => {
      const file = await captureVideoFrame(video);
      closeModal();
      if (file) onFile?.(file);
    });
    cancelBtn.addEventListener("click", closeModal);
    actions.append(captureBtn, cancelBtn);
    panelEl.append(video, actions);
    modal.appendChild(panelEl);
    document.body.appendChild(modal);
  }

  async function captureVideoFrame(video) {
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, width, height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.9));
    return blob ? new File([blob], "lucia-camera.jpg", { type: "image/jpeg" }) : null;
  }

  cameraButton?.addEventListener("click", event => {
    event.preventDefault();
    if (cameraButton.getAttribute("aria-disabled") === "true") return;
    showChoicePanel();
  });

  return {
    showChoicePanel,
    openCamera,
    closePanel,
    closeModal,
    stopCamera,
    get stream() {
      return stream;
    }
  };
}
