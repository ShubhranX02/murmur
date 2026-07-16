import { Navigate, useLocation, useParams } from 'react-router-dom';

function ChatPage() {
  const { matchId } = useParams();
  const location = useLocation();

  // Keep existing shared chat links working while presenting every
  // conversation inside the unified Matches workspace.
  return <Navigate to={`/matches/${matchId}${location.search}`} replace />;
}

export default ChatPage;
