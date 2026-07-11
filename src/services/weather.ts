export interface DailyForecast {
  date: string;
  temp: number;
  minTemp: number;
  maxTemp: number;
  condition: string;
  description: string;
  icon: string;
}

export interface WeatherData {
  isMock: boolean;
  current: {
    temp: number;
    feelsLike: number;
    condition: string;
    description: string;
    icon: string;
    humidity: number;
    windSpeed: number;
  };
  forecast: DailyForecast[];
}

const mapWmoToCondition = (code: number) => {
  if (code === 0) return { condition: 'Clear', description: 'clear sky', icon: '01d' };
  if (code === 1 || code === 2) return { condition: 'Clouds', description: 'partly cloudy', icon: '02d' };
  if (code === 3) return { condition: 'Clouds', description: 'overcast', icon: '04d' };
  if (code >= 45 && code <= 48) return { condition: 'Clouds', description: 'fog', icon: '50d' };
  if (code >= 51 && code <= 57) return { condition: 'Drizzle', description: 'drizzle', icon: '09d' };
  if (code >= 61 && code <= 67) return { condition: 'Rain', description: 'rain', icon: '10d' };
  if (code >= 71 && code <= 77) return { condition: 'Snow', description: 'snow', icon: '13d' };
  if (code >= 80 && code <= 82) return { condition: 'Rain', description: 'rain showers', icon: '09d' };
  if (code >= 85 && code <= 86) return { condition: 'Snow', description: 'snow showers', icon: '13d' };
  if (code >= 95 && code <= 99) return { condition: 'Thunderstorm', description: 'thunderstorm', icon: '11d' };
  return { condition: 'Clear', description: 'clear sky', icon: '01d' };
};

export const WeatherService = {
  fetchWeatherForecast: async (city: string, _apiKey?: string): Promise<WeatherData> => {
    try {
      // Step 1: Geocode the city using Open-Meteo Geocoding API
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
      if (!geoRes.ok) throw new Error("Failed to fetch coordinates");
      
      const geoData = await geoRes.json();
      if (!geoData.results || geoData.results.length === 0) {
        throw new Error(`City not found: ${city}`);
      }
      
      const { latitude, longitude } = geoData.results[0];

      // Step 2: Fetch Live Weather from Open-Meteo Forecast API
      const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`);
      if (!weatherRes.ok) throw new Error("Failed to fetch weather data");
      
      const weatherData = await weatherRes.json();
      
      const currentCond = mapWmoToCondition(weatherData.current.weather_code);
      const current = {
        temp: Math.round(weatherData.current.temperature_2m),
        feelsLike: Math.round(weatherData.current.apparent_temperature),
        condition: currentCond.condition,
        description: currentCond.description,
        icon: currentCond.icon,
        humidity: weatherData.current.relative_humidity_2m,
        windSpeed: weatherData.current.wind_speed_10m
      };

      const forecast: DailyForecast[] = [];
      const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      
      // Open-Meteo returns up to 7 days in the daily array. We take the first 5 starting from tomorrow (index 1).
      const daily = weatherData.daily;
      for (let i = 1; i <= 5 && i < daily.time.length; i++) {
        const dateStr = daily.time[i];
        const dateVal = new Date(dateStr);
        const dayName = daysOfWeek[dateVal.getDay()];
        const formattedDate = `${dayName}, ${dateVal.getDate()} ${dateVal.toLocaleString('default', { month: 'short' })}`;
        
        const dayCond = mapWmoToCondition(daily.weather_code[i]);
        
        forecast.push({
          date: formattedDate,
          temp: Math.round((daily.temperature_2m_max[i] + daily.temperature_2m_min[i]) / 2),
          minTemp: Math.round(daily.temperature_2m_min[i]),
          maxTemp: Math.round(daily.temperature_2m_max[i]),
          condition: dayCond.condition,
          description: dayCond.description,
          icon: dayCond.icon
        });
      }

      return {
        isMock: false,
        current,
        forecast
      };
    } catch (err) {
      console.warn("Failed to fetch live weather from Open-Meteo:", err);
      // Fallback object (in case of total failure)
      return {
        isMock: true,
        current: {
          temp: 24, feelsLike: 23, condition: 'Clear', description: 'clear sky', icon: '01d', humidity: 60, windSpeed: 3.5
        },
        forecast: []
      };
    }
  }
};
