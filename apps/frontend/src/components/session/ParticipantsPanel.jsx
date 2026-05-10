import { Users, X, MicOff, UserX, ChevronDown, ShieldCheck, ClipboardCheck, VolumeX } from 'lucide-react';
import { useState } from 'react';
import { useSessionStore } from '../../store/sessionStore.js';
import AttendanceModal from './AttendanceModal.jsx';
import Avatar from '../ui/Avatar.jsx';

export default function ParticipantsPanel({
  onClose, sessionId, sessionTitle, isHost, currentUserId,
  onMuteAll, onMuteUser, onKickUser, onLowerHand
}) {
  const { participants, raisedHands } = useSessionStore();
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(false);

  const raisedHandCount = participants.filter(p =>
    raisedHands.has(p.userId?.toString())
  ).length;

  return (
    <div className="flex flex-col h-full w-full bg-surface-800 text-foreground border-l border-border animate-in slide-in-from-right duration-300">
      {/* ── Header ── */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary-500/10 rounded-lg">
            <Users size={18} className="text-primary-400" />
          </div>
          <div>
            <h2 className="font-bold text-sm">Participants</h2>
            <p className="text-[10px] text-foreground/40">{participants.length} in session</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsAttendanceOpen(true)}
            className="p-2 hover:bg-primary-500/10 rounded-lg transition-colors text-primary-400"
            title="Attendance Report"
          >
            <ClipboardCheck size={18} />
          </button>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-full transition-colors text-foreground/40 hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ── Host Admin Controls ── */}
      {isHost && (
        <div className="px-4 py-3 border-b border-white/5 shrink-0 space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-foreground/30 font-bold mb-2">Host Controls</p>
          <div className="flex gap-2">
            <button
              onClick={onMuteAll}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 transition-all active:scale-95"
            >
              <VolumeX size={14} />
              Mute All
            </button>
            {raisedHandCount > 0 && (
              <button
                onClick={() => participants
                  .filter(p => raisedHands.has(p.userId?.toString()))
                  .forEach(p => onLowerHand(p.userId?.toString()))
                }
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-xl bg-surface-700 hover:bg-surface-600 border border-white/10 text-foreground/60 hover:text-foreground transition-all active:scale-95"
              >
                ✋ Lower All ({raisedHandCount})
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Participant List ── */}
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        {participants.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full opacity-30 gap-3">
            <Users size={32} />
            <p className="text-xs">No participants yet</p>
          </div>
        ) : (
          <div className="space-y-1">
            {participants.map((p) => (
              <ParticipantItem
                key={p.socketId}
                participant={p}
                isRaised={raisedHands.has(p.userId?.toString())}
                isSelf={p.userId?.toString() === currentUserId}
                isHost={isHost}
                onMute={() => onMuteUser(p.userId?.toString())}
                onKick={() => onKickUser(p.userId?.toString())}
                onLowerHand={() => onLowerHand(p.userId?.toString())}
              />
            ))}
          </div>
        )}
      </div>

      <AttendanceModal
        isOpen={isAttendanceOpen}
        onClose={() => setIsAttendanceOpen(false)}
        sessionId={sessionId}
        sessionTitle={sessionTitle}
      />
    </div>
  );
}

function ParticipantItem({ participant, isRaised, isSelf, isHost, onMute, onKick, onLowerHand }) {
  const initials = participant.name
    ?.split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  return (
    <div className="flex items-center justify-between group p-2 rounded-xl hover:bg-white/5 transition-all">
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0">
          <Avatar 
            src={participant.avatar || participant.profilePic} 
            name={participant.name} 
            size="sm" 
          />
          {isRaised && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 border-2 border-surface-800 rounded-full flex items-center justify-center animate-bounce">
              <span className="text-[9px]">✋</span>
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold truncate max-w-[120px]">
              {participant.name}
            </span>
            {isSelf && (
              <span className="text-[9px] text-primary-400 bg-primary-500/10 px-1.5 py-0.5 rounded-full font-bold shrink-0">You</span>
            )}
            {participant.isHost && (
              <ShieldCheck size={12} className="text-primary-400 shrink-0" title="Host" />
            )}
          </div>
          <span className="text-[10px] text-foreground/30 uppercase tracking-tighter">
            {participant.isHost ? 'Organizer' : 'Student'}
          </span>
        </div>
      </div>

      {/* Host-only action buttons — hidden for the host themselves and hidden from non-hosts */}
      {isHost && !isSelf && !participant.isHost && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {isRaised && (
            <button
              onClick={onLowerHand}
              title="Lower hand"
              className="p-1.5 text-amber-400/60 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all text-[10px] font-bold"
            >
              ✋
            </button>
          )}
          <button
            onClick={onMute}
            title="Mute participant"
            className="p-1.5 text-foreground/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
          >
            <MicOff size={14} />
          </button>
          <button
            onClick={onKick}
            title="Remove participant"
            className="p-1.5 text-foreground/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
          >
            <UserX size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
