"""Normalize raw shot coordinates to 0-1 range using fieldMin/fieldMax."""


def normalize_coordinate(raw_x: float, raw_y: float, field_min: dict, field_max: dict) -> tuple[float, float]:
    """
    Normalize raw coordinates to [0, 1] range.

    The pitch coordinate system:
    - x: sideline (left to right)
    - y: goal line (one goal to the other)
    - fieldMin/fieldMax define the boundaries

    Returns (nx, ny) where:
    - nx: 0 = left sideline, 1 = right sideline
    - ny: 0 = home goal, 1 = away goal
    """
    x_min, x_max = field_min["x"], field_max["x"]
    y_min, y_max = field_min["y"], field_max["y"]

    x_range = x_max - x_min
    y_range = y_max - y_min

    if x_range == 0 or y_range == 0:
        return 0.5, 0.5

    nx = (raw_x - x_min) / x_range
    ny = (raw_y - y_min) / y_range

    # Clamp to [0, 1]
    nx = max(0.0, min(1.0, nx))
    ny = max(0.0, min(1.0, ny))

    return nx, ny
