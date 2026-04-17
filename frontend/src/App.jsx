import React, { useState, useEffect, useRef } from 'react';
import Login from './components/Login';
import ChatList from './components/ChatList';
import ChatRoom from './components/ChatRoom';
import { registerUser, loginUser, initMessagingSocket, initPresenceSocket, fetchUserMessages, fetchAllUsers, deleteUserById, fetchAgentAnalyze } from './services/api';

const STORAGE_KEY = 'novaChatUser';
const STATUS_PILL_STYLES = {
  healthy: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40',
  critical: 'bg-rose-500/20 text-rose-200 border-rose-400/40',
  healing: 'bg-amber-500/20 text-amber-100 border-amber-300/40',
  restored: 'bg-green-500/20 text-green-100 border-green-300/40',
  unknown: 'bg-slate-500/20 text-slate-200 border-slate-300/40',
};

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  
  // Sockets
  const [messagingSocket, setMessagingSocket] = useState(null);
  const [presenceSocket, setPresenceSocket] = useState(null);

  // App State
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [systemStatus, setSystemStatus] = useState({ key: 'healthy', label: 'System Healthy', indicator: '🟢' });
  
  // Real-time states
  const [partnerTyping, setPartnerTyping] = useState(null); // userId of who is typing
  const typingTimeoutRef = useRef({});
  const hadIncidentRef = useRef(false);

  const deriveSystemStatus = (analysis) => {
    const monitoring = analysis?.monitoring || {};
    const kubernetesSignals = analysis?.kubernetesSignals || {};
    const decision = analysis?.decision || {};
    const serviceMap = monitoring?.services || monitoring;

    const serviceStatuses = Object.values(serviceMap || {})
      .map((entry) => String(entry?.status || '').toLowerCase())
      .filter(Boolean);
    const hasServiceDown = serviceStatuses.some((status) => status === 'down');

    const restartCount = Number(kubernetesSignals?.restartCount) || 0;
    const resourceOverload = Boolean(kubernetesSignals?.resourceOverload);
    const isCritical = hasServiceDown || resourceOverload || restartCount > 2;
    const isHealing = !isCritical && (Boolean(decision?.actionNeeded) || restartCount > 0);

    if (isCritical) {
      hadIncidentRef.current = true;
      return { key: 'critical', label: 'System Critical', indicator: '🔴' };
    }

    if (isHealing) {
      hadIncidentRef.current = true;
      return { key: 'healing', label: 'AI Healing in Progress', indicator: '🟡' };
    }

    if (hadIncidentRef.current) {
      hadIncidentRef.current = false;
      return { key: 'restored', label: 'System Restored', indicator: '🟢' };
    }

    return { key: 'healthy', label: 'System Healthy', indicator: '🟢' };
  };

  useEffect(() => {
    const restoreSession = async () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;

      try {
        const user = JSON.parse(saved);
        if (!user?.userId) return;

        setCurrentUser(user);
        initSockets(user);

        const [history, users] = await Promise.all([
          fetchUserMessages(user.userId),
          fetchAllUsers(),
        ]);
        setMessages(history);
        setAllUsers(users);
      } catch (err) {
        console.error('Failed to restore saved session', err);
        localStorage.removeItem(STORAGE_KEY);
      }
    };

    restoreSession();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const refreshUsers = async () => {
      try {
        const users = await fetchAllUsers();
        setAllUsers(users);
      } catch (err) {
        console.error('Failed to refresh users list', err);
      }
    };

    refreshUsers();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !selectedPartner) return;

    const loadConversationHistory = async () => {
      try {
        const history = await fetchUserMessages(currentUser.userId);
        setMessages(history);
      } catch (err) {
        console.error('Failed to load conversation history', err);
      }
    };

    loadConversationHistory();
  }, [currentUser?.userId, selectedPartner?.userId]);

  useEffect(() => {
    if (!currentUser) return;

    let active = true;

    const refreshSystemStatus = async () => {
      try {
        const analysis = await fetchAgentAnalyze();
        console.log('[SystemHealth] /agent/analyze response:', analysis);
        if (!active) return;
        const nextStatus = deriveSystemStatus(analysis);
        console.log('[SystemHealth] detected state:', nextStatus);
        setSystemStatus(nextStatus);
      } catch (err) {
        if (!active) return;
        console.warn('Failed to refresh AI system status', err?.message || err);
        setSystemStatus({ key: 'unknown', label: 'System Unknown', indicator: '⚠️' });
      }
    };

    refreshSystemStatus();
    const intervalId = setInterval(refreshSystemStatus, 3000);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [currentUser]);

  // 1. Handle Login
  const handleLogin = async ({ username, password, email }) => {
    try {
      const user = await loginUser({ username, password, email });
      setCurrentUser(user);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      initSockets(user);
      
      const [history, users] = await Promise.all([
        fetchUserMessages(user.userId),
        fetchAllUsers(),
      ]);
      setMessages(history);
      setAllUsers(users);
    } catch (err) {
      console.error('Login error', err);
      throw err;
    }
  };

  const handleRegister = async ({ username, password, email }) => {
    try {
      await registerUser({ username, password, email });
      await handleLogin({ username, password, email });
    } catch (err) {
      console.error('Register error', err);
      throw err;
    }
  };

  // 2. Initialize Sockets
  const initSockets = (user) => {
    if (presenceSocket) {
      presenceSocket.disconnect();
    }
    if (messagingSocket) {
      messagingSocket.disconnect();
    }

    // Presence
    const pSocket = initPresenceSocket();
    const sendPresence = () => {
      pSocket.emit('user_online', user);
    };
    pSocket.on('connect', sendPresence);
    pSocket.on('reconnect', sendPresence);
    pSocket.on('connect_error', (error) => {
      console.error('Presence socket connect error', error);
    });
    pSocket.on('online_users', (users) => {
      setOnlineUsers(users);
    });
    setPresenceSocket(pSocket);

    // Messaging
    const mSocket = initMessagingSocket();
    const joinRoom = () => {
      mSocket.emit('join', user.userId);
    };
    mSocket.on('connect', joinRoom);
    mSocket.on('reconnect', joinRoom);
    mSocket.on('connect_error', (error) => {
      console.error('Messaging socket connect error', error);
    });
    mSocket.on('receive_message', (msg) => {
      setMessages((prev) => {
        if (!msg) return prev;
        
        // Use message ID if available, otherwise use sender+receiver+timestamp+message as key
        const msgKey = msg._id || `${msg.sender}-${msg.receiver}-${msg.timestamp}-${msg.message}`;
        
        // Check if message already exists in state
        const exists = prev.some((existing) => {
          if (msg._id && existing._id) {
            return existing._id === msg._id;
          }
          return existing.sender === msg.sender && 
                 existing.receiver === msg.receiver && 
                 existing.message === msg.message &&
                 existing.timestamp === msg.timestamp;
        });
        
        if (exists) return prev;
        
        // Update existing optimistic message with DB fields if this is the echo back
        const optimisticIndex = prev.findIndex((m) => 
          m.sender === msg.sender && 
          m.receiver === msg.receiver && 
          m.message === msg.message &&
          !m._id
        );
        
        if (optimisticIndex !== -1) {
          // Replace optimistic message with server version
          const updated = [...prev];
          updated[optimisticIndex] = msg;
          return updated;
        }
        
        // Add as new message
        return [...prev, msg];
      });
    });
    mSocket.on('typing', ({ sender }) => {
      setPartnerTyping(sender);
      // Clear after a few seconds of no typing events
      if (typingTimeoutRef.current[sender]) {
        clearTimeout(typingTimeoutRef.current[sender]);
      }
      typingTimeoutRef.current[sender] = setTimeout(() => {
        setPartnerTyping((prev) => (prev === sender ? null : prev));
      }, 2000);
    });
    setMessagingSocket(mSocket);
  };

  // Cleanup sockets on unmount
  useEffect(() => {
    return () => {
      if (presenceSocket) presenceSocket.disconnect();
      if (messagingSocket) messagingSocket.disconnect();
    };
  }, [presenceSocket, messagingSocket]);
  
  const handleLogout = () => {
    if (presenceSocket) presenceSocket.disconnect();
    if (messagingSocket) messagingSocket.disconnect();
    localStorage.removeItem(STORAGE_KEY);
    setPresenceSocket(null);
    setMessagingSocket(null);
    setCurrentUser(null);
    setOnlineUsers([]);
    setAllUsers([]);
    setMessages([]);
    setSelectedPartner(null);
  };

  // Actions
  const handleSendMessage = (text) => {
    if (!messagingSocket || !selectedPartner) return;
    const outgoingMessage = {
      sender: currentUser.userId,
      receiver: selectedPartner.userId,
      message: text,
      timestamp: new Date().toISOString(),
    };
    messagingSocket.emit('send_message', outgoingMessage);
  };

  const handleTyping = () => {
    if (!messagingSocket || !selectedPartner) return;
    messagingSocket.emit('typing', {
      sender: currentUser.userId,
      receiver: selectedPartner.userId,
    });
  };

  const handleDeleteUser = async (user) => {
    if (!user?.userId || deletingUserId) return;

    const shouldDelete = window.confirm(`Delete user ${user.username}? This is for demo/admin use.`);
    if (!shouldDelete) return;

    try {
      setDeletingUserId(user.userId);
      await deleteUserById(user.userId);

      setAllUsers((prev) => prev.filter((entry) => entry.userId !== user.userId));
      setOnlineUsers((prev) => prev.filter((entry) => entry.userId !== user.userId));

      if (selectedPartner?.userId === user.userId) {
        setSelectedPartner(null);
      }
    } catch (err) {
      console.error('Failed to delete user', err);
      alert(err?.response?.data?.error || 'Failed to delete user.');
    } finally {
      setDeletingUserId(null);
    }
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} onRegister={handleRegister} />;
  }

  return (
    <div className="flex flex-col w-full h-screen overflow-hidden bg-background">
      <header className="flex items-center justify-between px-3 py-3 border-b border-white/10 sm:px-5 bg-surface/70 backdrop-blur-lg">
        <div>
          <h1 className="text-base font-semibold tracking-wide text-white sm:text-lg">Nova Chat Console</h1>
          <p className="text-xs text-textMuted">Self-healing microservices demo</p>
        </div>
        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-300 ${STATUS_PILL_STYLES[systemStatus.key] || STATUS_PILL_STYLES.healthy}`}>
          <span>{systemStatus.indicator}</span>
          <span>{systemStatus.label}</span>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar - Chat List */}
        <div className={`h-full w-full md:w-80 ${selectedPartner ? 'hidden md:flex' : 'flex'}`}>
          <ChatList
            currentUser={currentUser}
            users={allUsers}
            onlineUsers={onlineUsers}
            selectedPartner={selectedPartner}
            deletingUserId={deletingUserId}
            onDeleteUser={handleDeleteUser}
            onSelectUser={setSelectedPartner}
            onLogout={handleLogout}
          />
        </div>

        {/* Main Area - Chat Room */}
        <div className={`h-full flex-1 ${selectedPartner ? 'flex' : 'hidden md:flex'}`}>
          {selectedPartner ? (
            <ChatRoom
              currentUser={currentUser}
              partner={selectedPartner}
              messages={messages}
              onSendMessage={handleSendMessage}
              onTyping={handleTyping}
              partnerTyping={partnerTyping === selectedPartner.userId}
              onBack={() => setSelectedPartner(null)}
            />
          ) : (
            <div className="items-center justify-center flex-1 hidden bg-background md:flex">
              <div className="max-w-sm p-8 text-center border bg-surface/40 border-white/10 rounded-2xl">
                <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-2xl bg-primary/20 text-primary">💬</div>
                <h2 className="mb-2 text-xl font-semibold">Select a conversation</h2>
                <p className="text-sm text-textMuted">
                  Pick a user from the sidebar to start chatting and monitor system health during your demo.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
