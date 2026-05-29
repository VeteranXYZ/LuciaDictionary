import { afterEach, describe, expect, it, vi } from "vitest";
import { CAMERA_FALLBACK_MESSAGE, createCameraCaptureController } from "./cameraCapture.js";

const originalDocument = globalThis.document;
const originalNavigator = globalThis.navigator;
const originalFile = globalThis.File;

afterEach(() => {
  globalThis.document = originalDocument;
  Object.defineProperty(globalThis, "navigator", { value: originalNavigator, configurable: true });
  globalThis.File = originalFile;
});

function makeElement(tag = "div") {
  return {
    tag,
    type: "",
    textContent: "",
    className: "",
    parentNode: null,
    children: [],
    listeners: {},
    attributes: {},
    append(...nodes) {
      nodes.forEach(node => this.appendChild(node));
    },
    appendChild(node) {
      node.parentNode = this;
      this.children.push(node);
    },
    insertAdjacentElement(_position, node) {
      this.parentNode?.appendChild(node);
    },
    addEventListener(name, listener) {
      this.listeners[name] = listener;
    },
    click() {
      this.listeners.click?.({ preventDefault() {} });
    },
    remove() {
      this.removed = true;
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    getAttribute(name) {
      return this.attributes[name];
    },
    getContext() {
      return { drawImage() {} };
    },
    toBlob(callback) {
      callback(new Blob(["x"], { type: "image/jpeg" }));
    }
  };
}

function installDocument() {
  const body = makeElement("body");
  globalThis.document = {
    body,
    createElement: makeElement
  };
  return body;
}

describe("camera capture controller", () => {
  it("shows upload and camera options when clicking camera button", () => {
    installDocument();
    const wrap = makeElement();
    const cameraButton = makeElement("button");
    const imageInput = makeElement("input");
    wrap.appendChild(cameraButton);
    createCameraCaptureController({ cameraButton, imageInput });

    cameraButton.click();

    const panel = wrap.children.find(child => child.className === "camera-choice-panel");
    expect(panel.children.map(child => child.textContent)).toEqual(["选择图片", "使用摄像头拍照"]);
  });

  it("choosing upload triggers existing file input flow", () => {
    installDocument();
    const wrap = makeElement();
    const cameraButton = makeElement("button");
    const imageInput = makeElement("input");
    imageInput.click = vi.fn();
    wrap.appendChild(cameraButton);
    createCameraCaptureController({ cameraButton, imageInput });

    cameraButton.click();
    wrap.children.find(child => child.className === "camera-choice-panel").children[0].click();

    expect(imageInput.click).toHaveBeenCalledTimes(1);
  });

  it("shows fallback message if getUserMedia is unavailable", async () => {
    installDocument();
    Object.defineProperty(globalThis, "navigator", { value: {}, configurable: true });
    const setStatus = vi.fn();
    const cameraButton = makeElement("button");
    const controller = createCameraCaptureController({ cameraButton, setStatus });

    await controller.openCamera();

    expect(setStatus).toHaveBeenCalledWith(CAMERA_FALLBACK_MESSAGE, "warning");
  });

  it("stops camera tracks on cancel", async () => {
    installDocument();
    const stop = vi.fn();
    Object.defineProperty(globalThis, "navigator", {
      value: { mediaDevices: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop }] })) } },
      configurable: true
    });
    const cameraButton = makeElement("button");
    const controller = createCameraCaptureController({ cameraButton });

    await controller.openCamera();
    document.body.children[0].children[0].children[1].children[1].click();

    expect(stop).toHaveBeenCalledTimes(1);
  });
});
