import json
import math
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import APIRouter, HTTPException, Query


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/earthquakes",
    tags=["Earthquake Intelligence"]
)


# ============================================================
# EXTERNAL SERVICES
# ============================================================

USGS_URL = (
    "https://earthquake.usgs.gov/"
    "fdsnws/event/1/query"
)

OVERPASS_URL = (
    "https://overpass-api.de/api/interpreter"
)


# ============================================================
# DISTANCE
# ============================================================

def calculate_distance_km(
    lat1,
    lon1,
    lat2,
    lon2
):

    earth_radius = 6371.0

    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)

    delta_lat = math.radians(
        lat2 - lat1
    )

    delta_lon = math.radians(
        lon2 - lon1
    )

    a = (
        math.sin(delta_lat / 2) ** 2
        +
        math.cos(lat1_rad)
        *
        math.cos(lat2_rad)
        *
        math.sin(delta_lon / 2) ** 2
    )

    c = (
        2
        *
        math.atan2(
            math.sqrt(a),
            math.sqrt(1 - a)
        )
    )

    return round(
        earth_radius * c,
        2
    )


# ============================================================
# USGS HISTORICAL EARTHQUAKES
# ============================================================

def fetch_usgs_events(
    latitude,
    longitude,
    radius_km,
    years,
    min_magnitude
):

    end_time = datetime.now(
        timezone.utc
    )

    start_time = (
        end_time
        -
        timedelta(
            days=365 * years
        )
    )

    params = {

        "format": "geojson",

        "eventtype": "earthquake",

        "latitude": latitude,

        "longitude": longitude,

        "maxradiuskm": radius_km,

        "starttime":
            start_time.isoformat(),

        "endtime":
            end_time.isoformat(),

        "orderby": "time",

        "limit": 2000
    }

    if min_magnitude is not None:

        params[
            "minmagnitude"
        ] = min_magnitude

    url = (
        USGS_URL
        +
        "?"
        +
        urlencode(params)
    )

    request = Request(
        url,
        headers={
            "User-Agent":
                "GROUNDTRUTH-AIQuake/1.0"
        }
    )

    try:

        with urlopen(
            request,
            timeout=20
        ) as response:

            raw_data = response.read()

            return json.loads(
                raw_data
            )

    except HTTPError as error:

        raise HTTPException(
            status_code=502,
            detail=(
                "USGS returned "
                f"HTTP {error.code}"
            )
        )

    except URLError:

        raise HTTPException(
            status_code=502,
            detail=(
                "Unable to connect "
                "to USGS"
            )
        )

    except Exception as error:

        print(
            "USGS error:",
            error
        )

        raise HTTPException(
            status_code=502,
            detail=(
                "Unable to retrieve "
                "earthquake data"
            )
        )


# ============================================================
# OSM / OVERPASS
# ============================================================

def fetch_osm_services(
    latitude,
    longitude,
    radius_km
):

    radius_m = int(
        radius_km * 1000
    )

    query = f"""
    [out:json][timeout:60];

    (
      nwr[
        amenity=police
      ](
        around:{radius_m},
        {latitude},
        {longitude}
      );

      nwr[
        amenity=hospital
      ](
        around:{radius_m},
        {latitude},
        {longitude}
      );

      nwr[
        amenity=fire_station
      ](
        around:{radius_m},
        {latitude},
        {longitude}
      );

      nwr[
        amenity=clinic
      ](
        around:{radius_m},
        {latitude},
        {longitude}
      );

      nwr[
        emergency=ambulance_station
      ](
        around:{radius_m},
        {latitude},
        {longitude}
      );

      nwr[
        leisure=park
      ](
        around:{radius_m},
        {latitude},
        {longitude}
      );

      nwr[
        leisure=pitch
      ](
        around:{radius_m},
        {latitude},
        {longitude}
      );
    );

    out center tags;
    """

    request = Request(
        OVERPASS_URL,
        data=query.encode(
            "utf-8"
        ),
        headers={
            "Content-Type":
                "application/x-www-form-urlencoded",
            "User-Agent":
                "GROUNDTRUTH-AIQuake/1.0"
        }
    )

    try:

        with urlopen(
            request,
            timeout=90
        ) as response:

            raw_data = response.read()

            return json.loads(
                raw_data
            )

    except HTTPError as error:

        raise HTTPException(
            status_code=502,
            detail=(
                "OpenStreetMap "
                f"Overpass returned HTTP {error.code}"
            )
        )

    except URLError:

        raise HTTPException(
            status_code=502,
            detail=(
                "Unable to connect "
                "to OpenStreetMap services"
            )
        )

    except Exception as error:

        print(
            "Overpass error:",
            error
        )

        raise HTTPException(
            status_code=502,
            detail=(
                "Unable to retrieve "
                "map service data"
            )
        )


# ============================================================
# NORMALIZE OSM ELEMENT
# ============================================================

def normalize_osm_element(
    element,
    earthquake_lat,
    earthquake_lon
):

    tags = element.get(
        "tags",
        {}
    )

    center = element.get(
        "center"
    )

    if center:

        lat = center.get(
            "lat"
        )

        lon = center.get(
            "lon"
        )

    else:

        lat = element.get(
            "lat"
        )

        lon = element.get(
            "lon"
        )

    if lat is None or lon is None:

        return None

    amenity = tags.get(
        "amenity"
    )

    leisure = tags.get(
        "leisure"
    )

    emergency = tags.get(
        "emergency"
    )


    # --------------------------------------------------------
    # TYPE
    # --------------------------------------------------------

    if amenity == "police":

        service_type = "police"

    elif amenity == "hospital":

        service_type = "hospital"

    elif amenity == "fire_station":

        service_type = "fire"

    elif amenity == "clinic":

        service_type = "clinic"

    elif emergency == "ambulance_station":

        service_type = "ambulance"

    elif leisure == "park":

        service_type = "open_area"

    elif leisure == "pitch":

        service_type = "open_area"

    else:

        service_type = "other"


    name = tags.get(
        "name"
    )

    if not name:

        name = (
            service_type
            .replace(
                "_",
                " "
            )
            .title()
        )


    distance = calculate_distance_km(
        earthquake_lat,
        earthquake_lon,
        float(lat),
        float(lon)
    )


    return {

        "osm_id":
            element.get(
                "id"
            ),

        "name":
            name,

        "type":
            service_type,

        "latitude":
            float(lat),

        "longitude":
            float(lon),

        "distance_km":
            distance,

        "phone":
            tags.get(
                "phone"
            ),

        "website":
            tags.get(
                "website"
            ),

        "address":
            tags.get(
                "addr:street"
            ),

        "source":
            "OpenStreetMap"

    }


# ============================================================
# EMERGENCY MAP
# ============================================================

@router.get("/map")
def get_emergency_map(

    latitude: float = Query(
        ...,
        ge=-90,
        le=90
    ),

    longitude: float = Query(
        ...,
        ge=-180,
        le=180
    ),

    radius_km: float = Query(
        25,
        gt=0,
        le=100
    ),

    years: int = Query(
        10,
        ge=1,
        le=100
    ),

    min_magnitude: float | None = Query(
        None,
        ge=-2,
        le=10
    )
):

    # ========================================================
    # EARTHQUAKE HISTORY
    # ========================================================

    usgs_data = fetch_usgs_events(

        latitude,

        longitude,

        radius_km,

        years,

        min_magnitude

    )


    earthquake_events = []


    for feature in usgs_data.get(
        "features",
        []
    ):

        properties = feature.get(
            "properties",
            {}
        )

        geometry = feature.get(
            "geometry",
            {}
        )

        coordinates = geometry.get(
            "coordinates",
            []
        )

        if len(coordinates) < 3:

            continue


        event_lon = coordinates[0]
        event_lat = coordinates[1]
        depth = coordinates[2]


        timestamp = properties.get(
            "time"
        )


        time_iso = None


        if timestamp:

            try:

                time_iso = (
                    datetime.fromtimestamp(
                        timestamp / 1000,
                        tz=timezone.utc
                    ).isoformat()
                )

            except Exception:

                pass


        distance = calculate_distance_km(

            latitude,

            longitude,

            event_lat,

            event_lon

        )


        earthquake_events.append({

            "id":
                feature.get(
                    "id"
                ),

            "magnitude":
                properties.get(
                    "mag"
                ),

            "place":
                properties.get(
                    "place"
                ),

            "latitude":
                event_lat,

            "longitude":
                event_lon,

            "depth_km":
                depth,

            "time":
                timestamp,

            "time_iso":
                time_iso,

            "distance_km":
                distance,

            "alert":
                properties.get(
                    "alert"
                ),

            "significance":
                properties.get(
                    "sig"
                ),

            "source":
                "USGS"

        })


    # ========================================================
    # OSM SERVICES
    # ========================================================

    osm_data = fetch_osm_services(

        latitude,

        longitude,

        radius_km

    )


    services = []


    for element in osm_data.get(
        "elements",
        []
    ):

        service = normalize_osm_element(

            element,

            latitude,

            longitude

        )

        if service:

            services.append(
                service
            )


    # ========================================================
    # SORT SERVICES
    # ========================================================

    services.sort(
        key=lambda item:
            item["distance_km"]
    )


    # ========================================================
    # SEPARATE SERVICES
    # ========================================================

    police = [
        item
        for item in services
        if item["type"] == "police"
    ]

    hospitals = [
        item
        for item in services
        if item["type"] in [
            "hospital",
            "clinic"
        ]
    ]

    fire = [
        item
        for item in services
        if item["type"] == "fire"
    ]

    ambulance = [
        item
        for item in services
        if item["type"] == "ambulance"
    ]

    open_areas = [
        item
        for item in services
        if item["type"] == "open_area"
    ]


    # ========================================================
    # RESPONSE
    # ========================================================

    return {

        "incident": {

            "latitude":
                latitude,

            "longitude":
                longitude,

            "radius_km":
                radius_km

        },

        "historical_earthquakes": {

            "count":
                len(
                    earthquake_events
                ),

            "events":
                earthquake_events

        },

        "emergency_services": {

            "police":
                police,

            "hospitals":
                hospitals,

            "fire_stations":
                fire,

            "ambulance_stations":
                ambulance,

            "candidate_open_areas":
                open_areas

        },

        "data_sources": [

            "USGS Earthquake Catalog",

            "OpenStreetMap / Overpass API"

        ],

        "important_note":
            (
                "Open areas are map-data candidates "
                "and must not be treated as verified "
                "safe evacuation zones without "
                "official emergency assessment."
            )

    }