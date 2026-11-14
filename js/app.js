/* NAWAR GeoAI - Step-by-Step Guided User Journey, Map, Modals & Dashboard Controller */

(function () {
  const DATA = window.NAWAR_DATA;
  const STORAGE_KEY = "nawar_geoai_state_v1";

  const state = {
    lang: "en", // English by default
    stage: "welcome", // "welcome" | "wizard" | "dashboard"
    wizStep: 1, // 1 | 2 | 3 | 4
    maxUnlockedStep: 1,
    countryId: null,
    regionId: null,
    customCityName: null,
    lat: 24.7136,
    lon: 46.6753,
    mapZoom: 10,
    suggestedSoil: "loamy",
    soilType: "loamy",
    prevCropId: "none",
    startSeason: "winter",
    priority: "water",
    activeStrategyKey: "water",
    mapLayer: "street",
    climateData: null,
    planResult: null,
    extraSearchRegions: []
  };

  function saveStateToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // Ignore storage quota or privacy-mode errors
    }
  }

  function loadStateFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== "object") return false;
      Object.keys(state).forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(saved, key) && saved[key] !== undefined) {
          state[key] = saved[key];
        }
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearSavedFarmState() {
    state.stage = "welcome";
    state.wizStep = 1;
    state.maxUnlockedStep = 1;
    state.countryId = null;
    state.regionId = null;
    state.customCityName = null;
    state.lat = 24.7136;
    state.lon = 46.6753;
    state.mapZoom = 10;
    state.suggestedSoil = "loamy";
    state.soilType = "loamy";
    state.prevCropId = "none";
    state.startSeason = "winter";
    state.priority = "water";
    state.activeStrategyKey = "water";
    state.climateData = null;
    state.planResult = null;
    state.extraSearchRegions = [];
    saveStateToStorage();
  }

  let map = null;
  let streetTiles = null;
  let satTiles = null;
  let activeMarker = null;

  function t() {
    return DATA.i18n[state.lang];
  }

  function getSelectedCountry() {
    return DATA.countries.find((c) => c.id === state.countryId) || null;
  }

  function getSelectedRegion() {
    const c = getSelectedCountry();
    if (!c) return null;
    const preset = c.regions.find((r) => r.id === state.regionId);
    if (preset) return preset;
    return state.extraSearchRegions.find((r) => r.id === state.regionId) || null;
  }

  function getCurrentAreaDisplayName() {
    const dict = t();
    const country = getSelectedCountry();
    const region = getSelectedRegion();
    if (state.customCityName && country) {
      return `${state.customCityName} - ${country.name[state.lang]}`;
    }
    if (region && country) {
      return `${region.name[state.lang]} - ${country.name[state.lang]}`;
    }
    if (country) {
      return `${country.name[state.lang]} (${state.lat.toFixed(3)}, ${state.lon.toFixed(3)})`;
    }
    return `${dict.latLabel}: ${state.lat.toFixed(3)}, ${dict.lonLabel}: ${state.lon.toFixed(3)}`;
  }

  // Stage & Wizard Navigation
  function showStage(stageName) {
    state.stage = stageName;
    saveStateToStorage();
    document.getElementById("welcomeStage").classList.toggle("active-stage", stageName === "welcome");
    document.getElementById("wizardStage").classList.toggle("active-stage", stageName === "wizard");
    document.getElementById("dashboardStage").classList.toggle("active-stage", stageName === "dashboard");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goToWizardStep(stepNum) {
    state.wizStep = stepNum;
    if (stepNum > state.maxUnlockedStep) {
      state.maxUnlockedStep = stepNum;
    }

    showStage("wizard");

    for (let i = 1; i <= 4; i++) {
      const card = document.getElementById(`wizStep${i}`);
      if (card) {
        card.classList.toggle("active-wiz-step", i === stepNum);
      }
    }

    document.querySelectorAll(".wiz-prog-item").forEach((btn) => {
      const s = Number(btn.getAttribute("data-wiz-step"));
      btn.disabled = s > state.maxUnlockedStep;
      btn.classList.toggle("active", s === stepNum);
      btn.classList.toggle("done", s < stepNum);
    });

    if (stepNum === 2) {
      ensureMapInitializedAndZoomed();
      updateStep2Header();
    } else if (stepNum === 3) {
      renderSoilCards();
      populateCropSelect();
      populateSeasonSelect();
    } else if (stepNum === 4) {
      syncPriorityButtons();
      renderWizardSummary();
    }
  }

  // STEP 1: Country & City/Region Search ("تصغير المساحة")
  function renderCountryCards() {
    const grid = document.getElementById("countryCardsGrid");
    if (!grid) return;

    grid.innerHTML = DATA.countries
      .map((c) => {
        const isSelected = c.id === state.countryId;
        return `
          <button type="button" class="country-card-btn ${isSelected ? "selected" : ""}" data-country="${c.id}">
            <span>${c.name[state.lang]}</span>
            <span>→</span>
          </button>
        `;
      })
      .join("");

    grid.querySelectorAll(".country-card-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        const cid = this.getAttribute("data-country");
        selectCountryInStep1(cid);
      });
    });
  }

  function selectCountryInStep1(countryId) {
    state.countryId = countryId;
    state.regionId = null;
    state.customCityName = null;
    state.extraSearchRegions = [];
    saveStateToStorage();

    const searchInput = document.getElementById("citySearchInput");
    if (searchInput) searchInput.value = "";
    hideSearchStatus();

    renderCountryCards();

    const country = getSelectedCountry();
    const panel = document.getElementById("regionPickerPanel");
    const badge = document.getElementById("selectedCountryBadge");
    if (panel && country) {
      panel.classList.remove("hidden-block");
      if (badge) badge.textContent = country.name[state.lang];
      renderRegionCards("");
      setTimeout(() => {
        panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 80);
    }
  }

  function renderRegionCards(filterText) {
    const grid = document.getElementById("regionCardsGrid");
    const country = getSelectedCountry();
    if (!grid || !country) return;

    const query = (filterText || "").trim().toLowerCase();
    const combinedRegions = [...country.regions, ...state.extraSearchRegions];

    const filtered = combinedRegions.filter((r) => {
      if (!query) return true;
      const enMatch = (r.name.en || "").toLowerCase().includes(query);
      const arMatch = (r.name.ar || "").toLowerCase().includes(query);
      return enMatch || arMatch;
    });

    if (!filtered.length) {
      grid.innerHTML = "";
      showSearchStatus(t().noCityFoundMsg);
      return;
    }

    hideSearchStatus();

    grid.innerHTML = filtered
      .map((r) => {
        const isSel = r.id === state.regionId;
        return `
          <button type="button" class="region-card-btn ${isSel ? "selected" : ""}" data-region="${r.id}">
            <span>${r.name[state.lang]}</span>
            <span>📍</span>
          </button>
        `;
      })
      .join("");

    grid.querySelectorAll(".region-card-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        const rid = this.getAttribute("data-region");
        selectRegionAndZoomToStep2(rid);
      });
    });
  }

  function selectRegionAndZoomToStep2(regionId) {
    const country = getSelectedCountry();
    if (!country) return;

    const allRegions = [...country.regions, ...state.extraSearchRegions];
    const found = allRegions.find((r) => r.id === regionId);
    if (!found) return;

    state.regionId = found.id;
    state.customCityName = null;
    state.lat = Number(found.lat.toFixed(4));
    state.lon = Number(found.lon.toFixed(4));
    state.mapZoom = 11;
    state.suggestedSoil = found.soil || "loamy";
    state.soilType = state.suggestedSoil;

    goToWizardStep(2);
  }

  async function searchCityViaNominatim() {
    const input = document.getElementById("citySearchInput");
    const country = getSelectedCountry();
    if (!input || !country) return;

    const query = input.value.trim();
    if (!query) {
      renderRegionCards("");
      return;
    }

    showSearchStatus(t().searchingCityMsg);

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=${country.code}&limit=5&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, {
        headers: { "Accept-Language": state.lang === "ar" ? "ar,en" : "en" }
      });
      if (!res.ok) throw new Error("Search failed");
      const items = await res.json();

      if (Array.isArray(items) && items.length > 0) {
        state.extraSearchRegions = items.map((item, idx) => {
          const shortName = (item.display_name || query).split(",")[0].trim();
          return {
            id: `search-${idx}-${Date.now()}`,
            name: { en: shortName, ar: shortName },
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
            soil: country.regions[0] ? country.regions[0].soil : "loamy"
          };
        });
        hideSearchStatus();
        renderRegionCards(query);
      } else {
        renderRegionCards(query);
      }
    } catch (e) {
      renderRegionCards(query);
    }
  }

  function showSearchStatus(msg) {
    const el = document.getElementById("citySearchStatus");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden-block");
  }

  function hideSearchStatus() {
    const el = document.getElementById("citySearchStatus");
    if (!el) return;
    el.classList.add("hidden-block");
  }

  // STEP 2: Interactive Zoomed Map
  function createPinIcon() {
    return L.divIcon({
      className: "nawar-map-pin-wrapper",
      html: `<div class="nawar-map-pin"><span class="nawar-map-pin-core"></span></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
  }

  function ensureMapInitializedAndZoomed() {
    const mapContainer = document.getElementById("farmMap");
    if (!mapContainer || typeof L === "undefined") return;

    if (!map) {
      map = L.map("farmMap", {
        center: [state.lat, state.lon],
        zoom: state.mapZoom,
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

      activeMarker = L.marker([state.lat, state.lon], {
        icon: createPinIcon(),
        draggable: true
      }).addTo(map);

      activeMarker.on("dragend", function (e) {
        const pos = e.target.getLatLng();
        updatePinCoordinates(pos.lat, pos.lng, false);
      });

      map.on("click", function (e) {
        updatePinCoordinates(e.latlng.lat, e.latlng.lng, false);
      });
    }

    setTimeout(() => {
      map.invalidateSize();
      activeMarker.setLatLng([state.lat, state.lon]);
      map.setView([state.lat, state.lon], state.mapZoom, { animate: true });
    }, 100);

    syncLatLonInputs();
  }

  function updatePinCoordinates(lat, lon, recenter) {
    state.lat = Number(Math.max(-60, Math.min(70, Number(lat))).toFixed(4));
    state.lon = Number(Math.max(-180, Math.min(180, Number(lon))).toFixed(4));
    saveStateToStorage();

    if (activeMarker) {
      activeMarker.setLatLng([state.lat, state.lon]);
    }
    if (map && recenter) {
      map.flyTo([state.lat, state.lon], state.mapZoom, { duration: 0.6 });
    }
    syncLatLonInputs();
    updateStep2Header();
  }

  function syncLatLonInputs() {
    const latInput = document.getElementById("latInput");
    const lonInput = document.getElementById("lonInput");
    if (latInput) latInput.value = state.lat.toFixed(4);
    if (lonInput) lonInput.value = state.lon.toFixed(4);
  }

  function updateStep2Header() {
    const el = document.getElementById("step2AreaName");
    if (el) {
      el.textContent = getCurrentAreaDisplayName();
    }
  }

  // STEP 3: Soil Cards, Previous Crop & Starting Season
  function renderSoilCards() {
    const grid = document.getElementById("soilCardsGrid");
    if (!grid) return;

    const dict = t();
    const soils = ["sandy", "loamy", "clay", "saline"];

    grid.innerHTML = soils
      .map((sKey) => {
        const isSel = state.soilType === sKey;
        const isSuggested = state.suggestedSoil === sKey;
        return `
          <button type="button" class="soil-card-btn ${isSel ? "selected" : ""}" data-soil="${sKey}">
            <div class="soil-card-top">
              <span class="soil-card-title">${dict["soil_" + sKey]}</span>
              ${isSuggested ? `<span class="rec-badge">${dict.regionalSoilSuggested}</span>` : ""}
            </div>
            <p class="soil-card-desc">${dict["soil_" + sKey + "_desc"]}</p>
          </button>
        `;
      })
      .join("");

    grid.querySelectorAll(".soil-card-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        state.soilType = this.getAttribute("data-soil");
        saveStateToStorage();
        renderSoilCards();
      });
    });
  }

  function populateCropSelect() {
    const select = document.getElementById("prevCropSelect");
    if (!select) return;
    const dict = t();

    const noneOpt = `<option value="none" ${state.prevCropId === "none" ? "selected" : ""}>${dict.prevCropNone}</option>`;
    const cropOpts = DATA.crops
      .map(
        (c) =>
          `<option value="${c.id}" ${state.prevCropId === c.id ? "selected" : ""}>${c.name[state.lang]} - ${c.familyLabel[state.lang]}</option>`
      )
      .join("");

    select.innerHTML = noneOpt + cropOpts;
  }

  function populateSeasonSelect() {
    const select = document.getElementById("seasonSelect");
    if (!select) return;
    const dict = t();

    const seasons = ["winter", "spring", "summer"];
    select.innerHTML = seasons
      .map(
        (s) =>
          `<option value="${s}" ${state.startSeason === s ? "selected" : ""}>${dict["season_" + s]}</option>`
      )
      .join("");
  }

  // STEP 4: Priority & Summary Review
  function syncPriorityButtons() {
    document.querySelectorAll(".priority-btn").forEach((btn) => {
      const p = btn.getAttribute("data-priority");
      const active = p === state.priority;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function renderWizardSummary() {
    const grid = document.getElementById("wizardSummaryGrid");
    if (!grid) return;
    const dict = t();

    const prevCropObj = DATA.crops.find((c) => c.id === state.prevCropId);
    const prevCropLabel = prevCropObj ? prevCropObj.name[state.lang] : dict.prevCropNone;

    const items = [
      { label: dict.step1, val: getCurrentAreaDisplayName() },
      { label: dict.soilTypeLabel, val: dict["soil_" + state.soilType] },
      { label: dict.prevCropLabel, val: prevCropLabel },
      { label: dict.startSeasonLabel, val: dict["season_" + state.startSeason] },
      { label: dict.step4Title, val: dict["prio_" + state.priority] }
    ];

    grid.innerHTML = items
      .map(
        (item) => `
        <div class="sum-item">
          <div class="sum-label">${item.label}</div>
          <div class="sum-val">${item.val}</div>
        </div>
      `
      )
      .join("");
  }

  // Animated NASA Analysis Modal -> Dashboard
  async function runAnimatedPipelineAndShowDashboard() {
    const modal = document.getElementById("analysisModal");
    const progBar = document.getElementById("analysisProgressBar");
    const stepIds = ["anStep1", "anStep2", "anStep3", "anStep4"];

    if (modal) {
      modal.classList.remove("hidden-modal");
      if (progBar) progBar.style.width = "15%";
      stepIds.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.classList.remove("done");
      });
    }

    const markStep = (index, pct) => {
      const el = document.getElementById(stepIds[index]);
      if (el) el.classList.add("done");
      if (progBar) progBar.style.width = `${pct}%`;
    };

    markStep(0, 28);
    const climatePromise = window.NasaPowerService.fetchClimate(state.lat, state.lon);

    await new Promise((r) => setTimeout(r, 320));
    markStep(1, 55);

    const climate = await climatePromise;
    state.climateData = climate;

    await new Promise((r) => setTimeout(r, 280));
    markStep(2, 82);

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

    await new Promise((r) => setTimeout(r, 260));
    markStep(3, 100);

    await new Promise((r) => setTimeout(r, 200));
    if (modal) modal.classList.add("hidden-modal");

    showStage("dashboard");
    renderResultsUI(true);
  }

  // Results Dashboard Rendering
  function renderResultsUI(animateCards) {
    const dict = t();
    const climate = state.climateData;
    const plan = state.planResult;
    if (!climate || !plan) return;

    // Context Bar
    const locTitle = document.getElementById("activeLocationLabel");
    if (locTitle) {
      locTitle.textContent = getCurrentAreaDisplayName();
    }

    const tagsRow = document.getElementById("activeFarmTags");
    if (tagsRow) {
      const prevCropObj = DATA.crops.find((c) => c.id === state.prevCropId);
      const prevName = prevCropObj ? prevCropObj.name[state.lang] : dict.prevCropNone;
      tagsRow.innerHTML = `
        <span class="context-tag">🌱 ${dict["soil_" + state.soilType]}</span>
        <span class="context-tag">🌾 ${prevName}</span>
        <span class="context-tag">🗓️ ${dict["season_" + state.startSeason]}</span>
        <span class="context-tag">🎯 ${dict["prio_" + state.priority]}</span>
      `;
    }

    // NASA Telemetry
    const sourceBadge = document.getElementById("nasaSourceBadge");
    if (sourceBadge) {
      sourceBadge.textContent =
        climate.source === "live" ? dict.nasaSourceLive : dict.nasaSourceCached;
      sourceBadge.className =
        "status-pill " + (climate.source === "live" ? "status-live" : "status-cached");
    }

    document.getElementById("valTemp").textContent = `${climate.summary.annualTemp}°C`;
    document.getElementById("valMaxTemp").textContent = `${climate.summary.peakSummerTemp}°C`;
    document.getElementById("valRain").textContent = `${climate.summary.annualRainfallMm} mm`;
    document.getElementById("valSolar").textContent = `${climate.summary.meanSolar} kWh/m²`;

    renderStrategyCards();
    renderPlanTable(animateCards);
    renderScenarioSection();

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
          saveStateToStorage();
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
          <tr class="${animate ? "row-fade-in" : ""}" data-step-idx="${idx}" style="animation-delay: ${idx * 70}ms">
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

    tbody.querySelectorAll("tr").forEach((row) => {
      row.addEventListener("click", function () {
        const idx = Number(this.getAttribute("data-step-idx"));
        openCropDetailModal(idx);
      });
    });
  }

  function openCropDetailModal(stepIdx) {
    if (!state.planResult || !state.climateData) return;
    const dict = t();
    const activeStrat = state.planResult.strategies[state.activeStrategyKey];
    const step = activeStrat.steps[stepIdx];
    if (!step) return;

    const seasonTitleKeys = ["season1Label", "season2Label", "season3Label"];
    const sLabel = `${dict[seasonTitleKeys[stepIdx]]} - ${dict["seasonName_" + step.seasonKey]}`;
    const sClimate = state.climateData.seasons[step.seasonKey];

    document.getElementById("cropModalSeasonBadge").textContent = sLabel;
    document.getElementById("cropModalTitle").textContent = step.crop.name[state.lang];
    document.getElementById("cropModalFamily").textContent = step.crop.familyLabel[state.lang];

    const body = document.getElementById("cropModalBody");
    body.innerHTML = `
      <div class="crop-modal-grid">
        <div class="sum-item">
          <div class="sum-label">${dict.modalSuitabilityScore}</div>
          <div class="sum-val tabular-nums">${step.totalScore} / 100</div>
        </div>
        <div class="sum-item">
          <div class="sum-label">${dict.modalOptimalTemp}</div>
          <div class="sum-val tabular-nums">${step.crop.tempRange.optMin}°C - ${step.crop.tempRange.optMax}°C</div>
        </div>
        <div class="sum-item">
          <div class="sum-label">${dict.modalLocalSeasonTemp}</div>
          <div class="sum-val tabular-nums">${sClimate.meanTemp}°C (Max ${sClimate.maxTemp}°C)</div>
        </div>
        <div class="sum-item">
          <div class="sum-label">${dict.modalSeasonalWater}</div>
          <div class="sum-val tabular-nums">${step.adjustedWaterNeed} mm</div>
        </div>
      </div>
      <div class="sum-item">
        <div class="sum-label">${dict.modalWhySelected}</div>
        <div class="sum-val" style="font-weight: 500; margin-top: 4px;">${step.crop.reasons[state.lang]}</div>
        <span class="rule-pill" style="margin-top: 8px;">${dict[step.ruleKey]}</span>
      </div>
    `;

    document.getElementById("cropDetailModal").classList.remove("hidden-modal");
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

    const searchInput = document.getElementById("citySearchInput");
    if (searchInput) {
      searchInput.placeholder = dict.searchCityPlaceholder;
    }

    renderCountryCards();
    if (state.countryId) {
      const country = getSelectedCountry();
      const badge = document.getElementById("selectedCountryBadge");
      if (badge && country) badge.textContent = country.name[state.lang];
      renderRegionCards(searchInput ? searchInput.value : "");
    }

    updateStep2Header();
    renderSoilCards();
    populateCropSelect();
    populateSeasonSelect();
    syncPriorityButtons();
    renderWizardSummary();

    if (state.stage === "dashboard" && state.climateData && state.planResult) {
      renderResultsUI(false);
    }
  }

  function requestUserGpsAndGoToMap() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.lat = Number(pos.coords.latitude.toFixed(4));
        state.lon = Number(pos.coords.longitude.toFixed(4));
        state.mapZoom = 12;

        // Find nearest country for soil hint
        let bestCountry = DATA.countries[0];
        let bestRegion = bestCountry.regions[0];
        let minDist = Infinity;
        DATA.countries.forEach((c) => {
          c.regions.forEach((r) => {
            const d = Math.hypot(r.lat - state.lat, r.lon - state.lon);
            if (d < minDist) {
              minDist = d;
              bestCountry = c;
              bestRegion = r;
            }
          });
        });

        state.countryId = bestCountry.id;
        state.regionId = null;
        state.customCityName = "GPS";
        state.suggestedSoil = bestRegion.soil || "loamy";
        state.soilType = state.suggestedSoil;

        goToWizardStep(2);
      },
      () => {
        // If denied or unavailable, open map at current state
        goToWizardStep(2);
      },
      { timeout: 6000 }
    );
  }

  function bindEvents() {
    // Language Toggle
    const langToggleBtn = document.getElementById("langToggleBtn");
    if (langToggleBtn) {
      langToggleBtn.addEventListener("click", function () {
        state.lang = state.lang === "en" ? "ar" : "en";
        saveStateToStorage();
        applyStaticTranslations();
        if (map && state.stage === "wizard" && state.wizStep === 2) {
          setTimeout(() => map.invalidateSize(), 120);
        }
      });
    }

    // Brand Home click -> Welcome Screen
    const brandHome = document.getElementById("brandHomeTrigger");
    if (brandHome) {
      brandHome.addEventListener("click", function () {
        showStage("welcome");
      });
    }

    // Start Journey Button on Welcome Screen
    const startBtn = document.getElementById("startJourneyBtn");
    if (startBtn) {
      startBtn.addEventListener("click", function () {
        goToWizardStep(1);
      });
    }

    // Wizard Top Progress Tabs
    document.querySelectorAll(".wiz-prog-item").forEach((btn) => {
      btn.addEventListener("click", function () {
        const targetStep = Number(this.getAttribute("data-wiz-step"));
        if (targetStep <= state.maxUnlockedStep) {
          goToWizardStep(targetStep);
        }
      });
    });

    // Step 1: City Search input & button
    const citySearchInput = document.getElementById("citySearchInput");
    if (citySearchInput) {
      citySearchInput.addEventListener("input", function () {
        renderRegionCards(this.value);
      });
      citySearchInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          searchCityViaNominatim();
        }
      });
    }

    const searchCityBtn = document.getElementById("searchCityBtn");
    if (searchCityBtn) {
      searchCityBtn.addEventListener("click", searchCityViaNominatim);
    }

    // Step 1: "My farm isn't in the list - Pin it on the map"
    const notInListBtn = document.getElementById("notInListMapBtn");
    if (notInListBtn) {
      notInListBtn.addEventListener("click", function () {
        const country = getSelectedCountry();
        if (country) {
          state.lat = country.centerLat;
          state.lon = country.centerLon;
          state.mapZoom = 7;
          state.regionId = null;
          state.customCityName = null;
          state.suggestedSoil = country.regions[0] ? country.regions[0].soil : "loamy";
          state.soilType = state.suggestedSoil;
        }
        goToWizardStep(2);
      });
    }

    // Direct GPS buttons (Step 1 & Step 2)
    const gpsDirectBtn = document.getElementById("useGpsDirectBtn");
    if (gpsDirectBtn) {
      gpsDirectBtn.addEventListener("click", requestUserGpsAndGoToMap);
    }
    const gpsMapBtn = document.getElementById("useGpsBtn");
    if (gpsMapBtn) {
      gpsMapBtn.addEventListener("click", requestUserGpsAndGoToMap);
    }

    // Step 2: Map Layer Switcher
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

    // Step 2: Manual Lat / Lon inputs
    const latInput = document.getElementById("latInput");
    const lonInput = document.getElementById("lonInput");
    function onManualCoordChange() {
      const pLat = parseFloat(latInput.value);
      const pLon = parseFloat(lonInput.value);
      if (!isNaN(pLat) && !isNaN(pLon)) {
        updatePinCoordinates(pLat, pLon, true);
      }
    }
    if (latInput) latInput.addEventListener("change", onManualCoordChange);
    if (lonInput) lonInput.addEventListener("change", onManualCoordChange);

    // Wizard Step Back / Next Buttons
    document.getElementById("backToStep1Btn").addEventListener("click", () => goToWizardStep(1));
    document.getElementById("toStep3Btn").addEventListener("click", () => goToWizardStep(3));
    document.getElementById("backToStep2Btn").addEventListener("click", () => goToWizardStep(2));
    document.getElementById("toStep4Btn").addEventListener("click", () => goToWizardStep(4));
    document.getElementById("backToStep3Btn").addEventListener("click", () => goToWizardStep(3));

    // Step 3: Crop & Season Selects
    document.getElementById("prevCropSelect").addEventListener("change", function () {
      state.prevCropId = this.value;
      saveStateToStorage();
    });
    document.getElementById("seasonSelect").addEventListener("change", function () {
      state.startSeason = this.value;
      saveStateToStorage();
    });

    // Step 4: Priority Buttons
    document.querySelectorAll(".priority-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        state.priority = this.getAttribute("data-priority");
        saveStateToStorage();
        syncPriorityButtons();
        renderWizardSummary();
      });
    });

    // Step 4: Generate Plan Button
    document.getElementById("generateBtn").addEventListener("click", function () {
      runAnimatedPipelineAndShowDashboard();
    });

    // Dashboard Quick Edit Actions
    document.getElementById("editLocationBtn").addEventListener("click", () => goToWizardStep(1));
    document.getElementById("editInputsBtn").addEventListener("click", () => goToWizardStep(3));
    document.getElementById("newFarmBtn").addEventListener("click", () => {
      clearSavedFarmState();
      document.getElementById("regionPickerPanel").classList.add("hidden-block");
      renderCountryCards();
      showStage("welcome");
    });

    // Dashboard 7-Step Pipeline Strip
    document.querySelectorAll(".pipeline-step").forEach((step) => {
      step.addEventListener("click", function () {
        const action = this.getAttribute("data-action");
        if (action === "edit-location") {
          goToWizardStep(2);
          return;
        }
        if (action === "edit-inputs") {
          goToWizardStep(3);
          return;
        }
        const targetId = this.getAttribute("data-target");
        const targetEl = targetId ? document.getElementById(targetId) : null;
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });

    // Crop Detail Modal Close
    const closeCropModalBtn = document.getElementById("closeCropModalBtn");
    const cropDetailModal = document.getElementById("cropDetailModal");
    if (closeCropModalBtn && cropDetailModal) {
      closeCropModalBtn.addEventListener("click", () => {
        cropDetailModal.classList.add("hidden-modal");
      });
      cropDetailModal.addEventListener("click", (e) => {
        if (e.target === cropDetailModal) {
          cropDetailModal.classList.add("hidden-modal");
        }
      });
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    const hasSaved = loadStateFromStorage();
    applyStaticTranslations();
    bindEvents();

    if (hasSaved && state.stage === "dashboard" && state.climateData && state.planResult) {
      showStage("dashboard");
      renderResultsUI(false);
    } else if (hasSaved && state.stage === "wizard") {
      if (state.countryId) {
        const panel = document.getElementById("regionPickerPanel");
        if (panel) panel.classList.remove("hidden-block");
      }
      goToWizardStep(state.wizStep || 1);
    } else {
      showStage("welcome");
    }
  });
})();
