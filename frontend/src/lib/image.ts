export interface ProcessedImage {
  blob: Blob
  width: number
  height: number
  facesBlurred: number
}

export interface ProcessOptions {
  /** Longest edge in pixels. Images are never upscaled. */
  maxEdge?: number
  /** JPEG quality between 0 and 1. */
  quality?: number
  /** Best-effort on-device face blur when the browser supports FaceDetector. */
  blurFaces?: boolean
}

interface DetectedFace {
  boundingBox: { x: number; y: number; width: number; height: number }
}

interface FaceDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedFace[]>
}

type FaceDetectorConstructor = new (options?: {
  fastMode?: boolean
  maxDetectedFaces?: number
}) => FaceDetectorLike

function getFaceDetector(): FaceDetectorConstructor | null {
  if (typeof window === 'undefined') return null
  const candidate = (window as unknown as { FaceDetector?: FaceDetectorConstructor })
    .FaceDetector
  return typeof candidate === 'function' ? candidate : null
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob !== 'function') {
      reject(new Error('Canvas encoding is not supported'))
      return
    }
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Could not encode the image'))
      },
      'image/jpeg',
      quality,
    )
  })
}

async function loadImage(input: Blob): Promise<{
  source: CanvasImageSource
  width: number
  height: number
  dispose: () => void
}> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(input, { imageOrientation: 'from-image' })
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close(),
      }
    } catch {
      // Safari versions without imageOrientation support fall through.
    }
  }

  if (typeof document === 'undefined') {
    throw new Error('Image decoding requires a browser')
  }

  const url = URL.createObjectURL(input)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('Could not read this image'))
      element.src = url
    })
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      dispose: () => URL.revokeObjectURL(url),
    }
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}

function pixelateRegion(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  box: { x: number; y: number; width: number; height: number },
): void {
  const x = Math.max(0, Math.floor(box.x))
  const y = Math.max(0, Math.floor(box.y))
  const width = Math.min(canvas.width - x, Math.ceil(box.width))
  const height = Math.min(canvas.height - y, Math.ceil(box.height))
  if (width < 4 || height < 4) return

  const blocksAcross = Math.max(2, Math.floor(width / 18))
  const tiny = document.createElement('canvas')
  tiny.width = blocksAcross
  tiny.height = Math.max(2, Math.floor(height / 18))
  const tinyContext = tiny.getContext('2d')
  if (!tinyContext) return
  tinyContext.drawImage(canvas, x, y, width, height, 0, 0, tiny.width, tiny.height)

  context.save()
  context.imageSmoothingEnabled = false
  context.drawImage(tiny, 0, 0, tiny.width, tiny.height, x, y, width, height)
  context.restore()
}

async function blurDetectedFaces(canvas: HTMLCanvasElement): Promise<number> {
  const Detector = getFaceDetector()
  if (!Detector) return 0
  const context = canvas.getContext('2d')
  if (!context) return 0
  try {
    const detector = new Detector({ fastMode: true, maxDetectedFaces: 8 })
    const faces = await detector.detect(canvas)
    for (const face of faces) {
      const box = face.boundingBox
      // Grow the box slightly so hair and chin stay covered.
      const padX = box.width * 0.12
      const padY = box.height * 0.18
      pixelateRegion(context, canvas, {
        x: box.x - padX,
        y: box.y - padY,
        width: box.width + padX * 2,
        height: box.height + padY * 2,
      })
    }
    return faces.length
  } catch {
    // Face detection is a best-effort enhancement. The server always runs
    // its own detector before publishing.
    return 0
  }
}

/**
 * Re-encode a photo through a canvas. Drawing into a canvas discards all EXIF
 * metadata, including GPS. The output is a JPEG of at most `maxEdge` pixels.
 */
export async function processImage(
  input: Blob,
  options: ProcessOptions = {},
): Promise<ProcessedImage> {
  const maxEdge = options.maxEdge ?? 1600
  const quality = options.quality ?? 0.75
  const shouldBlur = options.blurFaces ?? true

  const loaded = await loadImage(input)
  try {
    if (!loaded.width || !loaded.height) throw new Error('The image has no pixels')

    const scale = Math.min(1, maxEdge / Math.max(loaded.width, loaded.height))
    const width = Math.max(1, Math.round(loaded.width * scale))
    const height = Math.max(1, Math.round(loaded.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is not available')
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    // JPEG has no alpha channel; fill white so transparent PNGs do not turn black.
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(loaded.source, 0, 0, width, height)

    const facesBlurred = shouldBlur ? await blurDetectedFaces(canvas) : 0
    const blob = await canvasToBlob(canvas, quality)
    return { blob, width, height, facesBlurred }
  } finally {
    loaded.dispose()
  }
}

/** Small local preview for the offline queue. */
export async function makeThumbnail(input: Blob): Promise<Blob> {
  const result = await processImage(input, {
    maxEdge: 480,
    quality: 0.6,
    blurFaces: false,
  })
  return result.blob
}

export function objectUrl(blob: Blob | null | undefined): string | null {
  if (!blob) return null
  return URL.createObjectURL(blob)
}
