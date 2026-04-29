export async function getLocalWeather(lat: number, lng: number) {
  const API_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY || '6311d9af91289e9cbf78c0226c26d116';
  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&appid=${API_KEY}`);
    const data = await res.json();
    return data;
  } catch (error) {
    return null;
  }
}

export async function getFloodRisk(lat: number, lng: number) {
  const API_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_FLOOD_API_KEY || '5a3065934a0eee350c66e4de29bf0143';
  try {
    // OpenWeather Flood API (Risk API)
    // Note: If using the basic weather API without a dedicated flood subscription, it might reject. 
    // We'll wrap in try-catch and handle fallback.
    const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${API_KEY}`);
    const data = await res.json();
    return data;
  } catch (error) {
    return null;
  }
}
