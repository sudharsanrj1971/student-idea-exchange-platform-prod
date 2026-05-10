import { Wifi, WifiOff, Loader2 } from 'lucide-react';

export function ConnectionStatus({ state }) {
  const configs = {
    connected: {
      icon: <Wifi size={14} />,
      label: 'Connected',
      className: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
    },
    disconnected: {
      icon: <WifiOff size={14} />,
      label: 'Disconnected',
      className: 'text-red-400 bg-red-400/10 border-red-400/30',
    },
    connecting: {
      icon: <Loader2 size={14} className="animate-spin" />,
      label: 'Connecting',
      className: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
    },
  };

  const config = configs[state] || configs.connecting;

  return (
    <div id="connection-status" className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium ${config.className}`}>
      {config.icon}
      <span className="hidden sm:inline">{config.label}</span>
    </div>
  );
}
