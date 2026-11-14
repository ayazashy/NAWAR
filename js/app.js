/* NAWAR GeoAI - Main Application Controller (Map, UI State, Bilingual, Animations) */

(function () {
  const DATA = window.NAWAR_DATA;

  const state = {
    lang: "en", // English by default as requested
    countryId: "sa",
    regionId: "sa-jouf",
    isCustomPoint: false,
    lat: 29.8874,
    lon: 39.3206,
    prevCropId: "wheat",
    soilType: "sandy",
    startSeason: "winter",
    priority: "water",
    activeStrategyKey: "water",
    mapLayer: "street",
    climateData: null,
    planResult: null
  };

  let map = null;
  let streetTiles = null;
  let satTiles = null;
  let activeMarker = null;
  let regionDotsLayer = null;

  function t() {
    return DATA.i18n[state.lang];
  }

  function findRegionById(regId) {
    for (const country of DATA.countries) {
      const found = country.regions.find((r) => r.id === regId);
      if (found) return { country, region: found };
    }
    return null;
  }

  function createPinIcon() {
    return L.divIcon({
      className: "nawar-map-pin-wrapper",
      html: `<div class="nawar-map-pin"><span class="nawar-map-pin-core"></span></div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });
  }

  function initMap() {
    const mapContainer = document.getElementById("farmMap");
    if (!mapContainer || typeof L === "undefined") return;

    map = L.map("farmMap", {
      center: [state.lat, state.lon],
      zoom: 6,
      zoomControl: true,
      scrollWheelZoom: true
    });

    streetTiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "&copy; OpenStreetMap"
    });

    satTiles = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 18,
        attribution: "&copy; Esri"
      }
    );

    streetTiles.addTo(map);

    // Plot subtle clickable region markers across the Middle East
    regionDotsLayer = L.layerGroup().addTo(map);
    renderRegionMarkers();

    // Place primary farm pin
    activeMarker = L.marker([state.lat, state.lon], {
      icon: createPinIcon(),
      draggable: true
    }).addTo(map);

    activeMarker.on("dragend", function (e) {
      const pos = e.target.getLatLng();
      setCustomCoordinates(pos.lat, pos.lng, false);
    });

    map.on("click", function (e) {
      setCustomCoordinates(e.latlng.lat, e.latlng.lng, false);
    });
  }

  function renderRegionMarkers() {
    if (!regionDotsLayer) return;
    regionDotsLayer.clearLayers();

    DATA.countries.forEach((country) => {
      country.regions.forEach((reg) => {
        const dot = L.circleMarker([reg.lat, reg.lon], {
          radius: 5,
          color: "#1f5c3a",
          weight: 1.5,
          fillColor: "#e9f2ec",
          fillOpacity: 0.85
        });

        dot.bindTooltip(
          `<strong>${reg.name[state.lang]}</strong><br/>${country.name[state.lang]}`,
          { direction: "top", offset: [0, -6] }
        );

        dot.on("click", function (ev) {
          L.DomEvent.stopPropagation(ev);
          selectPresetRegion(country.id, reg.id, true);
        });

        regionDotsLayer.addLayer(dot);
      });
    });
  }

  function selectPresetRegion(countryId, regionId, shouldFly) {
    const match = findRegionById(regionId);
    if (!match) return;

    state.countryId = countryId;
    state.regionId = regionId;
    state.isCustomPoint = false;
    state.lat = match.region.lat;
    state.lon = match.region.lon;
    state.soilType = match.region.soil;

    populateCountrySelect();
    populateRegionSelect();
    syncFormInputs();

    if (map && activeMarker) {
      activeMarker.setLatLng([state.lat, state.lon]);
      if (shouldFly) {
        map.flyTo([state.lat, state.lon], 7, { duration: 0.75 });
      }
    }

    runPipelineAnalysis();
  }

  function setCustomCoordinates(lat, lon, shouldFly) {
    const clampedLat = Math.max(-60, Math.min(70, Number(lat)));
    const clampedLon = Math.max(-180, Math.min(180, Number(lon)));

    state.lat = Number(clampedLat.toFixed(4));
    state.lon = Number(clampedLon.toFixed(4));
    state.isCustomPoint = true;

    // Check if close to a known region to highlight its country
    let nearestCountry = state.countryId;
    let minDist = Infinity;
    DATA.countries.forEach((c) => {
      c.regions.forEach((r) => {
        const d = Math.hypot(r.lat - state.lat, r.lon - state.lon);
        if (d < minDist) {
          minDist = d;
          nearestCountry = c.id;
        }
      });
    });
    state.countryId = nearestCountry;

    populateCountrySelect();
    populateRegionSelect();
    syncFormInputs();

    if (map && activeMarker) {
      activeMarker.setLatLng([state.lat, state.lon]);
      if (shouldFly) {
        map.flyTo([state.lat, state.lon], 8, { duration: 0.75 });
      }
    }

    runPipelineAnalysis();
  }

  function populateCountrySelect() {
    const countrySelect = document.getElementById("countrySelect");
    if (!countrySelect) return;

    countrySelect.innerHTML = DATA.countries
      .map(
        (c) =>
          `<option value="${c.id}" ${c.id === state.countryId ? "selected" : ""}>${c.name[state.lang]}</option>`
      )
      .join("");
  }

  function populateRegionSelect() {
    const regionSelect = document.getElementById("regionSelect");
    if (!regionSelect) return;

    const country = DATA.countries.find((c) => c.id === state.countryId) || DATA.countries[0];
    let html = country.regions
      .map(
        (r) =>
          `<option value="${r.id}" ${!state.isCustomPoint && r.id === state.regionId ? "selected" : ""}>${r.name[state.lang]}</option>`
      )
      .join("");

    if (state.isCustomPoint) {
      const customLabel = `${t().customLocationTag} (${state.lat.toFixed(3)}, ${state.lon.toFixed(3)})`;
      html = `<option value="custom" selected>${customLabel}</option>` + html;
    }

    regionSelect.innerHTML = html;
  }

  function populateCropSelect() {
    const prevCropSelect = document.getElementById("prevCropSelect");
    if (!prevCropSelect) return;

    const noneOption = `<option value="none" ${state.prevCropId === "none" ? "selected" : ""}>${t().prevCropNone}</option>`;
    const cropOptions = DATA.crops
      .map(
        (c) =>
          `<option value="${c.id}" ${c.id === state.prevCropId ? "selected" : ""}>${c.name[state.lang]} - ${c.familyLabel[state.lang]}</option>`
      )
      .join("");

    prevCropSelect.innerHTML = noneOption + cropOptions;
  }

  function populateSoilAndSeasonSelects() {
    const soilSelect = document.getElementById("soilSelect");
    if (soilSelect) {
      const soils = ["sandy", "loamy", "clay", "saline"];
      soilSelect.innerHTML = soils
        .map(
          (s) =>
            `<option value="${s}" ${state.soilType === s ? "selected" : ""}>${t()["soil_" + s]}</option>`
        )
        .join("");
    }

    const seasonSelect = document.getElementById("seasonSelect");
    if (seasonSelect) {
      const seasons = ["winter", "spring", "summer"];
      seasonSelect.innerHTML = seasons
        .map(
          (s) =>
            `<option value="${s}" ${state.startSeason === s ? "selected" : ""}>${t()["season_" + s]}</option>`
        )
        .join("");
    }
  }

  function syncFormInputs() {
    const latInput = document.getElementById("latInput");
    const lonInput = document.getElementById("lonInput");
    if (latInput) latInput.value = state.lat.toFixed(4);
    if (lonInput) lonInput.value = state.lon.toFixed(4);

    const soilSelect = document.getElementById("soilSelect");
    if (soilSelect) soilSelect.value = state.soilType;

    const seasonSelect = document.getElementById("seasonSelect");
    if (seasonSelect) seasonSelect.value = state.startSeason;

    document.querySelectorAll(".priority-btn").forEach((btn) => {
      const p = btn.getAttribute("data-priority");
      btn.classList.toggle("active", p === state.priority);
      btn.setAttribute("aria-pressed", p === state.priority ? "true" : "false");
    });
  }

  function applyStaticTranslations() {
    const dict = t();
    document.documentElement.lang = state.lang;
    document.documentElement.dir = state.lang === "ar" ? "rtl" : "ltr";

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (dict[key]) {
        el.textContent = dict[key];
      }
    });

    populateCountrySelect();
    populateRegionSelect();
    populateCropSelect();
    populateSoilAndSeasonSelects();
    syncFormInputs();
    renderRegionMarkers();

    if (state.climateData && state.planResult) {
      renderResultsUI(false);
    }
  }

  function animatePipelineFlow() {
    const steps = document.querySelectorAll(".pipeline-step");
    steps.forEach((step, idx) => {
      step.classList.remove("step-active");
      setTimeout(() => {
        step.classList.add("step-active");
      }, idx * 55);
    });
  }

  async function runPipelineAnalysis() {
    const loadingBar = document.getElementById("nasaLoadingBar");
    if (loadingBar) loadingBar.classList.add("visible");

    animatePipelineFlow();

    const climate = await window.NasaPowerService.fetchClimate(state.lat, state.lon);
    state.climateData = climate;

    const planResult = window.NawarEngine.generateFullPlan({
      crops: DATA.crops,
      climateData: climate,
      soilType: state.soilType,
      prevCropId: state.prevCropId,
      startSeason: state.startSeason,
      priority: state.priority
    });

    state.planResult = planResult;
    state.activeStrategyKey = state.priority;

    if (loadingBar) loadingBar.classList.remove("visible");

    renderResultsUI(true);
  }

  function renderResultsUI(animateCards) {
    const dict = t();
    const climate = state.climateData;
    const plan = state.planResult;
    if (!climate || !plan) return;

    // 1. Update NASA POWER Telemetry Strip
    const sourceBadge = document.getElementById("nasaSourceBadge");
    if (sourceBadge) {
      sourceBadge.textContent =
        climate.source === "live" ? dict.nasaSourceLive : dict.nasaSourceCached;
      sourceBadge.className =
        "status-pill " + (climate.source === "live" ? "status-live" : "status-cached");
    }

    const activeLocationLabel = document.getElementById("activeLocationLabel");
    if (activeLocationLabel) {
      if (state.isCustomPoint) {
        activeLocationLabel.textContent = `${dict.customLocationTag} (${state.lat.toFixed(3)}°, ${state.lon.toFixed(3)}°)`;
      } else {
        const match = findRegionById(state.regionId);
        activeLocationLabel.textContent = match
          ? `${match.region.name[state.lang]} - ${match.country.name[state.lang]}`
          : "";
      }
    }

    document.getElementById("valTemp").textContent = `${climate.summary.annualTemp}°C`;
    document.getElementById("valMaxTemp").textContent = `${climate.summary.peakSummerTemp}°C`;
    document.getElementById("valRain").textContent = `${climate.summary.annualRainfallMm} mm`;
    document.getElementById("valSolar").textContent = `${climate.summary.meanSolar} kWh/m²`;

    // 2. Render 3 Strategy Selector Cards
    renderStrategyCards();

    // 3. Render Active 3-Season Plan Table
    renderPlanTable(animateCards);

    // 4. Render Climate Scenario Stress-Test Cards & Confidence Badge
    renderScenarioSection();

    // 5. Render Chart.js Visualizations
    const activeStrat = plan.strategies[state.activeStrategyKey];
    window.NawarCharts.renderStrategyChart("strategyChart", plan, state.lang, dict);
    window.NawarCharts.renderScenarioChart("scenarioChart", activeStrat, state.lang, dict);
  }

  function renderStrategyCards() {
    const dict = t();
    const container = document.getElementById("strategyCardsContainer");
    if (!container || !state.planResult) return;

    const defs = [
      { key: "water", title: dict.strat_water_title },
      { key: "profit", title: dict.strat_profit_title },
      { key: "soil", title: dict.strat_soil_title }
    ];

    container.innerHTML = defs
      .map((d) => {
        const strat = state.planResult.strategies[d.key];
        const isRec = d.key === state.planResult.recommendedKey;
        const isActive = d.key === state.activeStrategyKey;
        const cropNames = strat.steps.map((s) => s.crop.name[state.lang]).join(" → ");
        const conf = strat.scenarioReport.confidencePercent;

        return `
          <button type="button" class="strategy-card ${isActive ? "active" : ""}" data-strat="${d.key}">
            <div class="strategy-card-top">
              <span class="strategy-card-title">${d.title}</span>
              ${isRec ? `<span class="rec-badge">${dict.recommendedTag}</span>` : ""}
            </div>
            <div class="strategy-crop-chain">${cropNames}</div>
            <div class="strategy-card-metrics">
              <span>💧 ${strat.metrics.totalWaterMm} mm</span>
              <span>🛡️ ${conf}%</span>
            </div>
          </button>
        `;
      })
      .join("");

    container.querySelectorAll(".strategy-card").forEach((btn) => {
      btn.addEventListener("click", function () {
        const chosen = this.getAttribute("data-strat");
        if (chosen && state.planResult.strategies[chosen]) {
          state.activeStrategyKey = chosen;
          renderStrategyCards();
          renderPlanTable(true);
          renderScenarioSection();
          window.NawarCharts.renderScenarioChart(
            "scenarioChart",
            state.planResult.strategies[chosen],
            state.lang,
            t()
          );
        }
      });
    });
  }

  function renderPlanTable(animate) {
    const dict = t();
    const tbody = document.getElementById("planTableBody");
    const activeStratTitleEl = document.getElementById("activeStrategyLabel");
    if (!tbody || !state.planResult) return;

    const activeStrat = state.planResult.strategies[state.activeStrategyKey];
    const stratTitleMap = {
      water: dict.strat_water_title,
      profit: dict.strat_profit_title,
      soil: dict.strat_soil_title
    };
    if (activeStratTitleEl) {
      activeStratTitleEl.textContent = stratTitleMap[state.activeStrategyKey] || "";
    }

    const seasonTitleKeys = ["season1Label", "season2Label", "season3Label"];

    tbody.innerHTML = activeStrat.steps
      .map((step, idx) => {
        const sLabel = dict[seasonTitleKeys[idx]];
        const sSub = dict["seasonName_" + step.seasonKey];
        const cropName = step.crop.name[state.lang];
        const famName = step.crop.familyLabel[state.lang];
        const reason = step.crop.reasons[state.lang];
        const ruleTag = dict[step.ruleKey];
        const riskText = dict["risk_" + step.riskLevel];
        const returnEst = step.crop.returnEstimate[state.lang];

        return `
          <tr class="${animate ? "row-fade-in" : ""}" style="animation-delay: ${idx * 70}ms">
            <td data-label="${dict.colSeason}">
              <div class="cell-season-num">${sLabel}</div>
              <div class="cell-season-sub">${sSub}</div>
            </td>
            <td data-label="${dict.colCrop}">
              <div class="cell-crop-name">${cropName}</div>
              <div class="cell-crop-family">${famName}</div>
            </td>
            <td data-label="${dict.colReason}">
              <div class="cell-reason-text">${reason}</div>
              <span class="rule-pill">${ruleTag}</span>
            </td>
            <td data-label="${dict.colWater}">
              <strong class="tabular-nums">${step.adjustedWaterNeed} mm</strong>
            </td>
            <td data-label="${dict.colRisk}">
              <span class="risk-badge risk-${step.riskLevel}">${riskText}</span>
            </td>
            <td data-label="${dict.colReturn}">
              <span class="return-text tabular-nums">${returnEst}</span>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function renderScenarioSection() {
    const dict = t();
    if (!state.planResult) return;

    const activeStrat = state.planResult.strategies[state.activeStrategyKey];
    const report = activeStrat.scenarioReport;

    const confBadge = document.getElementById("confidenceBadge");
    if (confBadge) {
      confBadge.className = `confidence-banner conf-${report.confidenceLevel}`;
      confBadge.innerHTML = `
        <div class="conf-score tabular-nums">${report.confidencePercent}%</div>
        <div class="conf-details">
          <div class="conf-title">${dict[report.confidenceTextKey]}</div>
          <div class="conf-bar-track">
            <div class="conf-bar-fill" style="width: ${report.confidencePercent}%"></div>
          </div>
        </div>
      `;
    }

    const scenCardsGrid = document.getElementById("scenarioCardsGrid");
    if (scenCardsGrid) {
      scenCardsGrid.innerHTML = report.scenarios
        .map((sc) => {
          const statusLabel = sc.passed ? dict.scenPassed : dict.scenWarn;
          const statusClass = sc.passed ? "scen-pass" : "scen-warn";
          return `
            <div class="scenario-card">
              <div class="scenario-card-header">
                <span class="scenario-name">${dict[sc.labelKey]}</span>
                <span class="scenario-status ${statusClass}">${statusLabel} (${sc.avgScore}/100)</span>
              </div>
              <p class="scenario-desc">${dict[sc.descKey]}</p>
            </div>
          `;
        })
        .join("");
    }
  }

  function bindEvents() {
    // Language Toggle
    const langToggleBtn = document.getElementById("langToggleBtn");
    if (langToggleBtn) {
      langToggleBtn.addEventListener("click", function () {
        state.lang = state.lang === "en" ? "ar" : "en";
        applyStaticTranslations();
        if (map) {
          setTimeout(() => map.invalidateSize(), 150);
        }
      });
    }

    // Country Select
    const countrySelect = document.getElementById("countrySelect");
    if (countrySelect) {
      countrySelect.addEventListener("change", function () {
        const newCountryId = this.value;
        const country = DATA.countries.find((c) => c.id === newCountryId);
        if (country && country.regions.length) {
          selectPresetRegion(country.id, country.regions[0].id, true);
        }
      });
    }

    // Region Select
    const regionSelect = document.getElementById("regionSelect");
    if (regionSelect) {
      regionSelect.addEventListener("change", function () {
        if (this.value === "custom") return;
        selectPresetRegion(state.countryId, this.value, true);
      });
    }

    // Manual Lat / Lon inputs
    const latInput = document.getElementById("latInput");
    const lonInput = document.getElementById("lonInput");
    function handleCoordChange() {
      const parsedLat = parseFloat(latInput.value);
      const parsedLon = parseFloat(lonInput.value);
      if (!isNaN(parsedLat) && !isNaN(parsedLon)) {
        setCustomCoordinates(parsedLat, parsedLon, true);
      }
    }
    if (latInput) latInput.addEventListener("change", handleCoordChange);
    if (lonInput) lonInput.addEventListener("change", handleCoordChange);

    // GPS Button
    const gpsBtn = document.getElementById("useGpsBtn");
    if (gpsBtn) {
      gpsBtn.addEventListener("click", function () {
        if (!navigator.geolocation) return;
        gpsBtn.disabled = true;
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            gpsBtn.disabled = false;
            setCustomCoordinates(pos.coords.latitude, pos.coords.longitude, true);
          },
          () => {
            gpsBtn.disabled = false;
          },
          { timeout: 6000 }
        );
      });
    }

    // Map Layer Switcher (Terrain / Satellite)
    document.querySelectorAll(".map-layer-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        const layer = this.getAttribute("data-layer");
        if (!map || layer === state.mapLayer) return;
        state.mapLayer = layer;
        document.querySelectorAll(".map-layer-btn").forEach((b) =>
          b.classList.toggle("active", b.getAttribute("data-layer") === layer)
        );
        if (layer === "sat") {
          map.removeLayer(streetTiles);
          satTiles.addTo(map);
        } else {
          map.removeLayer(satTiles);
          streetTiles.addTo(map);
        }
      });
    });

    // Previous Crop, Soil, Starting Season
    const prevCropSelect = document.getElementById("prevCropSelect");
    if (prevCropSelect) {
      prevCropSelect.addEventListener("change", function () {
        state.prevCropId = this.value;
        runPipelineAnalysis();
      });
    }

    const soilSelect = document.getElementById("soilSelect");
    if (soilSelect) {
      soilSelect.addEventListener("change", function () {
        state.soilType = this.value;
        runPipelineAnalysis();
      });
    }

    const seasonSelect = document.getElementById("seasonSelect");
    if (seasonSelect) {
      seasonSelect.addEventListener("change", function () {
        state.startSeason = this.value;
        runPipelineAnalysis();
      });
    }

    // Priority Buttons
    document.querySelectorAll(".priority-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        const prio = this.getAttribute("data-priority");
        if (!prio) return;
        state.priority = prio;
        syncFormInputs();
        runPipelineAnalysis();
      });
    });

    // Generate Button (smooth scroll to results on mobile)
    const generateBtn = document.getElementById("generateBtn");
    if (generateBtn) {
      generateBtn.addEventListener("click", function () {
        runPipelineAnalysis();
        if (window.innerWidth < 960) {
          const resultsEl = document.getElementById("resultsSection");
          if (resultsEl) {
            resultsEl.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }
      });
    }

    // Interactive Pipeline Steps smooth navigation
    document.querySelectorAll(".pipeline-step").forEach((step) => {
      step.addEventListener("click", function () {
        const targetId = this.getAttribute("data-target");
        const targetEl = targetId ? document.getElementById(targetId) : null;
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    applyStaticTranslations();
    initMap();
    bindEvents();
    runPipelineAnalysis();
  });
})();
