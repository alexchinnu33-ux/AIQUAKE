# AIQuake — AI earthquake damage assessment & rescue planning

**Case study:** the 24 June 2026 Venezuela earthquake, **Caraballeda** — 5,366 real
buildings with an AI damage class each, real OpenStreetMap roads and hospitals.

AIQuake turns damage data into a rescue map: people at risk → ranked rescue zones →
road routes for each rescue team. Field photos are classified by an AI model and
update the plan live.

## The app flow

1. **Landing page** (`/`, public) — live worldwide earthquakes, how it works, the AI's measured
   accuracy, the Caraballeda case study on real satellite imagery. **Log in / Get started** is top right.
2. **Log in** → you land on **New Incident**: pick a location, pick the earthquake, add photos if you
   have them, get a rescue report.
3. That incident becomes the **active incident**: the bar under the menu shows it, and
   *Mission Control*, *Damage Map*, *Rescue Planner* and *History* all switch to it.
   **Clear** (or log out) goes back to the Caraballeda demo with real assessed damage.

## Model files

- `ai/models/earthquake_classifier.pth` (Model 1, photo classifier) is in the repository.
- `ai/models/building_damage/model.onnx` (Model 2, satellite pair) is **1.3 GB** and is *not* in git
  (GitHub's limit is 100 MB). Copy it to that path yourself. Without it the backend still starts for
  every feature except the experimental satellite-pair analysis, which then reports an error.

## Quick start (Windows)

1. Make sure the PostgreSQL database in `backend/.env` is running (see `backend/.env.example`).
2. Double-click **`start.bat`** (opens the API and the website).
3. Open **http://localhost:5173**, click **Register**, create an account, log in.

Manual start:

```powershell
cd backend ; ..\venv\Scripts\python.exe -m uvicorn app:app --port 8000     # terminal 1
cd frontend ; npm install ; npm run dev                                     # terminal 2
```

First-time setup: `python -m venv venv`, `venv\Scripts\activate`, `pip install -r backend/requirements.txt`.
Docker alternative: `docker compose up --build` (untested).

## Any earthquake, anywhere: the **New Incident** wizard

1. **Location** — search a place or click the world map (quick picks: Caraballeda, Gaziantep,
   Port-au-Prince, Kathmandu, Sendai, Palu, Mexico City, Christchurch, L'Aquila ...).
2. **Earthquake** — past earthquakes within 300 km (USGS), a statistical risk estimate
   (hazard level, chance of M6+/M7+ in 10 years), weather, nearest hospitals / fire stations /
   police / helipads / shelters, and the details of the quake you pick: magnitude, depth,
   intensity, felt reports, tsunami flag, USGS PAGER alert and people exposed per shaking level.
3. **Imagery** — either *modelled damage* from the quake's USGS ShakeMap (recommended, worldwide)
   or your own *before/after photos* of the region (experimental Model 2, needs the image bounds).
4. **Report** — damage map, people at risk, ranked rescue zones, team routes with ETAs,
   rescue support list. Change the team count or day/night and it recomputes.

**Honest limits:** earthquakes cannot be predicted in time — the "risk estimate" only summarises how
often earthquakes happened nearby in the past. Modelled damage = ShakeMap shaking + a generic
fragility table (see `FRAGILITY` in `backend/region.py`), not an observation. It needs the quake to
have a ShakeMap (usually M5.5+). The first run for a new city downloads OpenStreetMap data (can take
1–2 minutes, cached afterwards). Only Caraballeda has real assessed damage.

Free key-less data sources used: USGS Earthquake Catalog / ShakeMap / PAGER, OpenStreetMap
(Overpass + Nominatim), Open-Meteo. No API key is needed.

## Demo walkthrough (5 minutes)

| # | Page | What to do / show |
|---|------|-------------------|
| 0 | **New Incident** | Pick any place + earthquake and get a rescue report (see above). |
| 1 | **Mission Control** | The landing page. Incident summary, the 5-step pipeline, map with priority zones and team routes, top-5 priorities. |
| 2 | **Damage Map** | 5,366 buildings coloured by damage. Toggle classes; switch to the satellite basemap. |
| 3 | **Rescue Planner** | Change team count / night vs day / base. Click a zone to see trapped, displaced and nearest hospital. Export CSV/JSON. |
| 4 | **Rescue Planner → Field photo report** | Click a building on the map, then press **Collapsed** (a real sample photo) or upload your own. Model 1 classifies it; the building changes colour and the whole plan recomputes. **RESET** undoes it. |
| 5 | **History** | Earthquakes of previous years: filter by years / magnitude, live USGS data or the offline archive of famous events. |
| 6 | **Model** | Model 1 accuracy 81.1 % on 2,475 unseen test images, per-class precision/recall, confusion matrix. |
| 7 | **Photo Classifier** | The original upload-and-classify page with your prediction history. |

## How it works

1. **Damage data** — each building has a class: no / minor / major damage or destroyed
   (HOTOSM fAIr assessment of post-event imagery).
2. **Field photos** — Model 1 (EfficientNet-B0) labels a photo Collapsed / Damaged / Intact
   (→ destroyed / major / none). Results under 60 % confidence are logged but not applied.
3. **People** — footprint × 1.5 floors ÷ 30 m² per person, × time of day (night 90 %, day 55 %).
4. **Trapped / displaced** — 30 % / 6 % of occupants trapped in destroyed / major-damage
   buildings; displaced 100 / 75 / 10 % for destroyed / major / minor.
5. **Priority** — buildings grouped in ~220 m cells; score = 3 × trapped + 0.5 × displaced;
   tiers CRITICAL / HIGH / MEDIUM / LOW.
6. **Routes** — OSM road graph with Dijkstra; roads within 20 m of a destroyed/major building
   are 2.5× slower (debris). Zones go most-urgent-first to the team that can arrive soonest.

All constants are at the top of `backend/rescue.py`.

## What is real and what is not

- **Real:** building footprints, damage assessment, roads/hospitals (OpenStreetMap), earthquake
  catalogue (USGS), Model 1 test accuracy.
- **Estimated:** people / trapped / displaced counts (planning ratios, not casualty counts).
- **Experimental:** *Model 2* (satellite pre/post pair → damage regions, `POST /rescue/analyze`) is
  **not validated**. In testing it flagged ~13 % of pixels as "destroyed" even when given two
  identical images, so do not rely on it. The real post-event satellite tiles could not be
  downloaded (the Planet/OpenAerialMap tile service returns HTTP 500), and the post-event images
  saved in `ai/model2/real_samples/paired_samples/` are blank.
- Model 1 was trained on drone photos of collapsed buildings; it has not been tested on
  Caraballeda photos.

## API (see http://localhost:8000/docs)

`GET /rescue/plan` · `GET /gis/buildings` · `GET /incident/info` · `GET /incident/reports` ·
`POST /incident/report` (login) · `DELETE /incident/reports` (login) · `GET /model/metrics` ·
`GET /region/geocode` · `GET /region/intel` · `GET /region/support` · `GET /region/event/{id}` ·
`GET /region/scenario` · `GET /earthquakes/history` · `POST /predict` (login) · `POST /rescue/analyze` (experimental)

## Project layout

- `backend/` FastAPI: `rescue.py` (planning engine), `incident.py` (field reports),
  `history_routes.py`, `model_routes.py`, `app.py`
- `frontend/` React + Vite + Leaflet (`src/pages/`)
- `ai/` datasets, notebooks, training, `models/` (Model 1 `.pth`, Model 2 `.onnx`, metrics JSON)
- `gis/venezuela/caraballeda/` buildings, damage GeoJSON, cached OSM roads/facilities
- `tests/` pytest (`pytest tests -q`, 15 tests)

Regenerate Model 1 metrics: `python ai/training/export_metrics.py`

## Data sources

Caraballeda damage assessment: HOTOSM fAIr / MapSwipe · Roads & facilities: OpenStreetMap (ODbL) ·
Earthquake catalogue: USGS · Pre-event reference imagery: Esri World Imagery.

## Limitations

- The rescue plan is built for Caraballeda only (the one area with full data).
- `/gis`, `/rescue`, `/earthquakes` and `/model` endpoints are public and read-only; photo reports,
  predictions and history need a login.
- Archive fatality figures are rounded, widely cited estimates.
