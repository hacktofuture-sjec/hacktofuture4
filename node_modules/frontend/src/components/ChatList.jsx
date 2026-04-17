import React from 'react';
import { User, Circle, LogOut, Trash2 } from 'lucide-react';

const buildAvatarUrl = (seed) => `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed || 'nova-user')}`;

const ChatList = ({
  currentUser,
  users,
  onlineUsers,
  selectedPartner,
  deletingUserId,
  onSelectUser,
  onDeleteUser,
  onLogout,
}) => {
  const onlineUserIds = new Set(onlineUsers.map((user) => user.userId));
  const otherUsers = users.filter(u => u.userId !== currentUser.userId);

  return (
    <div className="flex flex-col w-full h-full bg-surface border-r border-white/10 md:max-w-sm shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/10 sm:px-6 bg-surface/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 overflow-hidden rounded-full shadow-inner bg-linear-to-tr from-primary to-primary/50 text-white font-bold">
            <img src={buildAvatarUrl(currentUser.username)} alt={currentUser.username} className="object-cover w-full h-full" />
          </div>
          <div>
            <h2 className="font-semibold">{currentUser.username}</h2>
            <span className="text-xs text-green-400 flex items-center gap-1">
              <Circle className="w-2 h-2 fill-current" /> Online
            </span>
          </div>
        </div>
        <button 
          onClick={onLogout}
          className="p-2 transition-colors rounded-full text-textMuted hover:text-white hover:bg-white/10"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* User List */}
      <div className="flex-1 p-3 space-y-2 overflow-y-auto sm:p-4">
        <h3 className="px-2 pb-2 text-xs font-medium tracking-wider uppercase text-textMuted">Users ({otherUsers.length})</h3>
        
        {otherUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-textMuted">
            <User className="w-8 h-8 opacity-20" />
            <p className="text-sm">No one else is here.</p>
          </div>
        ) : (
          otherUsers.map((user) => {
            const isOnline = onlineUserIds.has(user.userId);
            const isSelected = selectedPartner?.userId === user.userId;
            const isDeleting = deletingUserId === user.userId;

            return (
              <div
                key={user.userId}
                className={`group flex items-center gap-2 rounded-xl border transition-all ${
                  isSelected
                    ? 'border-primary/40 bg-primary/15 shadow-sm shadow-primary/20'
                    : 'border-transparent hover:bg-white/5'
                }`}
              >
                <button
                  onClick={() => onSelectUser(user)}
                  className="flex items-center flex-1 gap-4 p-3 overflow-hidden text-left"
                >
                  <div className="relative">
                    <div className="flex items-center justify-center w-12 h-12 overflow-hidden text-white transition-colors rounded-full bg-white/10 group-hover:bg-primary/20">
                      <img src={buildAvatarUrl(user.username)} alt={user.username} className="object-cover w-full h-full" />
                    </div>
                    <div className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-surface rounded-full ${isOnline ? 'bg-green-500' : 'bg-slate-500'}`}></div>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="font-medium truncate">{user.username}</p>
                    <p className={`text-xs ${isOnline ? 'text-green-400' : 'text-textMuted'} truncate`}>{isOnline ? 'Online' : 'Offline'}</p>
                  </div>
                </button>
                <button
                  onClick={() => onDeleteUser(user)}
                  disabled={isDeleting}
                  className="p-2 mr-2 transition-colors rounded-lg text-textMuted hover:text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
                  title="Delete user"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ChatList;
