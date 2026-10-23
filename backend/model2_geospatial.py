import base64
import json
from pathlib import Path

import cv2
import numpy as np


DAMAGE_CLASSES = {
    0: "no-damage",
    1: "minor-damage",
    2: "major-damage",
    3: "destroyed",
}


def decode_mask(mask_data):
    """
    Decode a base64 PNG returned by Model 2.
    """

    if mask_data.startswith("data:image"):
        mask_data = mask_data.split(",", 1)[1]

    raw = base64.b64decode(mask_data)

    array = np.frombuffer(
        raw,
        dtype=np.uint8,
    )

    mask = cv2.imdecode(
        array,
        cv2.IMREAD_GRAYSCALE,
    )

    if mask is None:
        raise ValueError("Could not decode Model 2 damage mask.")

    return mask


def pixel_to_geo(
    x,
    y,
    width,
    height,
    west,
    south,
    east,
    north,
):
    """
    Convert a pixel coordinate to longitude/latitude
    using an explicitly supplied geographic extent.
    """

    longitude = (
        west
        + (x / width) * (east - west)
    )

    latitude = (
        north
        - (y / height) * (north - south)
    )

    return longitude, latitude


def contour_to_polygon(
    contour,
    width,
    height,
    bounds,
):
    """
    Convert an OpenCV contour from image pixels
    into a GeoJSON polygon.
    """

    west = bounds["west"]
    south = bounds["south"]
    east = bounds["east"]
    north = bounds["north"]

    points = contour.reshape(-1, 2)

    if len(points) < 3:
        return None

    coordinates = []

    for x, y in points:
        lon, lat = pixel_to_geo(
            float(x),
            float(y),
            width,
            height,
            west,
            south,
            east,
            north,
        )

        coordinates.append(
            [lon, lat]
        )

    if coordinates[0] != coordinates[-1]:
        coordinates.append(
            coordinates[0]
        )

    if len(coordinates) < 4:
        return None

    return coordinates


def damage_mask_to_geojson(
    mask,
    bounds,
    minimum_area_pixels=10,
):
    """
    Convert each predicted damage class into
    GeoJSON polygons.

    No-damage is intentionally omitted because
    the GIS layer is intended to represent
    damage areas.
    """

    height, width = mask.shape

    features = []

    for class_id in [1, 2, 3]:
        class_mask = (
            mask == class_id
        ).astype(np.uint8) * 255

        contours, _ = cv2.findContours(
            class_mask,
            cv2.RETR_EXTERNAL,
            cv2.CHAIN_APPROX_SIMPLE,
        )

        for contour in contours:
            area = cv2.contourArea(contour)

            if area < minimum_area_pixels:
                continue

            polygon = contour_to_polygon(
                contour,
                width,
                height,
                bounds,
            )

            if polygon is None:
                continue

            class_name = DAMAGE_CLASSES[class_id]

            feature = {
                "type": "Feature",
                "properties": {
                    "source": "AIQuake Model 2",
                    "damage_class": class_name,
                    "damage_class_id": class_id,
                    "pixel_area": round(
                        float(area),
                        2,
                    ),
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        polygon
                    ],
                },
            }

            features.append(feature)

    return {
        "type": "FeatureCollection",
        "features": features,
    }


def save_geojson(
    geojson,
    output_path,
):
    output_path = Path(output_path)

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with open(
        output_path,
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            geojson,
            file,
            indent=2,
        )

    return output_path