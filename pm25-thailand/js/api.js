// Live air-quality data from PCD Air4Thai and Open-Meteo.
const AQI_BASE_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const WEATHER_BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const PCD_PROXY_URL = '/api/v1/air-quality/pcd';
const PHRAE_PCD_STATION_ID = '69t';
const CACHE_TTL_MS = 10 * 60 * 1000;

let air4ThaiCache = null;
let air4ThaiCacheTime = 0;

async function fetchJson(url, label, timeout = 10000) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeout) });
  if (!response.ok) throw new Error(`${label} HTTP ${response.status}`);
  return response.json();
}

async function fetchPhraeFromAir4Thai() {
  if (air4ThaiCache && Date.now() - air4ThaiCacheTime < CACHE_TTL_MS) {
    return air4ThaiCache;
  }

  try {
    const result = await fetchJson(PCD_PROXY_URL, 'PCD Air4Thai', 10000);
    air4ThaiCache = result.station || null;
    air4ThaiCacheTime = Date.now();
    return air4ThaiCache;
  } catch (error) {
    console.warn('[PCD Air4Thai] fetch failed:', error.message);
    return null;
  }
}

async function fetchOpenMeteo(lat, lon) {
  const aqiUrl = `${AQI_BASE_URL}?latitude=${lat}&longitude=${lon}&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,dust,uv_index,european_aqi,us_aqi&hourly=pm10,pm2_5,european_aqi,us_aqi,uv_index&forecast_days=3&timezone=Asia%2FBangkok`;
  const weatherUrl = `${WEATHER_BASE_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m&timezone=Asia%2FBangkok`;
  const [aqiResult, weatherResult] = await Promise.allSettled([
    fetchJson(aqiUrl, 'Open-Meteo Air Quality'),
    fetchJson(weatherUrl, 'Open-Meteo Weather')
  ]);

  if (aqiResult.status === 'rejected' && weatherResult.status === 'rejected') {
    throw new Error(`Open-Meteo unavailable: ${aqiResult.reason.message}; ${weatherResult.reason.message}`);
  }

  return {
    aqi: aqiResult.status === 'fulfilled' ? aqiResult.value : null,
    weather: weatherResult.status === 'fulfilled' ? weatherResult.value : null,
    errors: [
      ...(aqiResult.status === 'rejected' ? [aqiResult.reason.message] : []),
      ...(weatherResult.status === 'rejected' ? [weatherResult.reason.message] : [])
    ]
  };
}

export async function fetchLocationAirQuality(lat, lon, districtId) {
  const [openMeteoResult, pcdResult] = await Promise.allSettled([
    fetchOpenMeteo(lat, lon),
    fetchPhraeFromAir4Thai()
  ]);

  const openMeteo = openMeteoResult.status === 'fulfilled' ? openMeteoResult.value : null;
  const pcdData = pcdResult.status === 'fulfilled' ? pcdResult.value : null;
  const isMueangPhraeStation = districtId === 'phrae_mueang';

  if (!openMeteo && !(isMueangPhraeStation && pcdData)) {
    const errors = [
      ...(openMeteoResult.status === 'rejected' ? [openMeteoResult.reason.message] : []),
      ...(pcdResult.status === 'rejected' ? [pcdResult.reason.message] : [])
    ];
    return { success: false, error: errors.join('; ') || 'ไม่มีข้อมูลจากแหล่งข้อมูลที่เชื่อมต่อ' };
  }

  const result = {
    success: true,
    aqi: openMeteo?.aqi || { current: null, hourly: null },
    weather: openMeteo?.weather || { current: null },
    timestamp: new Date().toISOString(),
    dataSource: 'Open-Meteo (แบบจำลอง)',
    errors: openMeteo?.errors || []
  };

  if (isMueangPhraeStation && pcdData) {
    const current = result.aqi.current || {};
    result.aqi.current = {
      ...current,
      time: pcdData.timestamp,
      pm2_5: pcdData.pm2_5,
      pm2_5_source: `PCD Air4Thai สถานี ${pcdData.stationName}`,
      ...(pcdData.pm10 !== null ? { pm10: pcdData.pm10 } : {}),
      ...(pcdData.pm25_aqi_th !== null ? { thai_aqi: pcdData.pm25_aqi_th } : {})
    };
    result.pcdRealtime = pcdData;
    result.dataSource = 'PCD Air4Thai + Open-Meteo';
  }

  return result;
}

export async function fetchBatchProvincesAQI(districts) {
  if (!districts?.length) return [];

  const lats = districts.map(district => district.lat.toFixed(4)).join(',');
  const lons = districts.map(district => district.lon.toFixed(4)).join(',');
  const url = `${AQI_BASE_URL}?latitude=${lats}&longitude=${lons}&current=pm2_5,pm10,us_aqi&timezone=Asia%2FBangkok`;

  try {
    const data = await fetchJson(url, 'Open-Meteo batch AQI', 12000);
    const results = Array.isArray(data) ? data : [data];
    const pcdData = await fetchPhraeFromAir4Thai();

    return districts.map((district, index) => {
      const current = results[index]?.current || {};
      let pm25 = Number.isFinite(current.pm2_5) ? Math.round(current.pm2_5 * 10) / 10 : null;
      let pm10 = Number.isFinite(current.pm10) ? Math.round(current.pm10 * 10) / 10 : null;
      const usAqi = Number.isFinite(current.us_aqi) ? current.us_aqi : null;
      let dataSource = 'Open-Meteo (แบบจำลอง)';

      if (district.id === 'phrae_mueang' && pcdData) {
        pm25 = pcdData.pm2_5;
        if (pcdData.pm10 !== null) pm10 = pcdData.pm10;
        dataSource = 'PCD Air4Thai (สถานี 69t)';
      }

      return { ...district, pm2_5: pm25, pm10, us_aqi: usAqi, dataSource };
    });
  } catch (error) {
    console.warn('Batch AQI request failed; trying individual locations:', error.message);
    return fetchBatchFallback(districts);
  }
}

async function fetchBatchFallback(districts) {
  const pcdData = await fetchPhraeFromAir4Thai();

  return Promise.all(districts.map(async district => {
    if (district.id === 'phrae_mueang' && pcdData) {
      return {
        ...district,
        pm2_5: pcdData.pm2_5,
        pm10: pcdData.pm10,
        us_aqi: null,
        dataSource: 'PCD Air4Thai (สถานี 69t)'
      };
    }

    try {
      const url = `${AQI_BASE_URL}?latitude=${district.lat}&longitude=${district.lon}&current=pm2_5,pm10,us_aqi&timezone=Asia%2FBangkok`;
      const data = await fetchJson(url, `Open-Meteo AQI (${district.name})`, 8000);
      const current = data.current || {};
      return {
        ...district,
        pm2_5: Number.isFinite(current.pm2_5) ? Math.round(current.pm2_5 * 10) / 10 : null,
        pm10: Number.isFinite(current.pm10) ? Math.round(current.pm10 * 10) / 10 : null,
        us_aqi: Number.isFinite(current.us_aqi) ? current.us_aqi : null,
        dataSource: 'Open-Meteo (แบบจำลอง)'
      };
    } catch (error) {
      console.warn(`No AQI data for ${district.name}:`, error.message);
      return { ...district, pm2_5: null, pm10: null, us_aqi: null, dataSource: 'ไม่มีข้อมูล' };
    }
  }));
}

export async function fetchPhraeForecast(lat = 18.1446, lon = 100.1410) {
  try {
    const url = `${AQI_BASE_URL}?latitude=${lat}&longitude=${lon}&hourly=pm2_5,us_aqi&forecast_days=2&timezone=Asia%2FBangkok`;
    return await fetchJson(url, 'Open-Meteo forecast');
  } catch (error) {
    console.warn('Forecast fetch failed:', error.message);
    return null;
  }
}

export async function getPCDStationInfo() {
  return fetchPhraeFromAir4Thai();
}

export function getWeatherDescription(code) {
  const weatherMap = {
    0: { text: 'ท้องฟ้าแจ่มใส', icon: 'sun', symbol: '☀️' },
    1: { text: 'แดดจัด เมฆบางส่วน', icon: 'sun-dim', symbol: '🌤️' },
    2: { text: 'มีเมฆเป็นบางส่วน', icon: 'cloud-sun', symbol: '⛅' },
    3: { text: 'ท้องฟ้ามีเมฆมาก', icon: 'cloud', symbol: '☁️' },
    45: { text: 'หมอกหนา', icon: 'cloud-fog', symbol: '🌫️' },
    48: { text: 'มีหมอกน้ำค้างแข็ง', icon: 'cloud-fog', symbol: '🌫️' },
    51: { text: 'ฝนละอองเบาบาง', icon: 'cloud-drizzle', symbol: '🌦️' },
    53: { text: 'ฝนละอองปานกลาง', icon: 'cloud-drizzle', symbol: '🌦️' },
    55: { text: 'ฝนละอองหนาแน่น', icon: 'cloud-drizzle', symbol: '🌧️' },
    61: { text: 'ฝนตกเล็กน้อย', icon: 'cloud-rain', symbol: '🌧️' },
    63: { text: 'ฝนตกปานกลาง', icon: 'cloud-rain', symbol: '🌧️' },
    65: { text: 'ฝนตกหนัก', icon: 'cloud-rain-heavy', symbol: '🌧️⛈️' },
    80: { text: 'ฝนซู่กระจาย', icon: 'cloud-rain', symbol: '🌦️' },
    81: { text: 'ฝนซู่ปานกลาง', icon: 'cloud-rain', symbol: '🌧️' },
    82: { text: 'ฝนซู่รุนแรง', icon: 'cloud-rain-heavy', symbol: '⛈️' },
    95: { text: 'พายุฝนฟ้าคะนอง', icon: 'cloud-lightning', symbol: '⚡' }
  };
  return weatherMap[code] || { text: 'ไม่มีข้อมูลสภาพอากาศ', icon: 'cloud', symbol: '—' };
}
