import { useState } from 'react';
import { X, Video, Calendar, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../services/api.js';

export default function CreateSessionModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', description: '', scheduledAt: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('Title is required');
    setLoading(true);
    try {
      const payload = { title: form.title, description: form.description };
      if (form.scheduledAt) payload.scheduledAt = new Date(form.scheduledAt).toISOString();
      const { data } = await api.post('/api/sessions', payload);
      onCreated(data.session);
      toast.success('Session created!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in">
      <div className="w-full max-w-md card animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary-500/20 rounded-xl flex items-center justify-center">
              <Video size={18} className="text-primary-400" />
            </div>
            <h2 className="text-lg font-semibold">New Session</h2>
          </div>
          <button
            id="close-modal-btn"
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors p-1"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">
              <FileText size={14} className="inline mr-1" />
              Title *
            </label>
            <input
              id="session-title"
              type="text"
              className="input-field"
              placeholder="e.g. Introduction to Calculus"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              maxLength={200}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">Description</label>
            <textarea
              id="session-description"
              className="input-field resize-none"
              rows={3}
              placeholder="What will be covered in this session?"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              maxLength={2000}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">
              <Calendar size={14} className="inline mr-1" />
              Scheduled Date & Time
            </label>
            <input
              id="session-scheduled-at"
              type="datetime-local"
              className="input-field"
              value={form.scheduledAt}
              onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              id="create-session-submit"
              type="submit"
              disabled={loading}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Create Session'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
