import { useState } from 'react';
import { Mail, Lock, User as UserIcon, Compass, Key } from 'lucide-react';
import { signUp, signIn, getCurrentUser, confirmSignUp, fetchAuthSession } from 'aws-amplify/auth';
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
  const [isVerifying, setIsVerifying] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const usernameAlias = trimmedEmail.replace('@', '_at_').replace(/[^a-zA-Z0-9_]/g, '');

    if (!trimmedEmail || !trimmedPassword) {
      setError('Please fill out all fields.');
      return;
    }

    if (isVerifying) {
      const trimmedOtp = otp.trim();
      if (!trimmedOtp) {
        setError('Please enter the verification code.');
        return;
      }

      setLoading(true);
      try {
        await confirmSignUp({
          username: usernameAlias,
          confirmationCode: trimmedOtp
        });

        // Auto sign in user after successful email OTP confirmation
        const signInResult = await signIn({
          username: trimmedEmail,
          password: trimmedPassword
        });

        if (signInResult.isSignedIn) {
          const user = await getCurrentUser();
          const session = await fetchAuthSession();
          const idToken = session.tokens?.idToken?.payload;

          onAuthSuccess({
            id: 'c-' + user.userId,
            name: (idToken?.name as string) || (idToken?.given_name as string) || trimmedEmail.split('@')[0] || user.username || 'User',
            email: (idToken?.email as string) || trimmedEmail,
            authProvider: 'cognito'
          });
        } else {
          setError('Account verified, but auto-login failed. Please sign in manually.');
          setIsVerifying(false);
          setIsLogin(true);
        }
      } catch (err: any) {
        setError(err.message || 'Verification failed. Please check the code.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (isLogin) {
      setLoading(true);
      try {
        const signInResult = await signIn({
          username: trimmedEmail,
          password: trimmedPassword
        });

        if (signInResult.isSignedIn) {
          const user = await getCurrentUser();
          const session = await fetchAuthSession();
          const idToken = session.tokens?.idToken?.payload;

          onAuthSuccess({
            id: 'c-' + user.userId,
            name: (idToken?.name as string) || (idToken?.given_name as string) || trimmedEmail.split('@')[0] || user.username || 'User',
            email: (idToken?.email as string) || trimmedEmail,
            authProvider: 'cognito'
          });
        } else if (signInResult.nextStep.signInStep === 'CONFIRM_SIGN_UP') {
          setIsVerifying(true);
          alert('Account verification pending. We have sent a code to your email.');
        } else {
          setError(`Further action required: ${signInResult.nextStep.signInStep}`);
        }
      } catch (err: any) {
        setError(err.message || 'Incorrect email or password.');
      } finally {
        setLoading(false);
      }
    } else {
      if (!name.trim()) {
        setError('Please enter your name.');
        return;
      }

      setLoading(true);
      try {
        
        await signUp({
          username: usernameAlias,
          password: trimmedPassword,
          options: {
            userAttributes: {
              name: name.trim(),
              email: trimmedEmail,
              given_name: name.trim().split(' ')[0] || name.trim(),
              phone_number: '+919876543210',
              birthdate: '1990-01-01',
              address: 'Not Specified'
            }
          }
        });
        setIsVerifying(true);
      } catch (err: any) {
        setError(err.message || 'Registration failed. Check password requirements.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleGoogleRedirect = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      alert("Google Client ID is missing. Please add 'VITE_GOOGLE_CLIENT_ID' to your '.env' file to authenticate with Google.");
      return;
    }
    const redirectUri = window.location.origin;
    const scope = 'email profile';
    const responseType = 'token';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=${responseType}&scope=${encodeURIComponent(scope)}`;
    window.location.href = authUrl;
  };

  const handleAppleRedirect = () => {
    const clientId = import.meta.env.VITE_APPLE_CLIENT_ID;
    if (!clientId) {
      alert("Apple Client ID is missing. Please add 'VITE_APPLE_CLIENT_ID' to your '.env' file to authenticate with Apple.");
      return;
    }
    const redirectUri = window.location.origin;
    const scope = 'name email';
    const responseType = 'code id_token';
    const authUrl = `https://appleid.apple.com/auth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=${encodeURIComponent(responseType)}&scope=${encodeURIComponent(scope)}&response_mode=fragment`;
    window.location.href = authUrl;
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
        {!isVerifying && (
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
        )}

        {error && <div className="auth-error">{error}</div>}

        {isVerifying ? (
          <>
            <form onSubmit={handleSubmit} className="auth-form">
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'left', lineHeight: '1.5', marginBottom: '8px' }}>
                We've sent a 6-digit confirmation code to <strong>{email}</strong>. Please enter it below to verify your email.
              </p>
              <div className="input-group">
                <span className="input-icon"><Key size={18} /></span>
                <input
                  type="text"
                  placeholder="Verification Code (OTP)"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary auth-submit-btn" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify & Log In'}
              </button>
            </form>

            <button
              type="button"
              className="auth-guest-btn"
              onClick={() => {
                setIsVerifying(false);
                setIsLogin(true);
                setError('');
              }}
              style={{ marginTop: '8px', display: 'block', width: '100%', textAlign: 'center' }}
            >
              Cancel & Go Back
            </button>
          </>
        ) : (
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

            <button type="submit" className="btn btn-primary auth-submit-btn" disabled={loading}>
              {loading ? 'Please wait...' : (isLogin ? 'Login Account' : 'Register Account')}
            </button>
          </form>
        )}

        {!isVerifying && (
          <>
            <div className="auth-divider">
              <span>Or sign in with</span>
            </div>

            {/* Social Buttons */}
            <div className="social-buttons">
              <button
                className="social-btn google-btn"
                onClick={handleGoogleRedirect}
                type="button"
              >
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.68 1.54 14.98 1 12 1 7.35 1 3.37 3.67 1.39 7.56l3.85 2.99c.9-2.7 3.42-4.51 6.76-4.51z" />
                  <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.34H12v4.43h6.46c-.28 1.48-1.11 2.73-2.37 3.58l3.69 2.87c2.16-1.99 3.41-4.92 3.41-8.54z" />
                  <path fill="#FBBC05" d="M5.24 10.55c-.23-.69-.36-1.43-.36-2.2s.13-1.51.36-2.2L1.39 3.16C.5 4.93 0 6.91 0 9s.5 4.07 1.39 5.84l3.85-3.29z" />
                  <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.69-2.87c-1.02.68-2.33 1.09-3.96 1.09-3.34 0-6.17-2.14-7.18-5.02L1.28 16.4C3.26 20.31 7.31 23 12 23z" />
                </svg>
                <span>Google</span>
              </button>

              <button
                className="social-btn apple-btn"
                onClick={handleAppleRedirect}
                type="button"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.21.67-2.93 1.49-.62.69-1.16 1.84-1.01 2.96 1.12.09 2.27-.57 2.95-1.39z" />
                </svg>
                <span>Apple</span>
              </button>
            </div>
          </>
        )}

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
    </div>
  );
}
