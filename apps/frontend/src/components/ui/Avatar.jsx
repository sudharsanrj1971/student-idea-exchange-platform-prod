import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Production-grade Avatar component with priority resolution and robust fallback
 */
export default function Avatar({ 
  src, 
  name, 
  size = 'md', 
  className = '', 
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const sizeClasses = {
    xs: 'w-6 h-6 text-[8px]',
    sm: 'w-8 h-8 text-[10px]',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-base',
    xl: 'w-24 h-24 text-2xl',
  };

  const getInitials = (n) => {
    if (!n) return '?';
    return n.split(' ').map(part => part[0]).join('').toUpperCase().slice(0, 2);
  };

  const stringToColor = (str) => {
    if (!str) return '#6366f1';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
  };

  // Reset state when src changes
  useEffect(() => {
    setLoaded(false);
    setError(false);
  }, [src]);

  const hasValidSrc = Boolean(src && typeof src === 'string' && src.trim() !== '' && src !== 'null' && src !== 'undefined');
  const showImage = hasValidSrc && !error;

  return (
    <div className={`relative rounded-full overflow-hidden flex items-center justify-center bg-surface-800 border border-white/10 shrink-0 ${sizeClasses[size]} ${className}`}>
      
      {showImage ? (
        <>
          {!loaded && (
            <div className="absolute inset-0 bg-white/5 animate-pulse" />
          )}

          <img
            src={src}
            alt={name || 'Avatar'}
            onLoad={() => setLoaded(true)}
            onError={() => {
              console.warn('[Avatar] Failed to load image:', src);
              setError(true);
            }}
            referrerPolicy="no-referrer"
            className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            // Handle cached images that might not fire onLoad
            ref={(img) => {
              if (img && img.complete && img.naturalHeight !== 0 && !loaded) {
                setLoaded(true);
              }
            }}
          />
        </>
      ) : (
        <div 
          className="w-full h-full flex items-center justify-center font-bold tracking-tighter"
          style={{ 
            background: `linear-gradient(135deg, ${stringToColor(name || 'User')}, ${stringToColor((name || 'User') + 'alt')})`,
            color: 'white',
            textShadow: '0 1px 2px rgba(0,0,0,0.5)'
          }}
        >
          {getInitials(name)}
        </div>
      )}

      {/* Decorative pulse for active source */}
      {loaded && showImage && (
        <div className="absolute inset-0 rounded-full border border-white/5 pointer-events-none" />
      )}
    </div>
  );
}
