/** @typedef {import('cropperjs')} Cropper */

let CropperClass = null;

async function loadCropper() {
  if (CropperClass) return CropperClass;
  const mod = await import("https://cdn.jsdelivr.net/npm/cropperjs@1.6.2/dist/cropper.esm.js");
  CropperClass = mod.default;
  return CropperClass;
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
    const Cropper = await loadCropper();

    return new Promise((resolve) => {
      this.#instance = new Cropper(imageEl, {
        aspectRatio: 1,
        viewMode: 1,
        dragMode: "crop",
        autoCropArea: 0.9,
        responsive: true,
        restore: false,
        guides: true,
        center: true,
        highlight: false,
        background: true,
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
        ready: () => resolve(this),
      });
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
