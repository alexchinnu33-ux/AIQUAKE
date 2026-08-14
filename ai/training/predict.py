import os
import torch
import torch.nn as nn
from PIL import Image

from torchvision import transforms
from torchvision import models

# ==========================================================
# DEVICE
# ==========================================================

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using Device: {device}")

# ==========================================================
# PATHS
# ==========================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODEL_PATH = os.path.join(
    BASE_DIR,
    "..",
    "models",
    "earthquake_classifier.pth"
)

IMAGE_PATH = os.path.join(
    BASE_DIR,
    "..",
    "test_images",
    "sample.webp"
)

print("Image Path:", IMAGE_PATH)

# Check if image exists
if not os.path.exists(IMAGE_PATH):
    raise FileNotFoundError(f"Image not found:\n{IMAGE_PATH}")

# ==========================================================
# IMAGE TRANSFORM
# ==========================================================

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

# ==========================================================
# LOAD MODEL
# ==========================================================

model = models.efficientnet_b0(weights=None)

model.classifier[1] = nn.Linear(
    in_features=1280,
    out_features=3
)

model.load_state_dict(
    torch.load(
        MODEL_PATH,
        map_location=device
    )
)

model.to(device)
model.eval()

# ==========================================================
# CLASS NAMES
# ==========================================================

classes = [
    "Collapsed",
    "Damaged",
    "Intact"
]

# ==========================================================
# LOAD IMAGE
# ==========================================================

image = Image.open(IMAGE_PATH).convert("RGB")

image = transform(image)

image = image.unsqueeze(0)

image = image.to(device)

# ==========================================================
# PREDICT
# ==========================================================

with torch.no_grad():

    outputs = model(image)

    probabilities = torch.softmax(outputs, dim=1)

    confidence, prediction = torch.max(probabilities, 1)

# ==========================================================
# DISPLAY RESULT
# ==========================================================

print("\n========================================")
print("        AIQUAKE PREDICTION")
print("========================================")
print(f"Image      : {os.path.basename(IMAGE_PATH)}")
print(f"Prediction : {classes[prediction.item()]}")
print(f"Confidence : {confidence.item()*100:.2f}%")
print("========================================")