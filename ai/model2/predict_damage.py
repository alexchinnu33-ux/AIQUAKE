import cv2
import numpy as np
import onnxruntime as ort
from pathlib import Path

MODEL_PATH = r"ai\models\building_damage\model.onnx"
PRE_PATH = r"ai\model2\samples\pre\sample_001.png"
POST_PATH = r"ai\model2\samples\post\sample_001.png"
OUTPUT_PATH = r"ai\model2\output\sample_001_damage_result.png"

print("Loading Model 2...")

session = ort.InferenceSession(
    MODEL_PATH,
    providers=["CPUExecutionProvider"]
)

print("Model loaded successfully.")

def prepare_image(path):
    image = cv2.imread(path)

    if image is None:
        raise FileNotFoundError(f"Could not read image: {path}")

    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    image = cv2.resize(image, (512, 512))

    image = image.astype(np.float32) / 255.0
    image = np.transpose(image, (2, 0, 1))
    image = np.expand_dims(image, axis=0)

    return image


print("Preparing images...")

pre_image = prepare_image(PRE_PATH)
post_image = prepare_image(POST_PATH)

print("PRE shape :", pre_image.shape)
print("POST shape:", post_image.shape)

print()
print("Running Model 2...")
print("This may take some time on CPU.")

outputs = session.run(
    ["damage_logits"],
    {
        "pre": pre_image,
        "post": post_image
    }
)

damage_logits = outputs[0]

print("Inference completed.")
print("Output shape:", damage_logits.shape)

damage_map = np.argmax(damage_logits, axis=1)[0]

print()
print("Damage pixel counts:")

class_names = {
    0: "No Damage",
    1: "Minor Damage",
    2: "Major Damage",
    3: "Destroyed"
}

for class_id, class_name in class_names.items():
    count = int(np.sum(damage_map == class_id))
    percentage = count / damage_map.size * 100

    print(
        f"{class_id} - {class_name}: "
        f"{count:,} pixels ({percentage:.2f}%)"
    )

# Create a simple visualization
colors = np.array(
    [
        [0, 255, 0],       # No damage
        [255, 255, 0],     # Minor damage
        [255, 165, 0],     # Major damage
        [255, 0, 0],       # Destroyed
    ],
    dtype=np.uint8
)

damage_visualization = colors[damage_map]

cv2.imwrite(
    OUTPUT_PATH,
    cv2.cvtColor(damage_visualization, cv2.COLOR_RGB2BGR)
)

print()
print("Result saved to:")
print(OUTPUT_PATH)