# AIQuake — project timeline

**Span:** 9 August 2026 – 24 October 2026 (about 11 weeks), plus a short plan for what remains.

> Reconstructed from file timestamps and git history, not from a work log. Weeks with no dated
> files are marked as gaps so they can be filled in truthfully (offline work, research, report
> writing, meetings). The **Owner** column is intentionally empty — add who actually did each item.

## What was built, week by week

| Week | Dates | Milestone | Evidence | Owner |
|------|-------|-----------|----------|-------|
| 1 | 9–15 Aug | Model 1 (EfficientNet-B0 photo classifier: Collapsed / Damaged / Intact) trained; FastAPI model service; Command Center page; **initial commit (14 Aug)** | `earthquake_classifier.pth` (9 Aug), `backend/model.py` (11 Aug), `CommandCenter.jsx` (13 Aug), commit `85dbdef7` | |
| 2 | 16–22 Aug | *No dated files found* | — | |
| 3 | 23–29 Aug | Accounts: registration, login, JWT authentication | `backend/auth.py` (25 Aug) | |
| 4–5 | 30 Aug – 12 Sep | *No dated files found* | — | |
| 6 | 13–19 Sep | Model 2 (ONNX building-damage model) added | `ai/models/building_damage/model.onnx` (18 Sep) | |
| 7 | 20–26 Sep | Caraballeda (2026 Venezuela earthquake) data pack: real buildings and assessed damage, GIS output; dashboard work; dataset and training notebooks | `real_samples/metadata.json`, `caraballeda_building_damage.geojson` (21 Sep), `Dashboard.jsx` (22 Sep), notebooks (23 Sep) | |
| 8–10 | 27 Sep – 17 Oct | *No dated files found* | — | |
| 11 | 18–24 Oct | Rescue engine (people at risk, ranked zones, multi-team routes); worldwide analysis (USGS history, risk statistics, ShakeMap damage model, nearby support); field-photo reports; Model 1 test metrics; redesigned UI and public landing page; tests, Docker files, README; pushed to GitHub (commit `ba15b65d`) | `rescue.py`, `region.py`, `Landing.jsx` (20 Oct), `model1_metrics.json` (20 Oct), 20 passing tests | |

## Milestones reached

| Date | Milestone |
|------|-----------|
| 9 Aug | First trained model |
| 14 Aug | Repository created |
| 25 Aug | User accounts working |
| 21 Sep | Real earthquake data (Caraballeda) integrated |
| 20 Oct | Model 1 measured on 2,475 unseen images: 81.1 % accuracy |
| 23 Oct | End-to-end flow: any location → earthquake → damage → priorities → routes |

## Plan for the remaining time (suggested, not yet done)

| When | Task |
|------|------|
| 25–28 Oct | Run the Caraballeda check of modelled vs real damage (`gis/validate_modelled_damage.py`) once OpenStreetMap's server is available; record the numbers |
| 25–28 Oct | Pre-load the demo cities (Gaziantep, Caraballeda and two more) so the demo works without waiting on OpenStreetMap |
| 29 Oct – 1 Nov | Put the new `/rescue` and `/region` endpoints behind login; replace the unvalidated Model 2 flow or label it clearly |
| 2–5 Nov | Add screenshots or a short demo video to the README; write the final report using the "What is real / estimated / experimental" sections |
| 6–7 Nov | Full rehearsal on a clean machine (`docker compose up --build` is untested), fix anything that breaks |

## Known limitations to state in the report

- Earthquakes are not predicted; risk figures are statistics of past rates.
- Outside Caraballeda, damage is modelled from USGS shaking and a generic vulnerability table.
- Model 2 is not validated and produced false positives on identical images.
- Model 1 was trained on drone photos of collapsed buildings and is wrong about roughly one collapsed building in five.
- Real post-event satellite imagery of Caraballeda could not be downloaded.
