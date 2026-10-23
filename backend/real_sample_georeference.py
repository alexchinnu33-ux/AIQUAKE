import json
from pathlib import Path


REAL_SAMPLES_DIR = (
    Path(__file__).resolve().parent.parent
    / "ai"
    / "model2"
    / "real_samples"
    / "paired_samples"
)


def find_metadata(sample_name):
    metadata_path = (
        REAL_SAMPLES_DIR
        / sample_name
        / "metadata.json"
    )

    if not metadata_path.exists():
        raise FileNotFoundError(
            f"Metadata not found: {metadata_path}"
        )

    with open(
        metadata_path,
        "r",
        encoding="utf-8",
    ) as file:
        return json.load(file)


def print_sample_metadata(sample_name):
    data = find_metadata(sample_name)

    print("=" * 70)
    print(sample_name)
    print("=" * 70)

    print(
        json.dumps(
            data,
            indent=2,
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    for sample in [
        "sample_001_destroyed",
        "sample_002_major-damage",
        "sample_003_minor-damage",
    ]:
        print_sample_metadata(sample)