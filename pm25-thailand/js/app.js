// PhraeBreathe PHEOC - Public Health Emergency Operations Center Controller
// Exclusively for Phrae Province (จังหวัดแพร่) - 8 Districts & Sub-districts (ตำบล)

import { PHRAE_DISTRICTS } from './district-data.js';
import { getThaiPcdStatus, getUSAqiStatus, formatThaiDateTime } from './aqi-utils.js';
import { fetchLocationAirQuality, fetchBatchProvincesAQI, getWeatherDescription } from './api.js';
import { renderHourlyChart } from './charts.js';
import { initMap, updateMapMarkers, panToLocation, refreshMapLayout } from './map.js';

// Application State (Strictly Phrae Province)
const state = {
  provinceName: 'แพร่',
  provinceNameEn: 'Phrae',
  provinceCenterLat: 18.1446,
  provinceCenterLon: 100.1410,
  currentDistrict: PHRAE_DISTRICTS[0], // Default: อำเภอเมืองแพร่
  activeDistrictId: PHRAE_DISTRICTS[0].id,
  standard: 'pcd', // 'pcd' | 'us'
  rankingsTab: 'cleanest', // 'cleanest' | 'polluted'
  batchDistrictsData: [],
  currentAirData: null,
  cleanRoomsData: null,
  elderlyDisabilityData: null,
  elderlyPopulationData: null,
  hospitalBedsData: null,
  airPollutionPatientsData: null,
  publicHealthDataLoaded: false,
  servicesData: [],
  requestsData: []
};

// DOM Elements Mapping
const elements = {
  // Navigation Tabs
  navTabs: document.querySelectorAll('.nav-tab'),
  tabContents: document.querySelectorAll('.tab-content'),

  // Search & Navigation in Phrae
  districtSelectTop: document.getElementById('districtSelectTop'),
  districtSelectInline: document.getElementById('districtSelectInline'),
  districtSearchInput: document.getElementById('districtSearchInput'),
  clearSearchBtn: document.getElementById('clearSearchBtn'),
  searchDropdown: document.getElementById('searchDropdown'),
  btnStdPCD: document.getElementById('btnStdPCD'),
  btnStdUS: document.getElementById('btnStdUS'),
  btnRefresh: document.getElementById('btnRefresh'),
  refreshIcon: document.getElementById('refreshIcon'),
  quickChipsContainer: document.getElementById('quickChipsContainer'),
  ambientGlow: document.getElementById('ambientGlow'),
  sopAlertTitle: document.getElementById('sopAlertTitle'),
  btnViewSopDetail: document.getElementById('btnViewSopDetail'),

  // Hero Card Overview
  regionLabel: document.getElementById('regionLabel'),
  currentDistrictName: document.getElementById('currentDistrictName'),
  currentDistrictEn: document.getElementById('currentDistrictEn'),
  updatedTimeText: document.getElementById('updatedTimeText'),
  cardGlowEffect: document.getElementById('cardGlowEffect'),
  gaugeProgressCircle: document.getElementById('gaugeProgressCircle'),
  mainPm25Value: document.getElementById('mainPm25Value'),
  statusBadgeContainer: document.getElementById('statusBadgeContainer'),
  statusEmoji: document.getElementById('statusEmoji'),
  statusLabel: document.getElementById('statusLabel'),
  statusDescription: document.getElementById('statusDescription'),
  mainUsAqiValue: document.getElementById('mainUsAqiValue'),
  usAqiDot: document.getElementById('usAqiDot'),
  mainPm10Value: document.getElementById('mainPm10Value'),

  // Weather Bar
  weatherIconSymbol: document.getElementById('weatherIconSymbol'),
  weatherText: document.getElementById('weatherText'),
  currentTempText: document.getElementById('currentTempText'),
  currentHumidityText: document.getElementById('currentHumidityText'),
  currentWindText: document.getElementById('currentWindText'),
  healthTipsList: document.getElementById('healthTipsList'),
  riskGroupTipText: document.getElementById('riskGroupTipText'),

  // Sub-district (ตำบล) Drilldown
  drilldownDistrictText: document.getElementById('drilldownDistrictText'),
  subDistrictGrid: document.getElementById('subDistrictGrid'),

  // Map & Rankings
  btnReloadMap: document.getElementById('btnReloadMap'),
  tabCleanest: document.getElementById('tabCleanest'),
  tabPolluted: document.getElementById('tabPolluted'),
  rankingsList: document.getElementById('rankingsList'),

  // Data source display
  dataSourceBadge: document.getElementById('dataSourceBadge'),
  dataSourceLabel: document.getElementById('dataSourceLabel'),

  // Clean Rooms Tab
  crTotalRegistered: document.getElementById('crTotalRegistered'),
  crTotalPassed: document.getElementById('crTotalPassed'),
  crTotalValid: document.getElementById('crTotalValid'),
  crElderlyDisabled: document.getElementById('crElderlyDisabled'),
  crElderlyDataYear: document.getElementById('crElderlyDataYear'),
  crElderlyPopulation: document.getElementById('crElderlyPopulation'),
  crElderlyPopulationYear: document.getElementById('crElderlyPopulationYear'),
  cleanRoomDataStatus: document.getElementById('cleanRoomDataStatus'),
  elderlyDisabilityDataStatus: document.getElementById('elderlyDisabilityDataStatus'),
  cleanRoomTableBody: document.getElementById('cleanRoomTableBody'),

  // Executive Report Tab
  btnExportExecJson: document.getElementById('btnExportExecJson'),
  execCrActive: document.getElementById('execCrActive'),
  execCrCoverage: document.getElementById('execCrCoverage'),
  execShortageAreas: document.getElementById('execShortageAreas'),
  execPollutionDataYear: document.getElementById('execPollutionDataYear'),
  execPollutionDisease: document.getElementById('execPollutionDisease'),
  execBedDataYear: document.getElementById('execBedDataYear'),
  execBedBaseline: document.getElementById('execBedBaseline'),
  execMasksDistributed: document.getElementById('execMasksDistributed'),
  execMasksRemaining: document.getElementById('execMasksRemaining'),
  execPurifiersDeployed: document.getElementById('execPurifiersDeployed'),
  execOpdSurge: document.getElementById('execOpdSurge'),
  execBedOccupancy: document.getElementById('execBedOccupancy'),
  execReservedBeds: document.getElementById('execReservedBeds'),
  execHomeVisits: document.getElementById('execHomeVisits'),
  execMobileUnits: document.getElementById('execMobileUnits'),

  // Health Beds Tab
  bedTotal: document.getElementById('bedTotal'),
  bedOccupancyRate: document.getElementById('bedOccupancyRate'),
  bedReserved: document.getElementById('bedReserved'),
  bedIcu: document.getElementById('bedIcu'),
  opdSurgeBadge: document.getElementById('opdSurgeBadge'),
  opdDiseasesList: document.getElementById('opdDiseasesList'),
  btnStartAiScreening: document.getElementById('btnStartAiScreening'),
  btnMorPromtConnect: document.getElementById('btnMorPromtConnect'),

  // Logistics Tab
  logN95Distributed: document.getElementById('logN95Distributed'),
  logN95Remaining: document.getElementById('logN95Remaining'),
  logSurgDistributed: document.getElementById('logSurgDistributed'),
  logSurgRemaining: document.getElementById('logSurgRemaining'),
  logPurifierDeployed: document.getElementById('logPurifierDeployed'),
  logPurifierRemaining: document.getElementById('logPurifierRemaining'),
  logMobileHomeVisits: document.getElementById('logMobileHomeVisits'),
  btnLogisticsAdd: document.getElementById('btnLogisticsAdd'),

  // Services Tab
  servicesTableBody: document.getElementById('servicesTableBody'),
  requestsListContainer: document.getElementById('requestsListContainer'),
  btnOpenNewServiceModal: document.getElementById('btnOpenNewServiceModal'),

  // Modals & Action Buttons
  serviceModal: document.getElementById('serviceModal'),
  btnCloseServiceModal: document.getElementById('btnCloseServiceModal'),
  btnCancelServiceModal: document.getElementById('btnCancelServiceModal'),
  newServiceForm: document.getElementById('newServiceForm'),
  inputDistrictSelectModal: document.getElementById('inputDistrictSelectModal'),

  supportModal: document.getElementById('supportModal'),
  btnCloseSupportModal: document.getElementById('btnCloseSupportModal'),
  btnCancelSupportModal: document.getElementById('btnCancelSupportModal'),
  supportRequestForm: document.getElementById('supportRequestForm'),
  reqDistrictSelectModal: document.getElementById('reqDistrictSelectModal'),
  btnOpenSupportRequest: document.getElementById('btnOpenSupportRequest'),
  btnOpenTelehealth: document.getElementById('btnOpenTelehealth')
};

// Application Initialization
document.addEventListener('DOMContentLoaded', async () => {
  renderDistrictSelectOptions();
  renderQuickChips();
  setupEventListeners();

  // Initialize Map strictly centered on Phrae
  initMap('thailandAirMap', state.provinceCenterLat, state.provinceCenterLon, onSelectDistrict);

  // Initial Load: Default District (อำเภอเมืองแพร่)
  await onSelectDistrict(state.currentDistrict, false);

  // Batch Load All 8 Districts for Map & Ranking
  await loadBatchDistricts();

  // Render Operational Modules for Phrae
  renderCleanRoomsTab();
  renderExecutiveReportTab();
  renderHealthBedsTab();
  renderLogisticsTab();

  // Load Services Data & Support Requests from REST API
  loadServicesAndRequests();
  loadPublicHealthData();
  loadLineStatus();

  if (window.lucide) window.lucide.createIcons();
});

/**
 * Populate 8 Districts of Phrae in Select Dropdowns
 */
function renderDistrictSelectOptions() {
  const optionsHtml = PHRAE_DISTRICTS.map(
    d => `<option value="${d.id}">${d.name} (${d.nameEn})</option>`
  ).join('');

  if (elements.districtSelectTop) {
    elements.districtSelectTop.innerHTML = optionsHtml;
    elements.districtSelectTop.value = state.currentDistrict.id;
    elements.districtSelectTop.addEventListener('change', e => {
      const found = PHRAE_DISTRICTS.find(d => d.id === e.target.value);
      if (found) onSelectDistrict(found);
    });
  }

  if (elements.districtSelectInline) {
    elements.districtSelectInline.innerHTML = optionsHtml;
    elements.districtSelectInline.value = state.currentDistrict.id;
    elements.districtSelectInline.addEventListener('change', e => {
      const found = PHRAE_DISTRICTS.find(d => d.id === e.target.value);
      if (found) onSelectDistrict(found);
    });
  }

  if (elements.inputDistrictSelectModal) {
    elements.inputDistrictSelectModal.innerHTML = PHRAE_DISTRICTS.map(
      d => `<option value="${d.id}">${d.name}</option>`
    ).join('');
  }

  if (elements.reqDistrictSelectModal) {
    elements.reqDistrictSelectModal.innerHTML = PHRAE_DISTRICTS.map(
      d => `<option value="${d.id}">${d.name}</option>`
    ).join('');
  }
}

/**
 * Render Quick Selection Chips for Phrae's 8 Districts
 */
function renderQuickChips() {
  if (!elements.quickChipsContainer) return;

  elements.quickChipsContainer.innerHTML = PHRAE_DISTRICTS.map(
    d => `
      <button 
        data-district-id="${d.id}"
        class="quick-chip px-3 py-1.5 rounded-xl text-xs font-medium border border-slate-700/80 bg-slate-900/80 text-slate-300 hover:text-white hover:border-sky-500 transition whitespace-nowrap active:scale-95 ${
          d.id === state.currentDistrict.id ? 'active bg-sky-600/30 text-sky-300 border-sky-500 font-bold' : ''
        }"
      >
        ${d.name.replace('อำเภอ', 'อ.')}
      </button>
    `
  ).join('');

  elements.quickChipsContainer.querySelectorAll('.quick-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const dId = btn.getAttribute('data-district-id');
      const found = PHRAE_DISTRICTS.find(d => d.id === dId);
      if (found) onSelectDistrict(found);
    });
  });
}

/**
 * Setup Main Event Listeners
 */
function setupEventListeners() {
  // Navigation Tabs Switcher
  elements.navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTabId = tab.getAttribute('data-tab');

      elements.navTabs.forEach(t => {
        t.classList.remove('active', 'text-sky-400');
        t.classList.add('text-slate-400');
      });
      tab.classList.add('active', 'text-sky-400');
      tab.classList.remove('text-slate-400');

      elements.tabContents.forEach(content => {
        if (content.id === targetTabId) {
          content.classList.remove('hidden');
        } else {
          content.classList.add('hidden');
        }
      });

      if (targetTabId === 'tab-overview') {
        refreshMapLayout();
      }

      if (window.lucide) window.lucide.createIcons();
    });
  });

  // SOP banner detail button switches directly to executive report
  if (elements.btnViewSopDetail) {
    elements.btnViewSopDetail.addEventListener('click', () => {
      const execTab = document.querySelector('.nav-tab[data-tab="tab-executive-report"]');
      if (execTab) execTab.click();
    });
  }

  // Standard Unit Switcher (PCD vs US AQI)
  if (elements.btnStdPCD) elements.btnStdPCD.addEventListener('click', () => setStandard('pcd'));
  if (elements.btnStdUS) elements.btnStdUS.addEventListener('click', () => setStandard('us'));

  // Refresh Button
  if (elements.btnRefresh) {
    elements.btnRefresh.addEventListener('click', async () => {
      if (elements.refreshIcon) elements.refreshIcon.classList.add('animate-spin');
      await loadDistrictAirData(state.currentDistrict);
      await loadBatchDistricts();
      await loadServicesAndRequests();
      await loadPublicHealthData();
      setTimeout(() => {
        if (elements.refreshIcon) elements.refreshIcon.classList.remove('animate-spin');
      }, 600);
    });
  }

  // Map Reload
  if (elements.btnReloadMap) {
    elements.btnReloadMap.addEventListener('click', () => {
      refreshMapLayout();
      panToLocation(state.currentDistrict.lat, state.currentDistrict.lon, 10);
    });
  }

  // Search Input for Districts & Tambons in Phrae
  if (elements.districtSearchInput) {
    elements.districtSearchInput.addEventListener('input', handleSearchInput);
  }
  if (elements.clearSearchBtn) {
    elements.clearSearchBtn.addEventListener('click', () => {
      elements.districtSearchInput.value = '';
      elements.clearSearchBtn.classList.add('hidden');
      elements.searchDropdown.classList.add('hidden');
    });
  }

  document.addEventListener('click', e => {
    if (elements.districtSearchInput && elements.searchDropdown) {
      if (!elements.districtSearchInput.contains(e.target) && !elements.searchDropdown.contains(e.target)) {
        elements.searchDropdown.classList.add('hidden');
      }
    }
  });

  // Rankings Tabs (Cleanest vs Polluted)
  if (elements.tabCleanest) {
    elements.tabCleanest.addEventListener('click', () => {
      state.rankingsTab = 'cleanest';
      elements.tabCleanest.className = 'flex-1 py-1.5 rounded-lg bg-emerald-600 text-white transition flex items-center justify-center gap-1.5';
      elements.tabPolluted.className = 'flex-1 py-1.5 rounded-lg text-slate-400 hover:text-white transition flex items-center justify-center gap-1.5';
      renderRankings();
    });
  }

  if (elements.tabPolluted) {
    elements.tabPolluted.addEventListener('click', () => {
      state.rankingsTab = 'polluted';
      elements.tabPolluted.className = 'flex-1 py-1.5 rounded-lg bg-rose-600 text-white transition flex items-center justify-center gap-1.5';
      elements.tabCleanest.className = 'flex-1 py-1.5 rounded-lg text-slate-400 hover:text-white transition flex items-center justify-center gap-1.5';
      renderRankings();
    });
  }

  // Modals Handlers
  if (elements.btnOpenNewServiceModal) {
    elements.btnOpenNewServiceModal.addEventListener('click', () => elements.serviceModal.classList.remove('hidden'));
  }
  if (elements.btnCloseServiceModal) {
    elements.btnCloseServiceModal.addEventListener('click', () => elements.serviceModal.classList.add('hidden'));
  }
  if (elements.btnCancelServiceModal) {
    elements.btnCancelServiceModal.addEventListener('click', () => elements.serviceModal.classList.add('hidden'));
  }

  if (elements.btnOpenSupportRequest) {
    elements.btnOpenSupportRequest.addEventListener('click', () => elements.supportModal.classList.remove('hidden'));
  }
  if (elements.btnCloseSupportModal) {
    elements.btnCloseSupportModal.addEventListener('click', () => elements.supportModal.classList.add('hidden'));
  }
  if (elements.btnCancelSupportModal) {
    elements.btnCancelSupportModal.addEventListener('click', () => elements.supportModal.classList.add('hidden'));
  }

  if (elements.btnLogisticsAdd) {
    elements.btnLogisticsAdd.addEventListener('click', () => {
      elements.serviceModal.classList.remove('hidden');
    });
  }

  // Telehealth & AI Health Code Gateways
  if (elements.btnOpenTelehealth) {
    elements.btnOpenTelehealth.addEventListener('click', () => {
      alert('ระบบเทเลเฮลธ์ยังไม่ได้เชื่อมต่อกับระบบหมอพร้อมหรือโรงพยาบาล กรุณาติดต่อหน่วยบริการในพื้นที่โดยตรง');
    });
  }

  if (elements.btnStartAiScreening) {
    elements.btnStartAiScreening.addEventListener('click', () => {
      alert('ระบบคัดกรองสุขภาพยังไม่ได้เชื่อมต่อกับบริการทางการ และไม่ได้บันทึกหรือส่งข้อมูลสุขภาพ');
    });
  }

  if (elements.btnMorPromtConnect) {
    elements.btnMorPromtConnect.addEventListener('click', () => {
      alert('ยังไม่มีการเชื่อมต่อฐานข้อมูลหมอพร้อมหรือคลังยาในขณะนี้');
    });
  }

  // Export Executive JSON
  if (elements.btnExportExecJson) {
    elements.btnExportExecJson.addEventListener('click', exportExecutiveSummary);
  }

  // Forms
  if (elements.newServiceForm) {
    elements.newServiceForm.addEventListener('submit', handleNewServiceSubmit);
  }
  if (elements.supportRequestForm) {
    elements.supportRequestForm.addEventListener('submit', handleSupportRequestSubmit);
  }
}

/**
 * Handle District Selection in Phrae
 */
export async function onSelectDistrict(district, flyMap = true) {
  if (!district) return;
  state.currentDistrict = district;
  state.activeDistrictId = district.id;

  // Sync Select Dropdowns
  if (elements.districtSelectTop) elements.districtSelectTop.value = district.id;
  if (elements.districtSelectInline) elements.districtSelectInline.value = district.id;
  if (elements.drilldownDistrictText) elements.drilldownDistrictText.textContent = district.name;

  // Sync Quick Chips Active State
  if (elements.quickChipsContainer) {
    elements.quickChipsContainer.querySelectorAll('.quick-chip').forEach(btn => {
      const isSelected = btn.getAttribute('data-district-id') === district.id;
      btn.classList.toggle('active', isSelected);
      btn.classList.toggle('bg-sky-600/30', isSelected);
      btn.classList.toggle('text-sky-300', isSelected);
      btn.classList.toggle('border-sky-500', isSelected);
      btn.classList.toggle('font-bold', isSelected);
    });
  }

  // Render Sub-districts (ตำบล) for this district
  renderSubDistricts();

  // Pan Map
  if (flyMap) {
    panToLocation(district.lat, district.lon, 11);
  }

  // Load Live Air Quality Data for this district
  await loadDistrictAirData(district);

  // Update map pin highlight
  if (state.batchDistrictsData.length > 0) {
    updateMapMarkers(state.batchDistrictsData, district.id, onSelectDistrict);
  }
}

/**
 * Load Air Quality Data for a Single District in Phrae
 */
async function loadDistrictAirData(district) {
  try {
    const result = await fetchLocationAirQuality(district.lat, district.lon, district.id);
    if (!result.success) {
      state.currentAirData = null;
      showAirDataUnavailable(district, result.error);
      return;
    }

    state.currentAirData = result;

    updateMainCardUI(district, result);
    updateHourlyChart(result);
  } catch (error) {
    console.error('Failed to load district air data:', error);
    state.currentAirData = null;
    showAirDataUnavailable(district, error.message);
  }
}

function showAirDataUnavailable(district, errorMessage) {
  const status = getThaiPcdStatus(null);
  if (elements.currentDistrictName) elements.currentDistrictName.textContent = district.name;
  if (elements.currentDistrictEn) elements.currentDistrictEn.textContent = `${district.nameEn}, Phrae Province`;
  if (elements.updatedTimeText) elements.updatedTimeText.textContent = 'ไม่มีข้อมูล';
  if (elements.mainPm25Value) elements.mainPm25Value.textContent = '--';
  if (elements.mainPm10Value) elements.mainPm10Value.textContent = '--';
  if (elements.mainUsAqiValue) elements.mainUsAqiValue.textContent = '--';
  if (elements.statusEmoji) elements.statusEmoji.textContent = status.statusEmoji;
  if (elements.statusLabel) elements.statusLabel.textContent = status.label;
  if (elements.statusDescription) elements.statusDescription.textContent = 'ไม่สามารถดึงข้อมูลคุณภาพอากาศจากแหล่งข้อมูลได้ในขณะนี้';
  if (elements.statusBadgeContainer) {
    elements.statusBadgeContainer.className = `inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-base font-bold border ${status.badgeBg}`;
  }
  if (elements.usAqiDot) elements.usAqiDot.style.backgroundColor = status.color;
  if (elements.cardGlowEffect) elements.cardGlowEffect.style.backgroundColor = `${status.color}15`;
  if (elements.ambientGlow) {
    elements.ambientGlow.className = 'fixed inset-0 pointer-events-none transition-colors duration-1000 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-500/10 via-slate-950/80 to-slate-950';
  }
  if (elements.dataSourceBadge) {
    elements.dataSourceBadge.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/15 text-slate-400 border border-slate-500/30';
    elements.dataSourceBadge.textContent = 'ไม่มีข้อมูล';
  }
  if (elements.dataSourceLabel) {
    elements.dataSourceLabel.textContent = `แหล่งข้อมูลไม่พร้อมใช้งาน${errorMessage ? `: ${errorMessage}` : ''}`;
  }
  if (elements.sopAlertTitle) elements.sopAlertTitle.textContent = `สถานะ: ไม่มีข้อมูล — ${district.name} จังหวัดแพร่`;
  if (elements.gaugeProgressCircle) {
    elements.gaugeProgressCircle.style.strokeDashoffset = String(2 * Math.PI * 66);
    elements.gaugeProgressCircle.style.stroke = status.color;
  }
  if (elements.weatherIconSymbol) elements.weatherIconSymbol.textContent = '—';
  if (elements.weatherText) elements.weatherText.textContent = 'ไม่มีข้อมูลสภาพอากาศ';
  if (elements.currentTempText) elements.currentTempText.textContent = '-- °C';
  if (elements.currentHumidityText) elements.currentHumidityText.textContent = '-- %';
  if (elements.currentWindText) elements.currentWindText.textContent = '-- km/h';
  if (elements.healthTipsList) elements.healthTipsList.innerHTML = '';
  if (elements.riskGroupTipText) elements.riskGroupTipText.textContent = 'ไม่สามารถให้คำแนะนำตามระดับฝุ่นได้ เนื่องจากไม่มีข้อมูลล่าสุด';
  updateHourlyChart({});
}

/**
 * Update Main Overview Card & Radial Gauge
 */
function updateMainCardUI(district, data) {
  const currentAqi = data.aqi?.current || {};
  const currentWeather = data.weather?.current || {};

  const pm25 = Number.isFinite(currentAqi.pm2_5) ? Math.round(currentAqi.pm2_5 * 10) / 10 : null;
  const pm10 = Number.isFinite(currentAqi.pm10) ? Math.round(currentAqi.pm10 * 10) / 10 : null;
  const usAqi = Number.isFinite(currentAqi.us_aqi) ? currentAqi.us_aqi : null;

  const status = getThaiPcdStatus(pm25);
  const timeInfo = currentAqi.time ? formatThaiDateTime(currentAqi.time) : { short: 'ไม่มีข้อมูล' };

  if (elements.regionLabel) {
    elements.regionLabel.textContent = 'จังหวัดแพร่ · พิกัดอำเภอโดยประมาณ';
  }
  if (elements.currentDistrictName) elements.currentDistrictName.textContent = district.name;
  if (elements.currentDistrictEn) elements.currentDistrictEn.textContent = `${district.nameEn || district.name}, Phrae Province`;
  if (elements.updatedTimeText) elements.updatedTimeText.textContent = timeInfo.short;

  if (elements.mainPm25Value) elements.mainPm25Value.textContent = pm25 ?? '--';
  if (elements.mainPm10Value) elements.mainPm10Value.textContent = pm10 ?? '--';
  if (elements.mainUsAqiValue) elements.mainUsAqiValue.textContent = usAqi ?? '--';

  // ---- Data source badge ----
  const srcBadge = document.getElementById('dataSourceBadge');
  const srcLabel = document.getElementById('dataSourceLabel');
  if (srcLabel) {
    const hasPcd = Number.isFinite(data.pcdRealtime?.pm2_5);
    const pcd = data.pcdRealtime;
    if (hasPcd) {
      if (srcBadge) {
        srcBadge.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
        srcBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> ข้อมูลจริง PCD';
      }
      const pm10Source = Number.isFinite(pcd.pm10)
        ? 'PCD Air4Thai'
        : pm10 !== null
          ? 'Open-Meteo (แบบจำลอง)'
          : 'ไม่มีข้อมูล';
      const usAqiSource = usAqi !== null ? 'Open-Meteo (แบบจำลอง)' : 'ไม่มีข้อมูล';
      srcLabel.textContent = `PM2.5: PCD Air4Thai สถานี ${pcd.stationName} (${pcd.timestamp}) · PM10: ${pm10Source} · US AQI: ${usAqiSource} · สภาพอากาศ: Open-Meteo`;
    } else if (pm25 !== null) {
      if (srcBadge) {
        srcBadge.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30';
        srcBadge.textContent = 'Open-Meteo · แบบจำลอง';
      }
      srcLabel.textContent = `PM2.5, PM10, US AQI และสภาพอากาศ: Open-Meteo (ข้อมูลแบบจำลอง)${data.errors?.length ? ` · ${data.errors.join('; ')}` : ''} · ไม่พบข้อมูลสถานี PCD`;
    } else {
      if (srcBadge) {
        srcBadge.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/15 text-slate-400 border border-slate-500/30';
        srcBadge.textContent = 'ไม่มีข้อมูล PM2.5';
      }
      srcLabel.textContent = `ไม่มีข้อมูล PM2.5 จากแหล่งที่เชื่อมต่อ${data.errors?.length ? `: ${data.errors.join('; ')}` : ''}`;
    }
  }

  // Radial Gauge Animation
  const circumference = 2 * Math.PI * 66; // 414.69
  const progressRatio = pm25 === null ? 0 : Math.min(pm25 / 100, 1);
  if (elements.gaugeProgressCircle) {
    elements.gaugeProgressCircle.style.strokeDashoffset = circumference - progressRatio * circumference;
    elements.gaugeProgressCircle.style.stroke = status.color;
  }

  if (elements.statusBadgeContainer) {
    elements.statusBadgeContainer.className = `inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-base font-bold border ${status.badgeBg}`;
  }
  if (elements.statusEmoji) elements.statusEmoji.textContent = status.statusEmoji;
  if (elements.statusLabel) elements.statusLabel.textContent = `คุณภาพอากาศ: ${status.label}`;
  if (elements.statusDescription) elements.statusDescription.textContent = status.description;

  // Top SOP Alert Banner
  if (elements.sopAlertTitle) {
    elements.sopAlertTitle.textContent = pm25 === null
      ? `สถานะ: ไม่มีข้อมูล — ${district.name} จังหวัดแพร่`
      : `สถานะ: ระดับ${status.label} (${pm25} µg/m³) - ${district.name} จังหวัดแพร่`;
  }

  if (elements.cardGlowEffect) elements.cardGlowEffect.style.backgroundColor = `${status.color}25`;
  if (elements.ambientGlow) {
    elements.ambientGlow.className = `fixed inset-0 pointer-events-none transition-colors duration-1000 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] ${status.gradient}`;
  }

  const usStatus = getUSAqiStatus(usAqi);
  if (elements.usAqiDot) elements.usAqiDot.style.backgroundColor = usStatus.color;

  // Weather Bar
  const wCode = currentWeather.weather_code;
  const wInfo = getWeatherDescription(wCode);
  if (elements.weatherIconSymbol) elements.weatherIconSymbol.textContent = wInfo.symbol;
  if (elements.weatherText) elements.weatherText.textContent = wInfo.text;
  if (elements.currentTempText) elements.currentTempText.textContent = Number.isFinite(currentWeather.temperature_2m) ? `${Math.round(currentWeather.temperature_2m)} °C` : '-- °C';
  if (elements.currentHumidityText) elements.currentHumidityText.textContent = Number.isFinite(currentWeather.relative_humidity_2m) ? `${currentWeather.relative_humidity_2m} %` : '-- %';
  if (elements.currentWindText) elements.currentWindText.textContent = Number.isFinite(currentWeather.wind_speed_10m) ? `${Math.round(currentWeather.wind_speed_10m)} km/h` : '-- km/h';

  // Health Action Recommendations
  if (elements.healthTipsList) {
    elements.healthTipsList.innerHTML = status.tips
      .map(
        tip => `
        <div class="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-200">
          <div class="p-1 rounded-lg bg-slate-800 text-sky-400 shrink-0">
            <i data-lucide="${tip.icon}" class="w-4 h-4"></i>
          </div>
          <span class="leading-relaxed pt-0.5">${tip.text}</span>
        </div>
      `
      )
      .join('');
  }

  if (elements.riskGroupTipText) elements.riskGroupTipText.textContent = status.riskGroupTip;

  if (window.lucide) window.lucide.createIcons();
}

/**
 * Render Sub-districts (ตำบล) Cards for Selected District in Phrae
 */
function renderSubDistricts() {
  if (!elements.subDistrictGrid) return;
  if (!state.cleanRoomsData?.success) {
    elements.subDistrictGrid.innerHTML = `
      <div class="md:col-span-2 lg:col-span-3 rounded-2xl border border-slate-700/70 bg-slate-950/40 p-5 text-sm text-slate-300">
        ${state.publicHealthDataLoaded
          ? 'ไม่สามารถดึงทะเบียนห้องปลอดฝุ่นจากกรมอนามัยได้ในขณะนี้'
          : 'กำลังดึงทะเบียนห้องปลอดฝุ่นจากกรมอนามัย'}
        ข้อมูลนี้เป็นทะเบียนสถานที่ ไม่ใช่ข้อมูลตรวจวัด PM2.5 ระดับตำบล
      </div>`;
    return;
  }

  const districtName = state.currentDistrict.name.replace(/^อำเภอ/, '');
  const rooms = state.cleanRoomsData.rooms.filter(room => room.district === districtName);
  if (rooms.length === 0) {
    elements.subDistrictGrid.innerHTML = `
      <div class="md:col-span-2 lg:col-span-3 rounded-2xl border border-slate-700/70 bg-slate-950/40 p-5 text-sm text-slate-300">
        ไม่พบรายการสถานที่ในทะเบียนห้องปลอดฝุ่นของอำเภอนี้
      </div>`;
    return;
  }

  const shownRooms = rooms.slice(0, 12);
  elements.subDistrictGrid.innerHTML = `
    ${shownRooms.map(room => `
      <article class="rounded-2xl border border-slate-700/70 bg-slate-950/40 p-4">
        <h4 class="font-semibold text-sm text-white">${escapeHtml(room.locationName)}</h4>
        <p class="mt-1 text-xs text-slate-400">${escapeHtml(room.subdistrict || 'ไม่ระบุตำบล')} · ${escapeHtml(room.type || 'ไม่ระบุประเภท')}</p>
        <p class="mt-2 text-xs ${room.certificationStatus === 'ผ่านและยังไม่หมดอายุ' ? 'text-emerald-400' : 'text-amber-300'}">
          ${escapeHtml(room.certificationStatus)}
        </p>
      </article>
    `).join('')}
    ${rooms.length > shownRooms.length ? `
      <div class="md:col-span-2 lg:col-span-3 text-center text-xs text-slate-400">
        แสดง ${shownRooms.length} จาก ${rooms.length} รายการในอำเภอ ·
        <a class="text-sky-400 hover:underline" href="${escapeHtml(state.cleanRoomsData.sourceUrl)}" target="_blank" rel="noopener noreferrer">ดูข้อมูลต้นทาง</a>
      </div>` : ''}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

/**
 * Render Clean Rooms Monitoring Tab (Tab 2)
 */
function renderCleanRoomsTab() {
  [
    elements.crTotalRegistered, elements.crTotalPassed, elements.crTotalValid,
    elements.crElderlyDisabled, elements.crElderlyDataYear,
    elements.crElderlyPopulation, elements.crElderlyPopulationYear
  ]
    .forEach(element => { if (element) element.textContent = '--'; });
  if (elements.cleanRoomDataStatus) elements.cleanRoomDataStatus.textContent = 'กำลังดึงข้อมูลทะเบียน...';
  if (elements.elderlyDisabilityDataStatus) elements.elderlyDisabilityDataStatus.textContent = 'กำลังดึงข้อมูลทะเบียนผู้สูงอายุพิการ...';
  if (elements.cleanRoomTableBody) {
    elements.cleanRoomTableBody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-slate-400">กำลังดึงข้อมูลจากกรมอนามัย...</td></tr>';
  }
}

async function loadPublicHealthData() {
  try {
    const response = await fetch('/api/v1/public/health-dashboard');
    if (!response.ok) throw new Error(`Public health data HTTP ${response.status}`);
    const data = await response.json();

    state.publicHealthDataLoaded = true;
    state.cleanRoomsData = data.cleanRooms?.success ? data.cleanRooms : null;
    state.elderlyDisabilityData = data.elderlyDisability?.success ? data.elderlyDisability : null;
    state.elderlyPopulationData = data.elderlyPopulation?.success ? data.elderlyPopulation : null;
    state.hospitalBedsData = data.hospitalBeds?.success ? data.hospitalBeds : null;
    state.airPollutionPatientsData = data.airPollutionPatients?.success ? data.airPollutionPatients : null;
    renderPublicHealthData(data);
    renderSubDistricts();
  } catch (error) {
    console.error('Failed to load public health data:', error);
    state.publicHealthDataLoaded = true;
    state.cleanRoomsData = null;
    state.elderlyDisabilityData = null;
    state.elderlyPopulationData = null;
    state.hospitalBedsData = null;
    state.airPollutionPatientsData = null;
    renderPublicHealthData({
      cleanRooms: { success: false, error: error.message },
      elderlyDisability: { success: false, error: error.message },
      elderlyPopulation: { success: false, error: error.message },
      hospitalBeds: { success: false, error: error.message },
      airPollutionPatients: { success: false, error: error.message }
    });
    renderSubDistricts();
  }
}

function renderPublicHealthData(data) {
  const cleanRooms = data.cleanRooms;
  if (cleanRooms?.success) {
    const summary = cleanRooms.summary;
    if (elements.crTotalRegistered) elements.crTotalRegistered.textContent = summary.registered.toLocaleString('th-TH');
    if (elements.crTotalPassed) elements.crTotalPassed.textContent = summary.passed.toLocaleString('th-TH');
    if (elements.crTotalValid) elements.crTotalValid.textContent = summary.valid.toLocaleString('th-TH');
    if (elements.cleanRoomDataStatus) {
      elements.cleanRoomDataStatus.textContent = `ตรวจข้อมูลเมื่อ ${new Date(cleanRooms.queriedAt).toLocaleString('th-TH')} · ผ่านแต่หมดอายุ ${summary.expired} · ไม่ผ่าน ${summary.failed}`;
    }
    if (elements.cleanRoomTableBody) {
      elements.cleanRoomTableBody.innerHTML = cleanRooms.rooms.map(room => {
        const statusClass = room.certificationStatus === 'ผ่านและยังไม่หมดอายุ'
          ? 'text-emerald-400'
          : room.certificationStatus === 'ผ่านแต่หมดอายุแล้ว'
            ? 'text-amber-300'
            : 'text-rose-400';
        return `
          <tr class="hover:bg-slate-900/50 transition">
            <td class="px-4 py-3">
              <div class="font-semibold text-white">${escapeHtml(room.locationName)}</div>
              <div class="text-[10px] text-slate-400">${escapeHtml(room.organization || 'ไม่ระบุหน่วยงาน')}</div>
            </td>
            <td class="px-4 py-3">${escapeHtml(room.district)} / ${escapeHtml(room.subdistrict || '--')}</td>
            <td class="px-4 py-3">${escapeHtml(room.type || '--')}</td>
            <td class="px-4 py-3">${escapeHtml(room.result || '--')}</td>
            <td class="px-4 py-3">${formatRegistryDate(room.evaluationDate)}</td>
            <td class="px-4 py-3">${formatRegistryDate(room.expiryDate)}</td>
            <td class="px-4 py-3 font-semibold ${statusClass}">${escapeHtml(room.certificationStatus)}</td>
          </tr>`;
      }).join('');
    }
    if (elements.execCrActive) elements.execCrActive.textContent = summary.passed.toLocaleString('th-TH');
    if (elements.execCrCoverage) elements.execCrCoverage.textContent = summary.valid.toLocaleString('th-TH');
    if (elements.execShortageAreas) {
      elements.execShortageAreas.textContent = `ในทะเบียนมี ${summary.registered} รายการ; ผ่านประเมิน ${summary.passed} รายการ แต่ใบรับรองยังไม่หมดอายุ ${summary.valid} รายการ · ข้อมูลไม่ระบุความจุหรือจำนวนผู้เปราะบางที่ได้รับบริการ`;
    }
  } else {
    if (elements.crTotalRegistered) elements.crTotalRegistered.textContent = '--';
    if (elements.crTotalPassed) elements.crTotalPassed.textContent = '--';
    if (elements.crTotalValid) elements.crTotalValid.textContent = '--';
    if (elements.cleanRoomDataStatus) elements.cleanRoomDataStatus.textContent = `ดึงข้อมูลทะเบียนกรมอนามัยไม่สำเร็จ: ${cleanRooms?.error || 'ไม่มีข้อมูล'}`;
    if (elements.cleanRoomTableBody) {
      elements.cleanRoomTableBody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-slate-400">ข้อมูลทะเบียนห้องปลอดฝุ่นไม่พร้อมใช้งาน</td></tr>';
    }
    if (elements.execCrActive) elements.execCrActive.textContent = '--';
    if (elements.execCrCoverage) elements.execCrCoverage.textContent = '--';
    if (elements.execShortageAreas) elements.execShortageAreas.textContent = 'ไม่สามารถดึงทะเบียนห้องปลอดฝุ่นจากกรมอนามัยได้';
  }

  const elderlyPopulation = data.elderlyPopulation;
  if (elderlyPopulation?.success) {
    if (elements.crElderlyPopulation) elements.crElderlyPopulation.textContent = elderlyPopulation.total.toLocaleString('th-TH');
    if (elements.crElderlyPopulationYear) elements.crElderlyPopulationYear.textContent = elderlyPopulation.dataYear;
  } else {
    if (elements.crElderlyPopulation) elements.crElderlyPopulation.textContent = '--';
    if (elements.crElderlyPopulationYear) elements.crElderlyPopulationYear.textContent = '--';
  }

  const elderly = data.elderlyDisability;
  if (elderly?.success) {
    if (elements.crElderlyDisabled) elements.crElderlyDisabled.textContent = elderly.total.toLocaleString('th-TH');
    if (elements.crElderlyDataYear) elements.crElderlyDataYear.textContent = elderly.dataYear;
    if (elements.elderlyDisabilityDataStatus) {
      const breakdown = elderly.records.map(record => `${record.district} ${record.count.toLocaleString('th-TH')}`).join(' · ');
      elements.elderlyDisabilityDataStatus.textContent = `ที่มา: สำนักงานจังหวัดแพร่ · ปีข้อมูล ${elderly.dataYear} · ${breakdown}`;
    }
  } else {
    if (elements.crElderlyDisabled) elements.crElderlyDisabled.textContent = '--';
    if (elements.crElderlyDataYear) elements.crElderlyDataYear.textContent = '--';
    if (elements.elderlyDisabilityDataStatus) {
      elements.elderlyDisabilityDataStatus.textContent = `ดึงข้อมูลผู้สูงอายุพิการไม่สำเร็จ: ${elderly?.error || 'ไม่มีข้อมูล'}`;
    }
  }

  renderAnnualHealthData(data);
}

function formatRegistryDate(value) {
  if (!value) return 'ไม่ระบุ';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'ไม่ระบุ' : date.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' });
}

/**
 * Render Executive Report Tab (Tab 3)
 */
function renderExecutiveReportTab() {
  [
    elements.execCrActive, elements.execCrCoverage, elements.execMasksDistributed,
    elements.execMasksRemaining, elements.execPurifiersDeployed, elements.execOpdSurge,
    elements.execBedOccupancy, elements.execReservedBeds, elements.execHomeVisits,
    elements.execMobileUnits
  ].forEach(element => { if (element) element.textContent = '--'; });
  if (elements.execShortageAreas) {
    elements.execShortageAreas.textContent = 'ยังไม่มีข้อมูลจากแหล่งทางการ';
  }
}

/**
 * Render Hospital Beds Baseline Tab (Tab 4)
 */
function renderHealthBedsTab() {
  [elements.bedTotal, elements.bedOccupancyRate, elements.bedReserved, elements.bedIcu, elements.opdSurgeBadge]
    .forEach(element => { if (element) element.textContent = '--'; });
  const bedTotalStatus = document.getElementById('bedTotalStatus');
  if (bedTotalStatus) bedTotalStatus.textContent = 'กำลังดึงข้อมูลทะเบียนเตียงรายปี...';
  if (elements.opdDiseasesList) {
    elements.opdDiseasesList.innerHTML = '<p class="p-4 text-center text-xs text-slate-400">กำลังดึงสถิติผู้ป่วยจากมลพิษทางอากาศ...</p>';
  }
}

function renderAnnualHealthData(data) {
  const beds = data.hospitalBeds;
  const bedTotalStatus = document.getElementById('bedTotalStatus');
  const bedDistrictBreakdown = document.getElementById('bedDistrictBreakdown');

  if (beds?.success) {
    if (elements.bedTotal) elements.bedTotal.textContent = beds.totalBeds.toLocaleString('th-TH');
    if (elements.execBedDataYear) elements.execBedDataYear.textContent = beds.dataYear;
    if (elements.execBedBaseline) elements.execBedBaseline.textContent = beds.totalBeds.toLocaleString('th-TH');
    if (bedTotalStatus) {
      bedTotalStatus.textContent = `ปีข้อมูล ${beds.dataYear} · ครบ ${beds.districtCount} อำเภอ · ไม่ใช่จำนวนเตียงว่างปัจจุบัน`;
    }
    if (bedDistrictBreakdown) {
      bedDistrictBreakdown.textContent = beds.records
        .map(record => `${record.district} ${record.beds.toLocaleString('th-TH')}`)
        .join(' · ');
    }
  } else {
    if (elements.bedTotal) elements.bedTotal.textContent = '--';
    if (elements.execBedDataYear) elements.execBedDataYear.textContent = '--';
    if (elements.execBedBaseline) elements.execBedBaseline.textContent = '--';
    if (bedTotalStatus) bedTotalStatus.textContent = `ดึงข้อมูลจำนวนเตียงรายปีไม่สำเร็จ: ${beds?.error || 'ไม่มีข้อมูล'}`;
    if (bedDistrictBreakdown) bedDistrictBreakdown.textContent = 'ไม่มีข้อมูลรายอำเภอ';
  }

  const occupancyStatus = document.getElementById('bedOccupancyStatus');
  if (occupancyStatus) occupancyStatus.textContent = 'ไม่มีข้อมูลปัจจุบันจากระบบโรงพยาบาล';
  if (elements.execBedOccupancy) elements.execBedOccupancy.textContent = 'ไม่มีข้อมูล';
  if (elements.execReservedBeds) elements.execReservedBeds.textContent = 'ไม่มีข้อมูล';

  const patients = data.airPollutionPatients;
  if (!patients?.success) {
    if (elements.opdSurgeBadge) elements.opdSurgeBadge.textContent = '--';
    if (elements.opdDiseasesList) {
      elements.opdDiseasesList.innerHTML = `<p class="p-4 text-center text-xs text-slate-400">ดึงสถิติผู้ป่วยจากมลพิษทางอากาศไม่สำเร็จ: ${escapeHtml(patients?.error || 'ไม่มีข้อมูล')}</p>`;
    }
    if (elements.execOpdSurge) elements.execOpdSurge.textContent = '--';
    if (elements.execPollutionDataYear) elements.execPollutionDataYear.textContent = '--';
    if (elements.execPollutionDisease) elements.execPollutionDisease.textContent = 'ไม่มีข้อมูล';
    return;
  }

  if (elements.opdSurgeBadge) elements.opdSurgeBadge.textContent = `ปี ${patients.dataYear}`;
  if (elements.execPollutionDataYear) elements.execPollutionDataYear.textContent = patients.dataYear;
  if (elements.execOpdSurge) {
    elements.execOpdSurge.textContent = patients.reportedCategoryCount.toLocaleString('th-TH');
  }
  if (elements.execPollutionDisease) {
    const topDisease = patients.diseases[0];
    elements.execPollutionDisease.textContent = topDisease
      ? `${topDisease.disease}: ${topDisease.patients.toLocaleString('th-TH')} ราย`
      : 'ไม่มีรายการ';
  }
  if (elements.opdDiseasesList) {
    elements.opdDiseasesList.innerHTML = `
      <p class="text-xs text-slate-400">
        ปีข้อมูล ${patients.dataYear} · แสดงผลรวมตามหมวดโรคจากไฟล์ต้นทาง ไม่ใช่จำนวนผู้ป่วยไม่ซ้ำหรือข้อมูล OPD รายวัน
        · <a class="text-emerald-400 hover:underline" href="${escapeHtml(patients.sourceUrl)}" target="_blank" rel="noopener noreferrer">ดูข้อมูลต้นทาง</a>
      </p>
      ${patients.diseases.map(disease => `
        <article class="rounded-xl border border-slate-700/70 bg-slate-900/60 p-3">
          <div class="flex items-start justify-between gap-3">
            <strong class="text-sm text-white">${escapeHtml(disease.disease)}</strong>
            <span class="shrink-0 font-bold text-rose-300">${disease.patients.toLocaleString('th-TH')} รายงาน</span>
          </div>
          <p class="mt-1 text-[11px] text-slate-400">${disease.districts.map(record =>
            `${escapeHtml(record.district)} ${record.patients.toLocaleString('th-TH')}`
          ).join(' · ')}</p>
        </article>`).join('')}`;
  }
}

/**
 * Render Logistics Tab (Tab 5)
 */
function renderLogisticsTab() {
  [
    elements.logN95Distributed, elements.logN95Remaining, elements.logSurgDistributed,
    elements.logSurgRemaining, elements.logPurifierDeployed, elements.logPurifierRemaining,
    elements.logMobileHomeVisits
  ].forEach(element => { if (element) element.textContent = '--'; });
}

/**
 * Batch Fetch Air Quality for All 8 Districts of Phrae
 */
async function loadBatchDistricts() {
  try {
    const results = await fetchBatchProvincesAQI(PHRAE_DISTRICTS);
    state.batchDistrictsData = results;

    updateMapMarkers(results, state.currentDistrict.id, onSelectDistrict);
    renderRankings();
  } catch (error) {
    console.error('Failed to load batch districts for Phrae:', error);
    state.batchDistrictsData = [];
    if (elements.rankingsList) {
      elements.rankingsList.innerHTML = '<p class="p-4 text-center text-xs text-slate-400">ไม่สามารถดึงข้อมูลคุณภาพอากาศของอำเภอได้</p>';
    }
  }
}

/**
 * Render Rankings Comparison for Phrae's 8 Districts
 */
function renderRankings() {
  if (!elements.rankingsList) return;

  const availableDistricts = state.batchDistrictsData.filter(district => Number.isFinite(district.pm2_5));
  if (availableDistricts.length === 0) {
    elements.rankingsList.innerHTML = '<p class="p-4 text-center text-xs text-slate-400">ยังไม่มีข้อมูลคุณภาพอากาศจากแหล่งข้อมูลที่เชื่อมต่อ</p>';
    return;
  }

  const sorted = [...availableDistricts].sort((a, b) => {
    return state.rankingsTab === 'cleanest' ? a.pm2_5 - b.pm2_5 : b.pm2_5 - a.pm2_5;
  });

  const medals = ['🥇', '🥈', '🥉', '4', '5', '6', '7', '8'];

  elements.rankingsList.innerHTML = sorted
    .map((item, idx) => {
      const status = getThaiPcdStatus(item.pm2_5);
      return `
      <div 
        class="rank-row flex items-center justify-between p-3 rounded-2xl bg-slate-900/70 hover:bg-slate-800/80 border border-slate-800/80 cursor-pointer transition active:scale-[0.99] group"
        data-rank-id="${item.id}"
      >
        <div class="flex items-center gap-3">
          <span class="w-6 text-center text-sm font-bold text-slate-400 group-hover:text-amber-400 transition">${medals[idx] || (idx + 1)}</span>
          <div>
            <div class="font-semibold text-sm text-slate-200 group-hover:text-sky-400 transition flex items-center gap-2">
              ${item.name}
              <span class="text-[10px] text-slate-500 font-normal">จ.แพร่</span>
            </div>
            <div class="text-[11px] text-slate-400 mt-0.5">${status.label} · ${item.dataSource}</div>
          </div>
        </div>

        <div class="text-right">
          <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${status.badgeBg}">
            <span>${item.pm2_5}</span>
            <span class="text-[10px] font-normal">µg/m³</span>
          </div>
        </div>
      </div>
    `;
    })
    .join('');

  elements.rankingsList.querySelectorAll('.rank-row').forEach(row => {
    row.addEventListener('click', () => {
      const dId = row.getAttribute('data-rank-id');
      const found = PHRAE_DISTRICTS.find(d => d.id === dId);
      if (found) onSelectDistrict(found);
    });
  });
}

/**
 * Handle Search Input strictly within Phrae's Districts & Tambons
 */
function handleSearchInput(e) {
  const query = e.target.value.trim().toLowerCase();
  if (!query) {
    elements.searchDropdown.classList.add('hidden');
    elements.clearSearchBtn.classList.add('hidden');
    return;
  }

  elements.clearSearchBtn.classList.remove('hidden');

  // Search districts in Phrae.
  const districtMatches = PHRAE_DISTRICTS.filter(d => {
    return d.name.toLowerCase().includes(query) || (d.nameEn && d.nameEn.toLowerCase().includes(query));
  });

  if (districtMatches.length === 0) {
    elements.searchDropdown.innerHTML = `<div class="p-3 text-xs text-slate-400 text-center">ไม่พบอำเภอในจังหวัดแพร่ที่ตรงกับ "${query}"</div>`;
    elements.searchDropdown.classList.remove('hidden');
    return;
  }

  let html = '';

  districtMatches.forEach(d => {
    html += `
      <div 
        class="search-item px-4 py-2.5 hover:bg-slate-800 cursor-pointer flex items-center justify-between text-xs transition"
        data-type="district"
        data-id="${d.id}"
      >
        <div class="flex items-center gap-2">
          <i data-lucide="map-pin" class="w-3.5 h-3.5 text-sky-400"></i>
          <div>
            <span class="font-medium text-white">${d.name}</span>
            <span class="text-slate-400 text-[11px]">(${d.nameEn}) จ.แพร่</span>
          </div>
        </div>
        <span class="px-2 py-0.5 rounded text-[10px] bg-sky-500/20 text-sky-300 font-bold">ระดับอำเภอ (แพร่)</span>
      </div>
    `;
  });

  elements.searchDropdown.innerHTML = html;
  elements.searchDropdown.classList.remove('hidden');

  elements.searchDropdown.querySelectorAll('.search-item').forEach(item => {
    item.addEventListener('click', () => {
      const dId = item.getAttribute('data-id');
      const found = PHRAE_DISTRICTS.find(d => d.id === dId);
      if (found) {
        onSelectDistrict(found);
        elements.districtSearchInput.value = found.name;
        elements.searchDropdown.classList.add('hidden');
      }
    });
  });

  if (window.lucide) window.lucide.createIcons();
}

/**
 * Standard Switcher (PCD vs US AQI)
 */
function setStandard(standard) {
  state.standard = standard;
  if (standard === 'pcd') {
    elements.btnStdPCD.className = 'px-2.5 py-1 rounded-md font-semibold transition bg-sky-600 text-white shadow-sm';
    elements.btnStdUS.className = 'px-2.5 py-1 rounded-md text-slate-400 hover:text-slate-200 transition';
  } else {
    elements.btnStdUS.className = 'px-2.5 py-1 rounded-md font-semibold transition bg-sky-600 text-white shadow-sm';
    elements.btnStdPCD.className = 'px-2.5 py-1 rounded-md text-slate-400 hover:text-slate-200 transition';
  }

  if (state.currentAirData) {
    updateHourlyChart(state.currentAirData);
  }
}

/**
 * Load Services and Requests from REST API
 */
async function loadServicesAndRequests() {
  try {
    const sRes = await fetch('/api/v1/services');
    if (sRes.ok) {
      const services = await sRes.json();
      state.servicesData = services;
      renderServicesTable(services);
    }

    const rRes = await fetch('/api/v1/requests');
    if (rRes.ok) {
      const requests = await rRes.json();
      state.requestsData = requests;
      renderRequestsList(requests);
    }
  } catch (e) {
    console.warn('REST API call failed:', e);
  }
}

async function loadLineStatus() {
  const statusElement = document.getElementById('supportLineStatus');
  if (!statusElement) return;

  try {
    const response = await fetch('/api/v1/line/status');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const status = await response.json();
    statusElement.textContent = status.configured
      ? 'เชื่อมต่อ LINE แล้ว: เมื่อส่งคำขอ ระบบจะส่งรายละเอียดและข้อมูลติดต่อไปยัง LINE ที่ตั้งค่าไว้'
      : 'ยังไม่ได้ตั้งค่า LINE: คำขอจะถูกบันทึกในเครื่องนี้ แต่จะไม่มีการส่งแจ้งเตือน';
  } catch (error) {
    console.error('Failed to check LINE configuration:', error);
    statusElement.textContent = 'ตรวจสอบสถานะ LINE ไม่ได้ในขณะนี้';
  }
}

function renderServicesTable(services) {
  if (!elements.servicesTableBody) return;

  if (!services || services.length === 0) {
    elements.servicesTableBody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-400">ยังไม่มีข้อมูลบริการในจังหวัดแพร่</td></tr>`;
    return;
  }

  elements.servicesTableBody.innerHTML = services
    .map(
      s => `
      <tr class="hover:bg-slate-900/50 transition">
        <td class="px-4 py-3">
          <div class="font-mono text-indigo-400 font-bold">${s.id}</div>
          <div class="text-[10px] text-slate-400">${s.date}</div>
        </td>
        <td class="px-4 py-3">
          <div class="font-semibold text-white">${s.subDistrict}</div>
          <div class="text-[10px] text-slate-400">${s.district}, จ.แพร่</div>
        </td>
        <td class="px-4 py-3">
          <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            ${s.serviceType}
          </span>
        </td>
        <td class="px-4 py-3 text-slate-300 max-w-xs truncate" title="${s.description}">${s.description}</td>
        <td class="px-4 py-3 text-amber-400 font-bold">${s.targetCount}</td>
        <td class="px-4 py-3 font-bold">${s.masksDistributed ?? '--'}</td>
        <td class="px-4 py-3 text-slate-400">${s.reporterName}</td>
      </tr>
    `
    )
    .join('');
}

function renderRequestsList(requests) {
  if (!elements.requestsListContainer) return;

  if (!requests || requests.length === 0) {
    elements.requestsListContainer.innerHTML = `<div class="p-4 text-center text-xs text-slate-400">ไม่มีรายการคำขอในจังหวัดแพร่ขณะนี้</div>`;
    return;
  }

  elements.requestsListContainer.innerHTML = requests
    .map(
      r => `
      <div class="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-start justify-between gap-3 text-xs">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="font-bold text-amber-400">${escapeHtml(r.id)}</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              ${escapeHtml(r.urgency)}
            </span>
            <span class="text-slate-400 text-[11px]">${escapeHtml(r.timestamp)}</span>
          </div>
          <div class="font-semibold text-white">${escapeHtml(r.requestType)} - ${escapeHtml(r.subDistrict)}, ${escapeHtml(r.district)} (จ.แพร่)</div>
          <p class="text-slate-300 mt-1 leading-relaxed">${escapeHtml(r.details)}</p>
          <div class="text-slate-400 text-[11px] mt-1">ผู้แจ้ง: ${escapeHtml(r.requesterName)} (โทร: ${escapeHtml(r.phone)})</div>
        </div>
        <div class="text-right shrink-0">
          <span class="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            ${escapeHtml(r.status)}
          </span>
        </div>
      </div>
    `
    )
    .join('');
}

/**
 * Handle New Service Submit (ข้อมูลชุดที่ 3)
 */
async function handleNewServiceSubmit(e) {
  e.preventDefault();
  const districtObj = PHRAE_DISTRICTS.find(d => d.id === elements.inputDistrictSelectModal.value);
  const payload = {
    province: 'แพร่',
    district: districtObj?.name || state.currentDistrict.name,
    subDistrict: document.getElementById('inputSubDistrict').value,
    serviceType: document.getElementById('inputServiceType').value,
    targetCount: Number(document.getElementById('inputTargetCount').value),
    masksDistributed: Number(document.getElementById('inputMasksCount').value),
    description: document.getElementById('inputDescription').value,
    reporterName: document.getElementById('inputReporter').value
  };

  try {
    const res = await fetch('/api/v1/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    alert('บันทึกข้อมูลในระบบนี้แล้ว (ยังไม่ได้ส่งเข้าฐานข้อมูลของหน่วยงาน)');
    elements.serviceModal.classList.add('hidden');
    elements.newServiceForm.reset();
    loadServicesAndRequests();
  } catch (err) {
    console.error('Failed to save service record:', err);
    alert(`บันทึกข้อมูลไม่สำเร็จ: ${err.message}`);
  }
}

/**
 * Handle Support Request Submit (Incident / Support)
 */
async function handleSupportRequestSubmit(e) {
  e.preventDefault();
  const districtObj = PHRAE_DISTRICTS.find(d => d.id === elements.reqDistrictSelectModal.value);
  const payload = {
    province: 'แพร่',
    district: districtObj?.name || state.currentDistrict.name,
    subDistrict: document.getElementById('reqSubDistrict').value,
    requestType: document.getElementById('reqType').value,
    urgency: document.getElementById('reqUrgency').value,
    details: document.getElementById('reqDetails').value,
    requesterName: document.getElementById('reqName').value,
    phone: document.getElementById('reqPhone').value
  };

  try {
    const res = await fetch('/api/v1/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = await res.json();
    alert(result.notification?.message || 'บันทึกคำขอแล้ว แต่ไม่ทราบสถานะการส่ง LINE');
    elements.supportModal.classList.add('hidden');
    elements.supportRequestForm.reset();
    loadServicesAndRequests();
  } catch (err) {
    console.error('Failed to save support request:', err);
    alert(`บันทึกคำขอไม่สำเร็จ: ${err.message}`);
  }
}

/**
 * Export Executive Summary JSON
 */
function exportExecutiveSummary() {
  const summary = {
    province: 'แพร่',
    provinceEn: 'Phrae',
    centerCoordinates: { lat: state.provinceCenterLat, lon: state.provinceCenterLon },
    exportedAt: new Date().toISOString(),
    selectedDistrict: state.currentDistrict?.name,
    airQuality: state.currentAirData?.aqi?.current || {},
    cleanRoomRegistry: state.cleanRoomsData
      ? {
          source: state.cleanRoomsData.source,
          queriedAt: state.cleanRoomsData.queriedAt,
          summary: state.cleanRoomsData.summary
        }
      : null,
    elderlyPopulation: state.elderlyPopulationData
      ? {
          source: state.elderlyPopulationData.source,
          queriedAt: state.elderlyPopulationData.queriedAt,
          dataYear: state.elderlyPopulationData.dataYear,
          total: state.elderlyPopulationData.total
        }
      : null,
    elderlyDisabilityRegistry: state.elderlyDisabilityData
      ? {
          source: state.elderlyDisabilityData.source,
          queriedAt: state.elderlyDisabilityData.queriedAt,
          dataYear: state.elderlyDisabilityData.dataYear,
          total: state.elderlyDisabilityData.total,
          records: state.elderlyDisabilityData.records
        }
      : null,
    hospitalBeds: state.hospitalBedsData,
    airPollutionPatients: state.airPollutionPatientsData,
    healthOperations: null,
    healthOperationsStatus: 'ยังไม่มีข้อมูลปฏิบัติการปัจจุบัน เช่น เตียงว่าง/อัตราครองเตียง, OPD รายวัน และสต็อก',
    districtAirQuality: state.batchDistrictsData,
    servicesCount: state.servicesData.length,
    activeRequestsCount: state.requestsData.length
  };

  const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PhraeBreathe-Executive-Brief-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Update Hourly Forecast Chart
 */
function updateHourlyChart(data) {
  const canvas = document.getElementById('hourlyForecastChart');
  if (!canvas) return;

  const hourlyData = data.aqi?.hourly;
  const hasForecast = Array.isArray(hourlyData?.time) && Array.isArray(hourlyData?.pm2_5);
  let message = document.getElementById('hourlyForecastUnavailable');
  if (!hasForecast) {
    renderHourlyChart('hourlyForecastChart', null, state.standard);
    canvas.classList.add('hidden');
    if (!message) {
      message = document.createElement('p');
      message.id = 'hourlyForecastUnavailable';
      message.className = 'flex h-full items-center justify-center text-sm text-slate-400';
      message.textContent = 'ไม่มีข้อมูลพยากรณ์จาก Open-Meteo';
      canvas.parentElement.append(message);
    }
    return;
  }

  if (message) message.remove();
  canvas.classList.remove('hidden');
  renderHourlyChart('hourlyForecastChart', hourlyData, state.standard);
}
