import cv2
import numpy as np
from pathlib import Path

PRE_PATH = Path("ai/model2/samples/pre/sample_001.png")
POST_PATH = Path("ai/model2/samples/post/sample_001.png")
RESULT_PATH = Path("ai/model2/output/sample_001_regions.png")
OUTPUT_PATH = Path("ai/model2/output/sample_001_comparison.png")

pre = cv2.imread(str(PRE_PATH))
post = cv2.imread(str(POST_PATH))
result = cv2.imread(str(RESULT_PATH))

if pre is None:
    raise FileNotFoundError(PRE_PATH)

if post is None:
    raise FileNotFoundError(POST_PATH)

if result is None:
    raise FileNotFoundError(RESULT_PATH)

# Add labels
def add_title(image, title):
    output = image.copy()

    cv2.rectangle(
        output,
        (0, 0),
        (512, 35),
        (0, 0, 0),
        -1
    )

    cv2.putText(
        output,
        title,
        (10, 24),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (255, 255, 255),
        2
    )

    return output


pre = add_title(pre, "BEFORE EARTHQUAKE")
post = add_title(post, "AFTER EARTHQUAKE")
result = add_title(result, "MODEL 2 DAMAGE REGIONS")

comparison = np.hstack([pre, post, result])

cv2.imwrite(str(OUTPUT_PATH), comparison)

print("Comparison image created:")
print(OUTPUT_PATH)
print("Size:", comparison.shape)