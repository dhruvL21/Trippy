import type { Trip, ItineraryDay, Activity, CostBreakdown, SafetyReport } from '../types';

export const AIService = {
  /**
   * Main OpenAI execution method
   */
  async callOpenAI(systemPrompt: string, userPrompt: string, isJson: boolean, apiKey: string, model: string = 'gpt-4o-mini'): Promise<string> {
    const activeKey = apiKey || (import.meta.env.VITE_OPENAI_API_KEY as string);
    if (!activeKey) {
      throw new Error('OpenAI API Key is missing. Please set VITE_OPENAI_API_KEY in your .env file.');
    }

    const url = 'https://api.openai.com/v1/chat/completions';
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${activeKey}`
    };

    const body: {
      model: string;
      messages: { role: string; content: string }[];
      temperature: number;
      response_format?: { type: string };
    } = {
      model: model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7
    };

    if (isJson) {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errMessage = errData.error?.message || `HTTP error ${response.status}`;
      throw new Error(`OpenAI API failed: ${errMessage}`);
    }

    const result = await response.json();
    return result.choices[0].message.content;
  },

  /**
   * AI-powered Trip Itinerary Generator
   */
  async generateItinerary(
    params: {
      source: string;
      destination: string;
      startDate: string;
      endDate: string;
      travelers: number;
      budgetLimit: number;
      interests: string[];
      tripType: string;
      accommodationPreference: string;
      transportPreference: string;
    },
    apiKey: string,
    model: string
  ): Promise<Trip> {
    const durationDays = Math.max(1, Math.ceil((new Date(params.endDate).getTime() - new Date(params.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1);

    const activeKey = apiKey || (import.meta.env.VITE_OPENAI_API_KEY as string);
    if (activeKey) {
      const systemPrompt = `You are TripPilot AI, a premium intelligent Indian travel companion.
Generate a comprehensive, highly realistic day-wise travel itinerary in structured JSON format.
Ensure you align the plans with Indian culture, local transportation, budgets (in INR ₹), and geography.

CRITICAL COSTING & MATHEMATICAL RULES:
1. Every activity in the daily itinerary must have a realistic cost (in INR ₹) representing the combined total for all travelers.
2. Calculate costs according to these exact guidelines:
   - "accommodation": Allocate lodging costs for all travelers combined. Standard hotel charges based on the user's preference: Luxury (~₹6000/night/room), Standard (~₹2500/night/room), Budget (~₹900/night/room). Calculate the number of rooms needed as Math.ceil(Number_of_Travelers / 2). Total daily accommodation cost = rooms * cost_per_night.
   - "transport": Include inter-city transit on Day 1 (and returning on the last day) based on preference: flight (~₹4500/person), train (~₹850/person), cab/bus (~₹2500/person). Scale this by the total number of travelers. Also include realistic local transit costs (auto-rickshaws, metro, cabs) throughout the days.
   - "food": Realistic daily meal expenses for all travelers combined based on preference: Luxury (~₹1500/person/day), Standard (~₹600/person/day), Budget (~₹250/person/day).
   - "sightseeing" & "shopping": Realistic entrance tickets, guide fees, and shopping costs, scaled for all travelers combined.
   - "emergency": Roughly 8% of the total budget limit.
3. The sum of the cost of all activities of a given type in the itinerary MUST exactly equal the corresponding field in the "costBreakdown" (e.g. sum of all "food" activities in the itinerary must equal "costBreakdown.food").
4. "costBreakdown.total" MUST be mathematically equal to the sum of accommodation, transport, food, sightseeing, shopping, and emergency. Double check your math!
5. Ensure the total cost does NOT exceed the user's budget limit.

Return ONLY a valid JSON object matching the following structure:
{
  "itinerary": [
    {
      "dayNumber": number,
      "date": "YYYY-MM-DD",
      "title": "Theme of the day",
      "activities": [
        {
          "time": "HH:MM",
          "title": "Activity name",
          "description": "Details about the activity",
          "cost": number,
          "type": "accommodation" | "transport" | "food" | "sightseeing" | "shopping" | "emergency",
          "location": "Specific place name",
          "isSafetyWarning": boolean,
          "address": "Detailed physical address, street name, or precise landmark description for the location (required for sightseeing, food, shopping)",
          "durationHours": number,
          "highlights": ["highlight 1", "highlight 2"],
          "dressCode": "specific clothing rules or entry etiquette, especially for religious sights (e.g. cover shoulders/knees, shoes must be removed)"
        }
      ],
      "budgetTip": "Tip for saving money today"
    }
  ],
  "costBreakdown": {
    "accommodation": number,
    "transport": number,
    "food": number,
    "sightseeing": number,
    "shopping": number,
    "emergency": number,
    "total": number
  },
  "packingList": ["string"]
}`;

      const userPrompt = `Generate a ${durationDays}-day trip itinerary from ${params.source} to ${params.destination}.
Start Date: ${params.startDate}, End Date: ${params.endDate}.
Number of travelers: ${params.travelers}.
Total budget limit: ₹${params.budgetLimit} INR.
User Interests: ${params.interests.join(', ')}.
Trip Type: ${params.tripType}.
Accommodation: ${params.accommodationPreference}.
Transport preference: ${params.transportPreference}.

Calculate and output all costs exactly for ${params.travelers} travelers and ${durationDays} days. Ensure they sum up properly. Make sure the total cost does NOT exceed ₹${params.budgetLimit} INR. Include realistic place names, precise physical addresses, duration of visits, specific activity highlights, and local etiquette/dress code guidelines for ${params.destination}. Suggest practical Indian transport modes like auto-rickshaws, metro, Vande Bharat trains, local cabs, or scooty rentals.`;

      try {
        const responseText = await this.callOpenAI(systemPrompt, userPrompt, true, activeKey, model);
        const parsed = JSON.parse(responseText);

        const trip = {
          id: Math.random().toString(36).substring(2, 9),
          ...params,
          itinerary: parsed.itinerary || [],
          costBreakdown: parsed.costBreakdown || {
            accommodation: 0,
            transport: 0,
            food: 0,
            sightseeing: 0,
            shopping: 0,
            emergency: 0,
            total: 0
          },
          packingList: parsed.packingList || []
        };
        return this.alignAndValidateTripCosts(trip);
      } catch (error) {
        console.error('Failed to generate itinerary with OpenAI:', error);
        throw new Error('Failed to generate itinerary. Please ensure your OpenAI API key is valid.');
      }
    }
    throw new Error('OpenAI API key is missing. The offline mock data fallback has been removed.');
  },

  /**
   * Generates a high-quality mock trip itinerary when offline or no API key is specified
   */
  generateMockTrip(): any {
    throw new Error('Mock data has been removed. Please use OpenAI.');
  },

  /**
   * AI-powered Safety Assistant response generator
   */
  async generateSafetyReport(destination: string, apiKey: string, model: string): Promise<SafetyReport> {
    const activeKey = apiKey || (import.meta.env.VITE_OPENAI_API_KEY as string);
    if (activeKey) {
      const systemPrompt = `You are a travel safety expert specializing in Indian destinations.
Provide a safety report for the requested destination in structured JSON format.
Return ONLY a JSON object matching this schema:
{
  "rating": number (1 to 100, where 100 is extremely safe),
  "commonScams": ["string"],
  "safeNeighborhoods": ["string"],
  "unsafeNeighborhoods": ["string"],
  "soloTravelerTips": ["string"],
  "qa": [
    {
      "question": "What is a common safety question about this destination?",
      "answer": "Safety advice answering the question"
    }
  ]
}`;
      const userPrompt = `Provide a comprehensive travel safety report for: ${destination}. Highlight solo-traveler safety, late-night safety, common local tourist scams, and emergency tips.`;

      try {
        const responseText = await this.callOpenAI(systemPrompt, userPrompt, true, activeKey, model);
        return JSON.parse(responseText);
      } catch (err) {
        console.error('Failed to fetch AI safety report, falling back to mock', err);
      }
    }

    return this.getMockSafetyReport(destination);
  },

  /**
   * Mock safety report fallback
   */
  getMockSafetyReport(destination: string): SafetyReport {
    throw new Error('Mock data disabled. Please use OpenAI.');
  },

  /**
   * AI Replanner suggestion generator
   */
  async generateReplannedItinerary(
    trip: Trip,
    dayNumber: number,
    reason: string,
    apiKey: string,
    model: string
  ): Promise<ItineraryDay> {
    const day = trip.itinerary.find(d => d.dayNumber === dayNumber);
    if (!day) throw new Error('Day not found in itinerary.');

    const activeKey = apiKey || (import.meta.env.VITE_OPENAI_API_KEY as string);
    if (activeKey) {
      const systemPrompt = `You are a dynamic travel agent. React to an unexpected event during a trip and adjust the activities for the rest of standard day.
Return ONLY a valid JSON object matching this schema:
{
  "dayNumber": number,
  "date": "YYYY-MM-DD",
  "title": "Updated Day Theme",
  "activities": [
    {
      "time": "HH:MM",
      "title": "Activity name",
      "description": "Details adjusted for the trigger event",
      "cost": number,
      "type": "accommodation" | "transport" | "food" | "sightseeing" | "shopping" | "emergency",
      "location": "Place name",
      "isSafetyWarning": boolean
    }
  ],
  "budgetTip": "Adjusted saving tip"
}`;
      const userPrompt = `The traveler is on Day ${dayNumber} in ${trip.destination}.
Current Day Itinerary: ${JSON.stringify(day)}
The traveler clicked this event trigger: "${reason}" (e.g. Rain, Attraction Closed, Over Budget, Low Energy).
Replanning parameters: Adjust the remaining hours of this day itinerary to be safer, indoor-focused (if rain), cheaper (if over budget), or rest-focused. Leave morning items intact if they already happened, or rewrite items after 12:00 PM. Keep costs realistic.`;

      try {
        const responseText = await this.callOpenAI(systemPrompt, userPrompt, true, activeKey, model);
        return JSON.parse(responseText);
      } catch (err) {
        console.error('AI replanning failed, using mock rules', err);
      }
    }

    return this.getMockReplannedDay(day, reason);
  },

  /**
   * Mock replanner logic
   */
  getMockReplannedDay(day: ItineraryDay, reason: string): ItineraryDay {
    throw new Error('Mock data disabled. Please use OpenAI.');
  },

  /**
   * General Assistant Chatbot endpoint
   */
  async askChatbot(
    chatHistory: { role: 'user' | 'assistant' | 'system', content: string }[],
    contextTrip: Trip | null,
    apiKey: string,
    model: string,
    personalInfo?: string
  ): Promise<string> {
    const activeKey = apiKey || (import.meta.env.VITE_OPENAI_API_KEY as string);
    if (activeKey) {
      let systemPrompt = `You are TripPilot AI, a knowledgeable, helpful, and charming Indian travel assistant.
You have full context about the user's active travel plan. Reference details of their trip (dates, destinations, travelers, expenses, budget) naturally to personalize your answers.
Provide tips on temple dress codes, UPI payment acceptance, tipping standards, Vande Bharat train bookings, regional food specialities, and local terms.
Be concise, structural, and write in markdown format.`;

      if (contextTrip) {
        systemPrompt += `\n\nActive Trip Context:\n${JSON.stringify({
          source: contextTrip.source,
          destination: contextTrip.destination,
          startDate: contextTrip.startDate,
          endDate: contextTrip.endDate,
          travelers: contextTrip.travelers,
          budgetLimit: contextTrip.budgetLimit,
          interests: contextTrip.interests,
          accommodation: contextTrip.accommodationPreference,
          transport: contextTrip.transportPreference,
          costSpent: contextTrip.costBreakdown.total
        })}`;
      }

      if (personalInfo && personalInfo.trim()) {
        systemPrompt += `\n\nUser Personal Info / Preferences / Health & Safety Notes:\n${personalInfo.trim()}`;
      }

      const url = 'https://api.openai.com/v1/chat/completions';
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activeKey}`
      };

      const body = {
        model: model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...chatHistory
        ],
        temperature: 0.7
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`OpenAI Chat Error: ${response.statusText}`);
      }

      const result = await response.json();
      return result.choices[0].message.content;
    }

    // Dynamic Mock Chatbot replies based on last user message
    const lastUserMessage = chatHistory[chatHistory.length - 1]?.content || '';
    return this.getMockChatbotReply(lastUserMessage, contextTrip);
  },

  /**
   * Mock chatbot responses
   */
  getMockChatbotReply(query: string, trip: Trip | null): string {
    throw new Error('Mock data disabled. Please use OpenAI.');
  },

  /**
   * Sanitizes, aligns, and validates trip costs and itinerary activities.
   * Recalculates cost breakdown categories directly from activities.
   * Proportional scaling is applied to flexible categories if total budget is exceeded.
   */
  alignAndValidateTripCosts(trip: Trip): Trip {

    // 1. Ensure daily accommodation activities exist in the itinerary
    let hasAccommodationActivity = false;
    trip.itinerary.forEach(day => {
      if (day.activities.some(act => act.type === 'accommodation')) {
        hasAccommodationActivity = true;
      }
    });

    const accommodationCostPerNight = trip.accommodationPreference === 'Luxury' ? 6000 : trip.accommodationPreference === 'Standard' ? 2500 : 900;
    const roomsCount = Math.ceil(trip.travelers / 2);
    const dailyAccCost = accommodationCostPerNight * roomsCount;

    if (!hasAccommodationActivity) {
      trip.itinerary.forEach(day => {
        day.activities.unshift({
          time: '08:00',
          title: `${trip.accommodationPreference} Stay (Daily Cost)`,
          description: `Room charge at your chosen ${trip.accommodationPreference.toLowerCase()} lodging.`,
          cost: dailyAccCost,
          type: 'accommodation',
          location: 'Hotel/Homestay'
        });
      });
    }

    // 2. Ensure intercity travel activity exists on Day 1
    let hasIntercityTravel = false;
    trip.itinerary.forEach(day => {
      if (day.activities.some(act => act.type === 'transport' && act.title.includes('Travel:'))) {
        hasIntercityTravel = true;
      }
    });

    const intercityCostPerPerson =
      trip.transportPreference === 'flight' ? 4500 :
        trip.transportPreference === 'train' ? 850 :
          2500; // cab/bus/default
    const totalIntercityCost = intercityCostPerPerson * trip.travelers;

    if (!hasIntercityTravel && trip.itinerary.length > 0) {
      trip.itinerary[0].activities.splice(1, 0, {
        time: '07:00',
        title: `Travel: ${trip.source} to ${trip.destination}`,
        description: `Inter-city transit via ${trip.transportPreference}.`,
        cost: totalIntercityCost,
        type: 'transport',
        location: `${trip.source} Station/Airport`
      });
    }

    // 3. Ensure emergency buffer is represented as an activity
    let hasEmergencyActivity = false;
    trip.itinerary.forEach(day => {
      if (day.activities.some(act => act.type === 'emergency')) {
        hasEmergencyActivity = true;
      }
    });

    const emergencyBuffer = Math.round(trip.budgetLimit * 0.08);
    if (!hasEmergencyActivity && trip.itinerary.length > 0) {
      const lastDay = trip.itinerary[trip.itinerary.length - 1];
      lastDay.activities.push({
        time: '21:00',
        title: 'Emergency Buffer / Contingency Fund',
        description: 'Reserved funds for unexpected travel expenses or emergency needs.',
        cost: emergencyBuffer,
        type: 'emergency',
        location: 'General'
      });
    }

    // 4. Recalculate cost breakdown fields based on activities
    let accommodation = 0;
    let transport = 0;
    let food = 0;
    let sightseeing = 0;
    let shopping = 0;
    let emergency = 0;

    trip.itinerary.forEach(day => {
      day.activities.forEach(act => {
        const cost = Number(act.cost) || 0;
        if (act.type === 'accommodation') accommodation += cost;
        else if (act.type === 'transport') transport += cost;
        else if (act.type === 'food') food += cost;
        else if (act.type === 'sightseeing') sightseeing += cost;
        else if (act.type === 'shopping') shopping += cost;
        else emergency += cost;
      });
    });

    let total = accommodation + transport + food + sightseeing + shopping + emergency;

    // 5. If the total exceeds the budget limit, scale down flexible expenses
    if (total > trip.budgetLimit) {
      let fixedCosts = 0;
      let flexibleCosts = 0;
      let currentEmergency = 0;

      trip.itinerary.forEach(day => {
        day.activities.forEach(act => {
          const cost = Number(act.cost) || 0;
          if (act.type === 'accommodation' || act.title.includes('Travel:')) {
            fixedCosts += cost;
          } else if (act.type === 'emergency') {
            currentEmergency += cost;
          } else {
            flexibleCosts += cost;
          }
        });
      });

      const minEmergency = Math.max(2000, Math.round(trip.budgetLimit * 0.02));
      let finalEmergency = 0;

      if (fixedCosts + minEmergency < trip.budgetLimit) {
        finalEmergency = minEmergency;
        if (flexibleCosts > 0) {
          const scaleFactor = (trip.budgetLimit - fixedCosts - minEmergency) / flexibleCosts;
          trip.itinerary.forEach(day => {
            day.activities.forEach(act => {
              if (act.type !== 'accommodation' && act.type !== 'emergency' && !act.title.includes('Travel:')) {
                act.cost = Math.round(act.cost * scaleFactor);
              }
            });
          });
        }
      } else {
        // Even with minEmergency, fixed costs exceed/equal the budget limit
        trip.itinerary.forEach(day => {
          day.activities.forEach(act => {
            if (act.type !== 'accommodation' && act.type !== 'emergency' && !act.title.includes('Travel:')) {
              act.cost = 0;
            }
          });
        });
        finalEmergency = Math.max(0, trip.budgetLimit - fixedCosts);
      }

      // Update emergency buffer activities in the itinerary to match finalEmergency
      trip.itinerary.forEach(day => {
        day.activities.forEach(act => {
          if (act.type === 'emergency') {
            act.cost = finalEmergency;
          }
        });
      });

      // Recalculate after scaling
      accommodation = 0;
      transport = 0;
      food = 0;
      sightseeing = 0;
      shopping = 0;
      emergency = 0;

      trip.itinerary.forEach(day => {
        day.activities.forEach(act => {
          const cost = Number(act.cost) || 0;
          if (act.type === 'accommodation') accommodation += cost;
          else if (act.type === 'transport') transport += cost;
          else if (act.type === 'food') food += cost;
          else if (act.type === 'sightseeing') sightseeing += cost;
          else if (act.type === 'shopping') shopping += cost;
          else emergency += cost;
        });
      });

      total = accommodation + transport + food + sightseeing + shopping + emergency;
    }

    trip.costBreakdown = {
      accommodation,
      transport,
      food,
      sightseeing,
      shopping,
      emergency,
      total
    };

    return trip;
  }
};
