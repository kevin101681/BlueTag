import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Report, ProjectDetails, ColorTheme, SignOffTemplate, Issue } from '../types';
import { Dashboard } from './Dashboard';
import { Plus, Search, Settings, X, Download, Upload, Trash2, Moon, Sun, Check, LogOut, Info, Image as ImageIcon, User, Book, ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react';
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
  onRefresh?: () => void;
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
    onAddIssueGlobal,
    isClientInfoCollapsed,
    onToggleClientInfo
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
                isClientInfoCollapsed={isClientInfoCollapsed}
                onToggleClientInfo={onToggleClientInfo}
            />
        </div>
    );
};

const HomeownerManualModal = ({ onClose }: { onClose: () => void }) => {
    const images = HOMEOWNER_MANUAL_IMAGES;
    const [currentPage, setCurrentPage] = useState(0);

    const goNext = () => {
        if (currentPage < images.length) {
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
        <div className="fixed inset-0 z-[300] bg-slate-900/95 backdrop-blur-xl flex flex-col items-center justify-center overflow-hidden animate-fade-in touch-none">
            
            {!hasImages && (
                 <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
                     <div className="max-w-md bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 text-white">
                         <Book size={48} className="mx-auto mb-4 opacity-50" />
                         <h3 className="text-xl font-bold mb-2">Manual Not Configured</h3>
                         <p className="text-white/70">Please add Base64 image strings to the configuration file to view the homeowner manual.</p>
                     </div>
                 </div>
            )}

            {/* Book Container */}
            {hasImages && (
                <div 
                    className="relative w-full h-full max-w-4xl max-h-[85vh] perspective-container flex items-center justify-center px-4"
                    {...swipeHandlers}
                    style={{ perspective: '2000px' }}
                    onClick={(e) => {
                         const width = e.currentTarget.clientWidth;
                         const x = e.clientX;
                         // Simple tap navigation: Right half next, Left half prev
                         if (x > window.innerWidth / 2) goNext();
                         else goPrev();
                    }}
                >
                    <div className="relative w-full h-full md:aspect-[4/3] max-w-[90vh]">
                    {images.map((img, index) => {
                        if (!img) return null;

                        // Page State Logic
                        const isFlipped = index < currentPage;
                        
                        // Z-Index Management for 3D Stacking
                        // When flipped (Left Stack): z-index follows index (0 at bottom, 1 above...)
                        // When unflipped (Right Stack): z-index is reversed (0 at top, 1 below...)
                        const zIndex = isFlipped ? index : (images.length - index);

                        return (
                            <div 
                                key={index}
                                className="absolute top-4 bottom-4 left-2 right-2 md:inset-0 origin-left"
                                style={{
                                    transformStyle: 'preserve-3d',
                                    transform: isFlipped ? 'rotateY(-180deg)' : 'rotateY(0deg)',
                                    zIndex: zIndex,
                                    // Delay z-index change when flipping forward (to keep it on top while moving)
                                    // Immediate z-index change when flipping backward (to lift it off the left stack immediately)
                                    transition: `transform 0.8s cubic-bezier(0.645, 0.045, 0.355, 1), z-index 0s ${isFlipped ? '0.4s' : '0s'}`
                                }}
                            >
                                {/* Front Face (The Image) */}
                                <div 
                                    className="absolute inset-0 bg-white shadow-xl rounded-r-md rounded-l-sm overflow-hidden flex items-center justify-center"
                                    style={{ backfaceVisibility: 'hidden' }}
                                >
                                    <img 
                                        src={img} 
                                        className="w-full h-full object-contain pointer-events-none" 
                                        alt={`Page ${index + 1}`}
                                    />
                                    {/* Inner Spine Shadow */}
                                    <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-black/20 to-transparent pointer-events-none" />
                                </div>

                                {/* Back Face (Blank / Pattern) */}
                                <div 
                                    className="absolute inset-0 bg-white shadow-xl rounded-l-md rounded-r-sm flex items-center justify-center overflow-hidden"
                                    style={{ 
                                        backfaceVisibility: 'hidden', 
                                        transform: 'rotateY(180deg)' 
                                    }}
                                >
                                    {/* Subtle Watermark on Back */}
                                    <div className="text-slate-100 font-bold text-6xl md:text-8xl select-none rotate-45 transform">
                                        BlueTag
                                    </div>
                                    {/* Spine Shadow for Back (Right Side when flipped) */}
                                    <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-black/10 to-transparent pointer-events-none" />
                                </div>
                            </div>
                        );
                    })}
                    </div>
                </div>
            )}

            {/* Close FAB (Material 3 Style) */}
            <button 
                onClick={onClose}
                className="absolute bottom-6 right-6 w-14 h-14 bg-primary-container text-on-primary-container rounded-2xl shadow-lg flex items-center justify-center hover:shadow-xl hover:scale-105 active:scale-95 transition-all z-[310]"
            >
                <X size={24} />
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
    onLogout,
    onRefresh
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
                    onRefresh={onRefresh}
                />
            </div>
        </div>,
        document.body
    );
};

const SettingsContent = ({ onClose, isDarkMode, currentTheme, onThemeChange, colorTheme, onColorThemeChange, installAvailable, onInstall, onDeleteOldReports, user, onLogin, onLogout, onRefresh }: any) => {
    const [storageInfo, setStorageInfo] = React.useState({ used: '0 Bytes', total: '0 Bytes', percentage: 0, warning: false, source: 'IndexedDB (up to GBs)' });
    const [isClearing, setIsClearing] = React.useState(false);
    
    const refreshStorageInfo = React.useCallback(async () => {
        const storageModule = await import('../services/storageService');
        const info = await storageModule.getStorageInfo();
        setStorageInfo(info);
    }, []);
    
    React.useEffect(() => {
        // Import dynamically to avoid circular dependencies
        refreshStorageInfo();
    }, [refreshStorageInfo]);
    
    const handleClearCache = async () => {
        if (!confirm('Clear all cached data? This will remove all reports but keep your settings. Make sure you have synced important reports to the cloud first.')) {
            return;
        }
        
        setIsClearing(true);
        try {
            const storageModule = await import('../services/storageService');
            await storageModule.clearAllCaches();
            await refreshStorageInfo();
            alert('Cache cleared successfully! The app will reload.');
            setTimeout(() => window.location.reload(), 500);
        } catch (error) {
            console.error('Error clearing cache', error);
            alert('Error clearing cache. Please try again.');
        } finally {
            setIsClearing(false);
        }
    };
    
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
                                <div className="flex items-center justify-center w-full">
                                    <button 
                                        onClick={() => {
                                            if (onLogin) onLogin();
                                            onClose();
                                        }}
                                        className="w-full px-4 py-3 bg-white text-slate-700 dark:bg-slate-600 dark:text-white text-sm font-bold rounded-xl shadow-sm border border-slate-200 dark:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-500 transition-all flex items-center justify-center gap-2"
                                    >
                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                        </svg>
                                        Sign in with Google
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
                </div>

                {/* App Actions */}
                <div className="space-y-3">
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Data & App</h4>
                    
                    {/* Storage Usage */}
                    <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-2xl">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Storage Usage</span>
                            <span className={`text-xs font-bold ${storageInfo.warning ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
                                {storageInfo.used} / {storageInfo.total}
                            </span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2 mb-2">
                            <div 
                                className={`h-2 rounded-full transition-all ${storageInfo.warning ? 'bg-red-500' : 'bg-primary'}`}
                                style={{ width: `${Math.min(storageInfo.percentage, 100)}%` }}
                            />
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{storageInfo.source}</p>
                        {storageInfo.warning && (
                            <p className="text-xs text-red-500 font-medium mt-1">Storage nearly full. Consider clearing cache or deleting old reports.</p>
                        )}
                    </div>
                    
                    {onRefresh && (
                        <button 
                            onClick={() => {
                                onRefresh();
                                onClose();
                            }}
                            className="w-full p-4 bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                            <RefreshCw size={20} />
                            Sync Reports
                        </button>
                    )}

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
                        onClick={async () => {
                            if (confirm("Delete all reports older than 30 days?")) {
                                onDeleteOldReports();
                                // Refresh storage info after deletion
                                setTimeout(() => refreshStorageInfo(), 500);
                            }
                        }}
                        className="w-full p-4 bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                        <Trash2 size={20} />
                        Delete Old Reports (30+ Days)
                    </button>
                    
                    <button 
                        onClick={handleClearCache}
                        disabled={isClearing}
                        className="w-full p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isClearing ? (
                            <>
                                <RefreshCw size={20} className="animate-spin" />
                                Clearing...
                            </>
                        ) : (
                            <>
                                <Trash2 size={20} />
                                Clear All Cache & Reports
                            </>
                        )}
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
            document.body.style.overflow = 'hidden';
            setTimeout(() => setIsVisible(true), 10);
        } else {
            setIsVisible(false);
            setTimeout(() => {
                setShouldRender(false);
                document.body.style.overflow = '';
            }, 300);
        }
        return () => { document.body.style.overflow = ''; };
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
        onRefresh
    } = props;

    // Lazily initialize selection to avoid empty placeholder flash on load
    const [internalSelectedId, setInternalSelectedId] = useState<string | null>(() => {
        if (reports && reports.length > 0) {
            const sorted = [...reports].sort((a, b) => b.lastModified - a.lastModified);
            return sorted[0].id;
        }
        return null;
    });

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const [isManualOpen, setIsManualOpen] = useState(false);
    const [reportViewStates, setReportViewStates] = useState<Record<string, { clientInfoCollapsed: boolean }>>({});

    // Ensure parent is synced when selection changes or on mount if we have a selection
    useEffect(() => {
        if (internalSelectedId) {
            onSelectReport(internalSelectedId);
        }
    }, [internalSelectedId, onSelectReport]);

    // Handle creation event: switch to the newly created report
    useEffect(() => {
        if (isCreating && reports.length > 0) {
            // Assuming the new report is at index 0 or we find the latest
            const latest = reports.reduce((prev, current) => (prev.lastModified > current.lastModified) ? prev : current);
            setInternalSelectedId(latest.id);
        }
    }, [isCreating, reports]);

    // Handle updates to reports list (e.g. initial load async)
    useEffect(() => {
        if (reports.length > 0 && !internalSelectedId) {
            // Default to most recent if we have none selected
            const sorted = [...reports].sort((a, b) => b.lastModified - a.lastModified);
            setInternalSelectedId(sorted[0].id);
        } else if (reports.length === 0) {
            setInternalSelectedId(null);
        }
    }, [reports, internalSelectedId]); 

    const handleLocalSelect = (id: string) => {
        setInternalSelectedId(id);
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
                        <Book size={24} />
                    </button>
                </div>
                
                {/* Center: Logo */}
                <div className="flex-1 flex justify-center">
                    <div className="bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 rounded-3xl p-1.5">
                        <img src={props.companyLogo} alt="Company Logo" className="w-14 h-14 object-contain" />
                    </div>
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
                        companyLogo={props.companyLogo}
                        signOffTemplates={props.signOffTemplates}
                        onUpdateTemplates={props.onUpdateTemplates}
                        isCreating={isCreating}
                        isExiting={isExiting}
                        onDelete={(e: React.MouseEvent, rect?: DOMRect) => props.onDeleteReport(activeReport.id, rect)}
                        onAddIssueGlobal={props.onAddIssueGlobal}
                        isClientInfoCollapsed={reportViewStates[activeReport.id]?.clientInfoCollapsed ?? false}
                        onToggleClientInfo={(collapsed: boolean) => {
                             setReportViewStates(prev => ({
                                ...prev,
                                [activeReport.id]: { ...prev[activeReport.id], clientInfoCollapsed: collapsed }
                             }));
                        }}
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
