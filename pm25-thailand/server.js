// Lightweight Zero-Dependency Local Static Server & REST API for PhraeBreathe (จังหวัดแพร่)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const AIR4THAI_URL = 'https://air4thai.pcd.go.th/services/getNewAQI_JSON.php';
const PHRAE_PCD_STATION_ID = '69t';
const AIR4THAI_CACHE_TTL_MS = 10 * 60 * 1000;
const CLEAN_ROOMS_URL = 'https://script.google.com/macros/s/AKfycbyD6E9p4oydOJXGvgqWlOcBranUNaO0tnS0yKlJuVcjvxQFz1hNHWvmzM6kk1PZ81ktiw/exec';
const ELDERLY_DISABILITY_URL = 'https://phrae.gdcatalog.go.th/dataset/a67be6b3-14c0-434f-9898-4e4c55726232/resource/e456d524-031c-4184-b0bb-6919f7af636a/download/register_01.csv';
const ELDERLY_POPULATION_URL = 'https://catalogapi.nso.go.th/api/index?table=OS_0405_01_0008_01&format=json';
const HOSPITAL_BEDS_URL = 'https://phrae.gdcatalog.go.th/dataset/7cf7aec2-8343-497e-ad07-031e961d270e/resource/56b1e1ba-e253-4490-9d71-488e75b30c89/download/.csv';
const AIR_POLLUTION_PATIENTS_URL = 'https://phrae.gdcatalog.go.th/dataset/6b1fa161-1d21-4352-8d91-747718bc2091/resource/f6ad2cbe-ee1f-44ce-818a-20f8cf140b6f/download/med.csv';
const PUBLIC_HEALTH_CACHE_TTL_MS = 60 * 60 * 1000;
const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';
let air4ThaiCache = null;
let air4ThaiCacheTime = 0;
let cleanRoomsCache = null;
let cleanRoomsCacheTime = 0;
let elderlyDisabilityCache = null;
let elderlyDisabilityCacheTime = 0;
let elderlyPopulationCache = null;
let elderlyPopulationCacheTime = 0;
let hospitalBedsCache = null;
let hospitalBedsCacheTime = 0;
let airPollutionPatientsCache = null;
let airPollutionPatientsCacheTime = 0;

function parsePublicCsv(csv, requiredColumns) {
  const [headerLine, ...lines] = csv.replace(/^\uFEFF/, '').split(/\r?\n/);
  const headers = headerLine?.split(',').map(value => value.trim()) || [];
  const columnIndexes = requiredColumns.map(column => headers.indexOf(column));
  if (columnIndexes.some(index => index < 0)) {
    throw new Error(`Public CSV is missing required columns: ${requiredColumns.join(', ')}`);
  }

  return lines.filter(Boolean).map(line => {
    const values = line.split(',').map(value => value.trim());
    return Object.fromEntries(requiredColumns.map((column, index) => [column, values[columnIndexes[index]]]));
  });
}

function getLineConfigurationStatus() {
  const channelConfigured = Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim());
  const recipientConfigured = Boolean(process.env.LINE_RECIPIENT_ID?.trim());
  return {
    configured: channelConfigured && recipientConfigured,
    channelConfigured,
    recipientConfigured
  };
}

async function sendLineSupportRequest(request) {
  const lineStatus = getLineConfigurationStatus();
  if (!lineStatus.configured) {
    return {
      sent: false,
      status: 'not_configured',
      message: 'ยังไม่ได้ตั้งค่า LINE Messaging API'
    };
  }

  const text = [
    'แจ้งเหตุ/ขอรับการสนับสนุน PM2.5 จังหวัดแพร่',
    `เลขที่: ${request.id}`,
    `ความเร่งด่วน: ${request.urgency}`,
    `ประเภท: ${request.requestType}`,
    `พื้นที่: ${request.district} ${request.subDistrict} จ.แพร่`,
    `รายละเอียด: ${String(request.details || '').slice(0, 1000)}`,
    `ผู้แจ้ง: ${request.requesterName}`,
    `โทร: ${request.phone}`,
    `เวลารับแจ้ง: ${request.timestamp}`
  ].join('\n');

  try {
    const response = await fetch(LINE_PUSH_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: process.env.LINE_RECIPIENT_ID.trim(),
        messages: [{ type: 'text', text }]
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[LINE Messaging API] HTTP ${response.status}: ${errorBody}`);
      return {
        sent: false,
        status: 'failed',
        message: `LINE Messaging API ตอบกลับ HTTP ${response.status}`
      };
    }

    return { sent: true, status: 'sent', message: 'ส่งแจ้งเตือน LINE แล้ว' };
  } catch (error) {
    console.error('[LINE Messaging API] notification failed:', error.message);
    return {
      sent: false,
      status: 'failed',
      message: `ส่ง LINE ไม่สำเร็จ: ${error.message}`
    };
  }
}

async function fetchCleanRooms() {
  if (cleanRoomsCache && Date.now() - cleanRoomsCacheTime < PUBLIC_HEALTH_CACHE_TTL_MS) {
    return cleanRoomsCache;
  }

  const response = await fetch(CLEAN_ROOMS_URL, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`กรมอนามัย HTTP ${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('กรมอนามัย returned an invalid clean-room dataset');

  const now = Date.now();
  const rooms = rows
    .filter(row => row.Province === 'แพร่')
    .map(row => {
      const expiry = row.ExpDate ? Date.parse(row.ExpDate) : NaN;
      const passed = row.Result === 'ผ่าน';
      const certificationStatus = !passed
        ? 'ไม่ผ่าน'
        : !Number.isFinite(expiry)
          ? 'ไม่มีวันหมดอายุในข้อมูล'
          : expiry >= now
            ? 'ผ่านและยังไม่หมดอายุ'
            : 'ผ่านแต่หมดอายุแล้ว';

      return {
        number: row.Number,
        locationName: row.LocationName,
        organization: row.OrgName,
        district: row.District,
        subdistrict: row.Subdistrict,
        type: row.Type,
        result: row.Result,
        evaluationDate: row.EvaluationDate,
        expiryDate: row.ExpDate || null,
        certificationStatus
      };
    });

  const summary = {
    registered: rooms.length,
    passed: rooms.filter(room => room.result === 'ผ่าน').length,
    valid: rooms.filter(room => room.certificationStatus === 'ผ่านและยังไม่หมดอายุ').length,
    expired: rooms.filter(room => room.certificationStatus === 'ผ่านแต่หมดอายุแล้ว').length,
    failed: rooms.filter(room => room.result !== 'ผ่าน').length
  };
  cleanRoomsCache = {
    success: true,
    source: 'กรมอนามัย: ทะเบียนห้องปลอดฝุ่น',
    sourceUrl: CLEAN_ROOMS_URL,
    queriedAt: new Date().toISOString(),
    summary,
    rooms
  };
  cleanRoomsCacheTime = now;
  return cleanRoomsCache;
}

async function fetchElderlyDisability() {
  if (elderlyDisabilityCache && Date.now() - elderlyDisabilityCacheTime < PUBLIC_HEALTH_CACHE_TTL_MS) {
    return elderlyDisabilityCache;
  }

  const response = await fetch(ELDERLY_DISABILITY_URL, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Phrae GDCatalog HTTP ${response.status}`);
  const csv = (await response.text()).replace(/^\uFEFF/, '');
  const rows = csv.split(/\r?\n/).slice(1).filter(Boolean).map(line => {
    const [yearText, district, countText] = line.split(',');
    return {
      year: Number(yearText),
      district: district?.trim(),
      count: Number(countText?.replace(/["\s,]/g, ''))
    };
  }).filter(row => Number.isFinite(row.year) && row.district && Number.isFinite(row.count));

  if (!rows.length) throw new Error('Phrae GDCatalog returned no valid elderly-disability records');
  const year = Math.max(...rows.map(row => row.year));
  const records = rows.filter(row => row.year === year);
  elderlyDisabilityCache = {
    success: true,
    source: 'สำนักงานจังหวัดแพร่: ผู้สูงอายุพิการที่จดทะเบียน',
    sourceUrl: ELDERLY_DISABILITY_URL,
    dataYear: year,
    queriedAt: new Date().toISOString(),
    total: records.reduce((sum, row) => sum + row.count, 0),
    records
  };
  elderlyDisabilityCacheTime = Date.now();
  return elderlyDisabilityCache;
}

async function fetchElderlyPopulation() {
  if (elderlyPopulationCache && Date.now() - elderlyPopulationCacheTime < PUBLIC_HEALTH_CACHE_TTL_MS) {
    return elderlyPopulationCache;
  }

  const response = await fetch(ELDERLY_POPULATION_URL, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`NSO elderly population API HTTP ${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('NSO returned an invalid elderly population dataset');

  const phraeRecords = rows.filter(row =>
    row.PROVINCE === 'จังหวัดแพร่' && row.SEX === 'รวม' && Number.isFinite(Number(row.YEAR)) && Number.isFinite(Number(row.VALUE))
  );
  if (!phraeRecords.length) throw new Error('NSO dataset has no elderly population record for Phrae');
  const latest = phraeRecords.reduce((current, row) =>
    Number(row.YEAR) > Number(current.YEAR) ? row : current
  );

  elderlyPopulationCache = {
    success: true,
    source: 'สำนักงานสถิติแห่งชาติ (ข้อมูลต้นทางจากกรมการปกครอง)',
    sourceUrl: ELDERLY_POPULATION_URL,
    dataYear: Number(latest.YEAR),
    queriedAt: new Date().toISOString(),
    total: Number(latest.VALUE)
  };
  elderlyPopulationCacheTime = Date.now();
  return elderlyPopulationCache;
}

async function fetchHospitalBeds() {
  if (hospitalBedsCache && Date.now() - hospitalBedsCacheTime < PUBLIC_HEALTH_CACHE_TTL_MS) {
    return hospitalBedsCache;
  }

  const response = await fetch(HOSPITAL_BEDS_URL, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Phrae hospital beds dataset HTTP ${response.status}`);
  const records = parsePublicCsv(await response.text(), ['ปี', 'อำเภอ', 'ประเภท', 'เตียง'])
    .map(row => ({
      year: Number(row['ปี']),
      district: row['อำเภอ'],
      type: row['ประเภท'],
      beds: Number(row['เตียง'])
    }))
    .filter(row => Number.isInteger(row.year) && row.district && Number.isFinite(row.beds) && row.beds >= 0);

  if (!records.length) throw new Error('Phrae hospital beds dataset returned no valid records');
  const dataYear = Math.max(...records.map(row => row.year));
  const latestRecords = records.filter(row => row.year === dataYear);
  hospitalBedsCache = {
    success: true,
    source: 'สำนักงานสาธารณสุขจังหวัดแพร่: จำนวนเตียงรายอำเภอ',
    sourceUrl: HOSPITAL_BEDS_URL,
    dataYear,
    queriedAt: new Date().toISOString(),
    totalBeds: latestRecords.reduce((sum, row) => sum + row.beds, 0),
    districtCount: latestRecords.length,
    records: latestRecords
  };
  hospitalBedsCacheTime = Date.now();
  return hospitalBedsCache;
}

async function fetchAirPollutionPatients() {
  if (airPollutionPatientsCache && Date.now() - airPollutionPatientsCacheTime < PUBLIC_HEALTH_CACHE_TTL_MS) {
    return airPollutionPatientsCache;
  }

  const response = await fetch(AIR_POLLUTION_PATIENTS_URL, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Phrae air-pollution patients dataset HTTP ${response.status}`);
  const records = parsePublicCsv(await response.text(), ['ปี', 'อำเภอ', 'กลุ่มโรค', 'จำนวนผู้ป่วย', 'หน่วย'])
    .map(row => ({
      year: Number(row['ปี']),
      district: row['อำเภอ'],
      disease: row['กลุ่มโรค'],
      patients: Number(row['จำนวนผู้ป่วย']),
      unit: row['หน่วย']
    }))
    .filter(row =>
      Number.isInteger(row.year) &&
      row.district &&
      row.disease &&
      Number.isFinite(row.patients) &&
      row.patients >= 0
    );

  if (!records.length) throw new Error('Phrae air-pollution patients dataset returned no valid records');
  const dataYear = Math.max(...records.map(row => row.year));
  const latestRecords = records.filter(row => row.year === dataYear);
  const diseaseMap = new Map();
  latestRecords.forEach(record => {
    const aggregate = diseaseMap.get(record.disease) || { disease: record.disease, patients: 0, districts: [] };
    aggregate.patients += record.patients;
    aggregate.districts.push({ district: record.district, patients: record.patients });
    diseaseMap.set(record.disease, aggregate);
  });
  const diseases = [...diseaseMap.values()].sort((a, b) => b.patients - a.patients);

  airPollutionPatientsCache = {
    success: true,
    source: 'สำนักงานสาธารณสุขจังหวัดแพร่: ผู้ป่วยด้วยโรคจากมลพิษทางอากาศ',
    sourceUrl: AIR_POLLUTION_PATIENTS_URL,
    dataYear,
    queriedAt: new Date().toISOString(),
    reportedCategoryCount: latestRecords.reduce((sum, row) => sum + row.patients, 0),
    diseases
  };
  airPollutionPatientsCacheTime = Date.now();
  return airPollutionPatientsCache;
}

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const SERVICES_FILE = path.join(DATA_DIR, 'services.json');
const REQUESTS_FILE = path.join(DATA_DIR, 'requests.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // ===================== REST API ROUTES =====================

  if ((req.method === 'GET' || req.method === 'HEAD') && pathname === '/api/v1/line/status') {
    const status = getLineConfigurationStatus();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
    res.end(req.method === 'HEAD' ? undefined : JSON.stringify(status));
    return;
  }

  // Proxy PCD's live station feed to avoid browser CORS restrictions.
  if ((req.method === 'GET' || req.method === 'HEAD') && pathname === '/api/v1/air-quality/pcd') {
    (async () => {
      try {
        if (!air4ThaiCache || Date.now() - air4ThaiCacheTime >= AIR4THAI_CACHE_TTL_MS) {
          const response = await fetch(AIR4THAI_URL, { signal: AbortSignal.timeout(10000) });
          if (!response.ok) throw new Error(`Air4Thai HTTP ${response.status}`);
          const json = await response.json();
          const station = (json.stations || []).find(item => item.stationID === PHRAE_PCD_STATION_ID);
          const latest = station?.AQILast;
          const pm25 = Number(latest?.PM25?.value);
          if (!station || !latest || !Number.isFinite(pm25) || pm25 < 0) {
            throw new Error(`Air4Thai station ${PHRAE_PCD_STATION_ID} has no valid PM2.5 reading`);
          }

          const parseReading = value => {
            const parsed = Number(value);
            return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
          };

          air4ThaiCache = {
            source: 'PCD Air4Thai',
            stationId: station.stationID,
            stationName: station.nameTH,
            stationNameEn: station.nameEN,
            area: station.areaTH,
            lat: parseReading(station.lat),
            lon: parseReading(station.long),
            timestamp: `${latest.date} ${latest.time}`,
            pm2_5: Math.round(pm25 * 10) / 10,
            pm25_aqi_th: parseReading(latest.PM25?.aqi),
            pm10: parseReading(latest.PM10?.value),
            overallAqi: parseReading(latest.AQI?.aqi),
            overallParam: latest.AQI?.param || null
          };
          air4ThaiCacheTime = Date.now();
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
        res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ station: air4ThaiCache }));
      } catch (error) {
        console.error('[Air4Thai] proxy request failed:', error.message);
        res.writeHead(502, { 'Content-Type': 'application/json; charset=UTF-8' });
        res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ error: 'PCD Air4Thai is temporarily unavailable' }));
      }
    })();
    return;
  }

  if ((req.method === 'GET' || req.method === 'HEAD') && pathname === '/api/v1/public/health-dashboard') {
    (async () => {
      const [
        cleanRoomsResult,
        elderlyDisabilityResult,
        elderlyPopulationResult,
        hospitalBedsResult,
        airPollutionPatientsResult
      ] = await Promise.allSettled([
        fetchCleanRooms(),
        fetchElderlyDisability(),
        fetchElderlyPopulation(),
        fetchHospitalBeds(),
        fetchAirPollutionPatients()
      ]);
      const data = {
        fetchedAt: new Date().toISOString(),
        cleanRooms: cleanRoomsResult.status === 'fulfilled'
          ? cleanRoomsResult.value
          : { success: false, error: cleanRoomsResult.reason.message },
        elderlyDisability: elderlyDisabilityResult.status === 'fulfilled'
          ? elderlyDisabilityResult.value
          : { success: false, error: elderlyDisabilityResult.reason.message },
        elderlyPopulation: elderlyPopulationResult.status === 'fulfilled'
          ? elderlyPopulationResult.value
          : { success: false, error: elderlyPopulationResult.reason.message },
        hospitalBeds: hospitalBedsResult.status === 'fulfilled'
          ? hospitalBedsResult.value
          : { success: false, error: hospitalBedsResult.reason.message },
        airPollutionPatients: airPollutionPatientsResult.status === 'fulfilled'
          ? airPollutionPatientsResult.value
          : { success: false, error: airPollutionPatientsResult.reason.message }
      };

      if (cleanRoomsResult.status === 'rejected') {
        console.error('[Anamai clean rooms] fetch failed:', cleanRoomsResult.reason.message);
      }
      if (elderlyDisabilityResult.status === 'rejected') {
        console.error('[Phrae elderly disability] fetch failed:', elderlyDisabilityResult.reason.message);
      }
      if (elderlyPopulationResult.status === 'rejected') {
        console.error('[NSO elderly population] fetch failed:', elderlyPopulationResult.reason.message);
      }
      if (hospitalBedsResult.status === 'rejected') {
        console.error('[Phrae hospital beds] fetch failed:', hospitalBedsResult.reason.message);
      }
      if (airPollutionPatientsResult.status === 'rejected') {
        console.error('[Phrae air-pollution patients] fetch failed:', airPollutionPatientsResult.reason.message);
      }

      res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify(data));
    })();
    return;
  }
  
  // 1. GET /api/v1/services (ข้อมูลชุดที่ 3: ข้อมูลบริการ จ.แพร่)
  if ((req.method === 'GET' || req.method === 'HEAD') && pathname === '/api/v1/services') {
    try {
      const data = fs.readFileSync(SERVICES_FILE, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
      if (req.method === 'HEAD') {
        res.end();
      } else {
        res.end(data);
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 2. POST /api/v1/services (บันทึกข้อมูลบริการชุดที่ 3 จ.แพร่)
  if (req.method === 'POST' && pathname === '/api/v1/services') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const newRecord = JSON.parse(body);
        newRecord.id = `SRV-PRE-${String(Date.now()).slice(-4)}`;
        newRecord.date = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

        const currentData = JSON.parse(fs.readFileSync(SERVICES_FILE, 'utf-8'));
        currentData.unshift(newRecord);
        fs.writeFileSync(SERVICES_FILE, JSON.stringify(currentData, null, 2), 'utf-8');

        res.writeHead(201, { 'Content-Type': 'application/json; charset=UTF-8' });
        res.end(JSON.stringify({ success: true, record: newRecord }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // 3. GET /api/v1/requests (รายการแจ้งเหตุ/ขอรับการสนับสนุน จ.แพร่)
  if ((req.method === 'GET' || req.method === 'HEAD') && pathname === '/api/v1/requests') {
    try {
      const data = fs.readFileSync(REQUESTS_FILE, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
      if (req.method === 'HEAD') {
        res.end();
      } else {
        res.end(data);
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 4. POST /api/v1/requests (ส่งคำขอรับการสนับสนุน สสจ.แพร่)
  if (req.method === 'POST' && pathname === '/api/v1/requests') {
    let body = '';
    let tooLarge = false;
    req.on('data', chunk => {
      if (tooLarge) return;
      body += chunk;
      if (Buffer.byteLength(body, 'utf8') > 10000) {
        tooLarge = true;
        body = '';
        res.writeHead(413, { 'Content-Type': 'application/json; charset=UTF-8' });
        res.end(JSON.stringify({ error: 'Request body too large' }));
      }
    });
    req.on('end', async () => {
      if (tooLarge) return;
      try {
        const newRequest = JSON.parse(body);
        newRequest.id = `REQ-PRE-${String(Date.now()).slice(-4)}`;
        newRequest.timestamp = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

        const currentRequests = JSON.parse(fs.readFileSync(REQUESTS_FILE, 'utf-8'));
        currentRequests.unshift(newRequest);
        fs.writeFileSync(REQUESTS_FILE, JSON.stringify(currentRequests, null, 2), 'utf-8');

        console.log(`[Support request]: saved ${newRequest.id} from ${newRequest.requesterName} (${newRequest.district})`);

        const notification = await sendLineSupportRequest(newRequest);
        newRequest.lineNotified = notification.sent;
        newRequest.lineNotificationStatus = notification.status;
        newRequest.status = notification.sent
          ? 'บันทึกแล้ว และส่งแจ้งเตือน LINE แล้ว'
          : notification.status === 'not_configured'
            ? 'บันทึกในระบบแล้ว (ยังไม่ได้ตั้งค่า LINE)'
            : 'บันทึกในระบบแล้ว (ส่ง LINE ไม่สำเร็จ)';
        if (!notification.sent) newRequest.lineNotificationError = notification.message;

        currentRequests[0] = newRequest;
        fs.writeFileSync(REQUESTS_FILE, JSON.stringify(currentRequests, null, 2), 'utf-8');

        res.writeHead(201, { 'Content-Type': 'application/json; charset=UTF-8' });
        res.end(JSON.stringify({
          success: true,
          request: newRequest,
          notification: {
            sent: notification.sent,
            status: notification.status,
            message: notification.message
          }
        }));
      } catch (err) {
        console.error('[Support request] failed:', err.message);
        if (!res.headersSent) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON payload or unable to save request' }));
        }
      }
    });
    return;
  }

  // ===================== STATIC FILE SERVING =====================
  let reqPath = pathname;
  if (reqPath === '/') reqPath = '/index.html';

  const filePath = path.join(__dirname, reqPath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=UTF-8' });
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n======================================================`);
  console.log(` 🇹🇭 PhraeBreathe - ศูนย์ปฏิบัติการฉุกเฉิน PM2.5 จังหวัดแพร่`);
  console.log(` 👉 แดชบอร์ด: ${url}`);
  console.log(` 👉 REST API: ${url}/api/v1/services`);
  console.log(`======================================================\n`);

  exec(`start ${url}`);
});
