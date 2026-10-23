import geopandas as gpd

building_path = r".\gis\venezuela\caraballeda\buildings\caraballeda_buildings_polygons.geojson"
damage_path = r".\gis\venezuela\caraballeda\damage_assessment\fair\caraballeda_damage_polygons.geojson"

print("Loading building polygons...")
buildings = gpd.read_file(building_path)

print("Loading damage polygons...")
damage = gpd.read_file(damage_path)

print()
print("===== BASIC DATA =====")
print("Building features:", len(buildings))
print("Damage features:", len(damage))
print("Building CRS:", buildings.crs)
print("Damage CRS:", damage.crs)

print()
print("===== SPATIAL JOIN =====")

joined = gpd.sjoin(
    buildings,
    damage,
    how="left",
    predicate="intersects"
)

print("Spatial join rows:", len(joined))

matched_buildings = joined.index.nunique()

print(
    "Buildings with at least one intersecting damage polygon:",
    matched_buildings
)

print(
    "Buildings with no match:",
    len(buildings) - matched_buildings
)

multiple_matches = (
    joined.groupby(level=0).size() > 1
).sum()

print(
    "Buildings with multiple matches:",
    multiple_matches
)

print()
print("===== ID CHECK =====")

id_matches = (
    buildings["id"].astype(str).isin(
        damage["id"].astype(str)
    )
).sum()

print("ID matches:", id_matches)

print()
print("===== DAMAGE CLASSES FOUND =====")

if "damage" in joined.columns:
    print(joined["damage"].value_counts(dropna=False))

print()
print("===== VALIDATION COMPLETE =====")