import { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext();
const YOUTUBE_DATA_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function hasFreshYouTubeData(user) {
  const lastUpdatedAt = user?.youtubeData?.lastUpdatedAt;
  if (!lastUpdatedAt) return false;
  const timestamp = new Date(lastUpdatedAt).getTime();
  return Number.isFinite(timestamp) && Date.now() - timestamp < YOUTUBE_DATA_MAX_AGE_MS;
}

function canUseYouTubeData(user) {
  return hasFreshYouTubeData(user) || Boolean(user?.youtubeRefreshSkipped);
}

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [youtubeToken, setYoutubeToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const isAuthenticated = !!user;
  const isOnboarded = Boolean(user?.onboarded && !user?.requiresYouTubeRefresh && canUseYouTubeData(user));

  useEffect(() => {
    // Restore session from localStorage
    const savedUser = localStorage.getItem('murmur_user');
    if (savedUser) {
      try {
        const savedProfile = JSON.parse(savedUser);
        // A local session must never bypass the weekly YouTube-data refresh.
        if (canUseYouTubeData(savedProfile) && !savedProfile.requiresYouTubeRefresh) {
          setUser(savedProfile);
        } else {
          localStorage.removeItem('murmur_user');
        }
      } catch (e) {
        console.error('Failed to parse saved user', e);
      }
    }
    setLoading(false);
  }, []);

  const signInWithGoogle = async (credential) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ credential }),
      });

      if (!response.ok) {
        throw new Error('Sign in failed');
      }

      const data = await response.json();
      setUser(data.user);
      localStorage.setItem('murmur_user', JSON.stringify(data.user));
      return data.user;
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  };

  const storeYouTubeToken = async (accessToken) => {
    if (!user) throw new Error('Must be signed in to store YouTube token');
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/auth/youtube-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accessToken, userId: user.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to store YouTube token');
      }

      setYoutubeToken(accessToken);
    } catch (error) {
      console.error('Error storing YouTube token:', error);
      throw error;
    }
  };

  const setOnboarded = () => {
    if (user) {
      const updatedUser = { ...user, onboarded: true };
      setUser(updatedUser);
      localStorage.setItem('murmur_user', JSON.stringify(updatedUser));
    }
  };

  const updateUser = (updates) => {
    if (user) {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      localStorage.setItem('murmur_user', JSON.stringify(updatedUser));
    }
  };

  const signOut = () => {
    setUser(null);
    setYoutubeToken(null);
    localStorage.removeItem('murmur_user');
  };

  const value = {
    user,
    youtubeToken,
    isAuthenticated,
    isOnboarded,
    loading,
    signInWithGoogle,
    storeYouTubeToken,
    setOnboarded,
    updateUser,
    signOut
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
