
import React, { useState, useEffect, useMemo } from 'react';
import { Report, ProjectDetails, ColorTheme, SignOffTemplate, Issue } from '../types';
import { Dashboard } from './Dashboard';
import { Plus, Search, Settings, X, Download, Upload, Trash2, Moon, Sun, Check, LogOut, Info, Palette } from 'lucide-react';
import { createPortal } from 'react-dom';
import { loginWithGoogle, logoutUser } from '../services/firebase';
import { User } from 'firebase/auth';
import { BlueTagLogo } from './Logo';
import { ReportCard } from './Dashboard'; // Import shared ReportCard

export type ThemeOption = 'light' | 'dark' | 'system';

interface ReportListProps {
  reports: Report[];
  onCreateNew: () => void;
  onSelectReport: (id: string) => void;
  onDeleteReport: (id: string) => void;
  onDeleteOldReports: () => void;
  onUpdateReport: (report: Report) => void;
  isDarkMode: boolean;
  currentTheme: ThemeOption;
  onThemeChange: (t: ThemeOption) => void;
  colorTheme: ColorTheme;
  onColorThemeChange: (c: ColorTheme) => void;
  user: User | null;
  companyLogo: string;
  onUpdateLogo: (l: string) => void;
  partnerLogo: string;
  onUpdatePartnerLogo: (l: string) => void;
  installAvailable: boolean;
  onInstall: () => void;
  isIOS: boolean;
  isStandalone: boolean;
  isDashboardOpen: boolean;
  signOffTemplates: SignOffTemplate[];
  onUpdateTemplates: (t: SignOffTemplate[]) => void;
  isCreating: boolean;
  onAddIssueGlobal: (locationName: string, issue: Issue) => void;
}

// Helper to check active
const DashboardWrapper = ({ 
    activeReport, 
    onUpdateReport, 
    onBack, 
    isDarkMode, 
    toggleTheme,
    companyLogo,
    signOffTemplates,
    onUpdateTemplates,
    isCreating,
    onDelete,
    onAddIssueGlobal
}: any) => {
    return (
        <div className="w-full h-full">
            <Dashboard 
                project={activeReport.project}
                locations={activeReport.locations}
                onSelectLocation={() => {}} 
                onUpdateProject={(p: ProjectDetails) => onUpdateReport({ ...activeReport, project: p, lastModified: Date.now() })}
                onUpdateLocations={(l: any[]) => onUpdateReport({ ...activeReport, locations: l, lastModified: Date.now() })}
                onBack={onBack}
                onAddIssueGlobal={onAddIssueGlobal}
                isDarkMode={isDarkMode}
                toggleTheme={toggleTheme}
                companyLogo={companyLogo}
                onModalStateChange={() => {}}
                signOffTemplates={signOffTemplates}
                onUpdateTemplates={onUpdateTemplates}
                isCreating={isCreating}
                onDelete={onDelete}
            />
        </div>
    );
};

const SettingsModal = ({ 
    isOpen, 
    onClose, 
    isDarkMode, 
    currentTheme, 
    onThemeChange, 
    colorTheme,
    onColorThemeChange,
    user,
    companyLogo,
    onUpdateLogo,
    installAvailable,
    onInstall,
    onDeleteOldReports
}: any) => {
    if (!isOpen) return null;

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    onUpdateLogo(ev.target.result as string);
                }
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    const THEME_COLORS = [
        '#60a5fa', // Blue (Default)
        '#f43f5e', // Rose
        '#8b5cf6', // Violet
        '#10b981', // Emerald
        '#f59e0b', // Amber
        '#64748b', // Slate
    ];

    return createPortal(
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[32px] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-dialog-enter">
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 shrink-0">
                    <div className="bg-slate-100 dark:bg-slate-700 px-4 py-2 rounded-full">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <Settings size={20} />
                            Settings
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-400 transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto space-y-8 flex-1">
                    {/* User Section */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Account</h4>
                        {user ? (
                            <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-2xl flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {user.photoURL ? (
                                        <img src={user.photoURL} className="w-10 h-10 rounded-full" alt="" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">
                                            {user.email?.[0].toUpperCase()}
                                        </div>
                                    )}
                                    <div className="text-sm">
                                        <p className="font-bold text-slate-800 dark:text-white">{user.displayName || 'User'}</p>
                                        <p className="text-slate-500 dark:text-slate-400">{user.email}</p>
                                    </div>
                                </div>
                                <button onClick={() => logoutUser()} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                                    <LogOut size={20} />
                                </button>
                            </div>
                        ) : (
                            <button 
                                onClick={() => loginWithGoogle()}
                                className="w-full py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-2xl flex items-center justify-center gap-2 font-bold text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                            >
                                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="" />
                                Sign in with Google
                            </button>
                        )}
                    </div>

                    {/* Appearance */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Appearance</h4>
                        <div className="bg-slate-50 dark:bg-slate-700/50 p-2 rounded-2xl flex">
                            {(['light', 'system', 'dark'] as const).map((t) => (
                                <button
                                    key={t}
                                    onClick={() => onThemeChange(t)}
                                    className={`flex-1 py-2 rounded-xl text-sm font-bold capitalize transition-all ${currentTheme === t ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                        
                        <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-2xl">
                             <div className="flex items-center gap-2 mb-3 text-slate-700 dark:text-slate-300 font-medium text-sm">
                                 <Palette size={16} />
                                 <span>Accent Color</span>
                             </div>
                             <div className="flex justify-between items-center">
                                 {THEME_COLORS.map(color => (
                                     <button
                                         key={color}
                                         onClick={() => onColorThemeChange(color)}
                                         className={`w-8 h-8 rounded-full transition-transform ${colorTheme === color ? 'scale-125 ring-2 ring-offset-2 ring-slate-400 dark:ring-slate-500' : 'hover:scale-110'}`}
                                         style={{ backgroundColor: color }}
                                     />
                                 ))}
                             </div>
                        </div>
                    </div>

                    {/* Branding */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Company Branding</h4>
                        <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-2xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {companyLogo ? (
                                    <img src={companyLogo} className="w-12 h-12 object-contain bg-white rounded-lg p-1" alt="Logo" />
                                ) : (
                                    <div className="w-12 h-12 bg-slate-200 dark:bg-slate-600 rounded-lg flex items-center justify-center text-slate-400">
                                        <Upload size={20} />
                                    </div>
                                )}
                                <div className="text-sm">
                                    <p className="font-bold text-slate-800 dark:text-white">Report Logo</p>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs">Appears on PDFs</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="px-3 py-1.5 bg-white dark:bg-slate-600 text-slate-700 dark:text-white text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-500 transition-colors"
                            >
                                Change
                            </button>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept="image/*"
                                onChange={handleLogoUpload}
                            />
                        </div>
                    </div>

                    {/* App Actions */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Data & App</h4>
                        {installAvailable && (
                            <button 
                                onClick={onInstall}
                                className="w-full p-4 bg-primary/10 text-primary rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-primary/20 transition-colors"
                            >
                                <Download size={20} />
                                Install App
                            </button>
                        )}
                        <button 
                            onClick={() => {
                                if (confirm("Delete all reports older than 30 days?")) onDeleteOldReports();
                            }}
                            className="w-full p-4 bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                            <Trash2 size={20} />
                            Cleanup Old Reports
                        </button>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 text-center">
                    <p className="text-xs text-slate-400 font-medium">BlueTag v1.1.11</p>
                </div>
            </div>
        </div>,
        document.body
    );
};

const ReportSelectionModal = ({ reports, onSelect, onClose }: { reports: Report[], onSelect: (id: string) => void, onClose: () => void }) => {
    const [search, setSearch] = useState("");
    
    // Most recent 5 reports for initial view
    const recentReports = useMemo(() => {
        return [...reports].sort((a, b) => b.lastModified - a.lastModified).slice(0, 5);
    }, [reports]);

    const filteredReports = useMemo(() => {
        if (!search.trim()) return recentReports;
        return reports.filter(r => {
            const clientName = r.project.fields?.find(f => f.label.includes("Name"))?.value || "";
            const lot = r.project.fields?.find(f => f.label.includes("Lot"))?.value || "";
            const addr = r.project.fields?.find(f => f.label.includes("Address"))?.value || "";
            const term = search.toLowerCase();
            return clientName.toLowerCase().includes(term) || lot.toLowerCase().includes(term) || addr.toLowerCase().includes(term);
        }).sort((a, b) => b.lastModified - a.lastModified);
    }, [reports, search, recentReports]);

    return createPortal(
        <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-[32px] shadow-2xl flex flex-col max-h-[85vh] animate-dialog-enter">
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 shrink-0 rounded-t-[32px]">
                    <div className="bg-slate-100 dark:bg-slate-700 px-4 py-2 rounded-full">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Search Reports</h3>
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-400 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-4 flex-1">
                    {reports.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">No reports found.</div>
                    ) : (
                        <div className="space-y-4">
                            {filteredReports.map(report => (
                                <div key={report.id} className="animate-slide-up">
                                    <ReportCard 
                                        project={report.project}
                                        issueCount={report.locations.reduce((acc, l) => acc + l.issues.length, 0)}
                                        lastModified={report.lastModified}
                                        onClick={() => onSelect(report.id)}
                                        readOnly={false} // Interactive
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-5 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0 rounded-b-[32px]">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input 
                            type="text" 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search for older reports..."
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full py-3 pl-12 pr-4 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export const ReportList: React.FC<ReportListProps> = (props) => {
    const { 
        reports, 
        onCreateNew, 
        onSelectReport, 
        isCreating
    } = props;

    const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // Effect: If `isCreating` becomes true, we should probably select the newest report
    useEffect(() => {
        if (isCreating && reports.length > 0) {
            // Assuming the new report is at index 0 or we find the latest
            const latest = reports.reduce((prev, current) => (prev.lastModified > current.lastModified) ? prev : current);
            setInternalSelectedId(latest.id);
            onSelectReport(latest.id); // Sync with parent
        }
    }, [isCreating, reports, onSelectReport]);

    useEffect(() => {
        if (reports.length > 0 && !internalSelectedId) {
            // Default to most recent
            const sorted = [...reports].sort((a, b) => b.lastModified - a.lastModified);
            setInternalSelectedId(sorted[0].id);
            onSelectReport(sorted[0].id);
        } else if (reports.length === 0) {
            setInternalSelectedId(null);
        }
    }, [reports.length]); 

    const handleLocalSelect = (id: string) => {
        setInternalSelectedId(id);
        onSelectReport(id);
        setIsSearchOpen(false);
    };

    const handleCreate = () => {
        onCreateNew();
    };

    const activeReport = reports.find(r => r.id === internalSelectedId);

    return (
        <div className="flex flex-col h-full bg-slate-200 dark:bg-slate-950">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 shrink-0 bg-transparent relative z-20">
                <BlueTagLogo size="md" className="drop-shadow-sm" />
                
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setIsSearchOpen(true)}
                        className="w-12 h-12 rounded-full bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-primary hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center"
                    >
                        <Search size={24} />
                    </button>
                    
                    <button 
                        onClick={handleCreate}
                        className={`w-12 h-12 rounded-full bg-white dark:bg-slate-800 text-primary hover:bg-primary hover:text-white transition-all shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center ${isCreating ? 'animate-pulse' : 'animate-breathing-glow'}`}
                    >
                        <Plus size={24} strokeWidth={3} />
                    </button>
                    
                    <button 
                        onClick={() => setIsSettingsOpen(true)}
                        className="w-12 h-12 rounded-full bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center"
                    >
                        <Settings size={24} />
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 relative">
                {activeReport ? (
                    <DashboardWrapper 
                        activeReport={activeReport}
                        onUpdateReport={props.onUpdateReport}
                        onBack={() => {}} // No back button in this mode
                        isDarkMode={props.isDarkMode}
                        toggleTheme={() => props.onThemeChange(props.currentTheme === 'dark' ? 'light' : 'dark')}
                        companyLogo={props.companyLogo}
                        signOffTemplates={props.signOffTemplates}
                        onUpdateTemplates={props.onUpdateTemplates}
                        isCreating={isCreating}
                        onDelete={() => props.onDeleteReport(activeReport.id)}
                        onAddIssueGlobal={props.onAddIssueGlobal}
                    />
                ) : (
                    <div className="absolute inset-4 sm:inset-6 border-4 border-dashed border-slate-200 dark:border-slate-800 rounded-[32px] flex flex-col items-center justify-center p-8 text-center">
                         <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-6">
                             <Plus size={48} className="text-slate-300 dark:text-slate-600" />
                         </div>
                         <h2 className="text-2xl font-bold text-slate-400 dark:text-slate-500 mb-2">No Reports Yet</h2>
                         <p className="text-slate-400 dark:text-slate-500 max-w-xs mx-auto mb-8">Tap the + button above to create your first inspection report.</p>
                         <button 
                            onClick={handleCreate}
                            className="bg-white dark:bg-slate-800 px-8 py-3 rounded-full shadow-lg text-primary font-bold animate-breathing-glow border border-slate-200 dark:border-slate-700"
                        >
                            Create Report
                        </button>
                    </div>
                )}
            </div>

            {/* Modals */}
            <SettingsModal 
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                {...props}
            />
            
            {isSearchOpen && (
                <ReportSelectionModal 
                    reports={reports}
                    onSelect={handleLocalSelect}
                    onClose={() => setIsSearchOpen(false)}
                />
            )}
        </div>
    );
}
