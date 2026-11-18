from __future__ import annotations

from dataclasses import dataclass, field
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError

from .faces import blur_faces
from .phash import compute_phash

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
ALLOWED_MIME_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"}
Image.MAX_IMAGE_PIXELS = 60_000_000


class ImageValidationError(ValueError):
    """Raised when an uploaded file is not a safe, supported image."""


class UnsupportedImageType(ImageValidationError):
    pass


@dataclass
class ProcessedImage:
    data: bytes
    thumb: bytes
    width: int
    height: int
    phash: str
    faces_blurred: int
    exif_stripped: bool = True
    format: str = "JPEG"
    meta: dict[str, object] = field(default_factory=dict)


def _to_rgb(image: Image.Image) -> Image.Image:
    if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
        base = Image.new("RGB", image.size, (255, 255, 255))
        rgba = image.convert("RGBA")
        base.paste(rgba, mask=rgba.getchannel("A"))
        return base
    return image.convert("RGB")


def validate_image(raw: bytes, declared_mime: str | None = None) -> tuple[Image.Image, str]:
    """Validate by content (never trust the declared MIME) and return an RGB image."""
    if not raw:
        raise ImageValidationError("Empty file")

    if declared_mime and declared_mime.lower() not in ALLOWED_MIME_TYPES:
        # HEIC is accepted by the UI's picker in some browsers but cannot be
        # decoded by Pillow without extra plugins; fail with a clear message.
        if declared_mime.lower() in {"image/heic", "image/heif"}:
            raise UnsupportedImageType(
                "HEIC/HEIF is not supported by the server yet. Please share as JPEG."
            )
        raise UnsupportedImageType("Only JPEG, PNG and WebP images are accepted")

    try:
        with Image.open(BytesIO(raw)) as probe:
            probe.verify()
            fmt = (probe.format or "").upper()
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError) as exc:
        raise ImageValidationError("File is not a valid image") from exc

    if fmt not in ALLOWED_FORMATS:
        raise UnsupportedImageType(f"Unsupported image format: {fmt or 'unknown'}")

    try:
        with Image.open(BytesIO(raw)) as image:
            image.load()
            # Apply orientation before stripping EXIF, otherwise portrait photos
            # would be rotated after metadata removal.
            upright = ImageOps.exif_transpose(image)
            rgb = _to_rgb(upright)
    except (Image.DecompressionBombError, OSError, ValueError) as exc:
        raise ImageValidationError("Image could not be decoded safely") from exc

    return rgb, fmt


def _resize_long_edge(image: Image.Image, max_edge: int) -> Image.Image:
    width, height = image.size
    longest = max(width, height)
    if longest <= max_edge:
        return image
    ratio = max_edge / float(longest)
    return image.resize(
        (max(1, round(width * ratio)), max(1, round(height * ratio))),
        Image.Resampling.LANCZOS,
    )


def _encode_jpeg(image: Image.Image, quality: int) -> bytes:
    # A brand-new RGB image is created before saving so Pillow cannot carry
    # over EXIF, ICC, XMP or text chunks from the upload.
    clean = Image.new("RGB", image.size)
    clean.paste(image.convert("RGB"))
    buffer = BytesIO()
    clean.save(buffer, format="JPEG", quality=quality, optimize=True, progressive=True)
    return buffer.getvalue()


def process_upload(
    raw: bytes,
    declared_mime: str | None = None,
    *,
    max_long_edge: int = 2048,
    quality: int = 85,
    thumb_long_edge: int = 480,
    thumb_quality: int = 78,
    detect_faces: bool = True,
) -> ProcessedImage:
    """Full server-side pipeline: validate, orient, resize, blur faces, re-encode."""
    image, fmt = validate_image(raw, declared_mime)
    image = _resize_long_edge(image, max_long_edge)

    if detect_faces:
        image, faces_blurred = blur_faces(image)
    else:
        faces_blurred = 0

    stored = _encode_jpeg(image, quality)
    thumb = _encode_jpeg(_resize_long_edge(image, thumb_long_edge), thumb_quality)

    return ProcessedImage(
        data=stored,
        thumb=thumb,
        width=image.width,
        height=image.height,
        phash=compute_phash(image),
        faces_blurred=faces_blurred,
        format="JPEG",
        meta={"source_format": fmt, "faces_blurred": faces_blurred},
    )
