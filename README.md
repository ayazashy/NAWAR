# NAWAR GeoAI
**A Smart Multi-Season Crop Planning Platform for Farmers in Dry Regions**  
*NASA Space Apps Challenge 2026 - Built by **NAWAR Team***

> *"Helping dry lands bloom, one smart season at a time."*

---

## Overview
**NAWAR GeoAI** is a lightweight, bilingual (English / Arabic) web platform that converts **NASA POWER** climate data, soil type, and crop requirements into a clear **3-season crop rotation plan** for farmers across the Middle East and dry regions worldwide.

Instead of suggesting a single crop for a single season, NAWAR GeoAI plans **three consecutive seasons ahead**, compares **three distinct rotation strategies** (Water-Saving, High-Return, and Soil-Builder), and stress-tests the plan under **three climate scenarios** (`Baseline`, `+2°C Warming`, and `-20% Rainfall`) with a transparent confidence level.

---

## How It Works (7-Step Pipeline)
1. **Select Location**: Choose a country and agricultural sub-region across the Middle East & North Africa, or click anywhere on the interactive map to pin exact farm coordinates.
2. **Enter Farm Information**: Select the previous crop, soil type (`Sandy`, `Loamy`, `Clay`, `Saline/Calcareous`), starting season, and primary goal (`Save Water`, `Maximize Profit`, or `Improve Soil`).
3. **Fetch NASA Data**: Retrieves seasonal temperature (`T2M`, `T2M_MAX`, `T2M_MIN`), precipitation (`PRECTOTCORR`), and solar irradiance (`ALLSKY_SFC_SW_DWN`) from the **NASA POWER Agroclimatology API**.
4. **Score Crops**: Evaluates each crop in the database on seasonal climate fit, soil compatibility, water requirement, and the farmer's chosen priority.
5. **Build 3 Rotation Strategies**: Applies agronomic rotation rules-preventing consecutive crop family repetition and pairing heavy-feeding cereals with nitrogen-fixing legumes (`Fabaceae`).
6. **Present the Best 3-Season Plan**: Displays the recommended 3-season schedule with plain-language reasons, water needs (`mm`), risk levels, and estimated returns.
7. **Test Under Climate Scenarios**: Re-evaluates the 3-season rotation under `Baseline`, `+2°C Warming`, and `-20% Rainfall` scenarios and calculates a survival confidence score.

---

## NASA & Partner Resources Used
- **NASA POWER (Agroclimatology & Meteorological Data)**: [power.larc.nasa.gov](https://power.larc.nasa.gov/) - Live API integration for temperature, precipitation, and solar radiation.
- **NASA SMAP (Soil Moisture Active Passive)**: [earthdata.nasa.gov/smap](https://www.earthdata.nasa.gov/data/platforms/space-based-platforms/smap) - Phase 2 root-zone soil moisture integration.
- **NASA GPM & IMERG**: [gpm.nasa.gov/data](https://gpm.nasa.gov/data) - Precipitation rate and drought anomaly tracking.
- **Landsat & MODIS / VIIRS**: [lpdaac.usgs.gov](https://lpdaac.usgs.gov/products/) - Vegetation health (`NDVI`) and seasonal crop vigor.
- **FAO GAEZ**: [gaez.fao.org](https://gaez.fao.org/) - Global Agro-Ecological Zones suitability reference.

---

## Project Structure
```text
├── index.html                  # Main bilingual web application (EN default + AR RTL toggle)
├── css/
│   └── styles.css              # Responsive desktop & vertical phone layout styles
├── js/
│   ├── data.js                 # Middle East regions, crop database & EN/AR dictionary
│   ├── nasaPowerApi.js         # NASA POWER API client + regional agroclimatology fallback
│   ├── engine.js               # Rule-based crop scoring, 3-season rotation & scenario engine
│   ├── charts.js               # Chart.js renderers for strategy & scenario comparisons
│   └── app.js                  # Interactive Leaflet map, state & UI controller
├── data/
│   └── crops.json              # Structured JSON crop database
└── assets/
    ├── fonts/                  # Locally hosted IBM Plex Sans & IBM Plex Sans Arabic (.woff2)
    └── vendor/                 # Locally hosted Leaflet.js & Chart.js
```

---

## Running Locally
No build step or backend server is required.
1. Clone this repository:
   ```bash
   git clone https://github.com/ayazashy/NAWAR.git
   ```
2. Open `index.html` in any modern desktop or mobile browser (or serve via `python -m http.server 8080`).

