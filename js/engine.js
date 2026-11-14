/* NAWAR GeoAI - Rule-Based Crop Scoring, 3-Season Rotation & Climate Stress-Test Engine */

window.NawarEngine = (function () {
  const SEASON_ORDER = {
    winter: ["winter", "spring", "summer"],
    spring: ["spring", "summer", "winter"],
    summer: ["summer", "winter", "spring"]
  };

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function scoreCropInSeason(crop, seasonKey, seasonClimate, soilType, goalMode, scenarioMods) {
    const mods = scenarioMods || { tempDelta: 0, rainMult: 1.0, waterDemandMult: 1.0 };
    const meanTemp = seasonClimate.meanTemp + mods.tempDelta;
    const maxTemp = seasonClimate.maxTemp + mods.tempDelta;
    const effectiveRain = seasonClimate.rainMm * mods.rainMult;

    // 1. Climate Fit (0 - 100)
    let climateScore = 82;
    const tr = crop.tempRange;

    if (meanTemp >= tr.optMin && meanTemp <= tr.optMax) {
      climateScore = 94;
    } else if (meanTemp >= tr.min && meanTemp < tr.optMin) {
      const ratio = (meanTemp - tr.min) / Math.max(1, tr.optMin - tr.min);
      climateScore = 62 + ratio * 28;
    } else if (meanTemp > tr.optMax && meanTemp <= tr.max) {
      const ratio = (tr.max - meanTemp) / Math.max(1, tr.max - tr.optMax);
      climateScore = 60 + ratio * 30;
    } else if (meanTemp < tr.min) {
      climateScore = Math.max(20, 55 - (tr.min - meanTemp) * 6);
    } else {
      climateScore = Math.max(18, 55 - (meanTemp - tr.max) * 6.5);
    }

    // Seasonal preference adjustment
    if (crop.preferredSeasons.includes(seasonKey)) {
      climateScore += 6;
    } else {
      climateScore -= 15;
    }

    // Extreme summer peak heat check
    if (maxTemp > tr.max + 5) {
      const excess = maxTemp - (tr.max + 5);
      const heatPenalty = excess * (1.8 - crop.heatTolerance * 0.11);
      climateScore -= Math.max(0, heatPenalty);
    }

    climateScore = clamp(Math.round(climateScore), 15, 99);

    // 2. Soil Fit (0 - 100)
    const soilScore = clamp(crop.soilScores[soilType] || 75, 30, 99);

    // 3. Water Efficiency (0 - 100)
    const adjustedWaterNeed = Math.round(crop.waterNeedMm * mods.waterDemandMult);
    const irrigationGap = Math.max(0, adjustedWaterNeed - effectiveRain);
    const rawWaterScore = 100 - (irrigationGap / 480) * 52 + crop.droughtTolerance * 2.2;
    const waterScore = clamp(Math.round(rawWaterScore), 25, 99);

    // 4. Economic Return Potential (0 - 100)
    const climateViabilityFactor = climateScore >= 65 ? 1.0 : climateScore / 70;
    const profitScore = clamp(Math.round(crop.returnScore * 10 * climateViabilityFactor), 30, 98);

    // 5. Soil Health & Nitrogen Impact (0 - 100)
    const soilHealthMap = { 3: 96, 2: 86, 1: 78, 0: 65, "-1": 50, "-2": 38 };
    const soilImpactScore = soilHealthMap[String(crop.soilImpact)] || 65;

    // Weighted Strategy Score
    let weights = { climate: 0.30, soil: 0.20, water: 0.25, profit: 0.15, soilHealth: 0.10 };
    if (goalMode === "water") {
      weights = { climate: 0.26, soil: 0.16, water: 0.42, profit: 0.08, soilHealth: 0.08 };
    } else if (goalMode === "profit") {
      weights = { climate: 0.26, soil: 0.16, water: 0.12, profit: 0.38, soilHealth: 0.08 };
    } else if (goalMode === "soil") {
      weights = { climate: 0.25, soil: 0.17, water: 0.14, profit: 0.08, soilHealth: 0.36 };
    }

    const composite =
      climateScore * weights.climate +
      soilScore * weights.soil +
      waterScore * weights.water +
      profitScore * weights.profit +
      soilImpactScore * weights.soilHealth;

    const totalScore = clamp(Math.round(composite), 20, 99);

    // Risk Level assessment
    let riskLevel = "low";
    if (climateScore < 62 || irrigationGap > 370) {
      riskLevel = "high";
    } else if (climateScore < 76 || irrigationGap > 270) {
      riskLevel = "medium";
    }

    return {
      crop,
      seasonKey,
      totalScore,
      climateScore,
      soilScore,
      waterScore,
      profitScore,
      soilImpactScore,
      adjustedWaterNeed,
      irrigationGap: Math.round(irrigationGap),
      riskLevel
    };
  }

  function buildRotationForGoal(crops, seasonSequence, climateData, soilType, prevCropId, goalMode) {
    const prevCropObj = crops.find((c) => c.id === prevCropId) || null;
    const prevFamily = prevCropObj ? prevCropObj.family : null;

    // Score all crops for each of the 3 seasons
    const seasonCandidates = seasonSequence.map((sKey) => {
      const sClim = climateData.seasons[sKey];
      return crops
        .map((crop) => scoreCropInSeason(crop, sKey, sClim, soilType, goalMode))
        .sort((a, b) => b.totalScore - a.totalScore);
    });

    // Search for the highest-scoring valid 3-season triplet that obeys agronomic rules:
    // 1. No consecutive family repetition (including prevFamily -> season 0, season 0 -> 1, season 1 -> 2)
    // 2. No duplicate crop in the 3-season plan
    // 3. Must include at least 1 legume (Fabaceae) across the 3 seasons (or 2 for soil strategy)
    let bestTriplet = null;
    let bestTripletScore = -Infinity;

    const top0 = seasonCandidates[0].slice(0, 10);
    const top1 = seasonCandidates[1].slice(0, 10);
    const top2 = seasonCandidates[2].slice(0, 10);

    for (const c0 of top0) {
      if (prevFamily && c0.crop.family === prevFamily) continue;
      for (const c1 of top1) {
        if (c1.crop.id === c0.crop.id) continue;
        if (c1.crop.family === c0.crop.family) continue;
        for (const c2 of top2) {
          if (c2.crop.id === c0.crop.id || c2.crop.id === c1.crop.id) continue;
          if (c2.crop.family === c1.crop.family) continue;

          const triplet = [c0, c1, c2];
          const legumeCount = triplet.filter((x) => x.crop.family === "Fabaceae").length;
          if (legumeCount < 1) continue;

          let bonus = 0;
          // Reward following a heavy feeder with a nitrogen fixer
          for (let i = 0; i < 2; i++) {
            if (triplet[i].crop.role === "heavy_feeder" && triplet[i + 1].crop.role === "nitrogen_fixer") {
              bonus += 14;
            }
          }
          if (prevCropObj && prevCropObj.role === "heavy_feeder" && c0.crop.role === "nitrogen_fixer") {
            bonus += 12;
          }
          if (goalMode === "soil" && legumeCount >= 1) {
            bonus += legumeCount * 10;
          }
          // Diversity of 3 distinct families across all 3 seasons
          if (c0.crop.family !== c2.crop.family) {
            bonus += 6;
          }

          const sumScore = c0.totalScore + c1.totalScore + c2.totalScore + bonus;
          if (sumScore > bestTripletScore) {
            bestTripletScore = sumScore;
            bestTriplet = triplet;
          }
        }
      }
    }

    // Fallback if strict constraints were too tight
    if (!bestTriplet) {
      bestTriplet = [seasonCandidates[0][0], seasonCandidates[1][1], seasonCandidates[2][2]];
    }

    // Annotate agronomic rule tags for clear farmer explanation
    const steps = bestTriplet.map((item, idx) => {
      let ruleKey = "ruleTagFamily";
      if (item.crop.role === "nitrogen_fixer") {
        ruleKey = "ruleTagLegume";
      } else if (item.seasonKey === "summer" || item.crop.droughtTolerance >= 9) {
        ruleKey = "ruleTagHeat";
      }
      return {
        ...item,
        stepIndex: idx + 1,
        ruleKey
      };
    });

    // Compute aggregate metrics (0 - 100) for Strategy Comparison Chart
    const avgWaterEff = Math.round((steps[0].waterScore + steps[1].waterScore + steps[2].waterScore) / 3);
    const avgProfit = Math.round((steps[0].profitScore + steps[1].profitScore + steps[2].profitScore) / 3);
    const avgSoil = Math.round((steps[0].soilImpactScore + steps[1].soilImpactScore + steps[2].soilImpactScore) / 3);
    const avgClimate = Math.round((steps[0].climateScore + steps[1].climateScore + steps[2].climateScore) / 3);
    const totalWaterMm = steps.reduce((acc, s) => acc + s.adjustedWaterNeed, 0);

    return {
      goalMode,
      steps,
      metrics: {
        waterEfficiency: avgWaterEff,
        profitPotential: avgProfit,
        soilHealth: avgSoil,
        climateResilience: avgClimate,
        totalWaterMm
      }
    };
  }

  function evaluateScenariosForStrategy(strategy, climateData, soilType) {
    const scenarioDefs = [
      {
        id: "baseline",
        labelKey: "scen_baseline",
        descKey: "scen_baseline_desc",
        mods: { tempDelta: 0, rainMult: 1.0, waterDemandMult: 1.0 }
      },
      {
        id: "heat",
        labelKey: "scen_heat",
        descKey: "scen_heat_desc",
        mods: { tempDelta: 2.0, rainMult: 1.0, waterDemandMult: 1.08 }
      },
      {
        id: "drought",
        labelKey: "scen_drought",
        descKey: "scen_drought_desc",
        mods: { tempDelta: 0.6, rainMult: 0.80, waterDemandMult: 1.05 }
      }
    ];

    const results = scenarioDefs.map((scen) => {
      const seasonScores = strategy.steps.map((step) => {
        const sClim = climateData.seasons[step.seasonKey];
        const reEval = scoreCropInSeason(
          step.crop,
          step.seasonKey,
          sClim,
          soilType,
          strategy.goalMode,
          scen.mods
        );
        // Combine climate, water & soil resilience under stress
        const stressScore = clamp(
          Math.round(
            reEval.climateScore * 0.45 +
            reEval.waterScore * 0.35 +
            reEval.soilScore * 0.20
          ),
          25,
          98
        );
        return {
          seasonKey: step.seasonKey,
          crop: step.crop,
          score: stressScore,
          waterNeedMm: reEval.adjustedWaterNeed
        };
      });

      const avgScore = Math.round(
        seasonScores.reduce((acc, s) => acc + s.score, 0) / seasonScores.length
      );
      const minScore = Math.min(...seasonScores.map((s) => s.score));
      const passed = avgScore >= 64 && minScore >= 55;

      return {
        id: scen.id,
        labelKey: scen.labelKey,
        descKey: scen.descKey,
        seasonScores,
        avgScore,
        passed
      };
    });

    const passedCount = results.filter((r) => r.passed).length;
    const overallAvg = Math.round(
      results.reduce((acc, r) => acc + r.avgScore, 0) / results.length
    );

    let confidenceLevel = "high";
    let confidenceTextKey = "confHigh";
    if (passedCount === 3) {
      confidenceLevel = "high";
      confidenceTextKey = "confHigh";
    } else if (passedCount === 2) {
      confidenceLevel = "medium";
      confidenceTextKey = "confMed";
    } else {
      confidenceLevel = "low";
      confidenceTextKey = "confLow";
    }

    return {
      scenarios: results,
      passedCount,
      totalScenarios: 3,
      confidencePercent: clamp(overallAvg + (passedCount === 3 ? 6 : 0), 45, 96),
      confidenceLevel,
      confidenceTextKey
    };
  }

  function generateFullPlan(params) {
    const { crops, climateData, soilType, prevCropId, startSeason, priority } = params;
    const seasonSequence = SEASON_ORDER[startSeason] || SEASON_ORDER.winter;

    const strategies = {
      water: buildRotationForGoal(crops, seasonSequence, climateData, soilType, prevCropId, "water"),
      profit: buildRotationForGoal(crops, seasonSequence, climateData, soilType, prevCropId, "profit"),
      soil: buildRotationForGoal(crops, seasonSequence, climateData, soilType, prevCropId, "soil")
    };

    Object.keys(strategies).forEach((key) => {
      strategies[key].scenarioReport = evaluateScenariosForStrategy(
        strategies[key],
        climateData,
        soilType
      );
    });

    return {
      recommendedKey: priority || "water",
      seasonSequence,
      strategies
    };
  }

  return {
    generateFullPlan
  };
})();

