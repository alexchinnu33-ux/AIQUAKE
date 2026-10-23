from datasets import load_dataset
from pathlib import Path
from PIL import Image

PRE_DIR = Path("ai/model2/samples/pre")
POST_DIR = Path("ai/model2/samples/post")

PRE_DIR.mkdir(parents=True, exist_ok=True)
POST_DIR.mkdir(parents=True, exist_ok=True)

print("Loading KATE-CD sample...")

dataset = load_dataset(
    "CSCRS/kate-cd",
    split="train",
    streaming=True
)

sample = next(iter(dataset))

print("Sample loaded.")
print("Available fields:", sample.keys())

pre = sample["pre_image"]
post = sample["post_image"]

pre_path = PRE_DIR / "sample_001.png"
post_path = POST_DIR / "sample_001.png"

pre.save(pre_path)
post.save(post_path)

print()
print("PRE :", pre_path)
print("POST:", post_path)
print()
print("Saved successfully.")