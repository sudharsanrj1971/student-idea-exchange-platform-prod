import { useState, useEffect } from 'react';
import { X, User, Clock, CheckCircle, Download, Calendar, RefreshCw } from 'lucide-react';
import api from '../../services/api.js';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';

export default function AttendanceModal({ sessionId, sessionTitle, isOpen, onClose, hostName, sessionDate }) {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchAttendance();
    }
  }, [isOpen]);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/api/sessions/${sessionId}/attendance`);
      setAttendance(data.attendance);
    } catch (err) {
      toast.error('Failed to load attendance report');
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
      
      // Prepare data for Excel
      const tableData = attendance.map((a, idx) => ({
        'S.No': idx + 1,
        'Participant Name': a.userName || 'Unknown',
        'Email': a.userId?.email || 'N/A',
        'Register No': a.registerNo || 'N/A',
        'Join Time': a.joinTime ? new Date(a.joinTime).toLocaleString() : 'N/A',
        'Leave Time': a.leaveTime ? new Date(a.leaveTime).toLocaleString() : 'Still in session',
        'Duration (Minutes)': Math.round((a.duration || 0) / 60),
        'Reconnects': a.reconnectCount || 0,
        'IP Address': a.ipAddress || 'Internal'
      }));
  
      // Create metadata headers
      const metadata = [
        ['SESSION ATTENDANCE REPORT'],
        ['Session Name:', sessionTitle],
        ['Host Name:', hostName || 'Host'],
        ['Total Students:', attendance.length],
        ['Date conducted:', new Date(sessionDate).toLocaleDateString()],
        ['Exported At:', new Date().toLocaleString()],
        [''] // Empty row spacing
      ];

      // Create worksheet starting with metadata
      const worksheet = XLSX.utils.aoa_to_sheet(metadata);

      // Add the table data starting after metadata
      XLSX.utils.sheet_add_json(worksheet, tableData, { origin: 'A7', skipHeader: false });
      
      // Set column widths
      const maxWidths = [
        { wch: 8 },  // S.No
        { wch: 30 }, // Name
        { wch: 30 }, // Email
        { wch: 15 }, // Register No
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface-800 border border-white/10 rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-surface-900/50">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <CheckCircle className="text-primary-400" size={24} />
              Attendance Report
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-foreground/40">{sessionTitle}</p>
              <span className="w-1 h-1 bg-white/20 rounded-full" />
              <p className="text-sm font-bold text-primary-400">Total: {attendance.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              id="refresh-attendance"
              onClick={fetchAttendance}
              disabled={loading}
              className="p-2 hover:bg-white/5 rounded-full transition-colors text-foreground/40 hover:text-primary-400"
              title="Refresh Attendance"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
            <button 
              id="close-attendance"
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-full transition-colors text-foreground/40 hover:text-foreground"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-primary-500">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 grayscale opacity-50">
              <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p>Generating report...</p>
            </div>
          ) : attendance.length === 0 ? (
            <div className="text-center py-20 opacity-40">
              <User size={48} className="mx-auto mb-4" />
              <p>No records found for this session</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-foreground/30 border-b border-white/5">
                    <th className="pb-4 font-semibold text-center w-10">S.No</th>
                    <th className="pb-4 font-semibold">User</th>
                    <th className="pb-4 font-semibold">Email</th>
                    <th className="pb-4 font-semibold">Register No</th>
                    <th className="pb-4 font-semibold text-center">Joined At</th>
                    <th className="pb-4 font-semibold text-right">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {attendance.map((record, idx) => (
                    <tr key={idx} className="group hover:bg-white/5 transition-colors">
                      <td className="py-4 text-center">
                        <span className="text-[10px] font-bold text-foreground/20 group-hover:text-primary-400 transition-colors uppercase tracking-widest">
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-4">
                        <div className="font-semibold text-sm text-primary-100">{record.userName}</div>
                        <div className="text-[10px] text-foreground/30">{record.ipAddress || 'Remote'}</div>
                      </td>
                      <td className="py-4 text-xs text-foreground/50">{record.userId?.email || 'N/A'}</td>
                      <td className="py-4 text-sm font-mono text-foreground/60">{record.registerNo || '---'}</td>
                      <td className="py-4 text-center text-xs text-foreground/50">
                        <div className="flex items-center justify-center gap-1">
                          <Calendar size={12} />
                          {new Date(record.joinTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="py-4 text-right">
                        <div className="text-sm font-bold text-green-400">
                          {Math.round((record.duration || 0) / 60)}m
                        </div>
                        {(record.reconnectCount || 0) > 0 && (
                          <div className="text-[9px] text-amber-400 font-bold uppercase">{record.reconnectCount} Reconnects</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-surface-900/50 border-t border-white/5 flex gap-3">
          <button
            onClick={exportExcel}
            disabled={attendance.length === 0}
            className="flex-1 bg-primary-500 hover:bg-primary-600 disabled:opacity-30 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary-500/25 active:scale-[0.98]"
          >
            <Download size={20} />
            Export to Excel
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-surface-700 hover:bg-surface-600 text-white font-bold py-3 rounded-2xl transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
