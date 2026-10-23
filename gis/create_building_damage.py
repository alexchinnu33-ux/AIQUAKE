import os
import geopandas as gpd

# --------------------------------------------------
# INPUT FILES
# --------------------------------------------------

building_path = (
    r".\gis\venezuela\caraballeda\buildings"
    r"\caraballeda_buildings_polygons.geojson"
)

damage_path = (
    r".\gis\venezuela\caraballeda\damage_assessment\fair"
    r"\caraballeda_damage_polygons.geojson"
)

# --------------------------------------------------
# OUTPUT
# --------------------------------------------------

output_dir = r".\gis\venezuela\caraballeda\output"
os.makedirs(output_dir, exist_ok=True)

output_path = os.path.join(
    output_dir,
    "caraballeda_building_damage.geojson"
)

# --------------------------------------------------
# LOAD DATA
# --------------------------------------------------

print("Loading building polygons...")
buildings = gpd.read_file(building_path)

print("Loading damage polygons...")
damage = gpd.read_file(damage_path)

print("Buildings:", len(buildings))
print("Damage polygons:", len(damage))

# --------------------------------------------------
# MAKE SURE CRS MATCHES
# --------------------------------------------------

if buildings.crs != damage.crs:
    print("CRS differs. Reprojecting damage layer...")
    damage = damage.to_crs(buildings.crs)

# --------------------------------------------------
# SPATIAL JOIN
# --------------------------------------------------

print("Performing spatial intersection...")

joined = gpd.sjoin(
    buildings,
    damage,
    how="left",
    predicate="intersects"
)

print("Spatial join rows:", len(joined))

# --------------------------------------------------
# DAMAGE SEVERITY
# --------------------------------------------------

severity = {
    "no-damage": 0,
    "minor-damage": 1,
    "major-damage": 2,
    "destroyed": 3
}

reverse_severity = {
    0: "no-damage",
    1: "minor-damage",
    2: "major-damage",
    3: "destroyed"
}

# --------------------------------------------------
# SELECT HIGHEST DAMAGE PER BUILDING
# --------------------------------------------------

print("Aggregating damage per building...")

records = []

for building_index, group in joined.groupby(level=0):

    building = buildings.loc[building_index]

    highest_severity = 0

    confidence = None

    probabilities = {
        "p_no_damage": None,
        "p_minor_damage": None,
        "p_major_damage": None,
        "p_destroyed": None
    }

    for _, row in group.iterrows():

        damage_label = row.get("damage")

        if damage_label in severity:

            current_severity = severity[damage_label]

            if current_severity > highest_severity:

                highest_severity = current_severity

                confidence = row.get("confidence")

                for key in probabilities:

                    if key in row.index:
                        probabilities[key] = row.get(key)

    record = {
        "building_id": str(building.get("id")),
        "damage_class": highest_severity,
        "damage": reverse_severity[highest_severity],
        "confidence": confidence,
        "p_no_damage": probabilities["p_no_damage"],
        "p_minor_damage": probabilities["p_minor_damage"],
        "p_major_damage": probabilities["p_major_damage"],
        "p_destroyed": probabilities["p_destroyed"],
        "geometry": building.geometry
    }

    records.append(record)

# --------------------------------------------------
# CREATE OUTPUT GEODATAFRAME
# --------------------------------------------------

result = gpd.GeoDataFrame(
    records,
    geometry="geometry",
    crs=buildings.crs
)

# --------------------------------------------------
# SAVE
# --------------------------------------------------

print("Saving building-level damage layer...")

result.to_file(
    output_path,
    driver="GeoJSON"
)

# --------------------------------------------------
# SUMMARY
# --------------------------------------------------

print()
print("========================================")
print("BUILDING DAMAGE LAYER CREATED")
print("========================================")

print("Total buildings:", len(result))

print()
print("Damage distribution:")

print(
    result["damage"].value_counts()
)

print()
print("Output file:")
print(output_path)

print()
print("========================================")
print("DONE")
print("========================================")