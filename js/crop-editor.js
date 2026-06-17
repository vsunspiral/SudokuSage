/** @typedef {import('cropperjs')} Cropper */

let CropperClass = null;

async function loadCropper() {
  if (CropperClass) return CropperClass;
  const mod = await import("https://cdn.jsdelivr.net/npm/cropperjs@1.6.2/dist/cropper.esm.js");
  CropperClass = mod.default;
  return CropperClass;
}

/** Wait until the browser has laid out visible elements. */
function waitForLayout() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

/**
 * Interactive square crop + rotation using Cropper.js.
 */
export class CropEditor {
  /** @type {Cropper | null} */
  #instance = null;

  /**
   * @param {HTMLImageElement} imageEl
   */
  async mount(imageEl) {
    this.destroy();
    await waitForLayout();

    const container = imageEl.closest(".crop-container");
    const Cropper = await loadCropper();

    return new Promise((resolve) => {
      this.#instance = new Cropper(imageEl, {
        container: container instanceof HTMLElement ? container : undefined,
        aspectRatio: 1,
        viewMode: 2,
        dragMode: "crop",
        autoCropArea: 1,
        responsive: true,
        restore: false,
        guides: true,
        center: true,
        highlight: false,
        background: false,
        modal: true,
        movable: true,
        rotatable: true,
        scalable: false,
        zoomable: true,
        zoomOnTouch: true,
        zoomOnWheel: true,
        cropBoxMovable: true,
        cropBoxResizable: true,
        toggleDragModeOnDblclick: false,
        minCropBoxWidth: 40,
        minCropBoxHeight: 40,
        ready: () => {
          this.#applyInitialCrop();
          resolve(this);
        },
      });
    });
  }

  /** Set crop box to the largest square that fits the visible image. */
  #applyInitialCrop() {
    const cropper = this.#instance;
    if (!cropper) return;

    cropper.resize();

    const canvasData = cropper.getCanvasData();
    const size = Math.min(canvasData.width, canvasData.height);

    cropper.setCropBoxData({
      left: canvasData.left + (canvasData.width - size) / 2,
      top: canvasData.top + (canvasData.height - size) / 2,
      width: size,
      height: size,
    });
  }

  destroy() {
    this.#instance?.destroy();
    this.#instance = null;
  }

  /**
   * @param {number} degrees
   */
  rotateTo(degrees) {
    this.#instance?.rotateTo(degrees);
  }

  /** @returns {number} */
  getRotation() {
    return this.#instance?.getData().rotate ?? 0;
  }

  /**
   * @param {number} [maxSize]
   * @returns {HTMLCanvasElement | null}
   */
  getCroppedCanvas(maxSize = 900) {
    return (
      this.#instance?.getCroppedCanvas({
        maxWidth: maxSize,
        maxHeight: maxSize,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: "high",
      }) ?? null
    );
  }
}
