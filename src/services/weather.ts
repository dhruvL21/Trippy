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

const generateMockWeather = (city: string): WeatherData => {
  const cityLower = city.toLowerCase();
  let baseTemp = 24;
  let condition = 'Clear';
  let description = 'clear sky';
  let icon = '01d';
  let humidity = 60;
  let windSpeed = 3.5;

  if (
    cityLower.includes('kedarnath') || 
    cityLower.includes('manali') || 
    cityLower.includes('leh') || 
    cityLower.includes('ladakh') || 
    cityLower.includes('shimla') || 
    cityLower.includes('kashmir') || 
    cityLower.includes('himalaya') ||
    cityLower.includes('badrinath') ||
    cityLower.includes('gangotri')
  ) {
    baseTemp = 6;
    condition = 'Snow';
    description = 'light snow showers';
    icon = '13d';
    humidity = 85;
    windSpeed = 5.2;
  } else if (
    cityLower.includes('goa') || 
    cityLower.includes('mumbai') || 
    cityLower.includes('kerala') || 
    cityLower.includes('chennai') || 
    cityLower.includes('pondicherry') || 
    cityLower.includes('bangalore') || 
    cityLower.includes('jaipur') ||
    cityLower.includes('delhi') ||
    cityLower.includes('agra')
  ) {
    baseTemp = 31;
    condition = 'Clouds';
    description = 'scattered clouds';
    icon = '03d';
    humidity = 78;
    windSpeed = 4.1;
  }

  // Create 5-day forecast starting from tomorrow
  const forecast: DailyForecast[] = [];
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();

  const conditionsList = ['Clear', 'Clouds', 'Rain', 'Snow'];
  const coldConditions = ['Snow', 'Clouds', 'Rain'];
  const warmConditions = ['Clear', 'Clouds', 'Rain'];

  for (let i = 1; i <= 5; i++) {
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + i);
    const dayName = daysOfWeek[nextDate.getDay()];
    const dateString = `${dayName}, ${nextDate.getDate()} ${nextDate.toLocaleString('default', { month: 'short' })}`;

    let dayTemp = baseTemp + Math.round((Math.random() - 0.5) * 4);
    let dayMin = dayTemp - Math.round(2 + Math.random() * 3);
    let dayMax = dayTemp + Math.round(2 + Math.random() * 3);
    let dayCondition = condition;
    let dayIcon = icon;
    let dayDesc = description;

    // Vary the weather slightly per day
    if (baseTemp <= 10) {
      // Cold weather variation
      dayCondition = coldConditions[Math.floor(Math.random() * coldConditions.length)];
      if (dayCondition === 'Snow') { dayIcon = '13d'; dayDesc = 'light snow'; }
      else if (dayCondition === 'Clouds') { dayIcon = '03d'; dayDesc = 'broken clouds'; }
      else { dayIcon = '09d'; dayDesc = 'cold drizzle'; }
    } else {
      // Warm/moderate weather variation
      dayCondition = warmConditions[Math.floor(Math.random() * warmConditions.length)];
      if (dayCondition === 'Clear') { dayIcon = '01d'; dayDesc = 'clear sky'; }
      else if (dayCondition === 'Clouds') { dayIcon = '02d'; dayDesc = 'few clouds'; }
      else { dayIcon = '10d'; dayDesc = 'light passing shower'; }
    }

    forecast.push({
      date: dateString,
      temp: dayTemp,
      minTemp: dayMin,
      maxTemp: dayMax,
      condition: dayCondition,
      description: dayDesc,
      icon: dayIcon
    });
  }

  return {
    isMock: true,
    current: {
      temp: baseTemp,
      feelsLike: baseTemp - 1,
      condition,
      description,
      icon,
      humidity,
      windSpeed
    },
    forecast
  };
};

export const WeatherService = {
  fetchWeatherForecast: async (city: string, apiKey?: string): Promise<WeatherData> => {
    if (!apiKey || apiKey.trim() === '') {
      return generateMockWeather(city);
    }

    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`
      );
      if (!response.ok) {
        throw new Error(`OpenWeatherMap error: ${response.statusText}`);
      }

      const data = await response.json();
      const list = data.list || [];
      if (list.length === 0) {
        return generateMockWeather(city);
      }

      const currentItem = list[0];
      const current = {
        temp: Math.round(currentItem.main.temp),
        feelsLike: Math.round(currentItem.main.feels_like),
        condition: currentItem.weather[0].main,
        description: currentItem.weather[0].description,
        icon: currentItem.weather[0].icon,
        humidity: currentItem.main.humidity,
        windSpeed: currentItem.wind.speed
      };

      // Extract daily forecasts (group by date string)
      const dailyMap: { [key: string]: any[] } = {};
      list.forEach((item: any) => {
        const dateStr = item.dt_txt.split(' ')[0];
        if (!dailyMap[dateStr]) {
          dailyMap[dateStr] = [];
        }
        dailyMap[dateStr].push(item);
      });

      const forecast: DailyForecast[] = [];
      const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      
      Object.keys(dailyMap).slice(0, 5).forEach((dateStr) => {
        const items = dailyMap[dateStr];
        const midDayItem = items.find((item: any) => item.dt_txt.includes('12:00:00')) || items[Math.floor(items.length / 2)];
        const dateVal = new Date(midDayItem.dt * 1000);
        const dayName = daysOfWeek[dateVal.getDay()];
        const formattedDate = `${dayName}, ${dateVal.getDate()} ${dateVal.toLocaleString('default', { month: 'short' })}`;

        let minTemp = 100;
        let maxTemp = -100;
        items.forEach((item: any) => {
          if (item.main.temp_min < minTemp) minTemp = item.main.temp_min;
          if (item.main.temp_max > maxTemp) maxTemp = item.main.temp_max;
        });

        forecast.push({
          date: formattedDate,
          temp: Math.round(midDayItem.main.temp),
          minTemp: Math.round(minTemp),
          maxTemp: Math.round(maxTemp),
          condition: midDayItem.weather[0].main,
          description: midDayItem.weather[0].description,
          icon: midDayItem.weather[0].icon
        });
      });

      return {
        isMock: false,
        current,
        forecast
      };
    } catch (err) {
      console.warn("Failed to fetch live weather from OpenWeatherMap, falling back to mock:", err);
      return generateMockWeather(city);
    }
  }
};
