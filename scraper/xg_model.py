"""xG model calibrated on 1,307,767 real IOSoccer shots (49,088 matches, 2024+).

Separate foot/header logistic regression models fitted via gradient descent.
Brier score: 0.205 (25.6% improvement over the old real-football model).
"""
import math

GOAL_HALF_WIDTH = 0.054  # 7.32m / 2 / 68m  (normalized)
ASPECT = 105 / 68


def calculate_xg(nx: float, ny: float, is_header: bool = False) -> float:
    """
    Calculate expected goals (xG) from a normalized shot position.

    Args:
        nx: normalized x (0=left sideline, 1=right sideline)
        ny: normalized y (0=one end, 1=other end)
        is_header: True if the shot is a header (bodyPart == 4)

    Returns:
        xG value between 0.02 and 0.95
    """
    x = max(0.0, min(1.0, nx))
    y = max(0.0, min(1.0, ny))

    goal_x = 0.5
    goal_y = 1.0 if y >= 0.5 else 0.0

    dx = x - goal_x
    dy = (y - goal_y) * ASPECT
    distance = math.sqrt(dx * dx + dy * dy)

    if distance < 0.001:
        return 0.95

    dist_y = abs(y - goal_y) * ASPECT
    a1 = math.atan2(goal_x - GOAL_HALF_WIDTH - x, dist_y)
    a2 = math.atan2(goal_x + GOAL_HALF_WIDTH - x, dist_y)
    angle = abs(a2 - a1)

    if is_header:
        # Headers beyond 20m are unrealistic — cap at 3%/2%
        if distance >= 0.40:
            return 0.02
        if distance >= 0.30:
            return 0.03
        z = -1.4731 - 0.6693 * distance + 0.9774 * angle
    else:
        z = -1.1190 - 1.4775 * distance + 1.6827 * angle

    xg = 1 / (1 + math.exp(-z))

    return max(0.02, min(0.95, xg))
