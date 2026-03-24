"""Simple xG model based on shot distance and angle to goal center."""
import math


# Goal is at y=0 or y=1 (normalized), centered at x=0.5
# Goal width ~14 units out of ~100 field width ≈ 14% of pitch width
GOAL_HALF_WIDTH = 0.07  # half of goal width in normalized coords


def calculate_xg(nx: float, ny: float, is_home_team: bool) -> float:
    """
    Calculate expected goals (xG) from a normalized shot position.

    Args:
        nx: normalized x (0=left sideline, 1=right sideline)
        ny: normalized y (0=home end, 1=away end)
        is_home_team: True if the shooting team is home

    Returns:
        xG value between 0 and 1
    """
    # Distance to goal center
    goal_x = 0.5
    # Home team shoots toward away goal (ny=1), away team toward home goal (ny=0)
    goal_y = 1.0 if is_home_team else 0.0

    dx = nx - goal_x
    dy = ny - goal_y
    distance = math.sqrt(dx * dx + dy * dy)

    if distance < 0.001:
        return 0.95  # Practically on the goal line

    # Angle to goal posts
    goal_left_x = goal_x - GOAL_HALF_WIDTH
    goal_right_x = goal_x + GOAL_HALF_WIDTH

    angle_left = math.atan2(abs(goal_y - ny), goal_left_x - nx)
    angle_right = math.atan2(abs(goal_y - ny), goal_right_x - nx)
    angle = abs(angle_left - angle_right)

    # xG formula: combination of distance decay and angle
    # Closer shots with wider angles = higher xG
    distance_factor = math.exp(-3.5 * distance)
    angle_factor = angle / math.pi  # normalize angle to [0, 1]

    xg = 0.7 * distance_factor + 0.3 * angle_factor

    # Clamp
    return max(0.01, min(0.95, xg))
