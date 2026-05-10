import { useEffect, useRef, useState, useCallback } from 'react';
import { Send, MessageSquare, X, User, Globe, ShieldAlert } from 'lucide-react';
import Avatar from '../ui/Avatar.jsx';

export default function ChatPanel({ sessionId, socket, user, sessionHostId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState([]);
  const [recipient, setRecipient] = useState(null); // { id, name } or null for Everyone
  const bottomRef = useRef(null);
  const typingTimeout = useRef(null);

  useEffect(() => {
    if (!socket) return;
    socket.emit('chat:history', { sessionId, limit: 50 });
    // ... (socket listeners same as before)
  }, [socket, sessionId]);
  
  // Re-adding the full useEffect because I need to keep the listeners
  useEffect(() => {
    if (!socket) return;

    const onHistory = ({ messages: msgs }) => {
      setMessages(msgs || []);
    };

    const onMessage = (msg) => {
      setMessages((prev) => {
        const filtered = prev.filter(m => !(m.isLocal && m.text === msg.text));
        return [...filtered, msg];
      });
      setIsTyping((prev) => prev.filter((u) => u.userId !== (msg.sender?._id || msg.sender)));
    };

    const onTyping = ({ userId, name, isTyping: typing }) => {
      setIsTyping((prev) => {
        const filtered = prev.filter((u) => u.userId !== userId);
        return typing ? [...filtered, { userId, name }] : filtered;
      });
    };

    socket.on('chat:history', onHistory);
    socket.on('chat:message', onMessage);
    socket.on('chat:typing', onTyping);

    return () => {
      socket.off('chat:history', onHistory);
      socket.off('chat:message', onMessage);
      socket.off('chat:typing', onTyping);
    };
  }, [socket, sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim() || !socket) return;
    
    const text = input.trim();
    const localMsg = {
      _id: `temp-${Date.now()}`,
      text,
      sender: user?._id,
      senderName: user?.name,
      createdAt: new Date().toISOString(),
      isLocal: true,
      isPrivate: !!recipient,
      recipientName: recipient?.name
    };
    
    setMessages((prev) => [...prev, localMsg]);
    socket.emit('chat:send', { 
      sessionId, 
      text, 
      recipientId: recipient?.id 
    });
    setInput('');
  };

  const handleTyping = (e) => {
    setInput(e.target.value);
    socket?.emit('chat:typing', { sessionId, isTyping: true });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket?.emit('chat:typing', { sessionId, isTyping: false });
    }, 1500);
  };

  const formatTime = (ts) =>
    new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const isOwnMessage = (msg) =>
    msg.sender?._id === user?._id || msg.sender === user?._id;

  const isHostMessage = (msg) => {
    const senderId = msg.sender?._id?.toString() || msg.sender?.toString();
    return senderId === sessionHostId;
  };

  const renderTextWithLinks = (text) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-300 underline hover:text-blue-200 hover:opacity-80 transition-opacity break-all">
            {part}
          </a>
        );
      }
      return <span key={i} className="break-words">{part}</span>;
    });
  };

  return (
    <div className="w-full h-full sidebar flex flex-col" id="chat-panel">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
        <MessageSquare size={16} className="text-primary-400" />
        <span className="font-semibold text-sm">Session Chat</span>
        <span className="ml-auto text-white/30 text-xs">{messages.length} msgs</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 custom-scrollbar">
        {messages.length === 0 ? (
          <p className="text-white/20 text-xs text-center py-8">No messages yet. Say hello! 👋</p>
        ) : (
          messages.map((msg, i) => {
            if (msg.type === 'system') {
              return (
                <div key={msg._id || i} className="flex justify-center py-1">
                   <div className="px-3 py-1 bg-white/5 rounded-full border border-white/5 text-[10px] text-white/40 font-medium uppercase tracking-wider">
                     {msg.text}
                   </div>
                </div>
              );
            }

            const own = isOwnMessage(msg);
            const isPrivate = msg.isPrivate;

            return (
              <div
                key={msg._id || i}
                className={`flex gap-3 ${own ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {!msg.type || msg.type !== 'system' ? (
                  <Avatar 
                    src={msg.sender?.avatar || msg.avatar} 
                    name={msg.senderName} 
                    size="xs" 
                    className="mt-1"
                  />
                ) : null}
                
                <div className={`flex flex-col gap-1 ${own ? 'items-end' : 'items-start'} flex-1`}>
                {!own && (
                  <div className="flex items-center gap-2 px-1 mb-0.5">
                    <button 
                      onClick={() => setRecipient({ id: msg.sender?._id || msg.sender, name: msg.senderName })}
                      className="text-xs text-white/50 font-medium hover:text-primary-400 transition-colors"
                    >
                      {msg.senderName}
                    </button>
                    {isHostMessage(msg) && (
                      <span className="text-[9px] bg-primary-500/20 text-primary-400 px-1.5 py-0.5 rounded-md font-bold border border-primary-500/30 uppercase tracking-wider flex items-center justify-center shrink-0">
                        Host
                      </span>
                    )}
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm relative ${
                    isPrivate 
                      ? 'bg-amber-500/10 border border-amber-500/20 text-white' 
                      : (own ? 'bg-primary-500/30 border border-primary-500/20 text-white' : 'bg-surface-700 text-white/90')
                  } ${own ? 'rounded-tr-sm' : 'rounded-tl-sm'} ${msg.isLocal ? 'opacity-70' : ''}`}
                >
                  {isPrivate && (
                    <div className="flex items-center gap-1.5 mb-1 opacity-60">
                      <ShieldAlert size={10} className="text-amber-400" />
                      <span className="text-[10px] uppercase font-black tracking-tighter text-amber-500">Private</span>
                    </div>
                  )}
                  {renderTextWithLinks(msg.text)}
                  {msg.isLocal && (
                    <div className="absolute -left-6 bottom-1 animate-spin w-3 h-3 border border-primary-400 border-t-transparent rounded-full" />
                  )}
                </div>
                {!msg.isLocal && (
                   <span className="text-[10px] text-white/20 px-1">
                    {formatTime(msg.createdAt)}
                    {isPrivate && (own ? ` to ${msg.recipientName || 'User'}` : ` (from ${msg.senderName})`)}
                   </span>
                )}
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator inside scroll area */}
        {isTyping.length > 0 && (
          <div className="flex items-center gap-2 text-white/30 text-[10px] py-1 px-2 animate-pulse">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1 h-1 bg-white/40 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            {isTyping.map((u) => u.name).join(', ')} typing...
          </div>
        )}
        <div ref={bottomRef} className="h-4" />
      </div>

      {/* Recipient Selector */}
      <div className="px-4 py-2 border-t border-white/5 bg-surface-800/80 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            {recipient ? <User size={12} className="text-amber-400 shrink-0" /> : <Globe size={12} className="text-primary-400 shrink-0" />}
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 truncate">
              To: <span className={recipient ? 'text-amber-400' : 'text-primary-400'}>{recipient ? recipient.name : 'Everyone'}</span>
            </span>
          </div>
          {recipient && (
            <button 
              onClick={() => setRecipient(null)}
              className="text-[10px] font-bold text-red-400/50 hover:text-red-400 uppercase tracking-tighter shrink-0 pl-2"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="p-3 border-t border-white/5 flex gap-2 bg-surface-800"
      >
        <input
          id="chat-input"
          type="text"
          className={`input-field !py-2.5 text-sm flex-1 ${recipient ? 'border-amber-500/30' : ''}`}
          placeholder={recipient ? `Private msg to ${recipient.name}...` : "Type a message..."}
          value={input}
          onChange={handleTyping}
          maxLength={1000}
          autoComplete="off"
        />
        <button
          id="chat-send-btn"
          type="submit"
          disabled={!input.trim()}
          className={`px-3.5 py-2.5 rounded-xl font-bold transition-all disabled:opacity-30 ${recipient ? 'bg-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'btn-primary'}`}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
