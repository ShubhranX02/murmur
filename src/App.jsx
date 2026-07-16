import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import OnboardingPage from './pages/OnboardingPage';
import MatchesPage from './pages/MatchesPage';
import ChatPage from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';
import ActivityFeedPage from './pages/ActivityFeedPage';
import CreateActivityPage from './pages/CreateActivityPage';
import ActivityRoomPage from './pages/ActivityRoomPage';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app">
          <Navbar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/onboarding" element={<OnboardingPage />} />
              <Route path="/activity" element={<ActivityFeedPage />} />
              <Route path="/activity/create" element={<CreateActivityPage />} />
              <Route path="/activity/:activityId" element={<ActivityRoomPage />} />
              <Route path="/matches" element={<MatchesPage />} />
              <Route path="/matches/:matchId" element={<MatchesPage />} />
              <Route path="/chat/:matchId" element={<ChatPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
