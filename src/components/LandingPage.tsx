import { useState, useEffect } from 'react';
import { 
  Users, 
  Shield, 
  TrendingUp, 
  Sparkles, 
  ArrowRight, 
  Info,
  Clock,
  Play,
  WifiOff,
  X
} from 'lucide-react';
import logoImg from '../assets/logo.png';

interface LandingPageProps {
  onGetStarted: () => void;
}

export default function LandingPage({ onGetStarted }: LandingPageProps) {
  const [demoSelection, setDemoSelection] = useState<'goa' | 'jaipur' | 'manali'>('goa');
  const [showOfflineModal, setShowOfflineModal] = useState<boolean>(false);

  // Scroll to the very top when landing page loads
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Preview data representing app capacity
  const previewTrips = {
    goa: {
      destination: 'Goa 🌴',
      days: 3,
      packing: ['Beachwear & Shorts', 'Sunscreen SPF 50', 'Waterproof Phone Case'],
      safety: 'Safe beach swimming zones, watch out for high tides after 6 PM.',
      dues: '₹7,500 settled'
    },
    jaipur: {
      destination: 'Jaipur 🏛️',
      days: 4,
      packing: ['Light cotton clothing', 'Sunglasses & Cap', 'Comfortable walking shoes'],
      safety: 'Dress modestly when visiting temples. Drink only bottled water.',
      dues: '₹4,800 settled'
    },
    manali: {
      destination: 'Manali 🏔️',
      days: 5,
      packing: ['Heavy woolens & Jacket', 'Trekking shoes', 'Personal first-aid kit'],
      safety: 'Carry cash (limited UPI signal on treks). Check mountain pass routes.',
      dues: '₹9,200 settled'
    }
  };

  const selectedData = previewTrips[demoSelection];

  return (
    <div className="landing-container">
      {/* Premium Ambient Background Elements */}
      <div className="landing-glow landing-glow-1"></div>
      <div className="landing-glow landing-glow-2"></div>
      <div className="landing-glow landing-glow-3"></div>

      {/* Header */}
      <header className="landing-header">
        <div className="brand-section">
          <div className="brand-logo" style={{ background: 'transparent', boxShadow: 'none' }}>
            <img src={logoImg} alt="Trippy Logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
          </div>
          <span className="brand-name">Trippy</span>
        </div>
        <div className="header-links">
          <a href="#features" className="header-link">Features</a>
          <a href="#demo" className="header-link">Quick Trial</a>
          <a href="#info" className="header-link">About</a>
        </div>
        <button className="btn btn-primary btn-sm header-cta" onClick={onGetStarted}>
          <span>Get Started</span>
          <ArrowRight size={14} />
        </button>
      </header>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="hero-content">
          <div className="hero-badge">
            <Sparkles size={14} />
            <span>AI-Driven Group Travel Companion</span>
          </div>
          <h1 className="hero-title">
            Explore. Sync. Settle. <br />
            <span className="gradient-text">Trippy is the Way.</span>
          </h1>
          <p className="hero-subtitle">
            The ultimate travel companion. Generate custom AI itineraries, check real-time cultural warnings, sync packing lists, and split group expenses directly with dynamically generated UPI QR codes.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-lg" onClick={onGetStarted}>
              <span>Start Planning Your Adventure</span>
              <ArrowRight size={18} />
            </button>
            <a href="#demo" className="btn btn-secondary btn-lg">
              <Play size={16} fill="currentColor" />
              <span>Try Interactive Demo</span>
            </a>
          </div>
          <div style={{ marginTop: '20px' }}>
            <button 
              className="btn btn-offline-promo" 
              onClick={() => setShowOfflineModal(true)}
              style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                color: '#fbbf24',
                fontSize: '13px',
                padding: '8px 20px',
                borderRadius: '9999px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 0 15px rgba(245, 158, 11, 0.05)'
              }}
            >
              <WifiOff size={14} />
              <span style={{ fontWeight: 600 }}>Works without internet during your trip. ⭐ See features</span>
            </button>
          </div>
        </div>

        {/* Floating Mockup Preview Dashboard */}
        <div className="hero-mockup-wrapper">
          <div className="hero-mockup glass-panel">
            <div className="mockup-header">
              <div className="mockup-dots">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
              </div>
              <div className="mockup-title">Trippy Web Dashboard</div>
            </div>
            <div className="mockup-body">
              <div className="mockup-sidebar">
                <div className="mock-item active">🗺️ Planner</div>
                <div className="mock-item">🛡️ Safety</div>
                <div className="mock-item">👥 Group</div>
                <div className="mock-item">💸 Expenses</div>
              </div>
              <div className="mockup-content">
                <div className="mock-card card-glow">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ color: 'var(--accent)', margin: 0 }}>🌴 Goa Beach Escapade</h4>
                    <span className="tag">Active Trip</span>
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '4px 0 10px' }}>Budget limit: ₹30,000 / member</p>
                  <div className="mock-itinerary">
                    <div className="mock-day">
                      <strong>Day 1: Arrival & Sunset Shack Crawl</strong>
                      <span className="sub">Visit Anjuna Beach for the scenic sunset...</span>
                    </div>
                    <div className="mock-day">
                      <strong>Day 2: Water Sports & Cultural Fort Tour</strong>
                      <span className="sub">Jet ski rides at Calangute, then historic Fort Aguada...</span>
                    </div>
                  </div>
                </div>
                <div className="mock-split-row">
                  <div className="mock-subcard">
                    <h5>👥 Group Members</h5>
                    <div className="mock-members">
                      <div className="mock-member"><span>DH</span> Dhruv (You)</div>
                      <div className="mock-member"><span>AR</span> Aarav</div>
                    </div>
                  </div>
                  <div className="mock-subcard">
                    <h5>💳 Quick Dues</h5>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#10b981' }}>✓ All Settlements Balanced</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid (Bento Style) */}
      <section className="landing-features" id="features">
        <div className="section-header">
          <h2 className="section-title">Engineered for Seamless Group Travel</h2>
          <p className="section-subtitle">Ditch the spreadsheets, group chats, and multiple payment apps. Trippy handles it all in a single space.</p>
        </div>

        <div className="bento-grid">
          <div className="bento-card bento-card-large glass-card card-glow">
            <div className="card-icon" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#c084fc' }}>
              <Sparkles size={24} />
            </div>
            <h3>AI Travel Pilot Itineraries</h3>
            <p>Generate highly comprehensive, location-aware travel schedules instantly. Our AI models analyze your travel dates, source, destination, travelers, and budgets to curate unique day-by-day plans, transport preferences, packing suggestions, and category costs.</p>
            <div className="card-visual-ai">
              <div className="bubble bubble-1">🎒 Trekking in Manali</div>
              <div className="bubble bubble-2">🏖️ Beaches in Goa</div>
              <div className="bubble bubble-3">🕌 Temples in Jaipur</div>
            </div>
          </div>

          <div className="bento-card glass-card">
            <div className="card-icon" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4' }}>
              <Users size={20} />
            </div>
            <h3>Real-time Group Sync</h3>
            <p>Instantly sync itineraries, checklist assignments, destination voting, and expense ledgers with friends. One invite code shares the complete trip database instantly.</p>
          </div>

          <div className="bento-card glass-card">
            <div className="card-icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
              <Shield size={20} />
            </div>
            <h3>Emergency & Safety Advisor</h3>
            <p>Get localized emergency guidelines, safety index values, and warning details specific to your trip. View weather summaries and local helpline contacts.</p>
          </div>

          <div className="bento-card bento-card-large glass-card card-glow">
            <div className="card-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
              <TrendingUp size={24} />
            </div>
            <h3>Smart Ledger & UPI QR Settlements</h3>
            <p>Add group expenses with precise splits. Trippy dynamically computes net balances and generates secure UPI payment QR codes on demand, allowing members to scan and settle dues directly inside the app.</p>
            <div className="card-visual-expenses">
              <div className="mock-ledger-item">
                <span>Villa Deposit Paid by Dhruv</span>
                <span className="amount">₹8,000</span>
              </div>
              <div className="mock-ledger-item">
                <span>Aarav owes Dhruv</span>
                <span className="settle-badge">Pay ₹2,000 via UPI QR</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Quick Trial Demo */}
      <section className="landing-demo" id="demo">
        <div className="section-header">
          <h2 className="section-title">Experience Trippy in Seconds</h2>
          <p className="section-subtitle">Pick a travel template below to preview how Trippy customizes your safety notes, packing checklists, and split dues.</p>
        </div>

        <div className="demo-interactive-widget glass-panel">
          <div className="demo-selectors">
            <button 
              className={`demo-selector-btn ${demoSelection === 'goa' ? 'active' : ''}`}
              onClick={() => setDemoSelection('goa')}
            >
              🌴 Goa Escapade
            </button>
            <button 
              className={`demo-selector-btn ${demoSelection === 'jaipur' ? 'active' : ''}`}
              onClick={() => setDemoSelection('jaipur')}
            >
              🏛️ Jaipur Culture
            </button>
            <button 
              className={`demo-selector-btn ${demoSelection === 'manali' ? 'active' : ''}`}
              onClick={() => setDemoSelection('manali')}
            >
              🏔️ Manali Adventure
            </button>
          </div>

          <div className="demo-preview-display">
            <div className="preview-block block-destination">
              <span className="label">Destination Focus</span>
              <h4>{selectedData.destination}</h4>
              <span className="duration-tag">{selectedData.days} Days Schedule</span>
            </div>

            <div className="preview-block block-packing">
              <span className="label">🎒 AI Packing Checklist Preview</span>
              <ul>
                {selectedData.packing.map((item, idx) => (
                  <li key={idx}><span className="check">✓</span> {item}</li>
                ))}
              </ul>
            </div>

            <div className="preview-block block-safety">
              <span className="label">🛡️ safety tag advisor</span>
              <p>{selectedData.safety}</p>
            </div>

            <div className="preview-block block-dues">
              <span className="label">💸 split settlements</span>
              <div className="mock-due-box">
                <span>Group Expenses Split</span>
                <strong>{selectedData.dues}</strong>
              </div>
            </div>
          </div>

          <div className="demo-cta-row">
            <button className="btn btn-primary" onClick={onGetStarted}>
              <span>Start Planning Your Real Trip</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* Info Section */}
      <section className="landing-info" id="info">
        <div className="info-grid glass-panel">
          <div className="info-text">
            <h3>Designed for Modern Travelers</h3>
            <p>
              Trippy was built to solve the fragmentation of trip planning. We combine the power of advanced AI engines to automate routing, local guidelines, and split budgets so that group coordination becomes effortless.
            </p>
            <div style={{ display: 'flex', gap: '20px', marginTop: '24px' }}>
              <div className="info-stat">
                <h4>100%</h4>
                <span>AI Personalized</span>
              </div>
              <div className="info-stat">
                <h4>0%</h4>
                <span>Spreadsheet Math</span>
              </div>
            </div>
          </div>
          <div className="info-cards">
            <div className="info-subcard">
              <div className="icon-wrap"><Clock size={18} /></div>
              <div>
                <h5>Saves Planning Time</h5>
                <p>Generate detailed schedules in seconds instead of spending hours crawling blogs.</p>
              </div>
            </div>
            <div className="info-subcard">
              <div className="icon-wrap"><Info size={18} /></div>
              <div>
                <h5>No Hidden Add-ons</h5>
                <p>Enjoy local safety briefings, emergency contact lookup directories, and ledgers absolutely free.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-brand">
          <img src={logoImg} alt="Trippy Logo" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
          <span>Trippy</span>
        </div>
        <p className="footer-copy">&copy; 2026 Trippy. All travel rights reserved. Plan safely.</p>
      </footer>
      {showOfflineModal && (
        <div className="offline-modal-overlay" onClick={() => setShowOfflineModal(false)}>
          <div className="offline-modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <button className="offline-modal-close" onClick={() => setShowOfflineModal(false)}>
              <X size={18} />
            </button>
            
            <div className="offline-modal-header">
              <div className="offline-modal-icon-wrap">
                <WifiOff size={28} />
              </div>
              <h3>100% Offline Travel Companion</h3>
              <p>
                No internet? No worries. Trippy stores your entire trip database locally on your device, ensuring it functions seamlessly off-grid during your travels.
              </p>
            </div>

            <div className="offline-modal-features-grid">
              <div className="offline-feature-item">
                <span className="check">✓</span>
                <div>
                  <h4>Saved itineraries</h4>
                  <p>Access full schedules, timings, and custom plans anytime.</p>
                </div>
              </div>
              <div className="offline-feature-item">
                <span className="check">✓</span>
                <div>
                  <h4>Expense splitter</h4>
                  <p>Log group costs and track balances instantly without data.</p>
                </div>
              </div>
              <div className="offline-feature-item">
                <span className="check">✓</span>
                <div>
                  <h4>Task assignments</h4>
                  <p>Assign responsibilities and track checklist tasks offline.</p>
                </div>
              </div>
              <div className="offline-feature-item">
                <span className="check">✓</span>
                <div>
                  <h4>Packing checklist</h4>
                  <p>Tick off and add essential gear as you pack on the road.</p>
                </div>
              </div>
              <div className="offline-feature-item">
                <span className="check">✓</span>
                <div>
                  <h4>Safety center</h4>
                  <p>Read neighborhood safety reports and scam updates.</p>
                </div>
              </div>
              <div className="offline-feature-item">
                <span className="check">✓</span>
                <div>
                  <h4>Emergency contacts</h4>
                  <p>Instantly look up pre-loaded local helplines & numbers.</p>
                </div>
              </div>
              <div className="offline-feature-item">
                <span className="check">✓</span>
                <div>
                  <h4>Travel notes</h4>
                  <p>Save hotel room numbers, taxi contacts, and quick diaries.</p>
                </div>
              </div>
              <div className="offline-feature-item">
                <span className="check">✓</span>
                <div>
                  <h4>Documents & tickets</h4>
                  <p>Store hotel confirmation texts, flight references & copies.</p>
                </div>
              </div>
              <div className="offline-feature-item">
                <span className="check">✓</span>
                <div>
                  <h4>AI summaries (cached)</h4>
                  <p>Read generated AI suggestions and chat history cached locally.</p>
                </div>
              </div>
              <div className="offline-feature-item">
                <span className="check">✓</span>
                <div>
                  <h4>Download entire trip</h4>
                  <p>Export an interactive single-file HTML app bundle offline.</p>
                </div>
              </div>
            </div>

            <div className="offline-modal-footer">
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  setShowOfflineModal(false);
                  onGetStarted();
                }}
              >
                <span>Start Planning Offline</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
