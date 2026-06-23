# ✈️ Trippy: AI-Powered Group Travel Companion

Trippy (featuring **TripPilot AI**) is a modern, premium web application designed to simplify travel planning, group coordination, and expense splitting. Whether you are traveling solo or in a group, Trippy acts as your intelligent travel companion, handling everything from customized itinerary generation and localized safety audits to real-time sync and direct UPI QR settlements.

---

## 🌟 Key Features

### 🗺️ 1. AI-Powered Trip Planner (TripPilot)
- **Custom Itineraries:** Generate comprehensive, day-wise travel schedules based on your source, destination, dates, budget limit, and travel group size.
- **Tailored Recommendations:** Align activities with specific interests (e.g., Beaches, History, Nightlife, Nature, Food, Shopping, or Adventure).
- **Practical Transit & Dress Codes:** Get detailed recommendations including practical transport modes (auto-rickshaws, metro, Vande Bharat trains, local rentals) and cultural dress code rules (especially for religious locations).
- **Fallback Engine:** Includes a robust local mock engine to provide high-quality itineraries for destinations like Goa, Jaipur, and Manali even when offline.

### 👥 2. Real-Time Group Sync
- **Serverless Real-Time Communication:** Synchronize lists, voting cards, chat history, and checklists instantly using a lightweight pub/sub system powered by `ntfy.sh` (no dedicated backend required).
- **Quick Invite Codes:** Share a copy of the trip database with friends via a simple, pasteable code.
- **Destination Voting:** Propose destination cities and vote collectively on where to go next.
- **Interactive Checklists:** Track packing and pre-trip tasks with assignments and checkers.

### 🛡️ 3. Emergency & Safety Advisor
- **Safety Rating:** Local safety indices for destinations.
- **Tourist Warning Systems:** Clear alerts on common tourist scams, safe/unsafe neighborhoods, and solo-traveler guidelines.
- **Localized Q&As:** Answers to key region-specific travel questions (e.g., tap water usage, late-night safety).

### 💸 4. Smart Ledger & UPI QR Splitter
- **Precise Expense Splitting:** Add group expenses with detailed categories (accommodation, transport, food, shopping, emergency).
- **UPI QR Code Generator:** Dynamically calculates net balances and generates secure UPI payment QR codes (`upi://pay` deep links) to scan and settle dues directly inside the app.

### 💬 5. TripPilot AI Chatbot
- **Context-Aware Assistant:** A travel companion chatbot that holds full context of your active trip (dates, destinations, travelers, expenses, budget limits) to provide personalized, immediate advice.

---

## 🛠️ Technology Stack

- **Frontend Core:** React 19 (Hooks, Context, Refs), TypeScript, Vite
- **Styling:** Premium Vanilla CSS featuring glassmorphism, harmonious color palettes, and responsive layouts
- **Authentication:** AWS Amplify Auth & Amazon Cognito (supporting Email verification OTP, Google OAuth, and Apple OAuth redirects)
- **AI Integrations:** OpenAI API (GPT models like `gpt-4o-mini` with structured JSON output formatting)
- **Pub/Sub Broker:** `ntfy.sh` SSE (Server-Sent Events) for real-time synchronization
- **Icons:** Lucide React

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18 or higher recommended)
- **npm** or **yarn**

### 1. Clone & Navigate
```bash
git clone https://github.com/dhruvL21/Trippy.git
cd Trippy/Trippy
```

### 2. Set Up Environment Variables
Create a `.env` file in the root of the project (`Trippy/Trippy/.env`) and populate the following keys:
```env
# OpenAI Integration
VITE_OPENAI_API_KEY=your_openai_api_key_here

# Social Authentication Credentials (Optional)
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
VITE_APPLE_CLIENT_ID=your_apple_client_id_here
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run the Development Server
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:5173`.

---

## 📁 Project Structure

```
Trippy/src/
├── assets/             # Brand logos and images
├── components/
│   ├── Auth.tsx        # Cognito, Google, and Apple social login flow
│   └── LandingPage.tsx # Premium showcase landing page with templates
├── lib/
│   └── amplify.ts      # AWS Amplify config
├── services/
│   ├── ai.ts           # OpenAI calls, Itinerary, Safety, & Chatbot logic
│   └── cognito.ts      # Cognito active session check helpers
├── types.ts            # Core TypeScript interfaces (Trip, Group, Expense, etc.)
├── App.css             # Main application design and layouts
├── App.tsx             # Master state machine and routing dashboard
└── main.tsx            # Application entry point
```

---

## 📝 License
This project is licensed under the MIT License.
