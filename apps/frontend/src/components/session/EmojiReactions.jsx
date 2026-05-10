import { useState, useEffect } from 'react';

// Single floating emoji — pure CSS animation, no framer-motion needed
function FloatingEmoji({ emoji, senderName, startX, sway }) {
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setGone(true), 3200);
    return () => clearTimeout(t);
  }, []);

  if (gone) return null;

  return (
    <div
      className="fixed bottom-20 pointer-events-none z-[150] flex flex-col items-center"
      style={{
        left: `${startX}%`,
        animation: `floatUp 3.2s ease-out forwards`,
        '--sway': `${sway}px`,
      }}
    >
      <div className="text-4xl drop-shadow-lg select-none">{emoji}</div>
      {senderName && (
        <div className="mt-1 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 text-[10px] font-bold text-white whitespace-nowrap">
          {senderName}
        </div>
      )}
    </div>
  );
}

export function EmojiRain({ reactions }) {
  return (
    <div className="fixed inset-0 pointer-events-none z-[150] overflow-hidden">
      {reactions.map((r) => (
        <FloatingEmoji
          key={r.id}
          emoji={r.emoji}
          senderName={r.name}
          startX={r.startX ?? (10 + Math.random() * 80)}
          sway={r.sway ?? (Math.random() * 80 - 40)}
        />
      ))}
    </div>
  );
}
