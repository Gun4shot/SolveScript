/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await authAPI.getMe({ signal: controller.signal });
      setUser(res.data.user);
    } catch (error) {
      // A temporary network/server delay must not look like an account logout.
      if (error?.response?.status === 401) setUser(null);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, []);

  // Check auth on mount.
  useEffect(() => {
    const initialCheck = window.setTimeout(() => { void checkAuth(); }, 0);
    const handleLogout = () => setUser(null);
    window.addEventListener('auth:logout', handleLogout);
    return () => {
      window.clearTimeout(initialCheck);
      window.removeEventListener('auth:logout', handleLogout);
    };
  }, [checkAuth]);

  const login = useCallback(async (email, password) => {
    const res = await authAPI.login({ email, password });
    setUser(res.data.user);
    return res.data;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const res = await authAPI.register({ name, email, password });
    setUser(res.data.user);
    return res.data;
  }, []);

  const completeProfile = useCallback(async (name) => {
    const res = await authAPI.completeProfile({ name });
    setUser(res.data.user);
    return res.data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
    } catch {
      // Continue even if API call fails
    }
    setUser(null);
  }, []);

  const value = {
    user,
    loading,
    login,
    register,
    completeProfile,
    logout,
    isAuthenticated: !!user,
    isGuest: !user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
