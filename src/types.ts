export interface Activity {
  time: string;
  title: string;
  description: string;
  cost: number;
  type: 'accommodation' | 'transport' | 'food' | 'sightseeing' | 'shopping' | 'emergency';
  location?: string;
  isSafetyWarning?: boolean;
  address?: string;
  durationHours?: number;
  highlights?: string[];
  dressCode?: string;
}

export interface ItineraryDay {
  dayNumber: number;
  date: string;
  title: string;
  activities: Activity[];
  budgetTip?: string;
}

export interface CostBreakdown {
  accommodation: number;
  transport: number;
  food: number;
  sightseeing: number;
  shopping: number;
  emergency: number;
  total: number;
}

export interface Trip {
  id: string;
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
  itinerary: ItineraryDay[];
  costBreakdown: CostBreakdown;
  packingList: string[];
}

export interface Member {
  id: string;
  name: string;
  upi?: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  assigneeName?: string;
  createdBy?: string;
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
  isAI?: boolean;
}

export interface DestinationVote {
  city: string;
  votes: string[]; // Member IDs/names
  proposedBy?: string;
}

export interface Group {
  id: string;
  name: string;
  members: Member[];
  votes: DestinationVote[];
  checklist: ChecklistItem[];
  chatHistory: ChatMessage[];
  hostId?: string;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  paidBy: string; // Member name
  splitWith: string[]; // Member names
  category: 'accommodation' | 'transport' | 'food' | 'sightseeing' | 'shopping' | 'emergency';
  date: string;
}

export interface QAItem {
  question: string;
  answer: string;
}

export interface SafetyReport {
  rating: number;
  commonScams: string[];
  safeNeighborhoods: string[];
  unsafeNeighborhoods: string[];
  soloTravelerTips: string[];
  qa: QAItem[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
}

export interface AppSettings {
  openaiApiKey: string;
  openweathermapApiKey: string;
  googleMapsApiKey: string;
  model: string;
  userName: string;
  userUpi: string;
  personalInfo: string;
  phone: string;
  email: string;
  emergencyContact: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  authProvider: 'email' | 'google' | 'apple';
}
