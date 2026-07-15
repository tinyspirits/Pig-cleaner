const https = require('https')
const i18n = require('./i18n')

// ─── WMO Weather Code → condition ───────────────────────────────────────────
// https://open-meteo.com/en/docs#weathervariables
const WMO_CODES = {
  0: 'clear',
  1: 'clear', 2: 'cloudy', 3: 'cloudy',
  45: 'fog', 48: 'fog',
  51: 'drizzle', 53: 'drizzle', 55: 'drizzle',
  61: 'rain', 63: 'rain', 65: 'rain',
  71: 'snow', 73: 'snow', 75: 'snow', 77: 'snow',
  80: 'rain', 81: 'rain', 82: 'rain',
  85: 'snow', 86: 'snow',
  95: 'thunderstorm', 96: 'thunderstorm', 99: 'thunderstorm',
}

// ─── State ───────────────────────────────────────────────────────────────────
let currentWeather = defaultWeather()
let pollingTimer = null
let updateCallback = null
let cachedLocation = null
let manualLocation = null // { lat, lon, city } do người dùng tự chọn trong Settings, ưu tiên hơn IP

function defaultWeather() {
  return {
    condition: 'clear',
    windSpeed: 0,
    windDirection: 0,
    windForceX: 0, // -1 = gió sang trái (W→E), +1 = sang phải
    isStorm: false,
    description: '',
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { 
      timeout: 10000,
      headers: {
        'User-Agent': 'PigCleaner/1.0 (https://github.com/tinyspirits/pig-cleaner)'
      }
    }, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(e) }
      })
    }).on('error', reject).on('timeout', () => reject(new Error('timeout')))
  })
}

async function getLocation() {
  // Vị trí người dùng tự chọn trong Settings luôn được ưu tiên
  if (manualLocation) return manualLocation
  if (cachedLocation) return cachedLocation

  // Các API lấy vị trí qua IP, theo thứ tự ưu tiên
  const apis = [
    {
      url: 'https://ipapi.co/json/',
      parse: (data) => ({
        lat: typeof data.latitude === 'number' ? data.latitude : parseFloat(data.latitude),
        lon: typeof data.longitude === 'number' ? data.longitude : parseFloat(data.longitude),
        city: data.city || data.region || data.country_name
      })
    },
    {
      url: 'https://ipinfo.io/json',
      parse: (data) => {
        if (!data.loc) return {}
        const [lat, lon] = data.loc.split(',').map(parseFloat)
        return { lat, lon, city: data.city || data.region || data.country }
      }
    },
    {
      url: 'https://get.geojs.io/v1/ip/geo.json',
      parse: (data) => ({
        lat: parseFloat(data.latitude),
        lon: parseFloat(data.longitude),
        city: data.city || data.region || data.country
      })
    }
  ]

  for (const api of apis) {
    try {
      const data = await fetchJson(api.url)
      const parsed = api.parse(data)
      
      if (typeof parsed.lat === 'number' && typeof parsed.lon === 'number' &&
          !Number.isNaN(parsed.lat) && !Number.isNaN(parsed.lon)) {
        cachedLocation = { lat: parsed.lat, lon: parsed.lon, city: parsed.city || i18n.t('weatherCond.unknown', 'Unknown') }
        console.log(`[Weather] Lấy vị trí thành công từ ${new URL(api.url).hostname}:`, cachedLocation.city)
        return cachedLocation
      } else {
        console.warn(`[Weather] ${api.url} trả về dữ liệu không hợp lệ:`, JSON.stringify(data).slice(0, 200))
      }
    } catch (err) {
      console.warn(`[Weather] Lỗi khi gọi ${api.url}:`, err.message)
    }
  }

  // Không cache thất bại vào cachedLocation — lần poll tiếp theo
  // sẽ thử gọi lại thay vì kẹt ở fallback mãi mãi.
  console.warn('[Weather] Tất cả API lấy vị trí đều thất bại, dùng mặc định.')
  return { lat: 21.0285, lon: 105.8542, city: i18n.t('weatherCond.hanoi', 'Hanoi (default)') }
}

// Chuyển hướng gió (độ) → windForceX
// Hướng gió trong khí tượng là hướng GIÓ TỪ ĐÂU ĐẾN:
// 0° = từ Bắc (thổi xuống Nam), 90° = từ Đông (thổi sang Tây)
// 270° = từ Tây (thổi sang Đông) → heo bị đẩy sang phải → forceX > 0
function calcWindForceX(directionDeg) {
  const rad = (directionDeg * Math.PI) / 180
  // sin(direction): 0°→0, 90°→+1 (Đông→Tây = thổi trái = forceX < 0)
  // Gió từ Tây (270°) = sin(270°) = -1 → thổi sang Đông = forceX > 0
  return -Math.sin(rad) // flip: gió từ Tây thổi sang phải
}

function buildDescription(condition, windSpeed, temperature) {
  const condLabels = {
    clear: `☀️ ${i18n.t('weatherCond.clear', 'Clear')}`,
    cloudy: `⛅ ${i18n.t('weatherCond.cloudy', 'Cloudy')}`,
    fog: `🌫️ ${i18n.t('weatherCond.fog', 'Fog')}`,
    drizzle: `🌦️ ${i18n.t('weatherCond.drizzle', 'Drizzle')}`,
    rain: `🌧️ ${i18n.t('weatherCond.rain', 'Rain')}`,
    snow: `❄️ ${i18n.t('weatherCond.snow', 'Snow')}`,
    thunderstorm: `⛈️ ${i18n.t('weatherCond.thunderstorm', 'Thunderstorm')}`,
  }
  const label = condLabels[condition] || `🌤️ ${i18n.t('weatherCond.normal', 'Normal')}`
  const tempStr = temperature !== null && temperature !== undefined ? `, ${Math.round(temperature)}°C` : ''
  return `${label}${tempStr}, ${i18n.t('weatherCond.wind', 'wind')} ${Math.round(windSpeed)} km/h`
}

// ─── Main fetch ───────────────────────────────────────────────────────────────
async function fetchWeather() {
  try {
    const loc = await getLocation()
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=weathercode,windspeed_10m,winddirection_10m,temperature_2m&hourly=weathercode,temperature_2m&windspeed_unit=kmh&timezone=auto&forecast_days=2`
    const data = await fetchJson(url)

    // Open-Meteo API v1: data.current holds current values
    const cur = data.current || data.current_weather || {}
    const wmoCode = cur.weathercode ?? cur.weather_code ?? 0
    const windSpeed = cur.windspeed_10m ?? cur.windspeed ?? 0
    const windDir = cur.winddirection_10m ?? cur.winddirection ?? 0
    const temperature = cur.temperature_2m ?? cur.temperature ?? null
    const condition = WMO_CODES[wmoCode] || 'cloudy'
    const windForceX = calcWindForceX(windDir)
    const isStorm = condition === 'thunderstorm' || windSpeed > 60

    // Dự báo 3 tiếng tới (lấy 3 slot hourly gần nhất)
    let upcomingCondition = null
    if (data.hourly && data.hourly.weathercode) {
      const now = new Date()
      const hour = now.getHours()
      const next3 = data.hourly.weathercode.slice(hour + 1, hour + 4)
      // Nếu có thay đổi xấu hơn trong 3 tiếng tới
      const SEVERITY = { clear: 0, cloudy: 1, fog: 1, drizzle: 2, rain: 3, snow: 3, thunderstorm: 4 }
      const curSeverity = SEVERITY[condition] || 0
      for (const code of next3) {
        const cond = WMO_CODES[code] || 'cloudy'
        if ((SEVERITY[cond] || 0) > curSeverity) {
          upcomingCondition = cond
          break
        }
      }
    }

    currentWeather = {
      condition,
      windSpeed,
      windDirection: windDir,
      windForceX,
      isStorm,
      temperature,
      upcomingCondition, // thời tiết sắp tới (xấu hơn hiện tại)
      description: buildDescription(condition, windSpeed, temperature),
      city: loc.city,
    }

    console.log(`[Weather] ${currentWeather.description} (${loc.city}) upcoming:${upcomingCondition}`)
    if (updateCallback) updateCallback(currentWeather)
  } catch (err) {
    console.warn('[Weather] Fetch failed:', err.message)
    // Giữ nguyên data cũ, không crash
  }
}

// ─── Vị trí thủ công (Settings) ─────────────────────────────────────────────
// Tìm địa điểm theo tên bằng API geocoding miễn phí của Open-Meteo — cùng
// nhà cung cấp với API thời tiết đang dùng, không cần thêm API key.
async function searchLocation(query) {
  if (!query || !query.trim()) return []
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=8&language=vi&format=json`
  try {
    const data = await fetchJson(url)
    if (!data.results) return []
    return data.results.map(r => ({
      lat: r.latitude,
      lon: r.longitude,
      city: r.name,
      admin1: r.admin1 || '',
      country: r.country || '',
      // Tên hiển thị đầy đủ, vd "Đà Nẵng, Việt Nam"
      label: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
    }))
  } catch (err) {
    console.warn('[Weather] Tìm địa điểm thất bại:', err.message)
    return []
  }
}

function setManualLocation(loc) {
  if (loc && typeof loc.lat === 'number' && typeof loc.lon === 'number') {
    manualLocation = { lat: loc.lat, lon: loc.lon, city: loc.city || loc.label || i18n.t('weatherCond.selected', 'Selected Location') }
    cachedLocation = null // bỏ cache IP cũ, không cần nữa
    fetchWeather() // cập nhật thời tiết ngay theo vị trí mới
  }
}

function clearManualLocation() {
  manualLocation = null
  cachedLocation = null // cho phép gọi lại ipapi.co từ đầu
  fetchWeather()
}

function getLocationInfo() {
  return {
    mode: manualLocation ? 'manual' : 'auto',
    location: manualLocation || cachedLocation || null,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────
function start(onUpdate) {
  updateCallback = onUpdate
  fetchWeather()
  // Polling mỗi 60 phút
  pollingTimer = setInterval(fetchWeather, 60 * 60 * 1000)
}

function stop() {
  if (pollingTimer) {
    clearInterval(pollingTimer)
    pollingTimer = null
  }
}

function getCurrent() {
  return currentWeather
}

module.exports = { start, stop, getCurrent, searchLocation, setManualLocation, clearManualLocation, getLocationInfo }
