import os
import copy

import torch
import torch.nn as nn
import torch.optim as optim

from torchvision import datasets, transforms, models
from torch.utils.data import DataLoader, random_split
from tqdm import tqdm

# ==========================================================
# DEVICE CONFIGURATION
# ==========================================================
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using Device: {device}")

# ==========================================================
# DATASET PATH
# ==========================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(BASE_DIR, "..", "dataset")
MODEL_PATH = os.path.join(BASE_DIR, "..", "models", "earthquake_classifier.pth")

os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)

print("Dataset Path:", DATASET_PATH)

# ==========================================================
# IMAGE TRANSFORMATIONS
# ==========================================================
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.RandomHorizontalFlip(),
    transforms.RandomRotation(15),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

# ==========================================================
# LOAD DATASET
# ==========================================================
dataset = datasets.ImageFolder(
    root=DATASET_PATH,
    transform=transform
)

print("\nClasses:", dataset.classes)
print("Total Images:", len(dataset))

# ==========================================================
# SPLIT DATASET
# ==========================================================
train_size = int(0.70 * len(dataset))
val_size = int(0.15 * len(dataset))
test_size = len(dataset) - train_size - val_size

train_dataset, val_dataset, test_dataset = random_split(
    dataset,
    [train_size, val_size, test_size],
    generator=torch.Generator().manual_seed(42)
)

print("\nTraining Images :", len(train_dataset))
print("Validation Images :", len(val_dataset))
print("Testing Images :", len(test_dataset))

# ==========================================================
# DATALOADERS
# ==========================================================
BATCH_SIZE = 32

train_loader = DataLoader(
    train_dataset,
    batch_size=BATCH_SIZE,
    shuffle=True
)

val_loader = DataLoader(
    val_dataset,
    batch_size=BATCH_SIZE,
    shuffle=False
)

test_loader = DataLoader(
    test_dataset,
    batch_size=BATCH_SIZE,
    shuffle=False
)

print("\nTrain Batches :", len(train_loader))
print("Validation Batches :", len(val_loader))
print("Test Batches :", len(test_loader))

# ==========================================================
# LOAD PRETRAINED MODEL
# ==========================================================
weights = models.EfficientNet_B0_Weights.DEFAULT
model = models.efficientnet_b0(weights=weights)

# Freeze pretrained layers
for param in model.parameters():
    param.requires_grad = False

# Replace classifier
model.classifier[1] = nn.Linear(
    in_features=1280,
    out_features=3
)

# Train only classifier
for param in model.classifier.parameters():
    param.requires_grad = True

model = model.to(device)

print("\nModel Ready!")

# ==========================================================
# LOSS & OPTIMIZER
# ==========================================================
criterion = nn.CrossEntropyLoss()

optimizer = optim.Adam(
    model.classifier.parameters(),
    lr=0.0001
)

# ==========================================================
# TRAINING SETTINGS
# ==========================================================
EPOCHS = 5

best_accuracy = 0.0
best_weights = copy.deepcopy(model.state_dict())

train_loss_history = []
val_loss_history = []

train_acc_history = []
val_acc_history = []

# ==========================================================
# TRAINING LOOP
# ==========================================================
for epoch in range(EPOCHS):

    print(f"\n==============================")
    print(f"Epoch {epoch+1}/{EPOCHS}")
    print("==============================")

    # ---------------------------
    # TRAIN
    # ---------------------------
    model.train()

    running_loss = 0
    correct = 0
    total = 0

    for images, labels in tqdm(train_loader):

        images = images.to(device)
        labels = labels.to(device)

        optimizer.zero_grad()

        outputs = model(images)

        loss = criterion(outputs, labels)

        loss.backward()

        optimizer.step()

        running_loss += loss.item()

        _, predicted = torch.max(outputs, 1)

        total += labels.size(0)

        correct += (predicted == labels).sum().item()

    train_loss = running_loss / len(train_loader)
    train_accuracy = 100 * correct / total

    train_loss_history.append(train_loss)
    train_acc_history.append(train_accuracy)

    # ---------------------------
    # VALIDATION
    # ---------------------------
    model.eval()

    running_loss = 0
    correct = 0
    total = 0

    with torch.no_grad():

        for images, labels in val_loader:

            images = images.to(device)
            labels = labels.to(device)

            outputs = model(images)

            loss = criterion(outputs, labels)

            running_loss += loss.item()

            _, predicted = torch.max(outputs, 1)

            total += labels.size(0)

            correct += (predicted == labels).sum().item()

    val_loss = running_loss / len(val_loader)
    val_accuracy = 100 * correct / total

    val_loss_history.append(val_loss)
    val_acc_history.append(val_accuracy)

    print(f"\nTrain Loss      : {train_loss:.4f}")
    print(f"Train Accuracy  : {train_accuracy:.2f}%")

    print(f"Validation Loss : {val_loss:.4f}")
    print(f"Validation Acc  : {val_accuracy:.2f}%")

    # ---------------------------
    # SAVE BEST MODEL
    # ---------------------------
    if val_accuracy > best_accuracy:

        best_accuracy = val_accuracy

        best_weights = copy.deepcopy(model.state_dict())

        torch.save(best_weights, MODEL_PATH)

        print("\n✅ Best model saved!")

# ==========================================================
# TRAINING COMPLETE
# ==========================================================
print("\n===================================")
print("Training Completed Successfully!")
print("===================================")

print(f"\nBest Validation Accuracy: {best_accuracy:.2f}%")

print("\nModel Saved At:")
print(MODEL_PATH)
