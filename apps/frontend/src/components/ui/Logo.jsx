import React from 'react';
import { motion } from 'framer-motion';

export default function Logo({ size = 'md', showText = true, className = '' }) {
  const sizes = {
    xs: { icon: 'w-5 h-5 rounded-lg', text: 'text-xs', gap: 'gap-1' },
    sm: { icon: 'w-6 h-6 rounded-lg', text: 'text-lg', gap: 'gap-2' },
    md: { icon: 'w-10 h-10 rounded-xl', text: 'text-2xl', gap: 'gap-3' },
    lg: { icon: 'w-16 h-16 rounded-[1.25rem]', text: 'text-4xl', gap: 'gap-4' },
  };

  const { icon, text, gap } = sizes[size] || sizes.md;

  return (
    <div className={`flex items-center ${gap} ${className}`}>
      <motion.div 
        whileHover={{ scale: 1.05, rotate: 5 }}
        className={`${icon} bg-gradient-to-br from-primary-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/20 border border-white/10`}
      >
        <svg 
          viewBox="0 0 24 24" 
          fill="none" 
          className="w-3/5 h-3/5 text-white"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            d="M13 2L3 14H12L10 22L20 10H11L13 2Z" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            fill="currentColor"
            fillOpacity="0.2"
          />
        </svg>
      </motion.div>
      
      {showText && (
        <div className="flex flex-col leading-none">
          <span className={`font-black tracking-tighter ${text} text-gradient`}>
            iChange
          </span>
          <span className="text-[10px] font-bold tracking-[0.2em] text-white/30 uppercase mt-1">
            Empower Your Potential
          </span>
        </div>
      )}
    </div>
  );
}
