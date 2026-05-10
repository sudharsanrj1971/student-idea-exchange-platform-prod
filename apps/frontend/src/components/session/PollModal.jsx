import { useState, useEffect } from 'react';
import { X, BarChart3, Plus, Trash2, PieChart, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PollModal({ 
  isOpen, onClose, isHost, onStartPoll, activePoll, pollVotes, userVote, onVote, onEndPoll 
}) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['Yes', 'No']);

  if (!isOpen) return null;

  const handleAddOption = () => {
    if (options.length < 5) setOptions([...options, '']);
  };

  const handleRemoveOption = (index) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleStart = () => {
    if (!question.trim() || options.some(opt => !opt.trim())) return;
    onStartPoll({ question, options: options.filter(o => !!o.trim()) });
    setQuestion('');
    setOptions(['Yes', 'No']);
  };

  const totalVotes = Object.values(pollVotes || {}).reduce((a, b) => a + b, 0);
  
  // Identify the winning option
  const maxVotes = Math.max(...Object.values(pollVotes || { 0: 0 }), 0);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-surface-800 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        
        {/* Header */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary-400">
            <BarChart3 size={20} />
            <h2 className="font-bold">Live Polling</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-foreground/40 hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
          {!activePoll ? (
            /* Creation View (Host Only) */
            isHost ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-foreground/40">Question</label>
                  <textarea
                    autoFocus
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask something..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:border-primary-400/50 resize-none h-24"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-widest text-foreground/40">Options</label>
                    {options.length < 5 && (
                      <button onClick={handleAddOption} className="text-xs text-primary-400 font-bold flex items-center gap-1 hover:text-primary-300">
                        <Plus size={14} /> Add Option
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {options.map((opt, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          value={opt}
                          onChange={(e) => handleOptionChange(i, e.target.value)}
                          placeholder={`Option ${i + 1}`}
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm focus:outline-none focus:border-primary-400/50"
                        />
                        {options.length > 2 && (
                          <button onClick={() => handleRemoveOption(i)} className="p-2 text-red-400/50 hover:text-red-400 hover:bg-red-500/10 rounded-lg shrink-0">
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleStart}
                  disabled={!question.trim() || options.some(opt => !opt.trim())}
                  className="w-full py-3 bg-primary-500 hover:bg-primary-400 text-white font-bold rounded-xl transition-all shadow-glow-primary active:scale-[0.98] disabled:opacity-50"
                >
                  Start Poll
                </button>
              </div>
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center text-foreground/20">
                  <BarChart3 size={32} />
                </div>
                <p className="text-foreground/40 text-sm">No active polls at the moment.</p>
              </div>
            )
          ) : (
            /* Active Poll View (Vote or Results) */
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Live Now</span>
                <h3 className="text-lg font-bold leading-tight">{activePoll.question}</h3>
                <p className="text-xs text-foreground/40">{totalVotes} votes so far</p>
              </div>

              <div className="space-y-3">
                {activePoll.options.map((option, index) => {
                  const votes = pollVotes[index] || 0;
                  const percentage = totalVotes === 0 ? 0 : Math.round((votes / totalVotes) * 100);
                  const isSelected = userVote === index;
                  const isWinner = totalVotes > 0 && votes === maxVotes;

                  return (
                    <motion.button
                      key={index}
                      initial={false}
                      onClick={() => !userVote && onVote(index)}
                      disabled={!!userVote}
                      className={`w-full group relative overflow-hidden rounded-xl border transition-all text-left ${
                        isSelected 
                          ? 'border-primary-500 bg-primary-500/5' 
                          : 'border-white/10 bg-white/5'
                      } ${!userVote ? 'hover:border-primary-500/50 cursor-pointer' : 'cursor-default'} ${isWinner ? 'shadow-[0_0_15px_rgba(67,97,238,0.1)]' : ''}`}
                    >
                      {/* Animated Bar Fill Background */}
                      {userVote !== undefined && (
                        <motion.div 
                          className={`absolute inset-y-0 left-0 ${isWinner ? 'bg-primary-500/20' : 'bg-white/5'}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ type: 'spring', stiffness: 50, damping: 20 }}
                        />
                      )}
                      
                      <div className="relative p-4 flex items-center justify-between text-sm">
                        <div className="flex gap-3 items-center">
                          <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-primary-400 shadow-[0_0_8px_rgba(67,97,238,0.5)]' : 'bg-white/20'}`} />
                          <div className="flex items-center gap-2">
                            <span className={isSelected ? 'font-bold text-primary-400' : 'text-foreground/70'}>
                              {option.text}
                            </span>
                            {isWinner && userVote !== undefined && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="text-amber-400"
                              >
                                <Trophy size={14} />
                              </motion.div>
                            )}
                          </div>
                        </div>
                        {userVote !== undefined && (
                          <motion.span 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className={`${isSelected || isWinner ? 'font-black text-primary-400' : 'text-foreground/40'} text-xs`}
                          >
                             {percentage}%
                          </motion.span>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {isHost && (
                <button
                  onClick={() => onEndPoll(activePoll.id)}
                  className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 font-bold rounded-xl transition-all"
                >
                  End Poll
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
