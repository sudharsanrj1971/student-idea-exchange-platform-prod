import { RefreshCw } from 'lucide-react';

export function ReconnectBanner() {
  return (
    <div
      id="reconnect-banner"
      className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-2 flex items-center justify-center gap-3 text-amber-300 text-sm animate-in"
    >
      <RefreshCw size={16} className="animate-spin" />
      <span>Connection lost — attempting to reconnect...</span>
    </div>
  );
}
