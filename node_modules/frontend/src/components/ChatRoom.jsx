import React, { useState, useEffect, useRef } from 'react';
import { Send, ChevronLeft } from 'lucide-react';

const buildAvatarUrl = (seed) => `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed || 'nova-user')}`;

const ChatRoom = ({ currentUser, partner, messages, onSendMessage, onTyping, partnerTyping, onBack }) => {
  const [text, setText] = useState('');
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, partnerTyping]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (text.trim()) {
      onSendMessage(text.trim());
      setText('');
    }
  };

  const handleInputChange = (e) => {
    setText(e.target.value);
    onTyping();
  };

  // Filter messages specifically between these two users
  const roomMessages = messages.filter(
    (m) =>
      (m.sender === currentUser.userId && m.receiver === partner.userId) ||
      (m.sender === partner.userId && m.receiver === currentUser.userId)
  );

  return (
    <div className="flex flex-col w-full h-full bg-background relative z-10">
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center gap-3 px-3 py-3 border-b border-white/10 sm:px-4 sm:py-4 bg-surface/80 backdrop-blur-md">
        <button onClick={onBack} className="flex items-center gap-1 p-2 -ml-1 transition-colors rounded-full md:hidden text-textMuted hover:text-white">
          <ChevronLeft className="w-5 h-5" />
          <span className="text-xs font-medium">Back</span>
        </button>
        <div className="relative">
          <div className="flex items-center justify-center w-10 h-10 overflow-hidden rounded-full bg-linear-to-tr from-secondary/80 to-secondary/30 text-white font-medium">
            <img src={buildAvatarUrl(partner.username)} alt={partner.username} className="object-cover w-full h-full" />
          </div>
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-surface rounded-full"></div>
        </div>
        <div className="flex-1 overflow-hidden">
          <h2 className="font-semibold text-white truncate">{partner.username}</h2>
          <p className="text-xs text-textMuted truncate">
            {partnerTyping ? (
              <span className="text-primary animate-pulse">Typing...</span>
            ) : (
              'Online'
            )}
          </p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 p-3 space-y-4 overflow-y-auto sm:p-4">
        {roomMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-textMuted/50">
            <p className="text-sm">No messages here yet.</p>
            <p className="text-xs">Send a message to start the chaos.</p>
          </div>
        ) : (
          roomMessages.map((msg, idx) => {
            const isMe = msg.sender === currentUser.userId;
            return (
              <div key={msg._id || idx} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`max-w-[75%] px-4 py-3 rounded-2xl ${
                    isMe 
                      ? 'bg-primary text-white rounded-tr-sm shadow-md shadow-primary/20' 
                      : 'bg-surface text-textMain rounded-tl-sm border border-white/5 shadow-md shadow-black/20'
                  }`}
                >
                  <p className="text-sm leading-relaxed">{msg.message}</p>
                </div>
              </div>
            );
          })
        )}
        
        {partnerTyping && (
           <div className="flex w-full justify-start">
             <div className="px-4 py-3 rounded-2xl bg-surface border border-white/5 rounded-tl-sm shadow-md flex items-center justify-center gap-1 h-10">
               <div className="w-1.5 h-1.5 bg-textMuted rounded-full animate-bounce [animation-delay:-0.3s]"></div>
               <div className="w-1.5 h-1.5 bg-textMuted rounded-full animate-bounce [animation-delay:-0.15s]"></div>
               <div className="w-1.5 h-1.5 bg-textMuted rounded-full animate-bounce"></div>
             </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="sticky bottom-0 z-20 p-3 border-t border-white/10 sm:p-4 bg-surface/50 backdrop-blur-lg pb-safe">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            type="text"
            value={text}
            onChange={handleInputChange}
            placeholder="Type a message..."
            className="w-full py-3.5 pl-4 pr-12 transition-colors border outline-none rounded-full bg-background/80 border-white/10 focus:border-primary focus:bg-background text-textMain placeholder:text-textMuted/50"
          />
          <button 
            type="submit" 
            disabled={!text.trim()}
            className="absolute right-1 p-2.5 text-white transition-all rounded-full bg-primary hover:bg-primary/90 disabled:opacity-30 disabled:scale-90"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatRoom;
