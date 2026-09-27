// Test-only entry. Production index.html never imports this file. The test
// server disables env files and all remote requests are intercepted/blocked.
import { StrictMode, useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Auth0Context } from '@auth0/auth0-react';
import App from '../../src/App';
import '../../src/styles/index.css';

export function Harness() {
  const [subject, setSubject] = useState('auth0|browser-a');
  useEffect(() => { window.changeTestAccount = setSubject; return () => { delete window.changeTestAccount; }; }, []);
  const claims = useCallback(async () => ({
    __raw: `test-only-token:${subject}`, sub: subject,
    iss: 'https://civicos-browser-test.auth0.com/', aud: 'browser_test_client',
    role: 'authenticated', email_verified: true, exp: Math.floor(Date.now() / 1000) + 3600,
  }), [subject]);
  const refresh = useCallback(async () => 'unused-test-access-token', []);
  const value = useMemo(() => ({
    isAuthenticated: Boolean(subject), isLoading: false,
    user: subject ? { sub: subject, email_verified: true, name: 'Test applicant' } : undefined,
    getIdTokenClaims: claims, getAccessTokenSilently: refresh,
    logout: async () => setSubject(null), loginWithRedirect: async () => {},
  }), [subject, claims, refresh]);
  return <Auth0Context.Provider value={value}><App /></Auth0Context.Provider>;
}
createRoot(document.getElementById('root')).render(<StrictMode><Harness /></StrictMode>);
