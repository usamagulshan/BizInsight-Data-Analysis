import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  BarChart3, 
  FileText, 
  History, 
  Download, 
  Trash2, 
  Plus, 
  Briefcase,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Printer,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { cn, formatCurrency, formatDate } from '@/src/lib/utils';
import { analyzeBusinessData, type AnalysisResult } from '@/src/services/geminiService';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type View = 'upload' | 'dashboard' | 'history';

interface SavedReport {
  id: number;
  businessName: string;
  reportName: string;
  analysisType: string;
  insights: string;
  createdAt: string;
}

export default function App() {
  const [view, setView] = useState<View>('upload');
  const [businessName, setBusinessName] = useState('My Business');
  const [analysisType, setAnalysisType] = useState('restaurant');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [history, setHistory] = useState<SavedReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/reports');
      const reports = await res.json();
      setHistory(reports);
    } catch (err) {
      console.error('Fetch history failed', err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) setFile(selectedFile);
  };

  const startAnalysis = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadRes.json();
      
      if (uploadData.error) throw new Error(uploadData.error);
      
      setData(uploadData.data);
      const result = await analyzeBusinessData(uploadData.data, analysisType);
      setAnalysis(result);
      setView('dashboard');

      // Auto save to history
      await fetch('/api/save-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          reportName: file.name,
          analysisType,
          data: uploadData.data,
          insights: JSON.stringify(result)
        })
      });
      fetchHistory();
    } catch (err) {
      console.error('Analysis failed', err);
      alert('Failed to analyze data. Please check the file format.');
    } finally {
      setLoading(false);
    }
  };

  const loadReport = async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/${id}`);
      const report = await res.json();
      setAnalysis(JSON.parse(report.insights));
      setData(report.data);
      setBusinessName(report.businessName);
      setAnalysisType(report.analysisType);
      setView('dashboard');
    } catch (err) {
      console.error('Load report failed', err);
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = async () => {
    if (!reportRef.current) return;
    setLoading(true);
    try {
      const canvas = await html2canvas(reportRef.current);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${businessName}_Analysis.pdf`);
    } catch (err) {
      console.error('PDF export failed', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg text-slate-900 font-sans">
      {/* Sidebar Navigation */}
      <aside className="fixed left-0 top-0 bottom-0 w-[260px] bg-brand-sidebar p-6 z-20 flex flex-col gap-6 text-slate-300">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 bg-blue-500 rounded flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
            BI
          </div>
          <span className="font-bold text-xl tracking-tight text-white">InsightPro</span>
        </div>

        <div className="px-2">
           <div 
            className={cn(
              "relative border-2 border-dashed rounded-lg p-4 transition-all text-center group cursor-pointer",
              file ? "border-blue-500 bg-brand-sidebar-accent" : "border-slate-600 hover:border-slate-400 bg-brand-sidebar-accent"
            )}
          >
            <input 
              type="file" 
              accept=".csv,.xlsx" 
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Upload size={20} className="mx-auto mb-2 text-slate-400 group-hover:text-blue-400" />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-slate-300">
              {file ? file.name : "Drag & Drop CSV"}
            </p>
          </div>
        </div>

        <nav className="space-y-1">
          <NavItem 
            icon={<Upload size={18} />} 
            label="Analysis Source" 
            active={view === 'upload'} 
            onClick={() => setView('upload')} 
          />
          <NavItem 
            icon={<BarChart3 size={18} />} 
            label="Intelligence Hub" 
            active={view === 'dashboard'} 
            onClick={() => analysis ? setView('dashboard') : setView('upload')} 
          />
          <NavItem 
            icon={<History size={18} />} 
            label="Saved Reports" 
            active={view === 'history'} 
            onClick={() => setView('history')} 
          />
        </nav>

        <div className="mt-auto pt-10">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4 px-2">Sample Data</div>
          <div className="space-y-1">
            <SampleDownload type="restaurant" label="Restaurant Sales" />
            <SampleDownload type="retail" label="Retail Inventory" />
            <SampleDownload type="service" label="Service Billing" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-[260px] p-6 max-w-[1400px]">
        <AnimatePresence mode="wait">
          {view === 'upload' && (
            <motion.div 
              key="upload"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-3xl"
            >
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900 mb-1">Business Setup</h1>
                <p className="text-sm text-slate-500 italic">Configure your business parameters for high-precision modeling.</p>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 space-y-6">
                  <div className="space-y-4">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Entity Information</label>
                    <div className="grid grid-cols-2 gap-4">
                      <input 
                        type="text" 
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded p-3 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                        placeholder="Business Name"
                      />
                      <select 
                        value={analysisType}
                        onChange={(e) => setAnalysisType(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded p-3 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/10 outline-none"
                      >
                        <option value="restaurant">Restaurant / F&B</option>
                        <option value="retail">Retail Store</option>
                        <option value="service">Service Provider</option>
                        <option value="other">Other Small Biz</option>
                      </select>
                    </div>
                  </div>

                  <div className="bg-blue-50/50 rounded-lg p-6 border border-blue-100 flex items-start gap-4">
                    <div className="w-10 h-10 bg-white rounded shadow-sm flex items-center justify-center text-blue-600 shrink-0">
                      <Briefcase size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Ready for Intelligence</h4>
                      <p className="text-xs text-slate-500 mt-1">Our AI will automatically scrub duplicates and normalize date formats for {analysisType === 'restaurant' ? 'table turnover and menu yields' : 'inventory or billable cycles'}.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 px-6 py-4 flex justify-end">
                  <button 
                    onClick={startAnalysis}
                    disabled={!file || loading}
                    className="h-10 px-6 rounded bg-blue-600 text-white text-sm font-bold flex items-center gap-2 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all"
                  >
                    {loading ? <Loader2 className="animate-spin" size={16} /> : <BarChart3 size={16} />}
                    Generate Strategy Report
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'dashboard' && analysis && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
              ref={reportRef}
            >
              <header className="flex justify-between items-center bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center">
                    <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%2364748b' d='M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'/%3E%3C/svg%3E" className="w-6 h-6 opacity-60" alt="Logo" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-slate-800 uppercase tracking-tight leading-none">{businessName}</h1>
                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Executive Strategy Dashboard</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                   <div className="flex gap-2">
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-1 rounded">LIVE ANALYSIS</span>
                    <span className="text-[10px] text-slate-400 font-bold py-1 tracking-widest">{formatDate(new Date().toISOString()).toUpperCase()}</span>
                  </div>
                  <div className="w-px h-6 bg-slate-200 mx-1" />
                  <button 
                    onClick={exportPDF}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all"
                  >
                    <Download size={14} />
                    PDF Report
                  </button>
                </div>
              </header>

              {/* KPIs Grid */}
              <div className="grid grid-cols-4 gap-4">
                {analysis.keyMetrics?.slice(0, 4).map((kpi, idx) => (
                  <div 
                    key={idx} 
                    className={cn(
                      "bg-white p-4 rounded-lg border border-slate-200 shadow-sm border-l-4",
                      idx === 0 ? "border-l-blue-500" : 
                      idx === 1 ? "border-l-rose-500" :
                      idx === 2 ? "border-l-amber-500" : "border-l-emerald-500"
                    )}
                  >
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{kpi.label}</div>
                    <div className="text-xl font-bold text-slate-800 tracking-tight">{kpi.value}</div>
                    {kpi.trend && (
                      <div className={cn(
                        "text-[10px] font-bold mt-1",
                        kpi.trend === 'up' ? "text-emerald-600" : "text-rose-600"
                      )}>
                        {kpi.trend === 'up' ? '+' : '-'} {kpi.trendValue} MoM
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Charts & Analytics */}
              <div className="grid grid-cols-2 gap-4">
                {analysis.suggestedCharts?.slice(0, 2).map((chart, idx) => (
                  <div key={idx} className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col h-[380px]">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">{chart.title}</h3>
                    <div className="flex-1 min-h-0">
                      <ResponsiveContainer width="100%" height="100%">
                        {chart.type === 'line' ? (
                          <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey={chart.xAxis} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} />
                            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px' }} />
                            <Line type="monotone" dataKey={chart.yAxis} stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} />
                          </LineChart>
                        ) : (
                          <BarChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey={chart.xAxis} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} />
                            <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px' }} />
                            <Bar dataKey={chart.yAxis} fill="#3b82f6" radius={[2, 2, 0, 0]} />
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </div>
                ))}
              </div>

              {/* Insights Section */}
              <div className="grid grid-cols-2 gap-4">
                <div className="card bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Strategic Overview</h3>
                  <div className="flex-1 leading-relaxed text-sm text-slate-600 italic border-l-2 border-blue-100 pl-4 py-1">
                    {analysis.summary}
                  </div>
                </div>

                <div className="bg-slate-900 p-6 rounded-lg shadow-xl shadow-slate-900/10 flex flex-col">
                  <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <TrendingUp size={14} />
                    High-Impact Recommendations
                  </h3>
                  <ul className="space-y-3">
                    {analysis.recommendations?.slice(0, 3).map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                        <span className="text-blue-500 shrink-0">•</span>
                        <span className="leading-tight"><strong className="text-white font-bold">{rec.split(':')[0]}</strong>{rec.includes(':') ? ':' + rec.split(':')[1] : rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Top/Bottom Metrics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Leaderboard</h3>
                  <div className="space-y-2">
                    {analysis.topPerformers?.slice(0, 3).map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50 last:border-0">
                        <span className="font-semibold text-slate-700">{item.name}</span>
                        <span className="text-emerald-600 font-bold">{typeof item.value === 'number' ? formatCurrency(item.value) : item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm border-l-4 border-l-rose-500">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Underperformers</h3>
                  <div className="space-y-2">
                    {analysis.bottomPerformers?.slice(0, 3).map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50 last:border-0">
                        <span className="font-semibold text-slate-700">{item.name}</span>
                        <span className="text-rose-600 font-bold">{typeof item.value === 'number' ? formatCurrency(item.value) : item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                     onClick={() => setView('upload')}
                     className="flex-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 flex flex-col items-center justify-center gap-2 shadow-sm hover:bg-slate-50 transition-all"
                  >
                    <Plus size={18} />
                    <span>New Audit</span>
                  </button>
                  <button 
                     className="flex-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 flex flex-col items-center justify-center gap-2 shadow-sm hover:bg-slate-50 transition-all"
                     onClick={exportPDF}
                  >
                    <Printer size={18} />
                    <span>Print PDF</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'history' && (
            <motion.div 
               key="history"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {history.map((report) => (
                <div 
                  key={report.id} 
                  className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col"
                  onClick={() => loadReport(report.id)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 bg-slate-50 rounded flex items-center justify-center text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                      <FileText size={20} />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-1 bg-slate-100 text-slate-500 rounded uppercase tracking-widest">
                       {report.analysisType}
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-slate-900 mb-1">{report.reportName}</h3>
                  <p className="text-slate-400 text-xs mb-4">{report.businessName}</p>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-50 mt-auto">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatDate(report.createdAt)}</span>
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-600 transition-colors" />
                  </div>
                </div>
              ))}
              {history.length === 0 && (
                <div className="col-span-full py-20 text-center text-slate-400">
                   No reports saved yet. Upload a file to generate your first report.
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Global Loader Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
          <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
          <p className="text-indigo-950 font-bold text-lg tracking-tight">Processing Business Intelligence...</p>
          <p className="text-slate-500 text-sm mt-2">Gemini AI is analyzing your data trends</p>
        </div>
      )}
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all text-left group",
        active 
          ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-500/10" 
          : "text-slate-400 hover:bg-brand-sidebar-accent hover:text-white"
      )}
    >
      <span className={cn(active ? "text-white" : "text-slate-500 group-hover:text-blue-400")}>{icon}</span>
      <span className="text-sm">{label}</span>
      {active && <motion.div layoutId="activeNav" className="ml-auto w-1 h-4 rounded-full bg-white/40" />}
    </button>
  );
}

function SampleDownload({ type, label }: { type: string, label: string }) {
  return (
    <a 
      href={`/api/sample-csv/${type}`} 
      download
      className="flex items-center justify-between px-3 py-2 text-[11px] font-bold text-slate-500 hover:text-blue-400 hover:bg-brand-sidebar-accent rounded transition-colors group uppercase tracking-widest"
      onClick={(e) => e.stopPropagation()}
    >
      <span>{label}</span>
      <Download size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
    </a>
  );
}
