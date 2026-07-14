const https = require('https')

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

function defaultWeather() {
  return {
    condition: 'clear',
    windSpeed: 0,
    windDirection: 0,
    windForceX: 0, // -1 = gió sang trái (W→E), +1 = sang phải
    isStorm: false,
    description: 'Đang tải thời tiết...',
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 10000 }, (res) => {
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
  if (cachedLocation) return cachedLocation
  try {
    const data = await fetchJson('https://ipapi.co/json/')
    // ipapi.co có thể trả về HTTP 200 nhưng body là lỗi (vd bị rate-limit:
    // {"error":true,"reason":"RateLimited"}) — lúc đó latitude/longitude sẽ
    // undefined. Trước đây code không kiểm tra điều này, nên vẫn cache lại
    // "vị trí" với lat/lon undefined, khiến gọi Open-Meteo với toạ độ rỗng
    // (dữ liệu thời tiết vô nghĩa) và city hiện "Unknown" mãi mãi.
    if (typeof data.latitude === 'number' && typeof data.longitude === 'number' &&
        !Number.isNaN(data.latitude) && !Number.isNaN(data.longitude)) {
      cachedLocation = { lat: data.latitude, lon: data.longitude, city: data.city || 'Không rõ' }
      return cachedLocation
    }
    console.warn('[Weather] ipapi.co trả về dữ liệu không hợp lệ (có thể bị rate-limit):', JSON.stringify(data).slice(0, 200))
  } catch (err) {
    console.warn('[Weather] Không lấy được vị trí theo IP:', err.message)
  }
  // Không cache thất bại vào cachedLocation — lần poll tiếp theo (30 phút
  // sau) sẽ thử gọi lại ipapi.co thay vì kẹt ở fallback mãi mãi.
  return { lat: 21.0285, lon: 105.8542, city: 'Hà Nội (mặc định)' }
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
    clear: '☀️ Trời quang',
    cloudy: '⛅ Trời nhiều mây',
    fog: '🌫️ Sương mù',
    drizzle: '🌦️ Mưa phùn',
    rain: '🌧️ Trời mưa',
    snow: '❄️ Tuyết rơi',
    thunderstorm: '⛈️ Bão sấm sét',
  }
  const label = condLabels[condition] || '🌤️ Trời bình thường'
  const tempStr = temperature !== null && temperature !== undefined ? `, ${Math.round(temperature)}°C` : ''
  return `${label}${tempStr}, gió ${Math.round(windSpeed)} km/h`
}

// ─── Main fetch ───────────────────────────────────────────────────────────────
async function fetchWeather() {
  try {
    const loc = await getLocation()
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=weathercode,windspeed_10m,winddirection_10m,temperature_2m&hourly=weathercode,temperature_2m&windspeed_unit=kmh&timezone=auto&forecast_days=1`
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

// ─── Public API ───────────────────────────────────────────────────────────────
function start(onUpdate) {
  updateCallback = onUpdate
  fetchWeather()
  // Polling mỗi 30 phút
  pollingTimer = setInterval(fetchWeather, 30 * 60 * 1000)
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

module.exports = { start, stop, getCurrent }
