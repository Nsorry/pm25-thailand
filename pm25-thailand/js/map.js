// Leaflet Interactive Air Quality & Health Operations Map for Thailand Provinces & Districts

let mapInstance = null;
let aqiMarkersLayer = null;

export function initMap(elementId, initialLat = 18.1446, initialLon = 100.1410, onSelectDistrict) {
  const container = document.getElementById(elementId);
  if (!container) return null;

  if (mapInstance) {
    setTimeout(() => mapInstance.invalidateSize(), 150);
    return mapInstance;
  }

  // Ensure explicit height
  container.style.height = '460px';
  container.style.minHeight = '460px';

  // Center on Initial Province
  mapInstance = L.map(elementId, {
    center: [initialLat, initialLon],
    zoom: 9.5,
    minZoom: 6,
    maxZoom: 16,
    zoomControl: false,
    scrollWheelZoom: true
  });

  // Zoom control
  L.control.zoom({ position: 'bottomright' }).addTo(mapInstance);

  // Standard OpenStreetMap Tile Layer
  const osmTile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  });
  osmTile.addTo(mapInstance);

  aqiMarkersLayer = L.layerGroup().addTo(mapInstance);

  // Invalidate size after layout calculation
  setTimeout(() => {
    if (mapInstance) mapInstance.invalidateSize();
  }, 200);

  setTimeout(() => {
    if (mapInstance) mapInstance.invalidateSize();
  }, 600);

  window.addEventListener('resize', () => {
    if (mapInstance) mapInstance.invalidateSize();
  });

  return mapInstance;
}

export function refreshMapLayout() {
  if (mapInstance) {
    setTimeout(() => {
      mapInstance.invalidateSize();
    }, 100);
  }
}

/**
 * Render Markers for Districts of Selected Province
 */
export function updateMapMarkers(districtsData, selectedId, onSelectDistrict) {
  if (!mapInstance || !aqiMarkersLayer) return;

  aqiMarkersLayer.clearLayers();

  districtsData.forEach(d => {
    const pm = d.pm2_5;
    let color = Number.isFinite(pm) ? '#0ea5e9' : '#64748b';

    if (Number.isFinite(pm)) {
      if (pm <= 15) color = '#0ea5e9'; // ฟ้า
      else if (pm <= 25) color = '#10b981'; // เขียว
      else if (pm <= 37.5) color = '#f59e0b'; // เหลือง
      else if (pm <= 75) color = '#f97316'; // ส้ม
      else color = '#ef4444'; // แดง
    }

    const isSelected = d.id === selectedId;

    const customIcon = L.divIcon({
      className: 'custom-map-pin',
      html: `
        <div class="relative group cursor-pointer" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.4));">
          <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white font-bold text-xs transition-transform transform ${
            isSelected ? 'scale-125 ring-4 ring-white shadow-2xl' : 'hover:scale-110'
          }" style="background-color: ${color};">
            <span class="w-2 h-2 rounded-full bg-white animate-pulse"></span>
            <span>${d.name.replace('อำเภอ', 'อ.').replace('เขต', '')}</span>
            <span class="bg-black/30 px-1.5 py-0.5 rounded text-[10px]">${pm ?? '--'} µg</span>
          </div>
        </div>
      `,
      iconSize: [120, 32],
      iconAnchor: [60, 16]
    });

    const marker = L.marker([d.lat, d.lon], { icon: customIcon });

    marker.bindPopup(`
      <div class="p-2 font-prompt text-slate-800">
        <h4 class="font-bold text-base mb-1 text-slate-900">${d.name}</h4>
        <div class="flex items-center gap-2 mb-2">
          <span class="px-2 py-0.5 rounded text-xs text-white font-bold" style="background-color: ${color}">
            PM2.5: ${pm ?? '--'} µg/m³
          </span>
          <span class="text-xs text-slate-500">US AQI: ${d.us_aqi ?? '--'}</span>
        </div>
        <p class="text-[11px] text-slate-500 mb-2">${d.dataSource || 'ไม่มีข้อมูล'}</p>
        <button class="w-full text-center bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold py-1.5 px-3 rounded shadow transition" id="popup-btn-${d.id}">
          เลือกอำเภอนี้ ➜
        </button>
      </div>
    `);

    marker.on('popupopen', () => {
      const btn = document.getElementById(`popup-btn-${d.id}`);
      if (btn) {
        btn.addEventListener('click', () => {
          if (onSelectDistrict) onSelectDistrict(d);
          marker.closePopup();
        });
      }
    });

    marker.on('click', () => {
      if (onSelectDistrict) onSelectDistrict(d);
    });

    marker.addTo(aqiMarkersLayer);
  });
}

export function panToLocation(lat, lon, zoom = 10) {
  if (mapInstance) {
    mapInstance.flyTo([lat, lon], zoom, {
      duration: 1.2,
      easeLinearity: 0.25
    });
    setTimeout(() => mapInstance.invalidateSize(), 300);
  }
}
