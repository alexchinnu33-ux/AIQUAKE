"""
Evaluate Model 1 on its held-out test split (same 70/15/15 split and seed 42
as train.py) and save the metrics as JSON for the dashboard.

Run:  python ai/training/export_metrics.py
Output: ai/models/model1_metrics.json
"""

import json
import os
from datetime import datetime, timezone

import torch
import torch.nn as nn
from sklearn.metrics import classification_report, confusion_matrix
from torch.utils.data import DataLoader, random_split
from torchvision import datasets, models, transforms

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(BASE_DIR, "..", "dataset")
MODEL_PATH = os.path.join(BASE_DIR, "..", "models", "earthquake_classifier.pth")
OUTPUT_PATH = os.path.join(BASE_DIR, "..", "models", "model1_metrics.json")

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

dataset = datasets.ImageFolder(DATASET_PATH, transform=transform)

train_size = int(0.70 * len(dataset))
val_size = int(0.15 * len(dataset))
test_size = len(dataset) - train_size - val_size

_, _, test_dataset = random_split(
    dataset,
    [train_size, val_size, test_size],
    generator=torch.Generator().manual_seed(42),
)
loader = DataLoader(test_dataset, batch_size=64, shuffle=False)

model = models.efficientnet_b0()
model.classifier[1] = nn.Linear(1280, 3)
checkpoint = torch.load(MODEL_PATH, map_location=device)
if isinstance(checkpoint, dict) and "state_dict" in checkpoint:
    checkpoint = checkpoint["state_dict"]
model.load_state_dict(checkpoint)
model.to(device).eval()

truth, predicted = [], []
with torch.no_grad():
    for images, labels in loader:
        outputs = model(images.to(device))
        predicted.extend(outputs.argmax(dim=1).cpu().tolist())
        truth.extend(labels.tolist())

classes = dataset.classes
report = classification_report(
    truth, predicted, target_names=classes, output_dict=True, digits=4
)

metrics = {
    "model": "AIQuake Model 1 (EfficientNet-B0 image classifier)",
    "evaluated_on": "held-out test split (15 %, seed 42)",
    "test_images": len(truth),
    "accuracy": round(report["accuracy"], 4),
    "macro_f1": round(report["macro avg"]["f1-score"], 4),
    "classes": classes,
    "per_class": {
        c: {
            "precision": round(report[c]["precision"], 4),
            "recall": round(report[c]["recall"], 4),
            "f1": round(report[c]["f1-score"], 4),
            "support": int(report[c]["support"]),
        }
        for c in classes
    },
    "confusion_matrix": confusion_matrix(truth, predicted).tolist(),
    "generated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
}

with open(OUTPUT_PATH, "w", encoding="utf-8") as file:
    json.dump(metrics, file, indent=2)

print(json.dumps(metrics, indent=2))
