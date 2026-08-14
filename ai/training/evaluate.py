import os
import torch
import torch.nn as nn

from torchvision import datasets
from torchvision import transforms
from torchvision import models

from torch.utils.data import DataLoader, random_split

from sklearn.metrics import classification_report
from sklearn.metrics import confusion_matrix

# ----------------------------------------
# DEVICE
# ----------------------------------------

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# ----------------------------------------
# PATHS
# ----------------------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DATASET_PATH = os.path.join(BASE_DIR, "..", "dataset")

MODEL_PATH = os.path.join(BASE_DIR, "..", "models", "earthquake_classifier.pth")

# ----------------------------------------
# TRANSFORM
# ----------------------------------------

transform = transforms.Compose([
    transforms.Resize((224,224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485,0.456,0.406],
        std=[0.229,0.224,0.225]
    )
])

# ----------------------------------------
# DATASET
# ----------------------------------------

dataset = datasets.ImageFolder(
    DATASET_PATH,
    transform=transform
)

train_size = int(0.70 * len(dataset))
val_size = int(0.15 * len(dataset))
test_size = len(dataset) - train_size - val_size

_, _, test_dataset = random_split(
    dataset,
    [train_size, val_size, test_size],
    generator=torch.Generator().manual_seed(42)
)

test_loader = DataLoader(
    test_dataset,
    batch_size=32,
    shuffle=False
)

# ----------------------------------------
# MODEL
# ----------------------------------------

model = models.efficientnet_b0()

model.classifier[1] = nn.Linear(1280,3)

model.load_state_dict(
    torch.load(
        MODEL_PATH,
        map_location=device
    )
)

model.to(device)

model.eval()

# ----------------------------------------
# PREDICTION
# ----------------------------------------

true_labels = []

predicted_labels = []

with torch.no_grad():

    for images, labels in test_loader:

        images = images.to(device)

        labels = labels.to(device)

        outputs = model(images)

        _, predicted = torch.max(outputs,1)

        true_labels.extend(labels.cpu().numpy())

        predicted_labels.extend(predicted.cpu().numpy())

print()

print(classification_report(
    true_labels,
    predicted_labels,
    target_names=dataset.classes
))

print()

print(confusion_matrix(
    true_labels,
    predicted_labels
))