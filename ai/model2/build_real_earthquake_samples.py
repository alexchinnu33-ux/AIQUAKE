"""
AIQuake - Real Earthquake Sample Data Builder
==============================================

Builds a local sample-data pack from public 2026 Venezuela earthquake sources.

Sources used:
- HOTOSM / Humanitarian OpenStreetMap Team: Venezuela earthquake response
- HOTOSM Hugging Face dataset: hotosm/venezuela_eq_2026
- Caraballeda post-event SkySat imagery distributed through OpenAerialMap
- ESRI World Imagery as the pre-event reference noted by the HOT MapSwipe project

IMPORTANT:
- These are real remote-sensing / damage-assessment data, not synthetic images.
- Caraballeda post-event imagery is Planet SkySat (~0.5 m) and is CC BY-NC 4.0.
- ESRI World Imagery is used only as a pre-event reference image. Review Esri
  terms before redistributing it.
- HOTOSM damage predictions are candidate/assessment data, not a guarantee of
  ground truth. Keep source/attribution metadata with the samples.

Run from the AIQuake project root:
    python ai/model2/build_real_earthquake_samples.py
"""

from pathlib import Path
import json
import math
import shutil
import time

import requests
from PIL import Image
from huggingface_hub import hf_hub_download


PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUT = PROJECT_ROOT / "ai" / "model2" / "real_samples"

OUT.mkdir(parents=True, exist_ok=True)

# Caraballeda AOI from HOTOSM.
MIN_LON = -66.88000
MIN_LAT = 10.59500
MAX_LON = -66.79000
MAX_LAT = 10.63500

HF_REPO = "hotosm/venezuela_eq_2026"

OAM_POST_TMS = (
    "https://tiles.openaerialmap.org/"
    "6a41b0d3b27aa6a12ba69d3/"
    "0/6a41b0d3b27aa6a12ba69d3f/"
    "{z}/{x}/{y}"
)

ESRI_TILE = (
    "https://server.arcgisonline.com/"
    "ArcGIS/rest/services/World_Imagery/MapServer/"
    "tile/{z}/{y}/{x}"
)


def download_hf(filename: str, destination: Path) -> Path:
    print(f"Downloading HOTOSM file: {filename}")

    cached = hf_hub_download(
        repo_id=HF_REPO,
        repo_type="dataset",
        filename=filename,
    )

    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(cached, destination)

    print(f"  -> {destination}")
    return destination


def lonlat_to_tile(lon: float, lat: float, zoom: int):
    n = 2 ** zoom

    x = (lon + 180.0) / 360.0 * n

    lat_rad = math.radians(lat)
    y = (
        1.0
        - math.asinh(math.tan(lat_rad)) / math.pi
    ) / 2.0 * n

    return x, y


def download_tile(url: str, destination: Path):
    if destination.exists():
        return True

    try:
        response = requests.get(
            url,
            timeout=30,
        )

        if response.status_code != 200:
            print(
                f"Tile failed: {response.status_code} {url}"
            )
            return False

        destination.write_bytes(
            response.content
        )

        return True

    except Exception as exc:
        print(f"Tile error: {exc}")
        return False


def build_mosaic(
    tile_template: str,
    zoom: int,
    output_path: Path,
    label: str,
):
    """
    Download tiles covering the complete Caraballeda AOI and
    mosaic them into one image.
    """

    print()
    print(f"Building {label} mosaic at zoom {zoom}")

    min_x, max_y = lonlat_to_tile(
        MIN_LON,
        MIN_LAT,
        zoom,
    )

    max_x, min_y = lonlat_to_tile(
        MAX_LON,
        MAX_LAT,
        zoom,
    )

    x0 = math.floor(min_x)
    x1 = math.floor(max_x)

    y0 = math.floor(min_y)
    y1 = math.floor(max_y)

    width_tiles = x1 - x0 + 1
    height_tiles = y1 - y0 + 1

    print(
        f"Tiles: {width_tiles} x {height_tiles} "
        f"= {width_tiles * height_tiles}"
    )

    tile_dir = OUT / "tiles" / label
    tile_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    tile_size = 256

    mosaic = Image.new(
        "RGB",
        (
            width_tiles * tile_size,
            height_tiles * tile_size,
        ),
    )

    downloaded = 0
    failed = 0

    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):

            tile_path = (
                tile_dir
                / f"{zoom}_{x}_{y}.jpg"
            )

            url = tile_template.format(
                z=zoom,
                x=x,
                y=y,
            )

            if download_tile(
                url,
                tile_path,
            ):
                try:
                    tile = Image.open(
                        tile_path
                    ).convert("RGB")

                    px = (x - x0) * tile_size
                    py = (y - y0) * tile_size

                    mosaic.paste(
                        tile,
                        (px, py),
                    )

                    downloaded += 1

                except Exception as exc:
                    print(
                        f"Unable to read tile: {exc}"
                    )
                    failed += 1
            else:
                failed += 1

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    mosaic.save(
        output_path,
        quality=92,
    )

    print(
        f"{label} mosaic saved: {output_path}"
    )
    print(
        f"Downloaded: {downloaded}; failed: {failed}"
    )

    return output_path


def make_metadata():
    metadata = {
        "project": "AIQuake",
        "scenario": "2026 Venezuela earthquake",
        "area": "Caraballeda",
        "aoi_bbox": [
            MIN_LON,
            MIN_LAT,
            MAX_LON,
            MAX_LAT,
        ],
        "event_date": "2026-06-24",
        "post_event_scene": "SkySat 20260627_112621_ssc2_u0002",
        "post_event_resolution": "~0.5 m orthorectified",
        "post_event_source": "Planet Labs PBC / OpenAerialMap",
        "post_event_license": "CC BY-NC 4.0",
        "pre_event_reference": (
            "ESRI World Imagery, as used as the pre-event "
            "reference in the HOT MapSwipe Caraballeda project"
        ),
        "damage_data": (
            "HOTOSM fAIr building-level damage assessment"
        ),
        "damage_data_note": (
            "Assessment/candidate data; not a substitute "
            "for ground verification."
        ),
        "sources": [
            "https://hotosm.org/en/projects/2026-venezuela-earthquake-response/",
            "https://huggingface.co/datasets/hotosm/venezuela_eq_2026",
            "https://mapswipe.org/es/projects/01KXFVZTTJ21EYQ5TVHHJRQQYT/",
        ],
        "created_utc": time.strftime(
            "%Y-%m-%dT%H:%M:%SZ",
            time.gmtime(),
        ),
    }

    path = OUT / "metadata.json"

    path.write_text(
        json.dumps(
            metadata,
            indent=2,
        ),
        encoding="utf-8",
    )

    return path


def create_damage_map_html():
    """
    Create an interactive local HTML map from the downloaded
    Caraballeda damage polygons.

    It uses OpenStreetMap tiles while online and embeds the
    damage GeoJSON in the HTML.
    """

    damage_path = (
        OUT
        / "damage_assessment"
        / "caraballeda_damage_polygons.geojson"
    )

    if not damage_path.exists():
        print(
            "Damage polygons not found; skipping HTML map."
        )
        return

    html_path = OUT / "caraballeda_damage_map.html"

    data = damage_path.read_text(
        encoding="utf-8"
    )

    # Lightweight standalone Leaflet page.
    html = f"""<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>AIQuake - Caraballeda Earthquake Damage Map</title>
<link rel="stylesheet"
 href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
html, body, #map {{
    height: 100%;
    margin: 0;
}}
#title {{
    position: absolute;
    z-index: 1000;
    top: 10px;
    left: 50px;
    padding: 10px 14px;
    background: rgba(0,0,0,.82);
    color: white;
    font-family: Arial, sans-serif;
    border-radius: 5px;
}}
</style>
</head>
<body>
<div id="title">
AIQuake — Caraballeda earthquake damage assessment
</div>
<div id="map"></div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const damageData = {data};

const map = L.map("map").setView(
    [10.608, -66.847],
    14
);

L.tileLayer(
    "https://{{s}}.tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png",
    {{
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
    }}
).addTo(map);

function colorForDamage(damage) {{
    if (damage === "destroyed") return "#ef4444";
    if (damage === "major-damage") return "#f97316";
    if (damage === "minor-damage") return "#eab308";
    return "#22c55e";
}}

L.geoJSON(
    damageData,
    {{
        style: function(feature) {{
            const damage =
                feature.properties?.damage || "no-damage";

            return {{
                color: colorForDamage(damage),
                weight: 1,
                fillOpacity: 0.65
            }};
        }},
        onEachFeature: function(feature, layer) {{
            const p = feature.properties || {{}};

            layer.bindPopup(
                "<b>Damage:</b> " +
                (p.damage || "unknown") +
                "<br><b>Confidence:</b> " +
                (p.confidence ?? "n/a")
            );
        }}
    }}
).addTo(map);
</script>
</body>
</html>
"""

    html_path.write_text(
        html,
        encoding="utf-8",
    )

    print(
        f"Interactive damage map: {html_path}"
    )



def make_damage_crop_pairs():
    """
    Create several real pre/post sample pairs around representative
    damaged locations from the HOTOSM Caraballeda damage polygons.

    The pair is geographically matched by using the same XYZ tile window
    for the pre-event reference and post-event imagery.

    Because the sources have different sensors/acquisition dates, these
    are geographic reference pairs for the prototype and should not be
    treated as perfectly co-registered training labels.
    """
    try:
        import geopandas as gpd
    except ImportError:
        print(
            "geopandas is required for damage crop pairs; skipping."
        )
        return

    damage_path = (
        OUT
        / "damage_assessment"
        / "caraballeda_damage_polygons.geojson"
    )

    if not damage_path.exists():
        print(
            "Damage polygons not found; skipping crop pairs."
        )
        return

    gdf = gpd.read_file(damage_path)

    selected = []

    # Prefer one example from each meaningful damage class.
    for damage_class in [
        "destroyed",
        "major-damage",
        "minor-damage",
    ]:
        rows = gdf[
            gdf["damage"].astype(str) == damage_class
        ]

        if len(rows) > 0:
            selected.append(
                rows.iloc[0]
            )

    if not selected:
        print(
            "No damage examples found; skipping crop pairs."
        )
        return

    pair_root = (
        OUT / "paired_samples"
    )
    pair_root.mkdir(
        parents=True,
        exist_ok=True,
    )

    zoom = 18
    tile_size = 256
    radius = 1  # 3x3 tile crop

    for index, row in enumerate(selected, start=1):

        point = row.geometry.centroid

        lon = float(point.x)
        lat = float(point.y)

        px, py = lonlat_to_tile(
            lon,
            lat,
            zoom,
        )

        center_x = math.floor(px)
        center_y = math.floor(py)

        x_start = center_x - radius
        y_start = center_y - radius
        x_end = center_x + radius
        y_end = center_y + radius

        crop_size = (
            (radius * 2 + 1)
            * tile_size
        )

        pre_mosaic = Image.new(
            "RGB",
            (crop_size, crop_size),
        )

        post_mosaic = Image.new(
            "RGB",
            (crop_size, crop_size),
        )

        for x in range(
            x_start,
            x_end + 1,
        ):
            for y in range(
                y_start,
                y_end + 1,
            ):
                col = x - x_start
                row_index = y - y_start

                pre_path = (
                    OUT
                    / "tiles"
                    / "pre_esri"
                    / f"{zoom}_{x}_{y}.jpg"
                )

                post_path = (
                    OUT
                    / "tiles"
                    / "post_oam"
                    / f"{zoom}_{x}_{y}.jpg"
                )

                pre_url = ESRI_TILE.format(
                    z=zoom,
                    x=x,
                    y=y,
                )

                post_url = OAM_POST_TMS.format(
                    z=zoom,
                    x=x,
                    y=y,
                )

                download_tile(
                    pre_url,
                    pre_path,
                )

                download_tile(
                    post_url,
                    post_path,
                )

                if pre_path.exists():
                    try:
                        pre_tile = Image.open(
                            pre_path
                        ).convert("RGB")

                        pre_mosaic.paste(
                            pre_tile,
                            (
                                col * tile_size,
                                row_index * tile_size,
                            ),
                        )
                    except Exception:
                        pass

                if post_path.exists():
                    try:
                        post_tile = Image.open(
                            post_path
                        ).convert("RGB")

                        post_mosaic.paste(
                            post_tile,
                            (
                                col * tile_size,
                                row_index * tile_size,
                            ),
                        )
                    except Exception:
                        pass

        damage_name = str(
            row.get(
                "damage",
                "unknown",
            )
        ).replace(
            " ",
            "_",
        )

        pair_dir = (
            pair_root
            / f"sample_{index:03d}_{damage_name}"
        )
        pair_dir.mkdir(
            parents=True,
            exist_ok=True,
        )

        pre_path = (
            pair_dir
            / "pre_reference.png"
        )

        post_path = (
            pair_dir
            / "post_event.png"
        )

        pre_mosaic.save(
            pre_path
        )

        post_mosaic.save(
            post_path
        )

        pair_metadata = {
            "sample": index,
            "damage_class_from_HOTOSM": str(
                row.get(
                    "damage",
                    "unknown",
                )
            ),
            "longitude": lon,
            "latitude": lat,
            "zoom": zoom,
            "source": (
                "HOTOSM Caraballeda damage polygon centroid"
            ),
            "pre_source": (
                "ESRI World Imagery reference"
            ),
            "post_source": (
                "OpenAerialMap / Planet SkySat"
            ),
            "warning": (
                "Pre and post sources are geographically matched "
                "reference imagery, not guaranteed pixel-perfect "
                "co-registration."
            ),
        }

        (
            pair_dir
            / "metadata.json"
        ).write_text(
            json.dumps(
                pair_metadata,
                indent=2,
            ),
            encoding="utf-8",
        )

        print(
            f"Created real sample pair {index}: "
            f"{damage_name} at {lat:.6f}, {lon:.6f}"
        )

def main():
    print("=" * 70)
    print("AIQuake REAL EARTHQUAKE SAMPLE DATA BUILDER")
    print("=" * 70)

    # -----------------------------------------------------
    # 1. Download real HOTOSM source data
    # -----------------------------------------------------

    download_hf(
        "caraballeda/aoi.geojson",
        OUT / "aoi.geojson",
    )

    download_hf(
        "caraballeda/viz/post_imagery.png",
        OUT / "post_event_full_area.png",
    )

    download_hf(
        "caraballeda/viz/damage_gallery.png",
        OUT / "damaged_area_examples.png",
    )

    download_hf(
        "caraballeda/buildings/caraballeda_buildings_polygons.geojson",
        OUT
        / "buildings"
        / "caraballeda_buildings_polygons.geojson",
    )

    download_hf(
        "caraballeda/damage_assessment/fair/caraballeda_damage_polygons.geojson",
        OUT
        / "damage_assessment"
        / "caraballeda_damage_polygons.geojson",
    )

    download_hf(
        "caraballeda/damage_assessment/combined/caraballeda_fair_microsoft_combined_damage_polygons.geojson",
        OUT
        / "damage_assessment"
        / "caraballeda_combined_damage_polygons.geojson",
    )

    # -----------------------------------------------------
    # 2. Build a full-area POST-event mosaic
    # -----------------------------------------------------

    build_mosaic(
        OAM_POST_TMS,
        zoom=16,
        output_path=(
            OUT
            / "post_event_full_area_mosaic.jpg"
        ),
        label="post_oam",
    )

    # -----------------------------------------------------
    # 3. Build a PRE-EVENT reference mosaic
    #
    # MapSwipe specifically documents ESRI World Imagery
    # as the pre-event reference for this Caraballeda
    # project.
    # -----------------------------------------------------

    build_mosaic(
        ESRI_TILE,
        zoom=16,
        output_path=(
            OUT
            / "pre_event_reference_mosaic.jpg"
        ),
        label="pre_esri",
    )

    # -----------------------------------------------------
    # 4. Representative real pre/post damage sample pairs
    # -----------------------------------------------------

    make_damage_crop_pairs()

    # -----------------------------------------------------
    # 5. Metadata
    # -----------------------------------------------------

    make_metadata()

    # -----------------------------------------------------
    # 6. Interactive whole-area damage map
    # -----------------------------------------------------

    create_damage_map_html()

    print()
    print("=" * 70)
    print("SAMPLE DATA BUILD COMPLETE")
    print("=" * 70)
    print(f"Output folder: {OUT}")
    print()
    print("Important:")
    print("- PRE is an ESRI World Imagery reference.")
    print("- POST is the 2026 SkySat/OAM event imagery.")
    print("- Damage polygons are HOTOSM fAIr assessment data.")
    print("- Keep metadata.json with the samples.")
    print("- Do not describe assessment polygons as guaranteed")
    print("  ground truth without field validation.")


if __name__ == "__main__":
    main()
