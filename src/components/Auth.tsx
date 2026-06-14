import { useState } from 'react';
import { Mail, Lock, User as UserIcon, Compass } from 'lucide-react';
import type { User } from '../types';
import logoImg from '../assets/logo.png';

interface AuthProps {
  onAuthSuccess: (user: User) => void;
  onSkip: () => void;
}

export default function Auth({ onAuthSuccess, onSkip }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  
  // Simulated Modal States
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [showAppleModal, setShowAppleModal] = useState(false);
  const [isAppleVerifying, setIsAppleVerifying] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please fill out all fields.');
      return;
    }

    if (!isLogin && !name.trim()) {
      setError('Please enter your name.');
      return;
    }

    // Mock successful login/register
    const mockUser: User = {
      id: Math.random().toString(36).substring(2, 9),
      name: isLogin ? email.split('@')[0] : name.trim(),
      email: email.trim(),
      authProvider: 'email'
    };

    onAuthSuccess(mockUser);
  };

  const handleGoogleLogin = (selectedName: string, selectedEmail: string) => {
    const mockUser: User = {
      id: 'g-' + Math.random().toString(36).substring(2, 9),
      name: selectedName,
      email: selectedEmail,
      avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(selectedName)}`,
      authProvider: 'google'
    };
    setShowGoogleModal(false);
    onAuthSuccess(mockUser);
  };

  const handleAppleLogin = () => {
    setIsAppleVerifying(true);
    setTimeout(() => {
      const mockUser: User = {
        id: 'a-' + Math.random().toString(36).substring(2, 9),
        name: 'Dhruv Lukhi',
        email: 'dhruv.lukhi@icloud.com',
        authProvider: 'apple'
      };
      setIsAppleVerifying(false);
      setShowAppleModal(false);
      onAuthSuccess(mockUser);
    }, 1500); // Simulate FaceID check
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-glow-1"></div>
      <div className="auth-glow-2"></div>
      
      <div className="auth-card glass-card">
        <div className="auth-header">
          <div className="auth-logo" style={{ background: 'transparent', width: '64px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <img src={logoImg} alt="Trippy Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <h2>Welcome to Trippy</h2>
          <p>Plan itineraries, split group dues, and safety checks in one place.</p>
        </div>

        {/* Tab Selector */}
        <div className="auth-tabs">
          <button 
            className={`auth-tab ${isLogin ? 'active' : ''}`}
            onClick={() => { setIsLogin(true); setError(''); }}
          >
            Login
          </button>
          <button 
            className={`auth-tab ${!isLogin ? 'active' : ''}`}
            onClick={() => { setIsLogin(false); setError(''); }}
          >
            Register
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="input-group">
              <span className="input-icon"><UserIcon size={18} /></span>
              <input 
                type="text" 
                placeholder="Full Name" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={!isLogin}
              />
            </div>
          )}

          <div className="input-group">
            <span className="input-icon"><Mail size={18} /></span>
            <input 
              type="email" 
              placeholder="Email Address" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <span className="input-icon"><Lock size={18} /></span>
            <input 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary auth-submit-btn">
            {isLogin ? 'Login Account' : 'Register Account'}
          </button>
        </form>

        <div className="auth-divider">
          <span>Or sign in with</span>
        </div>

        {/* Social Buttons */}
        <div className="social-buttons">
          <button 
            className="social-btn google-btn"
            onClick={() => setShowGoogleModal(true)}
            type="button"
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.68 1.54 14.98 1 12 1 7.35 1 3.37 3.67 1.39 7.56l3.85 2.99c.9-2.7 3.42-4.51 6.76-4.51z"/>
              <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.34H12v4.43h6.46c-.28 1.48-1.11 2.73-2.37 3.58l3.69 2.87c2.16-1.99 3.41-4.92 3.41-8.54z"/>
              <path fill="#FBBC05" d="M5.24 10.55c-.23-.69-.36-1.43-.36-2.2s.13-1.51.36-2.2L1.39 3.16C.5 4.93 0 6.91 0 9s.5 4.07 1.39 5.84l3.85-3.29z"/>
              <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.69-2.87c-1.02.68-2.33 1.09-3.96 1.09-3.34 0-6.17-2.14-7.18-5.02L1.28 16.4C3.26 20.31 7.31 23 12 23z"/>
            </svg>
            <span>Google</span>
          </button>

          <button 
            className="social-btn apple-btn"
            onClick={() => setShowAppleModal(true)}
            type="button"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.21.67-2.93 1.49-.62.69-1.16 1.84-1.01 2.96 1.12.09 2.27-.57 2.95-1.39z"/>
            </svg>
            <span>Apple</span>
          </button>
        </div>

        {/* Skip option */}
        <button 
          onClick={onSkip} 
          className="auth-guest-btn"
          type="button"
        >
          <Compass size={16} />
          <span>Browse as Guest</span>
        </button>
      </div>

      {/* Google Sign-in Mock Modal */}
      {showGoogleModal && (
        <div className="mock-auth-overlay">
          <div className="mock-auth-modal google-modal animate-slide-up">
            <div className="google-modal-header">
              <svg viewBox="0 0 24 24" width="32" height="32" style={{ marginBottom: '8px' }}>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <h3>Choose an account</h3>
              <p>to continue to Trippy</p>
            </div>

            <div className="google-accounts-list">
              <div 
                className="google-account-item"
                onClick={() => handleGoogleLogin('Dhruv Lukhi', 'dhruvlukhi07@gmail.com')}
              >
                <div className="google-avatar">D</div>
                <div className="account-details">
                  <strong>Dhruv Lukhi</strong>
                  <span>dhruvlukhi07@gmail.com</span>
                </div>
              </div>
              <div 
                className="google-account-item"
                onClick={() => handleGoogleLogin('Traveler Aarav', 'aarav.trip@gmail.com')}
              >
                <div className="google-avatar" style={{ background: '#e0aaff' }}>A</div>
                <div className="account-details">
                  <strong>Traveler Aarav</strong>
                  <span>aarav.trip@gmail.com</span>
                </div>
              </div>
              <div 
                className="google-account-item"
                onClick={() => handleGoogleLogin('Ananya Sen', 'ananya.sen@gmail.com')}
              >
                <div className="google-avatar" style={{ background: '#ffccd5' }}>A</div>
                <div className="account-details">
                  <strong>Ananya Sen</strong>
                  <span>ananya.sen@gmail.com</span>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => setShowGoogleModal(false)}
              className="btn btn-secondary google-modal-close"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Apple Sign-in Mock Modal */}
      {showAppleModal && (
        <div className="mock-auth-overlay">
          <div className="mock-auth-modal apple-modal animate-slide-up">
            <div className="apple-modal-header">
              <svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.21.67-2.93 1.49-.62.69-1.16 1.84-1.01 2.96 1.12.09 2.27-.57 2.95-1.39z"/>
              </svg>
              <h3>Sign in with Apple ID</h3>
              <p>Verify your credentials for Trippy</p>
            </div>

            {isAppleVerifying ? (
              <div className="apple-verifying-container">
                <div className="face-id-spinner"></div>
                <p>Verifying with Face ID...</p>
              </div>
            ) : (
              <div className="apple-form">
                <div className="apple-form-group">
                  <input type="text" readOnly value="dhruv.lukhi@icloud.com" />
                </div>
                <button 
                  onClick={handleAppleLogin}
                  className="btn btn-primary apple-signin-action"
                >
                  Sign in with passcode / Face ID
                </button>
              </div>
            )}

            {!isAppleVerifying && (
              <button 
                onClick={() => setShowAppleModal(false)}
                className="btn btn-secondary apple-modal-close"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
