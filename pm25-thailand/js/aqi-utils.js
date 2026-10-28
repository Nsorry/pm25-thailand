// Thailand PCD (กรมควบคุมมลพิษ) & US EPA AQI Calculation Utilities

export const THAI_PCD_LEVELS = [
  {
    max: 15.0,
    label: 'ดีมาก',
    labelEn: 'Very Good',
    code: 'very-good',
    color: '#0ea5e9', // Blue
    colorClass: 'text-sky-500',
    bgClass: 'bg-sky-500',
    badgeBg: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    gradient: 'from-sky-500/20 via-blue-500/10 to-transparent',
    icon: 'smile',
    statusEmoji: '💙',
    description: 'คุณภาพอากาศดีมาก เหมาะสำหรับกิจกรรมกลางแจ้งและการท่องเที่ยว',
    tips: [
      { icon: 'sun', text: 'เหมาะสำหรับทำกิจกรรมกลางแจ้ง ออกกำลังกาย และท่องเที่ยว' },
      { icon: 'shield-check', text: 'ประชาชนทั่วไปและกลุ่มเสี่ยงใช้ชีวิตได้ตามปกติ ไม่จำเป็นต้องใส่หน้ากาก' },
      { icon: 'wind', text: 'สามารถเปิดหน้าต่างระบายอากาศภายในบ้านได้เต็มที่' }
    ],
    riskGroupTip: 'กลุ่มเสี่ยงสามารถทำกิจกรรมกลางแจ้งได้ตามปกติ'
  },
  {
    max: 25.0,
    label: 'ดี',
    labelEn: 'Good',
    code: 'good',
    color: '#10b981', // Green
    colorClass: 'text-emerald-500',
    bgClass: 'bg-emerald-500',
    badgeBg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    gradient: 'from-emerald-500/20 via-teal-500/10 to-transparent',
    icon: 'check-circle',
    statusEmoji: '💚',
    description: 'คุณภาพอากาศดี สามารถทำกิจกรรมกลางแจ้งและการท่องเที่ยวได้ตามปกติ',
    tips: [
      { icon: 'activity', text: 'สามารถทำกิจกรรมกลางแจ้งและออกกำลังกายได้ตามปกติ' },
      { icon: 'shield-check', text: 'ไม่ต้องสวมหน้ากากอนามัย ยกเว้นผู้มีโรคประจำตัวแพ้ฝุ่นง่าย' },
      { icon: 'home', text: 'เปิดหน้าต่างระบายอากาศภายในอาคารได้' }
    ],
    riskGroupTip: 'กลุ่มเสี่ยง: สังเกตอาการตนเอง หากมีอาการระคายเคืองควรพักในอาคาร'
  },
  {
    max: 37.5,
    label: 'ปานกลาง',
    labelEn: 'Moderate',
    code: 'moderate',
    color: '#f59e0b', // Amber/Yellow
    colorClass: 'text-amber-500',
    bgClass: 'bg-amber-500',
    badgeBg: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    gradient: 'from-amber-500/20 via-yellow-500/10 to-transparent',
    icon: 'alert-circle',
    statusEmoji: '💛',
    description: 'คุณภาพอากาศปานกลาง ประชาชนทั่วไปทำกิจกรรมได้ตามปกติ กลุ่มเสี่ยงควรระวัง',
    tips: [
      { icon: 'activity', text: 'ประชาชนทั่วไปสามารถทำกิจกรรมกลางแจ้งได้ตามปกติ' },
      { icon: 'mask', text: 'ผู้ที่มีโรคภูมิแพ้ทางเดินหายใจ ควรเตรียมหน้ากากอนามัยติดตัว' },
      { icon: 'clock', text: 'หลีกเลี่ยงการออกกำลังกายหนักกลางแจ้งเป็นเวลานานเกินไป' }
    ],
    riskGroupTip: 'กลุ่มเสี่ยง: ควรลดเวลาทำกิจกรรมกลางแจ้ง หรือสวมหน้ากากอนามัยป้องกัน'
  },
  {
    max: 75.0,
    label: 'เริ่มมีผลกระทบต่อสุขภาพ',
    labelEn: 'Unhealthy for Sensitive',
    code: 'unhealthy-sensitive',
    color: '#f97316', // Orange
    colorClass: 'text-orange-500',
    bgClass: 'bg-orange-500',
    badgeBg: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    gradient: 'from-orange-500/25 via-amber-600/15 to-transparent',
    icon: 'alert-triangle',
    statusEmoji: '🧡',
    description: 'เริ่มมีผลกระทบต่อสุขภาพ ควรระวังและสวมหน้ากากป้องกัน PM2.5 เมื่อออกนอกอาคาร',
    tips: [
      { icon: 'mask', text: 'สวมหน้ากากป้องกันฝุ่น เช่น หน้ากาก N95 หรือ KN95 เมื่อออกนอกอาคาร' },
      { icon: 'home', text: 'ปิดประตูหน้าต่าง เปิดเครื่องฟอกอากาศเพื่อลดปริมาณฝุ่นสะสมในบ้าน' },
      { icon: 'slash', text: 'ลดหรืองดกิจกรรมกลางแจ้งที่ต้องออกแรงหนัก เช่น วิ่ง ปั่นจักรยาน' }
    ],
    riskGroupTip: 'กลุ่มเสี่ยง: เด็ก คนชรา หญิงมีครรภ์ ผู้ป่วยโรคปอด/หัวใจ ควรหลีกเลี่ยงกิจกรรมกลางแจ้ง'
  },
  {
    max: Infinity,
    label: 'มีผลกระทบต่อสุขภาพ',
    labelEn: 'Hazardous / Unhealthy',
    code: 'hazardous',
    color: '#ef4444', // Red
    colorClass: 'text-rose-500',
    bgClass: 'bg-rose-500',
    badgeBg: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    gradient: 'from-rose-500/30 via-red-600/20 to-transparent',
    icon: 'alert-octagon',
    statusEmoji: '🔴',
    description: 'คุณภาพอากาศมีผลกระทบต่อสุขภาพอย่างยิ่ง ทุกคนควรงดกิจกรรมกลางแจ้งโดยเด็ดขาด',
    tips: [
      { icon: 'slash', text: 'ทุกคนควรงดกิจกรรมกลางแจ้งทุกชนิด หลีกเลี่ยงการออกนอกอาคาร' },
      { icon: 'mask', text: 'หากจำเป็นต้องออกนอกอาคาร ต้องสวมหน้ากาก N95 ให้แนบสนิทกับใบหน้า' },
      { icon: 'air-vent', text: 'อยู่ในห้องปลอดฝุ่น (Clean Room) และเปิดเครื่องฟอกอากาศตลอดเวลา' },
      { icon: 'heart-pulse', text: 'หากมีอาการแน่นหน้าอก หายใจลำบาก ตาแดง แสบจมูก ควรรีบพบแพทย์ทันที' }
    ],
    riskGroupTip: 'กลุ่มเสี่ยง: อยู่ในอาคารหรือห้องปลอดฝุ่นอย่างเคร่งครัด งดออกจากบ้านโดยเด็ดขาด'
  }
];

export function getThaiPcdStatus(pm25) {
  if (pm25 === null || pm25 === undefined || isNaN(pm25)) {
    return {
      label: 'ไม่มีข้อมูล',
      labelEn: 'No Data',
      color: '#64748b',
      colorClass: 'text-slate-400',
      bgClass: 'bg-slate-500',
      badgeBg: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
      gradient: 'from-slate-500/10 to-transparent',
      icon: 'help-circle',
      statusEmoji: '⚪',
      description: 'ไม่พบข้อมูลคุณภาพอากาศสำหรับตำแหน่งนี้',
      tips: [],
      riskGroupTip: '-'
    };
  }

  for (const lvl of THAI_PCD_LEVELS) {
    if (pm25 <= lvl.max) {
      return { ...lvl, value: pm25 };
    }
  }
  return { ...THAI_PCD_LEVELS[THAI_PCD_LEVELS.length - 1], value: pm25 };
}

// US AQI breakpoints and status
export const US_AQI_LEVELS = [
  { max: 50, label: 'ดี (Good)', color: '#10b981', code: 'good' },
  { max: 100, label: 'ปานกลาง (Moderate)', color: '#f59e0b', code: 'moderate' },
  { max: 150, label: 'เริ่มกระทบกลุ่มเสี่ยง (USG)', color: '#f97316', code: 'unhealthy-sensitive' },
  { max: 200, label: 'มีผลกระทบ (Unhealthy)', color: '#ef4444', code: 'unhealthy' },
  { max: 300, label: 'มีผลกระทบมาก (Very Unhealthy)', color: '#a855f7', code: 'very-unhealthy' },
  { max: Infinity, label: 'อันตราย (Hazardous)', color: '#7f1d1d', code: 'hazardous' }
];

export function getUSAqiStatus(aqi) {
  if (aqi === null || aqi === undefined || isNaN(aqi)) {
    return { label: 'ไม่มีข้อมูล', color: '#64748b' };
  }
  for (const lvl of US_AQI_LEVELS) {
    if (aqi <= lvl.max) {
      return lvl;
    }
  }
  return US_AQI_LEVELS[US_AQI_LEVELS.length - 1];
}

export function formatThaiDateTime(isoString) {
  try {
    const d = isoString ? new Date(isoString) : new Date();
    const thaiMonths = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];
    const thaiDays = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

    const dayName = thaiDays[d.getDay()];
    const day = d.getDate();
    const month = thaiMonths[d.getMonth()];
    const year = d.getFullYear() + 543;
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');

    return {
      full: `วัน${dayName}ที่ ${day} ${month} ${year} เวลา ${hours}:${mins} น.`,
      short: `${day} ${month} ${hours}:${mins} น.`,
      time: `${hours}:${mins} น.`,
      dayName: dayName
    };
  } catch (e) {
    return { full: '-', short: '-', time: '-', dayName: '-' };
  }
}
