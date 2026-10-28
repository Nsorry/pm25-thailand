// Chart.js Manager for PM2.5 Trend and Forecast

let pmChartInstance = null;

export function renderHourlyChart(canvasId, hourlyData, standard = 'pcd') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (pmChartInstance) {
    pmChartInstance.destroy();
  }

  if (!hourlyData || !hourlyData.time || !hourlyData.pm2_5) {
    return;
  }

  // Take the next 24 hours starting from current time
  const now = new Date();
  const times = hourlyData.time;
  const pm25Values = hourlyData.pm2_5;
  const aqiValues = hourlyData.us_aqi || [];

  // Find index closest to current hour
  let startIndex = 0;
  for (let i = 0; i < times.length; i++) {
    const t = new Date(times[i]);
    if (t >= now || i === times.length - 1) {
      startIndex = Math.max(0, i - 1);
      break;
    }
  }

  const sliceCount = 24;
  const labels = [];
  const chartData = [];
  const pointColors = [];

  for (let i = startIndex; i < Math.min(startIndex + sliceCount, times.length); i++) {
    const d = new Date(times[i]);
    const hours = String(d.getHours()).padStart(2, '0');
    labels.push(`${hours}:00`);

    const val = standard === 'pcd' ? pm25Values[i] : aqiValues[i];
    chartData.push(val);

    // Color code each point based on PCD standards
    const checkVal = pm25Values[i];
    if (checkVal <= 15) pointColors.push('#16a34a'); // Green
    else if (checkVal <= 25) pointColors.push('#10b981'); // Emerald
    else if (checkVal <= 37.5) pointColors.push('#f59e0b'); // Amber
    else if (checkVal <= 75) pointColors.push('#f97316'); // Orange
    else pointColors.push('#ef4444'); // Red
  }

  // Create gradient fill
  const gradient = ctx.createLinearGradient(0, 0, 0, 240);
  gradient.addColorStop(0, 'rgba(34, 197, 94, 0.2)');
  gradient.addColorStop(0.5, 'rgba(34, 197, 94, 0.1)');
  gradient.addColorStop(1, 'rgba(34, 197, 94, 0.01)');

  pmChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: standard === 'pcd' ? 'ค่าฝุ่น PM2.5 (µg/m³)' : 'ดัชนี US AQI',
          data: chartData,
          fill: true,
          backgroundColor: gradient,
          borderColor: '#16a34a',
          borderWidth: 2.5,
          tension: 0.35,
          pointBackgroundColor: pointColors,
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 7
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(22, 58, 37, 0.95)',
          titleFont: { family: 'Prompt, sans-serif', size: 13 },
          bodyFont: { family: 'Prompt, sans-serif', size: 13 },
          padding: 12,
          boxPadding: 6,
          usePointStyle: true,
          callbacks: {
            label: function (context) {
              const val = context.parsed.y;
              const unit = standard === 'pcd' ? ' µg/m³' : ' AQI';
              let statusText = '';
              if (standard === 'pcd') {
                if (val <= 15) statusText = ' (ดีมาก 💙)';
                else if (val <= 25) statusText = ' (ดี 💚)';
                else if (val <= 37.5) statusText = ' (ปานกลาง 💛)';
                else if (val <= 75) statusText = ' (เริ่มมีผลกระทบ 🧡)';
                else statusText = ' (มีผลกระทบ 🔴)';
              }
              return ` ${context.dataset.label}: ${val}${unit}${statusText}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(53, 94, 64, 0.1)'
          },
          ticks: {
            color: '#687b6d',
            font: { family: 'Prompt, sans-serif', size: 11 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(53, 94, 64, 0.12)'
          },
          ticks: {
            color: '#687b6d',
            font: { family: 'Prompt, sans-serif', size: 11 },
            callback: function (value) {
              return value + (standard === 'pcd' ? ' µg' : '');
            }
          }
        }
      }
    }
  });
}
