/* NAWAR GeoAI - Chart.js Renderers (Bilingual & Mobile-Responsive) */

window.NawarCharts = (function () {
  let strategyChartInstance = null;
  let scenarioChartInstance = null;

  function getFontFamily(lang) {
    return lang === "ar"
      ? "'IBM Plex Sans Arabic', 'IBM Plex Sans', sans-serif"
      : "'IBM Plex Sans', 'IBM Plex Sans Arabic', sans-serif";
  }

  function renderStrategyChart(canvasId, planResult, lang, t) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === "undefined") return;

    if (strategyChartInstance) {
      strategyChartInstance.destroy();
    }

    const fontFam = getFontFamily(lang);
    const sWater = planResult.strategies.water.metrics;
    const sProfit = planResult.strategies.profit.metrics;
    const sSoil = planResult.strategies.soil.metrics;

    const labels = [
      t.metricWaterEff,
      t.metricProfitPotential,
      t.metricSoilHealth,
      t.metricClimateResilience
    ];

    strategyChartInstance = new Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: t.strat_water_title,
            data: [
              sWater.waterEfficiency,
              sWater.profitPotential,
              sWater.soilHealth,
              sWater.climateResilience
            ],
            backgroundColor: "#1f5c3a",
            borderRadius: 5,
            maxBarThickness: 28
          },
          {
            label: t.strat_profit_title,
            data: [
              sProfit.waterEfficiency,
              sProfit.profitPotential,
              sProfit.soilHealth,
              sProfit.climateResilience
            ],
            backgroundColor: "#c57b27",
            borderRadius: 5,
            maxBarThickness: 28
          },
          {
            label: t.strat_soil_title,
            data: [
              sSoil.waterEfficiency,
              sSoil.profitPotential,
              sSoil.soilHealth,
              sSoil.climateResilience
            ],
            backgroundColor: "#3a7ca5",
            borderRadius: 5,
            maxBarThickness: 28
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 550,
          easing: "easeOutQuart"
        },
        plugins: {
          legend: {
            position: "top",
            rtl: lang === "ar",
            labels: {
              boxWidth: 12,
              boxHeight: 12,
              usePointStyle: true,
              pointStyle: "rectRounded",
              color: "#1f2923",
              font: {
                family: fontFam,
                size: 12,
                weight: "500"
              }
            }
          },
          tooltip: {
            rtl: lang === "ar",
            backgroundColor: "#1a241e",
            titleFont: { family: fontFam, size: 12, weight: "600" },
            bodyFont: { family: fontFam, size: 12 },
            padding: 10,
            cornerRadius: 6
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: "#3f4d45",
              font: { family: fontFam, size: 11, weight: "500" }
            }
          },
          y: {
            min: 0,
            max: 100,
            grid: { color: "#e6e4dc" },
            ticks: {
              stepSize: 20,
              color: "#57665d",
              font: { family: fontFam, size: 11 }
            },
            title: {
              display: true,
              text: t.chartAxisScore,
              color: "#57665d",
              font: { family: fontFam, size: 11, weight: "500" }
            }
          }
        }
      }
    });
  }

  function renderScenarioChart(canvasId, activeStrategy, lang, t) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === "undefined") return;

    if (scenarioChartInstance) {
      scenarioChartInstance.destroy();
    }

    const fontFam = getFontFamily(lang);
    const scenarios = activeStrategy.scenarioReport.scenarios;

    const seasonLabels = activeStrategy.steps.map((step, idx) => {
      const sTitle = idx === 0 ? t.season1Label : idx === 1 ? t.season2Label : t.season3Label;
      return `${sTitle}: ${step.crop.name[lang]}`;
    });

    const baselineData = scenarios[0].seasonScores.map((s) => s.score);
    const heatData = scenarios[1].seasonScores.map((s) => s.score);
    const droughtData = scenarios[2].seasonScores.map((s) => s.score);

    scenarioChartInstance = new Chart(canvas, {
      type: "bar",
      data: {
        labels: seasonLabels,
        datasets: [
          {
            label: t.scen_baseline,
            data: baselineData,
            backgroundColor: "#1f5c3a",
            borderRadius: 5,
            maxBarThickness: 30
          },
          {
            label: t.scen_heat,
            data: heatData,
            backgroundColor: "#d97724",
            borderRadius: 5,
            maxBarThickness: 30
          },
          {
            label: t.scen_drought,
            data: droughtData,
            backgroundColor: "#b84a39",
            borderRadius: 5,
            maxBarThickness: 30
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 550,
          easing: "easeOutQuart"
        },
        plugins: {
          legend: {
            position: "top",
            rtl: lang === "ar",
            labels: {
              boxWidth: 12,
              boxHeight: 12,
              usePointStyle: true,
              pointStyle: "rectRounded",
              color: "#1f2923",
              font: {
                family: fontFam,
                size: 12,
                weight: "500"
              }
            }
          },
          tooltip: {
            rtl: lang === "ar",
            backgroundColor: "#1a241e",
            titleFont: { family: fontFam, size: 12, weight: "600" },
            bodyFont: { family: fontFam, size: 12 },
            padding: 10,
            cornerRadius: 6
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: "#3f4d45",
              font: { family: fontFam, size: 11, weight: "500" }
            }
          },
          y: {
            min: 0,
            max: 100,
            grid: { color: "#e6e4dc" },
            ticks: {
              stepSize: 20,
              color: "#57665d",
              font: { family: fontFam, size: 11 }
            },
            title: {
              display: true,
              text: t.chartAxisScore,
              color: "#57665d",
              font: { family: fontFam, size: 11, weight: "500" }
            }
          }
        }
      }
    });
  }

  return {
    renderStrategyChart,
    renderScenarioChart
  };
})();

