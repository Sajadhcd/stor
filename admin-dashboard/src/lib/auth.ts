export interface UserSession {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
}

export function saveSession(accessToken: string, refreshToken: string, user: UserSession) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('access_token', accessToken);
  localStorage.setItem('refresh_token', refreshToken);
  localStorage.setItem('user_session', JSON.stringify(user));
  if (user.tenantId) {
    localStorage.setItem('tenant_id', user.tenantId);
  }
}

export function getSession(): UserSession | null {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem('user_session');
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user_session');
  localStorage.removeItem('tenant_id');
}
