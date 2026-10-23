import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
REAL_DIR = BASE_DIR / "real_samples"

DAMAGE_FILE = (
    REAL_DIR
    / "damage_assessment"
    / "caraballeda_damage_polygons.geojson"
)

BUILDING_FILE = (
    REAL_DIR
    / "buildings"
    / "caraballeda_buildings_polygons.geojson"
)

OUTPUT_FILE = REAL_DIR / "geospatial_summary.json"


def load_geojson(path):
    with open(path, "r", encoding="utf-8") as file:
        return json.load(file)


def coordinate_bbox(coords, bbox=None):
    """
    Recursively inspect GeoJSON coordinates and calculate:
    [min_lon, min_lat, max_lon, max_lat]
    """
    if bbox is None:
        bbox = [
            float("inf"),
            float("inf"),
            float("-inf"),
            float("-inf"),
        ]

    if isinstance(coords, (list, tuple)):
        if (
            len(coords) >= 2
            and isinstance(coords[0], (int, float))
            and isinstance(coords[1], (int, float))
        ):
            lon = float(coords[0])
            lat = float(coords[1])

            bbox[0] = min(bbox[0], lon)
            bbox[1] = min(bbox[1], lat)
            bbox[2] = max(bbox[2], lon)
            bbox[3] = max(bbox[3], lat)

        else:
            for item in coords:
                coordinate_bbox(item, bbox)

    return bbox


def geometry_bbox(geometry):
    if not geometry:
        return None

    coordinates = geometry.get("coordinates")

    if coordinates is None:
        return None

    bbox = coordinate_bbox(coordinates)

    if bbox[0] == float("inf"):
        return None

    return bbox


def collection_bbox(data):
    total_bbox = [
        float("inf"),
        float("inf"),
        float("-inf"),
        float("-inf"),
    ]

    for feature in data.get("features", []):
        bbox = geometry_bbox(feature.get("geometry"))

        if bbox is None:
            continue

        total_bbox[0] = min(total_bbox[0], bbox[0])
        total_bbox[1] = min(total_bbox[1], bbox[1])
        total_bbox[2] = max(total_bbox[2], bbox[2])
        total_bbox[3] = max(total_bbox[3], bbox[3])

    if total_bbox[0] == float("inf"):
        return None

    return total_bbox


def get_property_fields(data):
    fields = set()

    for feature in data.get("features", []):
        properties = feature.get("properties") or {}

        for key in properties:
            fields.add(key)

    return sorted(fields)


def find_damage_field(data):
    """
    Try to identify the damage classification field.
    """
    candidates = [
        "damage",
        "damage_class",
        "damage_label",
        "class",
        "classification",
        "building_damage",
        "damage_category",
    ]

    fields = get_property_fields(data)

    for candidate in candidates:
        if candidate in fields:
            return candidate

    return None


def calculate_damage_counts(data):
    damage_field = find_damage_field(data)

    if damage_field is None:
        return {
            "damage_field": None,
            "counts": {},
        }

    counts = {}

    for feature in data.get("features", []):
        value = feature.get("properties", {}).get(damage_field)

        if value is None:
            value = "UNKNOWN"

        value = str(value)

        counts[value] = counts.get(value, 0) + 1

    return {
        "damage_field": damage_field,
        "counts": counts,
    }


def main():
    print("=" * 70)
    print("AIQUAKE GEOSPATIAL DATA INSPECTION")
    print("=" * 70)

    if not DAMAGE_FILE.exists():
        print(f"\nERROR: Damage file not found:")
        print(DAMAGE_FILE)
        return

    if not BUILDING_FILE.exists():
        print(f"\nERROR: Building file not found:")
        print(BUILDING_FILE)
        return

    damage_data = load_geojson(DAMAGE_FILE)
    building_data = load_geojson(BUILDING_FILE)

    damage_features = damage_data.get("features", [])
    building_features = building_data.get("features", [])

    damage_bbox = collection_bbox(damage_data)
    building_bbox = collection_bbox(building_data)

    damage_fields = get_property_fields(damage_data)
    building_fields = get_property_fields(building_data)

    damage_info = calculate_damage_counts(damage_data)

    print("\nDAMAGE DATA")
    print("-" * 70)
    print("Features:", len(damage_features))
    print("Geometry type:", damage_data.get("type"))
    print("Calculated geographic BBOX:", damage_bbox)
    print("Property fields:", damage_fields)

    print("\nDamage classification field:", damage_info["damage_field"])
    print("Damage counts:")

    for damage_class, count in damage_info["counts"].items():
        print(f"  {damage_class}: {count}")

    print("\nBUILDING DATA")
    print("-" * 70)
    print("Features:", len(building_features))
    print("Geometry type:", building_data.get("type"))
    print("Calculated geographic BBOX:", building_bbox)
    print("Property fields:", building_fields)

    first_damage = (
        damage_features[0].get("properties", {})
        if damage_features
        else {}
    )

    first_building = (
        building_features[0].get("properties", {})
        if building_features
        else {}
    )

    print("\nFIRST DAMAGE FEATURE PROPERTIES")
    print("-" * 70)
    print(json.dumps(first_damage, indent=2, ensure_ascii=False))

    print("\nFIRST BUILDING FEATURE PROPERTIES")
    print("-" * 70)
    print(json.dumps(first_building, indent=2, ensure_ascii=False))

    summary = {
        "project": "AIQuake",
        "area": "Caraballeda",
        "damage_data": {
            "file": str(DAMAGE_FILE),
            "feature_count": len(damage_features),
            "bbox": damage_bbox,
            "property_fields": damage_fields,
            "damage_field": damage_info["damage_field"],
            "damage_counts": damage_info["counts"],
        },
        "building_data": {
            "file": str(BUILDING_FILE),
            "feature_count": len(building_features),
            "bbox": building_bbox,
            "property_fields": building_fields,
        },
        "geospatial_relationship": {
            "coordinate_system": "GeoJSON geographic coordinates",
            "bbox_format": [
                "min_longitude",
                "min_latitude",
                "max_longitude",
                "max_latitude",
            ],
            "note": (
                "Bounds were calculated directly from the feature "
                "geometries. They are not inferred from image dimensions."
            ),
        },
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as file:
        json.dump(summary, file, indent=2, ensure_ascii=False)

    print("\n" + "=" * 70)
    print("INSPECTION COMPLETE")
    print("=" * 70)
    print("\nSummary saved to:")
    print(OUTPUT_FILE)


if __name__ == "__main__":
    main()
