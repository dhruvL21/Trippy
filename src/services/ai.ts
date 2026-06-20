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
        console.error('Failed to generate itinerary with OpenAI, falling back to mock engine', error);
      }
    }

    // Dynamic Mock Fallback Engine
    return this.alignAndValidateTripCosts(this.generateMockTrip(params, durationDays));
  },

  /**
   * Generates a high-quality mock trip itinerary when offline or no API key is specified
   */
  generateMockTrip(
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
    durationDays: number
  ): Trip {
    const dest = params.destination.split(',')[0].trim().toLowerCase();
    
    // Pick or construct base days
    let baseDays: Omit<ItineraryDay, 'date'>[];
    const mockPackingList: string[] = ['Aadhaar Card / ID proof', 'UPI Apps installed', 'Power bank', 'Comfortable walking shoes', 'Refillable water bottle'];

    if (dest.includes('jaipur')) {
      baseDays = [
        {
          dayNumber: 1,
          title: 'Royal Heritage & Pink City Sights',
          budgetTip: 'Buy a composite entry ticket at Albert Hall to save ₹200 on multiple monuments.',
          activities: [
            { time: '09:00', title: 'Amer Fort Exploration', description: 'Explore the grand Amer Fort, see the Sheesh Mahal (mirror palace), and take stunning photos.', cost: 200, type: 'sightseeing', location: 'Amer Fort', address: 'Amer Rd, Devisinghpura, Jaipur, Rajasthan 302001', durationHours: 3, highlights: ['Sheesh Mahal', 'Diwan-i-Aam', 'Maha Singh Palace'], dressCode: 'Comfortable walking shoes, modest clothing' },
            { time: '13:00', title: 'Rajasthani Thali Lunch', description: 'Enjoy a rich, traditional Rajasthani Dal Baati Churma meal at a legacy restaurant.', cost: 350, type: 'food', location: 'Laxmi Mishthan Bhandar', address: 'Johari Bazar Rd, Bapu Bazar, Jaipur, Rajasthan 302003', durationHours: 1.5, highlights: ['Traditional Thali', 'Dal Baati Churma', 'Sweet Lassi'] },
            { time: '15:00', title: 'Hawa Mahal & Johari Bazar Shopping', description: 'View the beautiful facade of Hawa Mahal and shop for hand-printed textiles and local jewelry.', cost: 800, type: 'shopping', location: 'Johari Bazar', address: 'Hawa Mahal Rd, Badi Choupad, Pink City, Jaipur, Rajasthan 302002', durationHours: 2.5, highlights: ['Hawa Mahal photoshoot', 'Lac Bangles', 'Traditional block prints'], dressCode: 'Casual wear' },
            { time: '19:00', title: 'Sunset view from Nahargarh Fort', description: 'Take a local cab up Nahargarh Hill for a beautiful panoramic sunset view of the pink city.', cost: 150, type: 'transport', location: 'Nahargarh Fort', address: 'Krishna Nagar, Brahampuri, Jaipur, Rajasthan 302002', durationHours: 2, highlights: ['Sunset city views', 'Stepwell (Baori) visit', 'Padao open-air cafe'] }
          ]
        },
        {
          dayNumber: 2,
          title: 'Science, Culture & Traditional Dinner',
          budgetTip: 'Use local E-rickshaws for short travel rather than calling private cabs.',
          activities: [
            { time: '09:30', title: 'Jantar Mantar Observatory', description: 'Marvel at the world\'s largest stone sundial and architectural astronomical instruments.', cost: 50, type: 'sightseeing', location: 'Jantar Mantar', address: 'Gangori Bazar, J.D.A. Market, Pink City, Jaipur, Rajasthan 302002', durationHours: 1.5, highlights: ['Vrihat Samrat Yantra', 'Laghu Samrat Yantra', 'Astronomical tools'] },
            { time: '11:30', title: 'City Palace Visit', description: 'Witness the private collection of royal costumes, carpets, and weapons at the palace museum.', cost: 300, type: 'sightseeing', location: 'City Palace', address: 'Tulsi Marg, Gangori Bazar, Pink City, Jaipur, Rajasthan 302002', durationHours: 2, highlights: ['Chandra Mahal', 'Mubarak Mahal Museum', 'Peacock Gate'], dressCode: 'Modest clothing required' },
            { time: '14:00', title: 'Pyaaz Kachori Snack', description: 'Devour the famous spicy onion kachoris of Jaipur with sweet lassi.', cost: 120, type: 'food', location: 'Rawat Mishthan Bhandar', address: 'Opposite Railway Station, Sindhi Camp, Jaipur, Rajasthan 302001', durationHours: 1, highlights: ['Pyaaz Kachori', 'Mawa Kachori', 'Lassi'] },
            { time: '18:00', title: 'Cultural Experience & Dinner', description: 'Immerse yourself in traditional folk dances, camel rides, puppet shows, and a massive royal dinner.', cost: 950, type: 'food', location: 'Chokhi Dhani', address: '12 Mile, Tonk Rd, Sitapura, Jaipur, Rajasthan 303905', durationHours: 4, highlights: ['Kalbelia folk dance', 'Camel rides', 'Royal Rajasthani feast'] }
          ]
        },
        {
          dayNumber: 3,
          title: 'Offbeat Forts & Rajasthani Crafts',
          budgetTip: 'Bargain down up to 40% when shopping at local street stalls.',
          activities: [
            { time: '10:00', title: 'Albert Hall Museum', description: 'Inspect Egyptian mummies, pottery, and weapons in a beautiful Indo-Saracenic building.', cost: 100, type: 'sightseeing', location: 'Albert Hall Museum', address: 'Museum Rd, Ram Niwas Garden, Kailash Puri, Jaipur, Rajasthan 302004', durationHours: 2, highlights: ['Egyptian Mummy', 'Persian Carpets', 'Ancient Armory'] },
            { time: '13:00', title: 'Local Block Printing Workshop', description: 'Watch local artisans dye fabrics using wooden blocks in Sanganer village.', cost: 200, type: 'sightseeing', location: 'Sanganer', address: 'Sanganer Town, Jaipur, Rajasthan 302029', durationHours: 2.5, highlights: ['Wooden block printing demo', 'Natural dye making', 'Artisan interactions'] },
            { time: '16:00', title: 'Bapu Bazar Shopping Spree', description: 'Purchase traditional Mojari leather shoes and bandhani sarees.', cost: 1200, type: 'shopping', location: 'Bapu Bazar', address: 'Bapu Bazar Rd, Pink City, Jaipur, Rajasthan 302003', durationHours: 2, highlights: ['Mojari leather footwear', 'Bandhani sarees', 'Lac jewelry'] }
          ]
        }
      ];
      mockPackingList.push('Cotton breathable clothes', 'Sunscreen and sunglasses', 'Sun hat');
    } else if (dest.includes('goa')) {
      baseDays = [
        {
          dayNumber: 1,
          title: 'North Goa Beach Hopping & Nightlife',
          budgetTip: 'Rent a scooty for ₹400/day rather than hiring private taxis which are very expensive here.',
          activities: [
            { time: '09:30', title: 'Fort Aguada Visit', description: 'Explore the 17th-century Portuguese lighthouse and enjoy coastal ocean views.', cost: 50, type: 'sightseeing', location: 'Fort Aguada', address: 'Aguada Fort Area, Candolim, Goa 403515', durationHours: 2, highlights: ['Portuguese lighthouse', 'Ocean fortifications', 'Freshwater spring'] },
            { time: '12:00', title: 'Baga Beach Watersports', description: 'Relax on the beach, or optionally participate in parasailing and jet skiing.', cost: 1000, type: 'sightseeing', location: 'Baga Beach', address: 'Baga Beach Path, Calangute, Goa 403516', durationHours: 2.5, highlights: ['Parasailing', 'Jet skiing', 'Sunbathing'], dressCode: 'Swimwear, casual beach clothing' },
            { time: '14:30', title: 'Goan Fish Curry Lunch', description: 'Eat traditional spicy Goan fish curry with rice by the shore.', cost: 450, type: 'food', location: 'Britto\'s Shack', address: 'Baga Beach, Calangute, Goa 403516', durationHours: 1.5, highlights: ['Goan Fish Curry', 'Prawn Balchao', 'Local mocktails'] },
            { time: '20:00', title: 'Nightlife at Tito\'s Lane', description: 'Dance the night away and sample local feni cocktails in the party hub.', cost: 1500, type: 'food', location: 'Tito\'s Lane', address: 'Tito\'s Lane, Baga, Goa 403516', durationHours: 4, highlights: ['Club Tito\'s', 'Feni cocktail tasting', 'Live DJ music'], dressCode: 'Smart casual / party wear' }
          ]
        },
        {
          dayNumber: 2,
          title: 'Heritage Churches & Spice Plantations',
          budgetTip: 'The government ferry from Panaji to Betim is free for pedestrians, great for a cheap boat ride!',
          activities: [
            { time: '09:00', title: 'Basilica of Bom Jesus', description: 'Visit the UNESCO world heritage site holding the mortal remains of St. Francis Xavier.', cost: 0, type: 'sightseeing', location: 'Old Goa', address: 'Old Goa Rd, Bainguinim, Goa 403110', durationHours: 1.5, highlights: ['Mortal remains of St. Francis', 'Baroque architecture', 'Sacred art gallery'], dressCode: 'Modest clothing required (knees and shoulders covered)' },
            { time: '11:30', title: 'Tropical Spice Plantation Tour', description: 'Walk through spice gardens, learn about green cardamom, peri peri, and enjoy a traditional buffet lunch.', cost: 500, type: 'food', location: 'Ponda', address: 'Arla Bazar Road, Keri, Ponda, Goa 403401', durationHours: 3, highlights: ['Guided spice walk', 'Traditional buffet on banana leaf', 'Elephant bath (optional)'] },
            { time: '15:30', title: 'Fontainhas Latin Quarter Walk', description: 'Stroll past colorful Portuguese-style houses and stop at a local bakery for pastries.', cost: 150, type: 'food', location: 'Fontainhas', address: 'Fontainhas Quarter, Panaji, Goa 403001', durationHours: 2, highlights: ['Colorful Portuguese villas', 'Confeitaria 31 De Janeiro bakery', 'Art galleries'] },
            { time: '18:00', title: 'Mandovi River Sunset Cruise', description: 'Take a scenic 1-hour cruise with Goan folk dancing and music onboard.', cost: 500, type: 'sightseeing', location: 'Mandovi River', address: 'Santa Monica Jetty, Panaji, Goa 403001', durationHours: 1.5, highlights: ['Sunset over Mandovi river', 'Dekhni folk dance', 'Sigmo festival music'] }
          ]
        },
        {
          dayNumber: 3,
          title: 'South Goa Serenity & Scenic Waterfalls',
          budgetTip: 'Share the forest jeep ride cost to Dudhsagar with other travelers at the gate.',
          activities: [
            { time: '08:00', title: 'Dudhsagar Waterfalls Trek', description: 'Take a jeep ride through the jungle to see the spectacular four-tiered milky waterfall.', cost: 600, type: 'sightseeing', location: 'Dudhsagar', address: 'Sonaulim, Goa 403706', durationHours: 5, highlights: ['Off-road forest jeep ride', '4-tiered waterfall view', 'Natural pool swimming'], dressCode: 'Sports shoes, change of clothes' },
            { time: '14:00', title: 'Palolem Beach Relaxation', description: 'Unwind on the crescent-shaped sandy beach, famous for its calm waters and scenic coconut trees.', cost: 300, type: 'food', location: 'Palolem Beach', address: 'Palolem Beach Road, Canacona, Goa 403702', durationHours: 3, highlights: ['Crescent beach walk', 'Kayaking by the island', 'Sunset beachside dinner'], dressCode: 'Beach wear' }
          ]
        }
      ];
      mockPackingList.push('Swimwear & shorts', 'Flip-flops & sandals', 'Waterproof pouch for phone');
    } else if (dest.includes('manali')) {
      baseDays = [
        {
          dayNumber: 1,
          title: 'Local Culture, Temples & Cafes',
          budgetTip: 'Walk around Old Manali instead of taking auto-rickshaws; the trails are beautiful and free.',
          activities: [
            { time: '09:30', title: 'Hadimba Temple Visit', description: 'Visit the historic wooden temple situated in the middle of dense Dhungri Van Vihar forest.', cost: 0, type: 'sightseeing', location: 'Hadimba Temple', address: 'Hadimba Temple Rd, Old Manali, Manali, Himachal Pradesh 175131', durationHours: 1.5, highlights: ['16th century wooden pagoda architecture', 'Dhungri Pine Forest', 'Yak photoshoots'], dressCode: 'Modest clothing recommended, shoes to be removed outside sanctum' },
            { time: '12:00', title: 'Manu Temple & Old Manali Walk', description: 'Cross the bridge and explore Old Manali\'s quaint houses and wood-crafted cafes.', cost: 0, type: 'sightseeing', location: 'Manu Temple', address: 'Manu Temple Road, Old Manali, Manali, Himachal Pradesh 175131', durationHours: 1.5, highlights: ['Sage Manu temple shrines', 'Quaint wooden homes', 'Scenic valley views'], dressCode: 'Modest clothing required' },
            { time: '13:30', title: 'Woodfired Pizza Lunch', description: 'Sit by the gushing Beas River and listen to live acoustic music over pizza.', cost: 400, type: 'food', location: 'Cafe 1947', address: 'Near Nehru Kund, Bahang, Old Manali, Manali, Himachal Pradesh 175131', durationHours: 1.5, highlights: ['River-side dining', 'Woodfired Pizza', 'Live music'] },
            { time: '16:00', title: 'Shopping at Mall Road', description: 'Browse for warm woolen shawls, wooden toys, and local apples.', cost: 500, type: 'shopping', location: 'Mall Road', address: 'Mall Road, Siyal, Manali, Himachal Pradesh 175131', durationHours: 2.5, highlights: ['Kullu woolens shopping', 'Himachali handcrafts', 'Local street food stalls'] }
          ]
        },
        {
          dayNumber: 2,
          title: 'Adventures in Solang Valley',
          budgetTip: 'Pre-book adventure activities online or negotiate in groups to avoid paying inflated peak season rates.',
          activities: [
            { time: '09:00', title: 'Solang Valley Paragliding', description: 'Experience a thrilling glider flight over the mountain valley with a professional pilot.', cost: 1500, type: 'sightseeing', location: 'Solang Valley', address: 'Solang Village, Manali, Himachal Pradesh 175131', durationHours: 4, highlights: ['Tandem paragliding flight', 'Zorbing ball rides', 'Cable car views'], dressCode: 'Warm layered clothing, sports shoes' },
            { time: '14:00', title: 'Jogini Waterfall Trek & Lunch', description: 'Trek from Vashisht village through pine woods to see the beautiful cascading waterfall.', cost: 150, type: 'food', location: 'Jogini Waterfalls', address: 'Vashisht Village, Manali, Himachal Pradesh 175131', durationHours: 3.5, highlights: ['Pine forest hiking trail', 'Jogini waterfall pool', 'Local Himachali cafe lunch'], dressCode: 'Sturdy trekking shoes, warm windcheater' },
            { time: '17:30', title: 'Vashisht Hot Water Springs', description: 'Relax your tired muscles in natural hot sulfur springs known for medicinal properties.', cost: 0, type: 'sightseeing', location: 'Vashisht Springs', address: 'Vashisht Village, Manali, Himachal Pradesh 175131', durationHours: 1, highlights: ['Natural sulfur hot bath', 'Vashisht temple visit', 'Local craft stalls'] }
          ]
        },
        {
          dayNumber: 3,
          title: 'Atal Tunnel & Lahaul Valley Snowy Expedition',
          budgetTip: 'Rent your snow suits and boots in Manali town for ₹250 rather than at the tunnel for ₹500.',
          activities: [
            { time: '08:30', title: 'Scenic Drive through Atal Tunnel', description: 'Travel through the world\'s longest highway tunnel above 10,000 feet, connecting to Lahaul Valley.', cost: 600, type: 'transport', location: 'Atal Tunnel', address: 'Atal Tunnel South Portal, Manali, Himachal Pradesh 175131', durationHours: 2, highlights: ['9.02 km highway tunnel drive', 'Pir Panjal mountain views', 'Engineering marvel briefing'] },
            { time: '10:30', title: 'Snow Fun at Sissu Village', description: 'Witness the gorgeous frozen waterfall and play in the snow in the dry Lahaul valley.', cost: 200, type: 'sightseeing', location: 'Sissu', address: 'Sissu Village, Lahaul Valley, Himachal Pradesh 175140', durationHours: 3.5, highlights: ['Sissu waterfall snow play', 'Telescopic glacier views', 'Snowboarding / Sledging'], dressCode: 'Heavy insulated snow suits, gloves, snow boots' },
            { time: '14:00', title: 'Traditional Siddu Meal in Sissu', description: 'Taste local Himachali steamed buns stuffed with poppy seeds and ghee.', cost: 150, type: 'food', location: 'Local Dhaba', address: 'Sissu Highway Junction, Sissu, Himachal Pradesh 175140', durationHours: 1, highlights: ['Himachali Siddu', 'Poppy seed chutney', 'Local masala chai'] }
          ]
        }
      ];
      mockPackingList.push('Heavy woolens & gloves', 'Thermaling innerwear', 'Lip balm & cold cream');
    } else {
      // Default Generic Indian Destination Generator (e.g. Delhi, Mumbai, Bengaluru, etc.)
      baseDays = [
        {
          dayNumber: 1,
          title: `Exploring the Heart of ${params.destination}`,
          budgetTip: 'Prefer metro or local trains to bypass traffic jams and save up to ₹300.',
          activities: [
            { time: '09:30', title: 'Iconic Landmark Tour', description: `Explore the historical centerpiece monument of ${params.destination}.`, cost: 150, type: 'sightseeing', location: `${params.destination} Landmark`, address: `Main Heritage St, ${params.destination}`, durationHours: 2.5, highlights: ['Historical tour', 'Museum exhibition', 'Architecture photography'], dressCode: 'Modest clothing recommended' },
            { time: '13:00', title: 'Famous Local Street Food Crawl', description: 'Try the popular street food specialities of the city.', cost: 200, type: 'food', location: 'Local Bazar', address: `Bazar Lane, ${params.destination}`, durationHours: 1.5, highlights: ['Signature local street dish', 'Sweet treats', 'Chai tasting'] },
            { time: '15:00', title: 'Traditional Market Shopping', description: 'Discover local handicrafts, textiles, and spices at native market stalls.', cost: 600, type: 'shopping', location: 'Central Bazar', address: `Market Road, ${params.destination}`, durationHours: 2.5, highlights: ['Handloom clothes', 'Artisan souvenirs', 'Spices shopping'] }
          ]
        },
        {
          dayNumber: 2,
          title: 'Cultural Wonders & Local Delights',
          budgetTip: 'Many temples and gardens have no entry fees; research before going.',
          activities: [
            { time: '10:00', title: 'Museum & Art Gallery Visit', description: 'Trace the city\'s heritage through local art, weapons, and coins.', cost: 100, type: 'sightseeing', location: 'City Museum', address: `Civic Center Area, ${params.destination}`, durationHours: 2, highlights: ['Heritage galleries', 'Ancient weapons', 'Paintings exhibition'] },
            { time: '13:30', title: 'Authentic Regional Cuisine Lunch', description: 'Enjoy a rich traditional sit-down lunch at a local legacy restaurant.', cost: 350, type: 'food', location: 'Legacy Eatery', address: `Food Street, ${params.destination}`, durationHours: 1.5, highlights: ['Traditional lunch platter', 'Local desserts', 'Heritage dining experience'] },
            { time: '16:00', title: 'Evening City Walk & Park Sunset', description: 'Take a leisurely stroll in a popular park or lakeside promenade.', cost: 50, type: 'sightseeing', location: 'City Lake', address: `Lake Drive Road, ${params.destination}`, durationHours: 2, highlights: ['Lake sunset views', 'Boating activity', 'Promenade walk'] }
          ]
        }
      ];
      mockPackingList.push('Universal power adapter', 'Hand sanitizer', 'Wet wipes');
    }

    // Adapt duration
    const finalItinerary: ItineraryDay[] = [];
    for (let i = 0; i < durationDays; i++) {
      const baseDayIndex = i % baseDays.length;
      const baseDay = baseDays[baseDayIndex];
      
      const tripDate = new Date(params.startDate);
      tripDate.setDate(tripDate.getDate() + i);
      const dateStr = tripDate.toISOString().split('T')[0];

      // Deep copy activities and update cost based on travelers
      const activities: Activity[] = baseDay.activities.map(act => {
        let cost = act.cost;
        if (act.type === 'food' || act.type === 'sightseeing' || act.type === 'shopping') {
          // Scales with travelers
          cost = act.cost * params.travelers;
        } else if (act.type === 'accommodation') {
          // Scales with rooms needed (approx 1 room per 2 travelers)
          cost = act.cost * Math.ceil(params.travelers / 2);
        }
        return {
          ...act,
          cost
        };
      });

      finalItinerary.push({
        dayNumber: i + 1,
        date: dateStr,
        title: baseDay.title,
        activities: activities,
        budgetTip: baseDay.budgetTip
      });
    }

    // Add accommodation cost daily (mocking staying in hotel)
    const accommodationCostPerNight = params.accommodationPreference === 'Luxury' ? 6000 : params.accommodationPreference === 'Standard' ? 2500 : 900;
    const roomsCount = Math.ceil(params.travelers / 2);
    const dailyAccCost = accommodationCostPerNight * roomsCount;

    finalItinerary.forEach(day => {
      day.activities.unshift({
        time: '08:00',
        title: `${params.accommodationPreference} Stay (Daily Cost)`,
        description: `Room charge at your chosen ${params.accommodationPreference.toLowerCase()} lodging.`,
        cost: dailyAccCost,
        type: 'accommodation',
        location: 'Hotel/Homestay'
      });
    });

    // Calculate cost breakdown
    let accommodation = 0;
    let transport = 0;
    let food = 0;
    let sightseeing = 0;
    let shopping = 0;
    let emergency = 0;

    finalItinerary.forEach(day => {
      day.activities.forEach(act => {
        if (act.type === 'accommodation') accommodation += act.cost;
        else if (act.type === 'transport') transport += act.cost;
        else if (act.type === 'food') food += act.cost;
        else if (act.type === 'sightseeing') sightseeing += act.cost;
        else if (act.type === 'shopping') shopping += act.cost;
        else emergency += act.cost;
      });
    });

    // Add inter-city transport mock cost to Day 1
    const intercityCostPerPerson = 
      params.transportPreference === 'flight' ? 4500 :
      params.transportPreference === 'train' ? 850 :
      2500; // cab/bus/default

    const totalIntercityCost = intercityCostPerPerson * params.travelers;
    transport += totalIntercityCost;
    
    // Add activity to Day 1
    finalItinerary[0].activities.splice(1, 0, {
      time: '07:00',
      title: `Travel: ${params.source} to ${params.destination}`,
      description: `Inter-city transit via ${params.transportPreference}.`,
      cost: totalIntercityCost,
      type: 'transport',
      location: `${params.source} Station/Airport`
    });

    // Set emergency buffer (approx 10% of budget)
    emergency = Math.round(params.budgetLimit * 0.08);

    const total = accommodation + transport + food + sightseeing + shopping + emergency;

    // Scale down if we exceed budget limit
    let scaleFactor = 1;
    if (total > params.budgetLimit) {
      scaleFactor = (params.budgetLimit - emergency) / (total - emergency);
      
      // Scale down activities costs (excluding accommodation and inter-city travel)
      finalItinerary.forEach(day => {
        day.activities.forEach(act => {
          if (act.type !== 'accommodation' && !act.title.includes('Travel:')) {
            act.cost = Math.round(act.cost * scaleFactor);
          }
        });
      });

      // Recalculate totals
      accommodation = 0;
      transport = 0;
      food = 0;
      sightseeing = 0;
      shopping = 0;
      
      finalItinerary.forEach(day => {
        day.activities.forEach(act => {
          if (act.type === 'accommodation') accommodation += act.cost;
          else if (act.type === 'transport') transport += act.cost;
          else if (act.type === 'food') food += act.cost;
          else if (act.type === 'sightseeing') sightseeing += act.cost;
          else if (act.type === 'shopping') shopping += act.cost;
        });
      });
    }

    const finalTotal = accommodation + transport + food + sightseeing + shopping + emergency;
    const costBreakdown: CostBreakdown = {
      accommodation,
      transport,
      food,
      sightseeing,
      shopping,
      emergency,
      total: finalTotal
    };

    return {
      id: Math.random().toString(36).substring(2, 9),
      source: params.source,
      destination: params.destination,
      startDate: params.startDate,
      endDate: params.endDate,
      travelers: params.travelers,
      budgetLimit: params.budgetLimit,
      interests: params.interests,
      tripType: params.tripType,
      accommodationPreference: params.accommodationPreference,
      transportPreference: params.transportPreference,
      itinerary: finalItinerary,
      costBreakdown,
      packingList: mockPackingList
    };
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
    const dest = destination.toLowerCase();
    
    if (dest.includes('jaipur')) {
      return {
        rating: 82,
        commonScams: [
          'Gemstone/Jewelry scam: Shops claiming to sell gems for export at massive profits.',
          'Overpriced auto-rickshaws charging 3x rates for tourists.',
          'Unauthorized local guides charging high fees and leading you to commission shops.'
        ],
        safeNeighborhoods: ['C-Scheme', 'Malviya Nagar', 'Vaishali Nagar', 'Civil Lines'],
        unsafeNeighborhoods: ['Deep interior lanes of Old City late at night', 'Isolated areas around Nahargarh Fort after dark'],
        soloTravelerTips: [
          'Pre-book official RTDC government guides at monuments.',
          'Use registered cab services (Uber/Ola) for late night commutes.',
          'Politely decline street vendors who follow you persistently.'
        ],
        qa: [
          { question: 'Is Jaipur safe for female solo travelers?', answer: 'Yes, Jaipur is generally safe and welcomes millions of tourists. Keep emergency contacts handy and avoid isolated paths after 10 PM.' },
          { question: 'Are UPI payments widely accepted?', answer: 'Yes, almost every shop, auto-rickshaw, and street food vendor in Jaipur accepts UPI via GPay/PhonePe.' }
        ]
      };
    } else if (dest.includes('goa')) {
      return {
        rating: 88,
        commonScams: [
          'Fake water sports tickets sold on beach pathways.',
          'Extremely inflated taxi fares (prefer renting a scooter).',
          'Spiked drinks in overcrowded party clubs.'
        ],
        safeNeighborhoods: ['Panaji', 'Candolim', 'Calangute', 'Palolem', 'Margao'],
        unsafeNeighborhoods: ['Isolated beach spots in South Goa after midnight', 'Unlit forest bypass roads in the interior'],
        soloTravelerTips: [
          'Wear helmets on rented scooties (heavy traffic police fines).',
          'Stick to well-lit main beach shacks and main roads after 11 PM.',
          'Keep your phone and wallet in zip pockets on crowded beaches.'
        ],
        qa: [
          { question: 'Is swimming in the sea safe?', answer: 'Only swim in designated areas monitored by active lifesavers. Look out for red warning flags indicating high tides.' },
          { question: 'What is the best way to travel around Goa?', answer: 'Renting a gearless scooter (₹350 - ₹500/day) is the most flexible, cost-effective way to get around.' }
        ]
      };
    }

    // Default generic Indian safety report
    return {
      rating: 75,
      commonScams: [
        'Inflated local transport prices for foreigners/outsiders.',
        'Fake charity donations request at popular monuments.',
        'Street vendors selling fake antiques.'
      ],
      safeNeighborhoods: ['Central Commercial districts', 'Well-lit residential zones'],
      unsafeNeighborhoods: ['Poorly lit alleyways near major transit hubs', 'Suburbs late at night'],
      soloTravelerTips: [
        'Keep family informed of your location using Google Maps share features.',
        'Prefer public transportation like Metro systems which have CCTV and security guards.',
        'Save local police emergency numbers (112) in speed dial.'
      ],
      qa: [
        { question: 'Is tap water safe to drink?', answer: 'No, always drink sealed bottled mineral water or purified RO water in India.' },
        { question: 'What should I do in an emergency?', answer: 'Dial 112, which is the unified pan-India emergency helpline for Police, Fire, and Ambulance services.' }
      ]
    };
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
    const reasonLower = reason.toLowerCase();
    
    // Copy day
    const replannedActivities: Activity[] = day.activities.map(act => {
      const timeHour = parseInt(act.time.split(':')[0]);
      
      // Let's modify afternoon/evening activities (after 12:00)
      if (timeHour >= 12) {
        if (reasonLower.includes('rain') || reasonLower.includes('weather')) {
          if (act.type === 'sightseeing' && !act.title.includes('Museum') && !act.title.includes('Temple')) {
            return {
              ...act,
              title: `Indoor Alternative: ${act.title} replaced`,
              description: `🌧️ Rain plan: Replaced outdoor visit with an indoor museum tour, a visit to a local heritage shopping mall, or standard traditional tea tasting.`,
              cost: Math.round(act.cost * 0.8),
              isSafetyWarning: true
            };
          }
        } else if (reasonLower.includes('closed') || reasonLower.includes('delay')) {
          if (act.type === 'sightseeing') {
            return {
              ...act,
              title: `Alternative: Local Market Explore`,
              description: `🚫 Scheduled spot is closed or delayed. Spend this time exploring local handcraft street stalls and cafe tasting.`,
              cost: 50
            };
          }
        } else if (reasonLower.includes('budget') || reasonLower.includes('expensive')) {
          return {
            ...act,
            title: `Budget Saver: ${act.title}`,
            description: `💸 Cost hack applied: Swapped premium entry ticket/activity for a free public walking tour and local street food.`,
            cost: Math.round(act.cost * 0.2)
          };
        } else if (reasonLower.includes('health') || reasonLower.includes('tired') || reasonLower.includes('energy')) {
          return {
            ...act,
            title: `Relaxed Option: ${act.title}`,
            description: `🧘 Low-energy pacing: Swapped long walking treks with a peaceful spa session, hotel rest, or a quiet sunset lounge by a cafe.`,
            cost: Math.round(act.cost * 0.5)
          };
        }
      }
      return { ...act };
    });

    return {
      ...day,
      title: `⚡ Replanned: ${day.title}`,
      activities: replannedActivities,
      budgetTip: `Adjusted plan due to: ${reason}. Indoor and lower-cost activities have been prioritized.`
    };
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
    const q = query.toLowerCase();
    const destName = trip ? trip.destination : 'India';

    if (q.includes('upi') || q.includes('pay') || q.includes('gpay') || q.includes('phonepe')) {
      return `### 💳 UPI Payments in ${destName}
UPI (Unified Payments Interface) is **extremely popular** and accepted almost everywhere in India.
- **Where you can use it**: Street food stalls, auto-rickshaws, tea (chai) vendors, local markets, and upscale hotels.
- **Apps to use**: Google Pay, PhonePe, Paytm, or Bhim UPI.
- **Tip**: Always keep ₹500 - ₹1,000 cash in hand for emergency remote areas where network connectivity is poor.`;
    }

    if (q.includes('temple') || q.includes('dress') || q.includes('etiquette') || q.includes('rules')) {
      return `### 🛕 Temple Etiquette & Rules in India
When visiting holy shrines or temples in ${destName}, please observe the following practices:
1. **Footwear**: Shoes must be removed before entering. Most temples have safe deposit counters (usually free or ₹10).
2. **Dress Code**: Dress modestly. Shoulders and knees should be fully covered. Some traditional temples might require men to wear dhotis and women to wear sarees/salwars.
3. **Photography**: Often banned inside the sanctum sanctorum. Look for warning boards.
4. **Leather items**: Belts, wallets, and bags made of genuine animal hide are prohibited in orthodox shrines.`;
    }

    if (q.includes('tip') || q.includes('tipping')) {
      return `### 🪙 Tipping Guidelines in India
Tipping in India is highly appreciated but optional:
- **Small Cafes/Dhabas**: Rounding up the bill or ₹20 - ₹50.
- **Casual Diners**: 5% to 7% of the bill.
- **Fine Dining**: Check if a **Service Charge (usually 10%)** is already added to the bill. If yes, no extra tip is required. If not, 10% is customary.
- **Cabs & Auto-rickshaws**: Rounding up to the nearest ₹10 or ₹50 is standard.
- **Hotel Porters**: ₹20 to ₹50 per bag.`;
    }

    if (q.includes('budget') || q.includes('expensive') || q.includes('cost')) {
      if (trip) {
        return `### 💸 Budget Review for your ${trip.destination} Trip
Your current trip budget limit is **₹${trip.budgetLimit}** and estimated costs sum up to **₹${trip.costBreakdown.total}**.
Here are quick optimization hacks:
1. **Accommodation**: You selected **${trip.accommodationPreference}**. Changing to Standard or Hostels can save you ₹1,500+ daily.
2. **Food**: Rely on legacy cafes and high-rating local dhabas rather than hotel buffets.
3. **Transport**: Use Vande Bharat trains or auto-rickshaws instead of renting private cabs for full days.`;
      }
      return `To give you custom budget tips, go to the **Trip Planner** and generate an active trip. Generally, using public metro transit and eating at legendary local eateries cuts costs by 50%.`;
    }

    return `Hi there! I'm your **TripPilot Companion**. 
    
I can help you with local details for your travel. Ask me about:
*   **"Is UPI accepted here?"**
*   **"What are the tipping standards in India?"**
*   **"What is the temple dress code?"**
*   **"How can I cut down my budget?"**
*   
How is your day going?`;
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
      const fixedCosts = accommodation + transport + emergency;
      const flexibleCosts = food + sightseeing + shopping;
      const remainingBudget = trip.budgetLimit - fixedCosts;

      if (remainingBudget > 0 && flexibleCosts > 0) {
        const scaleFactor = remainingBudget / flexibleCosts;
        trip.itinerary.forEach(day => {
          day.activities.forEach(act => {
            if (act.type !== 'accommodation' && act.type !== 'emergency' && !act.title.includes('Travel:')) {
              act.cost = Math.round(act.cost * scaleFactor);
            }
          });
        });
      } else if (flexibleCosts > 0) {
        trip.itinerary.forEach(day => {
          day.activities.forEach(act => {
            if (act.type !== 'accommodation' && act.type !== 'emergency' && !act.title.includes('Travel:')) {
              act.cost = 0;
            }
          });
        });
      }

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
