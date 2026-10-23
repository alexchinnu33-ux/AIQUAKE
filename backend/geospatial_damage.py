import base64
import io
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np
from PIL import Image


DAMAGE_CLASSES = {
    0: "No Damage",
    1: "Minor Damage",
    2: "Major Damage",
    3: "Destroyed",
}


def pixel_to_geo(
    x: float,
    y: float,
    width: int,
    height: int,
    west: float,
    south: float,
    east: float,
    north: float,
) -> Tuple[float, float]:
    """
    Convert an image pixel coordinate to longitude/latitude.

    This assumes the supplied image bounds are geographically
    aligned with the image.
    """

    longitude = west + (
        x / width
    ) * (east - west)

    latitude = north - (
        y / height
    ) * (north - south)

    return longitude, latitude


def polygon_pixel_to_geojson(
    contour,
    image_width: int,
    image_height: int,
    bounds: Dict[str, float],
):
    """
    Convert one OpenCV contour into a GeoJSON polygon.
    """

    west = bounds["west"]
    south = bounds["south"]
    east = bounds["east"]
    north = bounds["north"]

    coordinates = []

    for point in contour:

        x = float(point[0][0])
        y = float(point[0][1])

        longitude, latitude = pixel_to_geo(
            x,
            y,
            image_width,
            image_height,
            west,
            south,
            east,
            north,
        )

        coordinates.append(
            [longitude, latitude]
        )

    if len(coordinates) < 3:
        return None

    if coordinates[0] != coordinates[-1]:
        coordinates.append(coordinates[0])

    return [coordinates]


def damage_mask_to_geojson(
    damage_mask: np.ndarray,
    bounds: Dict[str, float],
    minimum_area: int = 25,
):
    """
    Convert a 2D damage-class mask into GeoJSON polygons.

    damage_mask values:

        0 = No Damage
        1 = Minor Damage
        2 = Major Damage
        3 = Destroyed
    """

    if damage_mask.ndim != 2:
        raise ValueError(
            "damage_mask must be a 2D array."
        )

    height, width = damage_mask.shape

    features: List[Dict] = []

    for class_id, class_name in DAMAGE_CLASSES.items():

        # Ignore No Damage when generating
        # damage regions.
        if class_id == 0:
            continue

        mask = np.where(
            damage_mask == class_id,
            255,
            0,
        ).astype(np.uint8)

        contours, _ = cv2.findContours(
            mask,
            cv2.RETR_EXTERNAL,
            cv2.CHAIN_APPROX_SIMPLE,
        )

        for contour in contours:

            area = cv2.contourArea(
                contour
            )

            if area < minimum_area:
                continue

            polygon = polygon_pixel_to_geojson(
                contour,
                width,
                height,
                bounds,
            )

            if polygon is None:
                continue

            features.append(
                {
                    "type": "Feature",
                    "properties": {
                        "damage_class": class_name,
                        "damage_class_id": class_id,
                        "pixel_area": float(area),
                        "source": "AIQuake Model 2",
                    },
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": polygon,
                    },
                }
            )

    return {
        "type": "FeatureCollection",
        "features": features,
    }