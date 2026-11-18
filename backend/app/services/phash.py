from __future__ import annotations

from io import BytesIO

import numpy as np
from PIL import Image


def compute_phash(image: Image.Image, hash_size: int = 8, highfreq_factor: int = 4) -> str:
    """Perceptual hash using a 2-D DCT (no external hashing dependency).

    Returns 64 bits as 16 hex characters for an 8x8 hash.
    """
    img_size = hash_size * highfreq_factor
    gray = image.convert("L").resize((img_size, img_size), Image.Resampling.LANCZOS)
    pixels = np.asarray(gray, dtype=np.float64)

    # Orthonormal DCT-II matrix: C[u, x] = a(u) * cos((2x + 1) * u * pi / 2N)
    n = img_size
    x = np.arange(n)
    u = np.arange(n)[:, None]
    alpha = np.where(u == 0, np.sqrt(1.0 / n), np.sqrt(2.0 / n))
    cos_matrix = alpha * np.cos((2 * x[None, :] + 1) * u * np.pi / (2.0 * n))
    dct = cos_matrix @ pixels @ cos_matrix.T

    low = dct[:hash_size, :hash_size]
    median = np.median(low.flatten()[1:])
    bits = (low > median).flatten()
    value = 0
    for bit in bits:
        value = (value << 1) | int(bit)
    return f"{value:016x}"


def hamming_distance(left: str | None, right: str | None) -> int:
    if not left or not right:
        return 999
    try:
        return (int(left, 16) ^ int(right, 16)).bit_count()
    except ValueError:
        return 999


def image_from_bytes(data: bytes) -> Image.Image:
    with Image.open(BytesIO(data)) as image:
        image.load()
        return image.copy()
