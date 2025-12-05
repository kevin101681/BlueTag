

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Report, ProjectDetails, ColorTheme, SignOffTemplate, Issue } from '../types';
import { Dashboard } from './Dashboard';
import { Plus, Search, Settings, X, Download, Upload, Trash2, Moon, Sun, Check, LogOut, Info, Palette, Image as ImageIcon, User, BookOpen, ArrowLeft, ArrowRight } from 'lucide-react';
import { createPortal } from 'react-dom';
import { BlueTagLogo } from './Logo';
import { ReportCard } from './Dashboard';
import { HOMEOWNER_MANUAL_IMAGES } from '../constants';
import { useSwipe } from '../hooks/useSwipe';

export type ThemeOption = 'light' | 'dark' | 'system';

interface ReportListProps {
  reports: Report[];
  onCreateNew: () => void;
  onSelectReport: (id: string) => void;
  onSelectLocation: (id: string) => void;
  onDeleteReport: (id: string, rect?: DOMRect) => void;
  onDeleteOldReports: () => void;
  onUpdateReport: (report: Report) => void;
  isDarkMode: boolean;
  currentTheme: ThemeOption;
  onThemeChange: (t: ThemeOption) => void;
  colorTheme: ColorTheme;
  onColorThemeChange: (c: ColorTheme) => void;
  user: any; 
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
  onLogin?: () => void;
  onLogout?: () => void;
  deletingReportId?: string | null;
  isDeleting?: boolean;
}

// Helper to check active
const DashboardWrapper = ({ 
    activeReport, 
    onUpdateReport, 
    onSelectLocation, 
    onBack, 
    isDarkMode, 
    toggleTheme,
    companyLogo,
    signOffTemplates,
    onUpdateTemplates,
    isCreating,
    isExiting,
    onDelete,
    onAddIssueGlobal
}: any) => {
    return (
        <div className="w-full h-full">
            <Dashboard 
                project={activeReport.project}
                locations={activeReport.locations}
                onSelectLocation={onSelectLocation} 
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
                isExiting={isExiting}
                onDelete={onDelete}
            />
        </div>
    );
};

const HomeownerManualModal = ({ onClose }: { onClose: () => void }) => {
    const images = HOMEOWNER_MANUAL_IMAGES;
    const [currentPage, setCurrentPage] = useState(0);

    const goNext = () => {
        if (currentPage < images.length - 1) {
            setCurrentPage(prev => prev + 1);
        }
    };

    const goPrev = () => {
        if (currentPage > 0) {
            setCurrentPage(prev => prev - 1);
        }
    };

    const swipeHandlers = useSwipe({
        onSwipedLeft: goNext,
        onSwipedRight: goPrev
    });

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; }
    }, []);

    const hasImages = images.some(img => img.length > 0);

    return createPortal(
        <div className="fixed inset-0 z-[300] bg-slate-900 flex flex-col items-center justify-center overflow-hidden animate-fade-in touch-none">
            
            {!hasImages && (
                 <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
                     <div className="max-w-md bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 text-white">
                         <BookOpen size={48} className="mx-auto mb-4 opacity-50" />
                         <h3 className="text-xl font-bold mb-2">Manual Not Configured</h3>
                         <p className="text-white/70">Please add Base64 image strings to the configuration file to view the homeowner manual.</p>
                     </div>
                 </div>
            )}

            {/* Book Container */}
            {hasImages && (
                <div 
                    className="relative w-full h-full max-w-3xl max-h-[90vh] perspective-container flex items-center justify-center"
                    {...swipeHandlers}
                    style={{ perspective: '2000px' }}
                    onClick={(e) => {
                         const width = e.currentTarget.clientWidth;
                         const x = e.clientX;
                         if (x > width / 2) goNext();
                         else goPrev();
                    }}
                >
                    {images.map((img, index) => {
                        if (!img) return null;
                        
                        // Stack order: lower pages are behind
                        // Current and future pages are stacked normally (0 on top of 1, etc)
                        // But wait, standard stack is 0 at bottom in DOM. 
                        // Let's force Z-index: 
                        const zIndex = images.length - index;
                        
                        // Flip logic: 
                        // If index < currentPage, it has flipped (-180deg)
                        // If index === currentPage, it is flat (0deg)
                        // If index > currentPage, it is flat (0deg) and underneath
                        const isFlipped = index < currentPage;
                        
                        return (
                            <div 
                                key={index}
                                className="absolute inset-4 md:inset-10 flex items-center justify-center backface-hidden transition-transform duration-700 ease-in-out origin-left shadow-2xl"
                                style={{
                                    zIndex: isFlipped ? 0 : zIndex, // Send flipped pages to back visually if needed, though rotate handles it mostly
                                    transform: isFlipped ? 'rotateY(-130deg)' : 'rotateY(0deg)', // -130 allows seeing the previous page a bit like holding a book
                                    opacity: isFlipped ? 0 : 1, // Fade out flipped pages for cleaner "single stack" look on mobile
                                    pointerEvents: 'none',
                                    backgroundColor: 'white'
                                }}
                            >
                                <img 
                                    src={img} 
                                    className="max-w-full max-h-full object-contain shadow-md rounded-sm"
                                    alt={`Page ${index + 1}`}
                                />
                                
                                {/* Shadow overlay for depth during flip */}
                                <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent pointer-events-none" style={{ opacity: isFlipped ? 1 : 0, transition: 'opacity 0.7s' }} />
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Controls / Indicators */}
            {hasImages && (
                <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none">
                     <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full text-white/90 font-mono text-sm border border-white/10 pointer-events-auto">
                         {currentPage + 1} / {images.length}
                     </div>
                </div>
            )}

            {/* Close FAB */}
            <button 
                onClick={onClose}
                className="absolute bottom-8 right-8 w-14 h-14 bg-white text-slate-900 rounded-full shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-[310]"
            >
                <X size={28} />
            </button>
        </div>,
        document.body
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
    companyLogo,
    onUpdateLogo,
    partnerLogo,
    onUpdatePartnerLogo,
    installAvailable,
    onInstall,
    onDeleteOldReports,
    user,
    onLogin,
    onLogout
}: any) => {
    // Internal state to manage mount/unmount for exit animation
    const [isVisible, setIsVisible] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            document.body.style.overflow = 'hidden';
            setTimeout(() => setIsVisible(true), 10);
        } else {
            setIsVisible(false);
            setTimeout(() => {
                setShouldRender(false);
                document.body.style.overflow = '';
            }, 300);
        }
    }, [isOpen]);

    if (!shouldRender) return null;

    return createPortal(
        <div className={`fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
            <div className={`bg-white dark:bg-slate-800 w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] h-auto overflow-hidden rounded-[32px] transition-all duration-300 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
                <SettingsContent 
                    onClose={onClose}
                    isDarkMode={isDarkMode}
                    currentTheme={currentTheme}
                    onThemeChange={onThemeChange}
                    colorTheme={colorTheme}
                    onColorThemeChange={onColorThemeChange}
                    companyLogo={companyLogo}
                    onUpdateLogo={onUpdateLogo}
                    partnerLogo={partnerLogo}
                    onUpdatePartnerLogo={onUpdatePartnerLogo}
                    installAvailable={installAvailable}
                    onInstall={onInstall}
                    onDeleteOldReports={onDeleteOldReports}
                    user={user}
                    onLogin={onLogin}
                    onLogout={onLogout}
                />
            </div>
        </div>,
        document.body
    );
};

const SettingsContent = ({ onClose, isDarkMode, currentTheme, onThemeChange, colorTheme, onColorThemeChange, companyLogo, onUpdateLogo, partnerLogo, onUpdatePartnerLogo, installAvailable, onInstall, onDeleteOldReports, user, onLogin, onLogout }: any) => {
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const partnerFileInputRef = React.useRef<HTMLInputElement>(null);

    const THEME_COLORS = [
        '#60a5fa', // Blue (Default)
        '#f43f5e', // Rose
        '#8b5cf6', // Violet
        '#10b981', // Emerald
        '#f59e0b', // Amber
        '#64748b', // Slate
    ];

    return (
        <>
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 shrink-0">
                <div className="bg-slate-100 dark:bg-slate-700 px-4 py-2 rounded-2xl">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Settings size={20} />
                        Settings
                    </h3>
                </div>
                <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-2xl text-slate-500 hover:text-slate-800 dark:text-slate-400 transition-colors">
                    <X size={20} />
                </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-8 flex-1">
                {/* Account Section */}
                <div className="space-y-3">
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Account</h4>
                    <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-2xl">
                            {user ? (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-primary">
                                            <User size={20} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 dark:text-white text-sm">{user.user_metadata?.full_name || 'User'}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={onLogout}
                                        className="px-3 py-1.5 bg-white dark:bg-slate-600 text-red-500 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    >
                                        Sign Out
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between">
                                    <div className="text-sm text-slate-500 dark:text-slate-400">
                                        Sign in to verify account status
                                    </div>
                                    <button 
                                        onClick={() => {
                                            if (onLogin) onLogin();
                                            onClose();
                                        }}
                                        className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all"
                                    >
                                        Sign In
                                    </button>
                                </div>
                            )}
                    </div>
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
                    
                    <div className="bg-slate-50 dark:bg-slate-700/50 p-8 rounded-2xl">
                            <div className="flex items-center gap-2 mb-8 text-slate-700 dark:text-slate-300 font-medium text-sm">
                                <Palette size={16} />
                                <span>Accent Color</span>
                            </div>
                            <div className="flex justify-between items-center px-2">
                                {THEME_COLORS.map(color => (
                                    <button
                                        key={color}
                                        onClick={() => onColorThemeChange(color)}
                                        className={`w-12 h-12 rounded-full transition-all duration-300 ${colorTheme === color ? 'scale-125 ring-4 ring-offset-4 ring-slate-400 dark:ring-slate-500 shadow-xl z-10' : 'hover:scale-110 opacity-80 hover:opacity-100'}`}
                                        style={{ backgroundColor: color }}
                                        title="Set Accent Color"
                                    />
                                ))}
                            </div>
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
                        Delete Old Reports (30+ Days)
                    </button>
                </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 text-center">
                <p className="text-xs text-slate-400 font-medium">BlueTag v1.1.13</p>
            </div>
        </>
    );
}

const ReportSelectionModal = ({ 
    isOpen,
    reports, 
    onSelect, 
    onClose, 
    onDelete,
    deletingReportId,
    isDeleting 
}: { 
    isOpen: boolean,
    reports: Report[], 
    onSelect: (id: string) => void, 
    onClose: () => void, 
    onDelete: (id: string, rect?: DOMRect) => void,
    deletingReportId?: string | null,
    isDeleting?: boolean
}) => {
    const [search, setSearch] = useState("");
    const [isVisible, setIsVisible] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            setTimeout(() => setIsVisible(true), 10);
        } else {
            setIsVisible(false);
            setTimeout(() => setShouldRender(false), 300);
        }
    }, [isOpen]);

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

    if (!shouldRender) return null;

    return createPortal(
        <div className={`fixed inset-0 z-[150] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
            <div className={`bg-white dark:bg-slate-800 w-full max-w-lg rounded-[32px] shadow-2xl flex flex-col max-h-[85vh] transition-all duration-300 ${isVisible ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-8 opacity-0'}`}>
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 shrink-0 rounded-t-[32px]">
                    <div className="bg-slate-100 dark:bg-slate-700 px-4 py-2 rounded-2xl">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Search Reports</h3>
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-2xl text-slate-500 hover:text-slate-800 dark:text-slate-400 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-4 flex-1">
                    {reports.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">No reports found.</div>
                    ) : (
                        <div className="space-y-4">
                            {filteredReports.map(report => (
                                <div key={report.id} className={`${(deletingReportId === report.id && isDeleting) ? 'animate-scale-out' : 'animate-slide-up'}`}>
                                    <ReportCard 
                                        project={report.project}
                                        issueCount={report.locations.reduce((acc, l) => acc + l.issues.length, 0)}
                                        lastModified={report.lastModified}
                                        onClick={() => onSelect(report.id)}
                                        onDelete={(e, rect) => { e.stopPropagation(); onDelete(report.id, rect); }}
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
        isCreating,
        deletingReportId,
        isDeleting,
        companyLogo
    } = props;

    const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const [isManualOpen, setIsManualOpen] = useState(false);

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
        // Trigger exit animation first
        setIsExiting(true);
        setTimeout(() => {
            onCreateNew();
            setIsExiting(false);
        }, 600);
    };

    const activeReport = reports.find(r => r.id === internalSelectedId);
    // Extract client name for the header pill
    const clientName = activeReport?.project?.fields?.[0]?.value || "";

    return (
        <div className="flex flex-col min-h-screen bg-slate-200 dark:bg-slate-950">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 shrink-0 bg-transparent relative z-20">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setIsSettingsOpen(true)}
                        className="w-[54px] h-[54px] rounded-2xl bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center"
                        title="Settings"
                    >
                        <Settings size={24} />
                    </button>

                     <button 
                        onClick={() => setIsManualOpen(true)}
                        className="w-[54px] h-[54px] rounded-2xl bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-primary hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center"
                        title="Homeowner Manual"
                    >
                        <BookOpen size={24} />
                    </button>
                </div>
                
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setIsSearchOpen(true)}
                        className="w-[54px] h-[54px] rounded-2xl bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-primary hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center"
                        title="Search Reports"
                    >
                        <Search size={24} />
                    </button>
                    
                    <button 
                        onClick={handleCreate}
                        disabled={isCreating || isExiting}
                        className="w-[54px] h-[54px] rounded-2xl bg-white dark:bg-slate-800 text-primary hover:bg-primary hover:text-white transition-all shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center"
                        title="Create New Report"
                    >
                        <Plus size={24} strokeWidth={3} />
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 relative">
                {activeReport ? (
                    <DashboardWrapper 
                        activeReport={activeReport}
                        onUpdateReport={props.onUpdateReport}
                        onSelectLocation={props.onSelectLocation}
                        onBack={() => {}} // No back button in this mode
                        isDarkMode={props.isDarkMode}
                        toggleTheme={() => props.onThemeChange(props.currentTheme === 'dark' ? 'light' : 'dark')}
                        companyLogo={companyLogo}
                        signOffTemplates={props.signOffTemplates}
                        onUpdateTemplates={props.onUpdateTemplates}
                        isCreating={isCreating}
                        isExiting={isExiting}
                        onDelete={(e: React.MouseEvent, rect?: DOMRect) => props.onDeleteReport(activeReport.id, rect)}
                        onAddIssueGlobal={props.onAddIssueGlobal}
                    />
                ) : (
                    <div className="max-w-3xl mx-auto p-6 relative">
                         {/* Empty Placeholder that matches ReportCard dimensions/position */}
                        <div className="w-full bg-white/50 dark:bg-slate-900/50 rounded-[32px] p-6 border-4 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center min-h-[220px]">
                             <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-6">
                                 <Plus size={40} className="text-slate-300 dark:text-slate-600" />
                             </div>
                             <button 
                                onClick={handleCreate}
                                className="bg-white dark:bg-slate-800 px-8 py-3 rounded-full shadow-lg text-primary font-bold animate-breathing-glow border border-slate-200 dark:border-slate-700 hover:scale-105 transition-transform"
                            >
                                Create Report
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            <SettingsModal 
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                {...props}
            />
            
            <ReportSelectionModal 
                isOpen={isSearchOpen}
                reports={reports}
                onSelect={handleLocalSelect}
                onClose={() => setIsSearchOpen(false)}
                onDelete={(id, rect) => props.onDeleteReport(id, rect)}
                deletingReportId={deletingReportId}
                isDeleting={isDeleting}
            />

            {isManualOpen && (
                <HomeownerManualModal onClose={() => setIsManualOpen(false)} />
            )}
        </div>
    );
}
