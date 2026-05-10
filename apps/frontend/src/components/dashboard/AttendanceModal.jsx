import { useEffect, useState } from 'react';
import { X, Users, Clock, Hash, Globe, Download, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../services/api.js';
import * as XLSX from 'xlsx';

export default function AttendanceModal({ session, onClose }) {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?._id) {
      fetchAttendance();
    }
  }, [session?._id]);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      // BUG FIX: Use the session-specific attendance route which is accessible by hosts
      const { data } = await api.get(`/api/sessions/${session._id}/attendance`);
      setAttendance(data.attendance || []);
    } catch (err) {
      console.error('Fetch attendance error:', err);
      toast.error('Failed to load attendance records');
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = () => {
    try {
      if (!attendance || attendance.length === 0) {
        toast.error('No attendance data to export');
        return;
      }

      if (!XLSX || !XLSX.utils) {
        throw new Error('Excel library (XLSX) not properly loaded');
      }
      
      const sessionTitle = session.title || 'Session';
      
      // Prepare data for Excel
      const tableData = attendance.map((a, idx) => ({
        'S.No': idx + 1,
        'Participant Name': a.userName || 'Unknown',
        'Email': a.userId?.email || 'N/A',
        'Register No': a.registerNo || 'N/A',
        'Join Time': a.joinTime ? new Date(a.joinTime).toLocaleString() : 'N/A',
        'Leave Time': a.leaveTime ? new Date(a.leaveTime).toLocaleString() : 'Active',
        'Duration (Minutes)': Math.round((a.duration || 0) / 60),
        'Reconnects': a.reconnectCount || 0,
        'IP Address': a.ipAddress || 'Remote'
      }));
  
      // Prepare metadata headers
      const metadata = [
        ['SESSION ATTENDANCE REPORT'],
        ['Session Name:', sessionTitle],
        ['Host Name:', session.host?.name || 'Host'],
        ['Total Students:', attendance.length],
        ['Date conducted:', session.startTime ? new Date(session.startTime).toLocaleDateString() : 'N/A'],
        ['Exported At:', new Date().toLocaleString()],
        [''] // Empty row spacing
      ];

      // Create worksheet starting with metadata
      const worksheet = XLSX.utils.aoa_to_sheet(metadata);

      // Add table data starting after metadata
      XLSX.utils.sheet_add_json(worksheet, tableData, { origin: 'A7', skipHeader: false });
      
      // Set column widths
      const maxWidths = [
        { wch: 8 },  // S.No
        { wch: 30 }, // Name
        { wch: 30 }, // Email
        { wch: 20 }, // Register No
        { wch: 25 }, // Join Time
        { wch: 25 }, // Leave Time
        { wch: 20 }, // Duration
        { wch: 15 }, // Reconnects
        { wch: 20 }  // IP Address
      ];
      worksheet['!cols'] = maxWidths;
  
      // Create workbook and append worksheet
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');
  
      // Generate and download file using writeFile for broad browser compatibility
      const fileName = `Attendance_${sessionTitle.replace(/[^a-z0-9]/gi, '_')}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      
      toast.success('Attendance report exported successfully');
    } catch (err) {
      console.error('Export failed:', err);
      toast.error(`Export failed: ${err.message}`);
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit'
    });
  };

  const formatDuration = (seconds) => {
    if (!seconds && seconds !== 0) return '0m';
    const mins = Math.floor(seconds / 60);
    return `${mins}m`;
  };

  // Prevent closing when clicking within the modal content
  const handleContentClick = (e) => e.stopPropagation();

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-4xl max-h-[85vh] card flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 shadow-2xl rounded-3xl"
        onClick={handleContentClick}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-surface-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-500/20 rounded-xl flex items-center justify-center">
              <Users size={20} className="text-primary-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Attendance Report</h2>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-white/40">{session?.title}</p>
                <span className="w-1 h-1 bg-white/20 rounded-full" />
                <p className="text-sm font-bold text-primary-400">Total: {attendance.length}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchAttendance}
              disabled={loading}
              className="text-white/40 hover:text-primary-400 transition-colors p-2 hover:bg-white/5 rounded-full"
              title="Refresh attendance"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-0 custom-scrollbar bg-surface-800">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 grayscale opacity-50">
              <Loader2 className="w-10 h-10 text-primary-400 animate-spin mb-4" />
              <p className="text-white/40">Loading attendance data...</p>
            </div>
          ) : attendance.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center grayscale opacity-50">
              <Users className="w-12 h-12 text-white/10 mb-4" />
              <p className="text-white/40 text-lg font-semibold">No records found</p>
              <p className="text-white/20 text-sm">Attendance is recorded when students join the session.</p>
            </div>
          ) : (
            <div className="overflow-x-auto p-6">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="text-white/30 text-[10px] font-bold uppercase tracking-widest border-b border-white/5">
                    <th className="pb-4 font-semibold text-center w-12">S.No</th>
                    <th className="pb-4 font-semibold">Name</th>
                    <th className="pb-4 font-semibold">Register No</th>
                    <th className="pb-4 font-semibold text-center">In-Time</th>
                    <th className="pb-4 font-semibold text-center">Out-Time</th>
                    <th className="pb-4 font-semibold text-center">Duration</th>
                    <th className="pb-4 font-semibold text-right pr-4">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {attendance.map((record, idx) => (
                    <tr 
                      key={idx} 
                      className="group hover:bg-white/5 transition-colors"
                    >
                      <td className="py-4 text-center">
                        <span className="text-[10px] font-bold text-white/20 group-hover:text-primary-500 transition-colors uppercase tracking-widest">
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-4">
                        <div className="font-semibold text-sm text-primary-100">{record.userName}</div>
                        <div className="text-[10px] text-white/30">{record.userId?.email || ''}</div>
                      </td>
                      <td className="py-4">
                        <div className="font-mono text-sm text-white/60">{record.registerNo || '---'}</div>
                      </td>
                      <td className="py-4 text-center text-sm font-medium text-green-400/80">
                        {formatTime(record.joinTime)}
                      </td>
                      <td className="py-4 text-center text-sm font-medium text-amber-400/80">
                        {record.leaveTime ? formatTime(record.leaveTime) : <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded text-[10px] uppercase font-bold">Live</span>}
                      </td>
                      <td className="py-4 text-center text-sm">
                        <div className="font-bold text-white/80">{formatDuration(record.duration)}</div>
                        {(record.reconnectCount || 0) > 0 && (
                          <div className="text-[9px] text-amber-500 font-bold uppercase">{record.reconnectCount} Reconnects</div>
                        )}
                      </td>
                      <td className="py-4 text-right pr-4">
                        <span className="text-[10px] font-mono bg-white/5 px-2 py-1 rounded border border-white/5 text-white/40">
                          {record.ipAddress || 'Remote'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/5 bg-surface-900/50 flex gap-4">
          <button
            onClick={exportExcel}
            disabled={attendance.length === 0 || loading}
            className="flex-1 bg-primary-500 hover:bg-primary-600 disabled:opacity-30 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary-500/25 active:scale-[0.98]"
          >
            <Download size={20} />
            Export to Excel
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-surface-700 hover:bg-surface-600 text-white font-bold py-3.5 rounded-2xl transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
