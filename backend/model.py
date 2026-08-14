import os

import torch
import torch.nn as nn

from PIL import Image

from torchvision import transforms
from torchvision import models


# --------------------------------------------------
# DEVICE
# --------------------------------------------------

device = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)

print("AI Model Device:", device)


# --------------------------------------------------
# PATH
# --------------------------------------------------

BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

MODEL_PATH = os.path.join(
    BASE_DIR,
    "..",
    "ai",
    "models",
    "earthquake_classifier.pth"
)

MODEL_PATH = os.path.abspath(MODEL_PATH)

print("AI Model Path:", MODEL_PATH)


# --------------------------------------------------
# CLASSES
# --------------------------------------------------

CLASSES = [
    "Collapsed",
    "Damaged",
    "Intact"
]


# --------------------------------------------------
# TRANSFORM
# --------------------------------------------------

transform = transforms.Compose([

    transforms.Resize((224, 224)),

    transforms.ToTensor(),

    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )

])


# --------------------------------------------------
# CREATE MODEL
# --------------------------------------------------

model = models.efficientnet_b0(
    weights=None
)

model.classifier[1] = nn.Linear(
    1280,
    3
)


# --------------------------------------------------
# LOAD TRAINED MODEL
# --------------------------------------------------

if not os.path.exists(MODEL_PATH):

    raise FileNotFoundError(
        f"Model file not found: {MODEL_PATH}"
    )


checkpoint = torch.load(
    MODEL_PATH,
    map_location=device
)


# Handle normal state_dict
if isinstance(checkpoint, dict) and "state_dict" in checkpoint:

    checkpoint = checkpoint["state_dict"]


model.load_state_dict(
    checkpoint
)


model = model.to(device)

model.eval()


print("AIQuake model loaded successfully.")


# --------------------------------------------------
# PREDICTION FUNCTION
# --------------------------------------------------

def predict_image(image_path):

    image = Image.open(
        image_path
    )

    image = image.convert(
        "RGB"
    )

    image = transform(
        image
    )

    image = image.unsqueeze(
        0
    )

    image = image.to(
        device
    )


    with torch.no_grad():

        output = model(
            image
        )

        probabilities = torch.softmax(
            output,
            dim=1
        )

        confidence, prediction = torch.max(
            probabilities,
            dim=1
        )


    predicted_class = CLASSES[
        prediction.item()
    ]

    confidence_value = (
        confidence.item() * 100
    )


    return {
        "prediction": predicted_class,
        "confidence": round(
            confidence_value,
            2
        )
    }