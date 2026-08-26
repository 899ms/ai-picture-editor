import enum


class Ratio(enum.StrEnum):
    SQUARE = "1:1"
    PORTRAIT_4_5 = "4:5"
    PORTRAIT_3_4 = "3:4"
    VERTICAL_9_16 = "9:16"
    LANDSCAPE_16_9 = "16:9"


# 与交付尺寸对齐，避免生成后再次重采样
SIZES: dict[Ratio, tuple[int, int]] = {
    Ratio.SQUARE: (1080, 1080),
    Ratio.PORTRAIT_4_5: (1080, 1350),
    Ratio.PORTRAIT_3_4: (1080, 1440),
    Ratio.VERTICAL_9_16: (1080, 1920),
    Ratio.LANDSCAPE_16_9: (1920, 1080),
}

DELIVERY_RATIOS = (Ratio.SQUARE, Ratio.PORTRAIT_4_5, Ratio.VERTICAL_9_16)


def size_of(ratio: Ratio) -> tuple[int, int]:
    return SIZES[ratio]
