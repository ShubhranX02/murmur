import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import MatchCard from '../components/MatchCard';
import ChatPanel from '../components/ChatPanel';
import LoadingSpinner from '../components/LoadingSpinner';
import './MatchesPage.css';

function MatchesPage() {
  const { user, isAuthenticated, isOnboarded } = useAuth();
  const navigate = useNavigate();
  const { matchId } = useParams();

  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isGroupCreatorOpen, setIsGroupCreatorOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupError, setGroupError] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }
    
    if (!isOnboarded || !user?.detailsComplete) {
      navigate('/onboarding');
      return;
    }

    const fetchMatches = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const [matchesResponse, groupsResponse] = await Promise.all([
          fetch(`${apiUrl}/api/matches/${user.id}`),
          fetch(`${apiUrl}/api/chat/groups/${user.id}`)
        ]);
        if (!matchesResponse.ok || !groupsResponse.ok) throw new Error('Failed to fetch chats');
        const [matchesData, groupsData] = await Promise.all([matchesResponse.json(), groupsResponse.json()]);
        // Match-delivery records retain both IDs. Prefer the other member's
        // ID so links and conversations cannot accidentally target the
        // signed-in recipient when reading an older API response.
        const directMatches = (matchesData.matches || []).map(match => ({
          ...match,
          userId: match.otherUserId || match.userId
        }));
        setMatches([...groupsData.groups || [], ...directMatches]);
      } catch (err) {
        console.error('Error fetching matches:', err);
        setError('Could not load your matches. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
    const interval = setInterval(fetchMatches, 10000);
    return () => clearInterval(interval);
  }, [user, isAuthenticated, isOnboarded, navigate]);

  const chatKey = match => match.chatId || match.otherUserId || match.userId;
  const activeMatch = matches.find(match => chatKey(match) === matchId);

  // Automatically expand sidebar if there is no active match selected
  useEffect(() => {
    if (!activeMatch) {
      setIsSidebarCollapsed(false);
    }
  }, [activeMatch]);

  if (loading) {
    return (
      <div className="matches-page-loading">
        <LoadingSpinner size="large" text="Loading your matches..." />
      </div>
    );
  }

  const selectMatch = (match) => {
    navigate(`/matches/${chatKey(match)}`);
  };

  const openGroupCreator = () => {
    setGroupName('');
    setSelectedMemberIds([]);
    setGroupError(null);
    setIsGroupCreatorOpen(true);
  };

  const toggleGroupMember = memberId => {
    setSelectedMemberIds(current => current.includes(memberId)
      ? current.filter(id => id !== memberId)
      : [...current, memberId]);
  };

  const createGroup = async event => {
    event.preventDefault();
    setIsCreatingGroup(true);
    setGroupError(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/chat/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId: user.id, name: groupName, memberIds: selectedMemberIds })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not create the group chat.');
      setMatches(current => [data.group, ...current]);
      setIsGroupCreatorOpen(false);
      navigate(`/matches/${data.group.chatId}`);
    } catch (createError) {
      setGroupError(createError.message || 'Could not create the group chat.');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleMatchAction = (action, targetMatch) => {
    if (action === 'Delete chat') {
      setMatches(prev => prev.filter(m => chatKey(m) !== chatKey(targetMatch)));
      if (matchId === chatKey(targetMatch)) navigate('/matches');
    } else if (action === 'Pin chat') {
      setMatches(prev => prev.map(m => chatKey(m) === chatKey(targetMatch) ? { ...m, isPinned: !m.isPinned } : m));
    } else if (action === 'Mark as unread') {
      setMatches(prev => prev.map(m => chatKey(m) === chatKey(targetMatch) ? { ...m, hasUnreadMessages: !m.hasUnreadMessages } : m));
    } else if (action === 'Block') {
      alert(`${targetMatch.displayName} has been blocked.`);
      setMatches(prev => prev.filter(m => chatKey(m) !== chatKey(targetMatch)));
      if (matchId === chatKey(targetMatch)) navigate('/matches');
    } else if (action === 'Report') {
      alert(`Report filed for ${targetMatch.displayName}.`);
    } else if (action === 'Mute notifications') {
      setMatches(prev => prev.map(m => chatKey(m) === chatKey(targetMatch) ? { ...m, isMuted: !m.isMuted } : m));
    }
  };

  const activeMatches = matches;

  const availableMatches = matches.filter(match => !match.isGroup);

  // Keep groups together, then sort direct matches by their compatibility score.
  const sortedMatches = [...activeMatches].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    if (a.isGroup && !b.isGroup) return -1;
    if (!a.isGroup && b.isGroup) return 1;
    return (b.score || 0) - (a.score || 0);
  });

  return (
    <div className="matches-page">
      {error && (
        <div className="error-card glass animate-fade-in">
          {error}
        </div>
      )}

      <div className={`chat-workspace animate-fade-in ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          <aside className="matches-sidebar">
            <div className="matches-sidebar-header">
              <div>
                <h1>Chats</h1>
              </div>
              <div className="sidebar-header-actions">
                <button type="button" className="create-group-button" onClick={openGroupCreator} aria-label="Create group chat" title="Create group chat">+</button>
                {activeMatch && (
                  <button 
                    type="button" 
                    className="sidebar-toggle" 
                    onClick={() => setIsSidebarCollapsed(true)} 
                    aria-label="Collapse chats"
                  >
                    ‹
                  </button>
                )}
              </div>
            </div>
            <div className="matches-list" aria-label="Your chats">
              {sortedMatches.length ? sortedMatches.map((match, index) => (
                <MatchCard
                  key={chatKey(match)}
                  match={match}
                  delay={`${index * 0.05}s`}
                  onSelect={selectMatch}
                  isSelected={chatKey(match) === matchId}
                  onAction={handleMatchAction}
                />
              )) : <div className="matches-empty-list">No chats yet. Create a group or add a match to begin.</div>}
            </div>
          </aside>
          <ChatPanel 
            match={activeMatch} 
            isSidebarCollapsed={isSidebarCollapsed} 
            onToggleSidebar={() => setIsSidebarCollapsed(prev => !prev)} 
          />
      </div>

      {isGroupCreatorOpen && (
        <div className="group-creator-backdrop" onClick={() => !isCreatingGroup && setIsGroupCreatorOpen(false)}>
          <form className="group-creator-modal glass" onSubmit={createGroup} onClick={event => event.stopPropagation()}>
            <div className="group-creator-heading"><div><h2>Create group</h2><p>Invite any of your matches.</p></div><button type="button" className="group-creator-close" onClick={() => setIsGroupCreatorOpen(false)} aria-label="Close" disabled={isCreatingGroup}>×</button></div>
            <label className="group-name-field">Group name<input value={groupName} onChange={event => setGroupName(event.target.value)} maxLength="80" placeholder="Give your group a name" autoFocus required /></label>
            <fieldset className="group-match-picker"><legend>Select matches</legend>{availableMatches.length ? availableMatches.map(match => (
              <label key={match.userId} className="group-match-option"><input type="checkbox" checked={selectedMemberIds.includes(match.userId)} onChange={() => toggleGroupMember(match.userId)} /><img src={match.photoURL || '/default-avatar.png'} alt="" /><span>{match.displayName}</span></label>
            )) : <p>You have no matches to invite yet. You can still create a group for yourself.</p>}</fieldset>
            {groupError && <p className="group-creator-error" role="alert">{groupError}</p>}
            <button type="submit" className="btn-primary" disabled={isCreatingGroup}>{isCreatingGroup ? 'Creating…' : 'Create Group'}</button>
          </form>
        </div>
      )}
    </div>
  );
}

export default MatchesPage;
