/* NAWAR GeoAI - NASA POWER API Client & Seasonal Agroclimatology Parser */

window.NasaPowerService = (function () {
  const cache = new Map();

  const MONTHS_WINTER = ["OCT", "NOV", "DEC", "JAN", "FEB"];
  const MONTHS_SPRING = ["MAR", "APR", "MAY"];
  const MONTHS_SUMMER = ["JUN", "JUL", "AUG", "SEP"];

  function avg(values) {
    const valid = values.filter((v) => typeof v === "number" && v > -900);
    if (!valid.length) return 0;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
  }

  function maxVal(values) {
    const valid = values.filter((v) => typeof v === "number" && v > -900);
    if (!valid.length) return 0;
    return Math.max(...valid);
  }

  function minVal(values) {
    const valid = values.filter((v) => typeof v === "number" && v > -900);
    if (!valid.length) return 0;
    return Math.min(...valid);
  }

  function parseNasaParameters(paramObj) {
    const t2m = paramObj.T2M || {};
    const tMax = paramObj.T2M_MAX || {};
    const tMin = paramObj.T2M_MIN || {};
    const prec = paramObj.PRECTOTCORR || {};
    const solar = paramObj.ALLSKY_SFC_SW_DWN || {};

    function buildSeason(months, daysCount) {
      const meanTemp = avg(months.map((m) => t2m[m]));
      const peakTemp = maxVal(months.map((m) => tMax[m]));
      const lowTemp = minVal(months.map((m) => tMin[m]));
      const rainMmPerDay = avg(months.map((m) => prec[m]));
      const rainMmSeason = Math.round(rainMmPerDay * daysCount);
      const rawSolar = avg(months.map((m) => solar[m]));
      // NASA POWER AG community returns ALLSKY_SFC_SW_DWN in MJ/m²/day (1 kWh/m² = 3.6 MJ/m²)
      const solarRad = rawSolar > 11 ? rawSolar / 3.6 : rawSolar;
      return {
        meanTemp: Number(meanTemp.toFixed(1)),
        maxTemp: Number(peakTemp.toFixed(1)),
        minTemp: Number(lowTemp.toFixed(1)),
        rainMm: rainMmSeason,
        solarKwh: Number(solarRad.toFixed(2))
      };
    }

    const winter = buildSeason(MONTHS_WINTER, 151);
    const spring = buildSeason(MONTHS_SPRING, 92);
    const summer = buildSeason(MONTHS_SUMMER, 122);

    const annualTemp = typeof t2m.ANN === "number" && t2m.ANN > -900
      ? Number(t2m.ANN.toFixed(1))
      : Number(((winter.meanTemp + spring.meanTemp + summer.meanTemp) / 3).toFixed(1));

    const peakSummerTemp = summer.maxTemp;
    const annualRainfallMm = winter.rainMm + spring.rainMm + summer.rainMm;
    const rawAnnSolar = typeof solar.ANN === "number" && solar.ANN > -900 ? solar.ANN : 0;
    const meanSolar = rawAnnSolar > 0
      ? Number(((rawAnnSolar > 11 ? rawAnnSolar / 3.6 : rawAnnSolar)).toFixed(2))
      : Number(((winter.solarKwh + spring.solarKwh + summer.solarKwh) / 3).toFixed(2));

    return {
      source: "live",
      summary: {
        annualTemp,
        peakSummerTemp,
        annualRainfallMm,
        meanSolar
      },
      seasons: {
        winter,
        spring,
        summer
      }
    };
  }

  function buildFallbackClimate(lat, lon) {
    // Realistic Middle East & North Africa agroclimatology estimation based on coordinates
    const absLat = Math.abs(lat);
    const isLevantOrNorth = absLat >= 31.5 && lon >= 34 && lon <= 45;
    const isHighland = (lat > 14.5 && lat < 19.5 && lon > 41.5 && lon < 45.5) || (lat > 33.5 && lon > 35 && lon < 37);
    const isHyperAridGulf = absLat < 30 && lon >= 38;

    let winterMean = 16.5 - (absLat - 25) * 0.42;
    let springMean = 24.0 - (absLat - 25) * 0.35;
    let summerMean = 33.5 - (absLat - 25) * 0.22;

    if (isHighland) {
      winterMean -= 3.5;
      springMean -= 4.0;
      summerMean -= 5.5;
    } else if (isHyperAridGulf) {
      summerMean += 2.2;
    }

    let winterRain = isLevantOrNorth ? 210 : isHighland ? 140 : 45;
    let springRain = isLevantOrNorth ? 75 : isHighland ? 120 : 22;
    let summerRain = isHighland ? 95 : 5;

    // Coastal Mediterranean boost
    if (lat >= 30.5 && lat <= 36.8 && lon >= 29.5 && lon <= 36.5) {
      winterRain = Math.max(winterRain, 155);
    }

    const solarBase = isLevantOrNorth ? 5.6 : 6.4;

    const winter = {
      meanTemp: Number(winterMean.toFixed(1)),
      maxTemp: Number((winterMean + 7.2).toFixed(1)),
      minTemp: Number((winterMean - 6.5).toFixed(1)),
      rainMm: Math.round(winterRain),
      solarKwh: Number((solarBase - 1.4).toFixed(2))
    };
    const spring = {
      meanTemp: Number(springMean.toFixed(1)),
      maxTemp: Number((springMean + 8.0).toFixed(1)),
      minTemp: Number((springMean - 6.8).toFixed(1)),
      rainMm: Math.round(springRain),
      solarKwh: Number((solarBase + 0.3).toFixed(2))
    };
    const summer = {
      meanTemp: Number(summerMean.toFixed(1)),
      maxTemp: Number((summerMean + 8.4).toFixed(1)),
      minTemp: Number((summerMean - 6.2).toFixed(1)),
      rainMm: Math.round(summerRain),
      solarKwh: Number((solarBase + 1.1).toFixed(2))
    };

    return {
      source: "regional",
      summary: {
        annualTemp: Number(((winter.meanTemp + spring.meanTemp + summer.meanTemp) / 3).toFixed(1)),
        peakSummerTemp: summer.maxTemp,
        annualRainfallMm: winter.rainMm + spring.rainMm + summer.rainMm,
        meanSolar: Number(((winter.solarKwh + spring.solarKwh + summer.solarKwh) / 3).toFixed(2))
      },
      seasons: {
        winter,
        spring,
        summer
      }
    };
  }

  async function fetchClimate(lat, lon) {
    const key = `${Number(lat).toFixed(2)},${Number(lon).toFixed(2)}`;
    if (cache.has(key)) {
      return cache.get(key);
    }

    const url = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,ALLSKY_SFC_SW_DWN&community=AG&longitude=${Number(lon).toFixed(4)}&latitude=${Number(lat).toFixed(4)}&format=JSON`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const json = await response.json();
      const params = json && json.properties && json.properties.parameter;
      if (!params || !params.T2M) {
        throw new Error("Missing parameter payload");
      }
      const parsed = parseNasaParameters(params);
      cache.set(key, parsed);
      return parsed;
    } catch (err) {
      clearTimeout(timer);
      const fallback = buildFallbackClimate(lat, lon);
      cache.set(key, fallback);
      return fallback;
    }
  }

  return {
    fetchClimate,
    buildFallbackClimate
  };
})();

