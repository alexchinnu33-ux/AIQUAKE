import cv2
import numpy as np
from pathlib import Path

INPUT_PATH = Path("ai/model2/output/sample_001_damage_result.png")
OUTPUT_PATH = Path("ai/model2/output/sample_001_regions.png")

print("Loading damage map...")

image = cv2.imread(str(INPUT_PATH))

if image is None:
    raise FileNotFoundError(f"Could not read: {INPUT_PATH}")

print("Image shape:", image.shape)

# The visualization uses:
# No Damage  -> Green
# Minor      -> Yellow
# Major      -> Orange
# Destroyed  -> Red

# OpenCV reads images as BGR.
# Therefore:
# Green  = (0, 255, 0)
# Yellow = (0, 255, 255)
# Orange = (0, 165, 255)
# Red    = (0, 0, 255)

class_colors = {
    "Minor Damage": (0, 255, 255),
    "Major Damage": (0, 165, 255),
    "Destroyed": (0, 0, 255),
}

output = image.copy()

region_number = 0

for class_name, color in class_colors.items():

    # Find pixels matching this damage color
    lower = np.array(color, dtype=np.uint8)
    upper = np.array(color, dtype=np.uint8)

    mask = cv2.inRange(image, lower, upper)

    # Find connected components
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(
        mask,
        connectivity=8
    )

    print()
    print(class_name)

    found = 0

    for i in range(1, num_labels):

        x = stats[i, cv2.CC_STAT_LEFT]
        y = stats[i, cv2.CC_STAT_TOP]
        w = stats[i, cv2.CC_STAT_WIDTH]
        h = stats[i, cv2.CC_STAT_HEIGHT]
        area = stats[i, cv2.CC_STAT_AREA]

        # Ignore tiny isolated regions
        if area < 100:
            continue

        found += 1
        region_number += 1

        cx, cy = centroids[i]

        print(
            f"Region {region_number}: "
            f"area={area}px, "
            f"bbox=({x},{y},{w},{h}), "
            f"center=({cx:.1f},{cy:.1f})"
        )

        # Draw bounding box
        cv2.rectangle(
            output,
            (x, y),
            (x + w, y + h),
            color,
            2
        )

        # Label region
        cv2.putText(
            output,
            f"R{region_number}",
            (x, max(y - 5, 15)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            color,
            2
        )

    print("Regions found:", found)

cv2.imwrite(str(OUTPUT_PATH), output)

print()
print("Total regions:", region_number)
print("Saved:")
print(OUTPUT_PATH)