import React, { useState, useEffect, useRef, useMemo, useLayoutEffect, useCallback } from 'react';
import { Report, ColorTheme, ProjectDetails, LocationGroup, Issue, SignOffTemplate } from '../types';
import { FileText, Trash2, Calendar, MapPin, Settings, Sun, Moon, Monitor, Download, User as UserIcon, LogOut, Image as ImageIcon, X, ChevronRight, ChevronUp, Palette, Check, Plus, ChevronLeft, PenTool, Share2, Mail, Send, Copy, Phone, Hash, Briefcase, Layers } from 'lucide-react';
import { User } from 'firebase/auth';
import { loginWithGoogle, logoutUser } from '../services/firebase';
import { BlueTagLogo } from './Logo';
import { createPortal } from 'react-dom';
import { Dashboard } from './Dashboard';
import { LocationDetail } from './LocationDetail';
import { generateUUID } from '../constants';
import { generateSignOffPDF, SIGN_OFF_TITLE, generatePDFWithMetadata } from '../services/pdfService';

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
  onThemeChange: (theme: ThemeOption) => void;
  colorTheme: ColorTheme;
  onColorThemeChange: (theme: ColorTheme) => void;
  companyLogo?: string;
  onUpdateLogo: (logo: string) => void;
  partnerLogo?: string;
  onUpdatePartnerLogo: (logo: string) => void;
  user: User | null;
  installAvailable?: boolean;
  onInstall?: () => void;
  isIOS?: boolean;
  isStandalone?: boolean;
  isDashboardOpen?: boolean;
  hideLogo?: boolean;
  signOffTemplates: SignOffTemplate[];
  onUpdateTemplates: (templates: SignOffTemplate[]) => void;
  isCreating?: boolean;
}

interface SettingsModalProps {
    onClose: () => void;
    currentTheme: ThemeOption;
    onThemeChange: (theme: ThemeOption) => void;
    colorTheme: ColorTheme;
    onColorThemeChange: (theme: ColorTheme) => void;
    user: User | null;
    onLogin: () => void;
    currentLogo?: string;
    onUpdateLogo: (logo: string) => void;
    currentPartnerLogo?: string;
    onUpdatePartnerLogo: (logo: string) => void;
    installAvailable?: boolean;
    onInstall?: () => void;
    isIOS?: boolean;
    isStandalone?: boolean;
}

// --- Hook for Desktop Detection ---
const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    // Check if the primary pointer is 'fine' (mouse, trackpad) rather than 'coarse' (touch)
    // Also consider screen width for layout decisions
    const checkDesktop = () => {
        const isFinePointer = window.matchMedia('(pointer: fine)').matches;
        const isWideScreen = window.innerWidth >= 768; // md breakpoint
        setIsDesktop(isFinePointer || isWideScreen);
    };
    
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);
  return isDesktop;
};

// --- Color Conversion Helpers ---
const hexToHsl = (hex: string) => {
  let r = 0, g = 0, b = 0;
  // Remove # if present
  hex = hex.replace('#', '');
  
  if (hex.length === 3) {
    r = parseInt("0x" + hex[0] + hex[0]);
    g = parseInt("0x" + hex[1] + hex[1]);
    b = parseInt("0x" + hex[2] + hex[2]);
  } else if (hex.length === 6) {
    r = parseInt("0x" + hex.substring(0, 2));
    g = parseInt("0x" + hex.substring(2, 4));
    b = parseInt("0x" + hex.substring(4, 6));
  }
  
  r /= 255;
  g /= 255;
  b /= 255;
  const cmin = Math.min(r,g,b), cmax = Math.max(r,g,b), delta = cmax - cmin;
  let h = 0, s = 0, l = 0;

  if (delta === 0) h = 0;
  else if (cmax === r) h = ((g - b) / delta) % 6;
  else if (cmax === g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;

  h = Math.round(h * 60);
  if (h < 0) h += 360;

  l = (cmax + cmin) / 2;
  s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  
  s = +(s * 100).toFixed(1);
  l = +(l * 100).toFixed(1);

  return { h, s, l };
};

const hslToHex = (h: number, s: number, l: number) => {
  s /= 100;
  l /= 100;

  let c = (1 - Math.abs(2 * l - 1)) * s,
      x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
      m = l - c / 2,
      r = 0,
      g = 0,
      b = 0;

  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x;
  }
  
  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  const toHex = (n: number) => {
    const hex = n.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return "#" + toHex(r) + toHex(g) + toHex(b);
};

// --- Custom Material 3 Color Picker Modal ---
const ColorPickerModal = ({ initialColor, onChange, onClose }: { initialColor: string, onChange: (c: string) => void, onClose: () => void }) => {
    const [hsl, setHsl] = useState(hexToHsl(initialColor));
    const [hex, setHex] = useState(initialColor);

    useEffect(() => {
        setHex(hslToHex(hsl.h, hsl.s, hsl.l));
    }, [hsl]);

    const handleHChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const h = parseInt(e.target.value);
        setHsl(prev => ({ ...prev, h }));
        onChange(hslToHex(h, hsl.s, hsl.l));
    };

    const handleSChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const s = parseInt(e.target.value);
        setHsl(prev => ({ ...prev, s }));
        onChange(hslToHex(hsl.h, s, hsl.l));
    };

    const handleLChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const l = parseInt(e.target.value);
        setHsl(prev => ({ ...prev, l }));
        onChange(hslToHex(hsl.h, hsl.s, l));
    };

    return (
        <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <style>{`
                input[type=range] {
                    -webkit-appearance: none;
                    appearance: none;
                    background: transparent;
                    cursor: pointer;
                }
                input[type=range]::-webkit-slider-runnable-track {
                    height: 28px;
                    border-radius: 999px;
                }
                input[type=range]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    height: 36px;
                    width: 36px;
                    border-radius: 50%;
                    background: white;
                    border: 1px solid rgba(0,0,0,0.1);
                    box-shadow: 0 4px 6px rgba(0,0,0,0.2);
                    margin-top: -4px; /* Center thumb on 28px track */
                    transform: scale(1);
                    transition: transform 0.1s;
                }
                input[type=range]:active::-webkit-slider-thumb {
                    transform: scale(1.1);
                }
                input[type=range]::-moz-range-thumb {
                    height: 36px;
                    width: 36px;
                    border-radius: 50%;
                    background: white;
                    border: 1px solid rgba(0,0,0,0.1);
                    box-shadow: 0 4px 6px rgba(0,0,0,0.2);
                }
            `}</style>
            
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[32px] shadow-2xl p-6 border border-white/20 ring-1 ring-black/5 dark:ring-white/10 flex flex-col animate-dialog-enter">
                 {/* Header */}
                 <div className="flex justify-between items-center mb-6">
                     <h3 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">Select Color</h3>
                     <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                         <X size={24} className="text-slate-500 dark:text-slate-400" />
                     </button>
                 </div>

                 {/* Preview Card */}
                 <div className="h-32 w-full rounded-[24px] mb-8 shadow-inner border border-slate-100 dark:border-slate-800 relative overflow-hidden group">
                     <div className="absolute inset-0 transition-colors duration-200" style={{ backgroundColor: hex }} />
                     
                     <div className="absolute inset-0 flex items-center justify-center">
                         <div className="bg-white/20 backdrop-blur-md px-5 py-2.5 rounded-full shadow-lg border border-white/30 flex items-center gap-2">
                             <div className="w-4 h-4 rounded-full bg-white" />
                             <span className="font-mono font-bold text-xl text-white drop-shadow-sm uppercase tracking-wider">
                                 {hex}
                             </span>
                         </div>
                     </div>
                 </div>

                 {/* Sliders */}
                 <div className="space-y-8 mb-4">
                     {/* Hue Slider */}
                     <div className="space-y-3">
                         <div className="flex justify-between items-center px-1">
                             <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Hue</label>
                             <span className="text-xs font-mono text-slate-400">{hsl.h}°</span>
                         </div>
                         <div className="relative h-7 w-full rounded-full ring-1 ring-black/5 overflow-hidden">
                             <input 
                                 type="range" 
                                 min="0" max="360" 
                                 value={hsl.h} 
                                 onChange={handleHChange}
                                 className="absolute inset-0 w-full z-10 opacity-0 cursor-pointer" // Invisible overlay for interaction area logic
                             />
                             {/* Visible custom stylized input */}
                             <input 
                                 type="range" 
                                 min="0" max="360" 
                                 value={hsl.h} 
                                 onChange={handleHChange}
                                 className="w-full relative z-20"
                                 style={{ 
                                     background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)' 
                                 }}
                             />
                         </div>
                     </div>
                     
                     {/* Saturation Slider */}
                     <div className="space-y-3">
                         <div className="flex justify-between items-center px-1">
                             <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Saturation</label>
                             <span className="text-xs font-mono text-slate-400">{hsl.s}%</span>
                         </div>
                         <input 
                            type="range"
                            min="0" max="100"
                            value={hsl.s}
                            onChange={handleSChange}
                            className="w-full rounded-full ring-1 ring-black/5"
                            style={{ 
                                background: `linear-gradient(to right, ${hslToHex(hsl.h, 0, hsl.l)}, ${hslToHex(hsl.h, 100, hsl.l)})` 
                            }} 
                         />
                     </div>

                     {/* Lightness Slider */}
                     <div className="space-y-3">
                        <div className="flex justify-between items-center px-1">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Lightness</label>
                            <span className="text-xs font-mono text-slate-400">{hsl.l}%</span>
                         </div>
                        <input 
                            type="range"
                            min="0" max="100"
                            value={hsl.l}
                            onChange={handleLChange}
                            className="w-full rounded-full ring-1 ring-black/5"
                            style={{ 
                                background: `linear-gradient(to right, black, ${hslToHex(hsl.h, hsl.s, 50)}, white)` 
                            }} 
                         />
                     </div>
                 </div>

                 {/* Action */}
                 <button 
                     onClick={onClose}
                     className="w-full mt-6 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-[20px] font-bold text-lg hover:scale-[1.02] active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2"
                 >
                     <Check size={20} strokeWidth={3} />
                     Apply Color
                 </button>
            </div>
        </div>
    );
};

// --- Image Viewer Modal ---
const ImageViewerModal = ({ url, title, onClose }: { url: string, title: string, onClose: () => void }) => (
    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
        <div className="relative w-full max-w-4xl h-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 shrink-0">
                <h3 className="font-bold text-lg text-white">{title}</h3>
                <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 text-white transition-colors">
                    <X size={20} />
                </button>
            </div>
            <div className="flex-1 flex items-center justify-center overflow-hidden rounded-2xl bg-black/50 border border-white/10">
                <img src={url} alt={title} className="max-w-full max-h-full object-contain" />
            </div>
        </div>
    </div>
);

// --- Email Options Modal ---
interface EmailMenuModalProps {
    report: Report;
    onClose: () => void;
    onEmailAll: (report: Report) => void;
    onEmailReport: (report: Report) => void;
    onEmailSignOff: (report: Report) => void;
}

const EmailMenuModal: React.FC<EmailMenuModalProps> = ({ 
    report, 
    onClose, 
    onEmailAll, 
    onEmailReport, 
    onEmailSignOff 
}) => {
    const hasReport = !!report.project.reportPreviewImage;
    const hasSignOff = !!report.project.signOffImage;

    return (
        <div 
            className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in" 
            onClick={(e) => { e.stopPropagation(); onClose(); }}
        >
            <div 
                className="bg-white dark:bg-slate-800 w-[95%] max-w-sm rounded-[24px] shadow-2xl p-5 border border-white/10 ring-1 ring-black/5 dark:ring-white/10 flex flex-col animate-dialog-enter max-h-[95%] overflow-y-auto" 
                onClick={e => e.stopPropagation()}
            >
                 <div className="flex justify-between items-center mb-5 shrink-0">
                     <div className="flex items-center gap-3">
                         <div className="bg-primary/10 dark:bg-blue-900/30 p-2 rounded-full text-primary dark:text-blue-400">
                            <Mail size={20} />
                         </div>
                         <h3 className="text-lg font-bold text-slate-800 dark:text-white">Email Docs</h3>
                     </div>
                     <button onClick={onClose} className="p-1.5 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                         <X size={18} className="text-slate-500 dark:text-slate-400" />
                     </button>
                 </div>
                 
                 <div className="space-y-3">
                     {/* Option 1: Email Report & Sign Off */}
                     {hasReport && hasSignOff && (
                        <button
                            onClick={() => { onEmailAll(report); onClose(); }}
                            className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-3.5 rounded-[16px] font-bold flex items-center justify-between shadow-md hover:shadow-lg hover:scale-[1.02] transition-all active:scale-95 group"
                        >
                            <span className="flex items-center gap-3 text-sm">
                                <Copy size={16} />
                                Report & Sign Off
                            </span>
                            <ChevronRight size={16} className="opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                        </button>
                     )}

                     {/* Option 2: Email Report Only */}
                     <button
                        onClick={() => { onEmailReport(report); onClose(); }}
                        disabled={!hasReport}
                        className="w-full bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-white p-3.5 rounded-[16px] font-bold flex items-center justify-between border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                     >
                        <span className="flex items-center gap-3 text-sm">
                            <FileText size={16} />
                            Report Only
                        </span>
                        {!hasReport ? (
                            <span className="text-[10px] text-slate-400 font-normal italic">N/A</span>
                        ) : (
                            <ChevronRight size={16} className="opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                        )}
                     </button>

                     {/* Option 3: Email Sign Off Only */}
                     <button
                        onClick={() => { onEmailSignOff(report); onClose(); }}
                        disabled={!hasSignOff}
                        className="w-full bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-white p-3.5 rounded-[16px] font-bold flex items-center justify-between border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                     >
                        <span className="flex items-center gap-3 text-sm">
                            <PenTool size={16} />
                            Sign Off Only
                        </span>
                        {!hasSignOff ? (
                            <span className="text-[10px] text-slate-400 font-normal italic">N/A</span>
                        ) : (
                            <ChevronRight size={16} className="opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                        )}
                     </button>
                 </div>
            </div>
        </div>
    );
};

interface SettingsModalProps {
    onClose: () => void;
    currentTheme: ThemeOption;
    onThemeChange: (theme: ThemeOption) => void;
    colorTheme: ColorTheme;
    onColorThemeChange: (theme: ColorTheme) => void;
    user: User | null;
    onLogin: () => void;
    currentLogo?: string;
    onUpdateLogo: (logo: string) => void;
    currentPartnerLogo?: string;
    onUpdatePartnerLogo: (logo: string) => void;
    installAvailable?: boolean;
    onInstall?: () => void;
    isIOS?: boolean;
    isStandalone?: boolean;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
    onClose, 
    currentTheme,
    onThemeChange,
    colorTheme,
    onColorThemeChange,
    user,
    onLogin,
    currentLogo,
    onUpdateLogo,
    currentPartnerLogo,
    onUpdatePartnerLogo,
    installAvailable,
    onInstall,
    isIOS,
    isStandalone
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const partnerFileInputRef = useRef<HTMLInputElement>(null);
    const [logoError, setLogoError] = useState(false);
    const [partnerLogoError, setPartnerLogoError] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    useEffect(() => {
        setLogoError(false);
    }, [currentLogo]);

    useEffect(() => {
        setPartnerLogoError(false);
    }, [currentPartnerLogo]);

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                onUpdateLogo(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handlePartnerLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                onUpdatePartnerLogo(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleInstallClick = () => {
        if (installAvailable && onInstall) {
            onInstall();
        }
    };

    const colors = [
        { label: 'Ocean', color: '#60a5fa' },
        { label: 'Forest', color: '#4ade80' },
        { label: 'Royal', color: '#a78bfa' },
        { label: 'Sunset', color: '#fb923c' },
        { label: 'Rose', color: '#fb7185' },
    ];

    const isCustomColor = !colors.some(c => c.color.toLowerCase() === colorTheme.toLowerCase());

    return createPortal(
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex justify-end items-end p-4 animate-fade-in">
             <div className="bg-white dark:bg-slate-800 rounded-[24px] w-full max-w-md shadow-2xl border border-white/20 ring-1 ring-black/5 dark:ring-white/10 overflow-hidden max-h-[90vh] flex flex-col animate-dialog-enter origin-bottom-right">
                 <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 shrink-0 z-10">
                    <div className="bg-slate-100 dark:bg-slate-700 px-4 py-2 rounded-full flex items-center gap-2">
                        <Settings size={20} className="text-slate-500 dark:text-slate-300" />
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">
                            Settings
                        </h3>
                    </div>
                 </div>
                 
                 <div className="p-6 space-y-8 overflow-y-auto flex-1">
                     
                     {!isStandalone && installAvailable && (
                        <div>
                            <button
                                onClick={handleInstallClick}
                                className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-4 rounded-[20px] font-bold flex items-center justify-center gap-3 shadow-md hover:shadow-lg transition-all active:scale-95"
                            >
                                <Download size={20} />
                                <span>Install App</span>
                            </button>
                        </div>
                     )}

                     <div>
                         <label className="inline-block bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3">Account</label>
                         {user ? (
                             <div className="bg-primary-container/30 dark:bg-blue-900/20 p-4 rounded-xl flex items-center justify-between border border-primary-container dark:border-blue-900/50">
                                 <div className="flex items-center gap-3">
                                     {user.photoURL ? (
                                         <img src={user.photoURL} alt="User" className="w-10 h-10 rounded-full border border-white/50" />
                                     ) : (
                                         <div className="w-10 h-10 rounded-full bg-primary/20 dark:bg-blue-800 flex items-center justify-center text-primary dark:text-blue-300">
                                             <UserIcon size={20} />
                                         </div>
                                     )}
                                     <div>
                                         <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{user.displayName || 'User'}</p>
                                         <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                                     </div>
                                 </div>
                                 <button 
                                    onClick={() => { logoutUser(); onClose(); }}
                                    className="p-2 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition-colors"
                                    title="Sign Out"
                                 >
                                     <LogOut size={20} />
                                 </button>
                             </div>
                         ) : (
                             <button
                                onClick={() => { onLogin(); onClose(); }}
                                className="w-full bg-primary hover:bg-primary/90 dark:bg-slate-600 dark:hover:bg-slate-500 text-white p-4 rounded-[20px] font-bold flex items-center justify-center gap-3 shadow-md hover:shadow-lg transition-all active:scale-95"
                             >
                                 <UserIcon size={20} />
                                 <span>Sign In with Google</span>
                             </button>
                         )}
                     </div>

                     {/* Logos Section */}
                     <div className="space-y-4">
                         <div>
                            <div className="flex justify-between items-center mb-3">
                                <label className="inline-block bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Company Logo</label>
                            </div>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-4 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group text-left shadow-sm"
                            >
                                <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center justify-center p-2 shrink-0 overflow-hidden group-hover:border-primary dark:group-hover:border-slate-500 transition-colors">
                                    {currentLogo && !logoError ? (
                                        <img 
                                            src={currentLogo} 
                                            alt="Logo" 
                                            className="w-full h-full object-contain" 
                                            onError={() => setLogoError(true)}
                                        />
                                    ) : (
                                        <ImageIcon className="text-slate-300 dark:text-slate-500" size={32} />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <span className="block text-sm font-bold text-primary dark:text-slate-300 mb-1">
                                        Upload New Logo
                                    </span>
                                    <p className="text-xs text-slate-400">Recommended: PNG with transparent background</p>
                                </div>
                            </button>
                            <input 
                                ref={fileInputRef}
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={handleLogoUpload}
                            />
                         </div>

                         <div>
                            <div className="flex justify-between items-center mb-3">
                                <label className="inline-block bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Partner / Co-Brand Logo</label>
                            </div>
                            <button
                                onClick={() => partnerFileInputRef.current?.click()}
                                className="w-full bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-4 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group text-left shadow-sm"
                            >
                                <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center justify-center p-2 shrink-0 overflow-hidden group-hover:border-primary dark:group-hover:border-slate-500 transition-colors">
                                    {currentPartnerLogo && !partnerLogoError ? (
                                        <img 
                                            src={currentPartnerLogo} 
                                            alt="Partner Logo" 
                                            className="w-full h-full object-contain" 
                                            onError={() => setPartnerLogoError(true)}
                                        />
                                    ) : (
                                        <ImageIcon className="text-slate-300 dark:text-slate-500" size={32} />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <span className="block text-sm font-bold text-primary dark:text-slate-300 mb-1">
                                        Upload Partner Logo
                                    </span>
                                    <p className="text-xs text-slate-400">Renders next to main logo</p>
                                </div>
                            </button>
                            <input 
                                ref={partnerFileInputRef}
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={handlePartnerLogoUpload}
                            />
                         </div>
                     </div>

                     <div>
                        <label className="inline-block bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3">Theme Mode</label>
                        <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                            {[
                                { id: 'light', label: 'Light', icon: Sun },
                                { id: 'dark', label: 'Dark', icon: Moon },
                                { id: 'system', label: 'System', icon: Monitor }
                            ].map((option) => {
                                const Icon = option.icon;
                                const isActive = currentTheme === option.id;
                                return (
                                    <button
                                        key={option.id}
                                        onClick={() => onThemeChange(option.id as ThemeOption)}
                                        className={`py-3 px-2 rounded-xl text-sm font-bold transition-all flex flex-col items-center gap-2 ${
                                            isActive 
                                            ? 'bg-white dark:bg-slate-700 text-primary dark:text-white shadow-sm' 
                                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                        }`}
                                    >
                                        <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                                        <span>{option.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                     </div>

                     <div>
                        <label className="inline-block bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3">Accent Color</label>
                        
                        {/* Material 3 Expressive Grid Layout */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {colors.map((c) => {
                                const isSelected = colorTheme.toLowerCase() === c.color.toLowerCase();
                                return (
                                    <button
                                        key={c.color}
                                        onClick={() => onColorThemeChange(c.color)}
                                        className={`h-16 rounded-[20px] relative overflow-hidden transition-all group ${isSelected ? 'ring-2 ring-slate-800 dark:ring-white scale-[1.02] shadow-md' : 'hover:scale-[1.02] hover:shadow-sm'}`}
                                    >
                                        {/* Background Fill with opacity */}
                                        <div 
                                            className="absolute inset-0 opacity-20 dark:opacity-30 transition-colors" 
                                            style={{ backgroundColor: c.color }} 
                                        />
                                        
                                        <div className="relative h-full flex items-center px-4 gap-3">
                                            <div 
                                                className="w-8 h-8 rounded-full shadow-sm flex items-center justify-center shrink-0" 
                                                style={{ backgroundColor: c.color }}
                                            >
                                                {isSelected && <Check size={16} className="text-white drop-shadow-md" strokeWidth={3} />}
                                            </div>
                                            <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">
                                                {c.label}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}

                            {/* Custom Color Card */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowColorPicker(true)}
                                    className={`w-full h-16 rounded-[20px] relative overflow-hidden transition-all group flex items-center px-4 gap-3 bg-slate-50 dark:bg-slate-900 border-2 border-dashed ${isCustomColor ? 'border-slate-800 dark:border-white shadow-md' : 'border-slate-300 dark:border-slate-600 hover:border-slate-400'}`}
                                >
                                    <div 
                                        className="w-8 h-8 rounded-full shadow-sm flex items-center justify-center shrink-0 bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500"
                                    >
                                        {isCustomColor ? (
                                             <div className="w-full h-full rounded-full border-2 border-white flex items-center justify-center" style={{ backgroundColor: colorTheme }}>
                                                 <Check size={14} className="text-white drop-shadow-md" strokeWidth={3} />
                                             </div>
                                        ) : (
                                            <Palette size={16} className="text-white" />
                                        )}
                                    </div>
                                    <span className={`font-bold text-sm ${isCustomColor ? 'text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                                        Custom
                                    </span>
                                </button>
                            </div>
                        </div>
                     </div>
                 </div>
                 
                 {/* Footer with Close Button */}
                 <div className="p-5 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex gap-3 shrink-0">
                    <div className="flex-1 flex items-center">
                         <p className="text-xs text-slate-400 dark:text-slate-500 font-medium font-mono">
                            BlueTag v1.4.7
                        </p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="px-8 py-3 rounded-full font-bold text-white bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors shadow-sm"
                    >
                        Close
                    </button>
                 </div>
             </div>
             
             {showColorPicker && (
                 <ColorPickerModal 
                    initialColor={colorTheme} 
                    onChange={onColorThemeChange} 
                    onClose={() => setShowColorPicker(false)} 
                 />
             )}
        </div>,
        document.body
    );
};

interface ReportCardProps {
    report: Report;
    onClick: (id: string) => void;
    onDelete: (id: string) => void;
    isDeleting: boolean;
    layout?: 'carousel' | 'list';
    isFeatured?: boolean;
    isNew?: boolean;
    confirmDelete?: boolean;
    onConfirmDelete?: () => void;
    onCancelDelete?: () => void;
    onViewImage: (url: string, title: string) => void;
    onOpenEmailMenu: (report: Report) => void;
    emailMenuOpen?: boolean;
    onCloseEmailMenu?: () => void;
    onEmailAll?: (r: Report) => void;
    onEmailReport?: (r: Report) => void;
    onEmailSignOff?: (r: Report) => void;
    className?: string; // Add className prop
}

// Map strings to Icon components for display
const getFieldIcon = (iconName: string) => {
    switch (iconName) {
        case 'User': return UserIcon;
        case 'Phone': return Phone;
        case 'Mail': return Mail;
        case 'MapPin': return MapPin;
        case 'Calendar': return Calendar;
        case 'Hash': return Hash;
        case 'Briefcase': return Briefcase;
        default: return FileText;
    }
};

// Inner Content Component
const ReportCardContent: React.FC<{ 
    report: Report, 
    onDelete?: (e: React.MouseEvent) => void,
    onViewImage: (url: string, title: string) => void,
    onOpenEmailMenu: (report: Report) => void
}> = ({ report, onDelete, onViewImage, onOpenEmailMenu }) => {
    const issueCount = report.locations ? report.locations.reduce((acc, loc) => acc + (loc.issues ? loc.issues.length : 0), 0) : 0;
    
    // Extract dynamic fields for display
    const fields = report.project.fields || [];
    const clientName = fields[0]?.value || "";
    const lotUnit = fields[1]?.value || "";
    
    // Filter detail fields (skip index 0 and 1, only show non-empty)
    const visibleDetailFields = fields.slice(2).filter(f => f.value && f.value.trim() !== "");

    const hasReport = !!report.project.reportPreviewImage;
    const hasSignOff = !!report.project.signOffImage;
    const hasAnyDoc = hasReport || hasSignOff;

    return (
        <div className="flex flex-col h-full gap-2">
            <div className="flex justify-between items-start w-full">
                 <div className="flex-1 overflow-hidden pr-2">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1 truncate leading-tight">
                        {clientName || "New Report"}
                    </h3>
                    
                    {lotUnit && (
                        <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 truncate">
                            {lotUnit}
                        </div>
                    )}
                 </div>
                 
                 {onDelete && (
                    <button 
                        onClick={onDelete}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 dark:bg-slate-700 text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors z-10 shrink-0"
                    >
                        <Trash2 size={16} />
                    </button>
                 )}
            </div>

            <div className="flex flex-col gap-1.5 mt-1 flex-1">
                {visibleDetailFields.map(field => {
                    const Icon = getFieldIcon(field.icon);
                    const isMap = field.icon === 'MapPin';
                    
                    if (isMap) {
                        return (
                            <a 
                                key={field.id}
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(field.value)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-2 text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
                            >
                                <Icon size={14} className="shrink-0" />
                                <span className="truncate">{field.value}</span>
                            </a>
                        );
                    }

                    return (
                        <div key={field.id} className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 font-medium">
                            <Icon size={14} className="shrink-0" />
                            <span className="truncate">{field.value}</span>
                        </div>
                    );
                })}
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                 <div className="bg-primary/10 dark:bg-blue-900/30 rounded-full px-3 py-1 flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold text-primary dark:text-blue-300">
                        {issueCount} {issueCount === 1 ? 'Item' : 'Items'}
                    </span>
                 </div>

                 <div className="flex gap-2">
                    {/* View Buttons - Report */}
                    {hasReport && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onViewImage(report.project.reportPreviewImage!, 'Report Preview'); }}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 dark:bg-slate-700/50 text-slate-400 dark:text-slate-400 hover:text-primary dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-100 dark:border-slate-700 shadow-sm"
                            title="View Report"
                        >
                            <FileText size={16} />
                        </button>
                    )}
                    
                    {/* View Buttons - Sign-Off */}
                    {hasSignOff && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onViewImage(report.project.signOffImage!, 'Sign Off Sheet'); }}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 dark:bg-slate-700/50 text-slate-400 dark:text-slate-400 hover:text-primary dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-100 dark:border-slate-700 shadow-sm"
                            title="View Sign Off"
                        >
                            <PenTool size={16} />
                        </button>
                    )}

                    {/* Unified Email Button */}
                    {hasAnyDoc && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onOpenEmailMenu(report); }}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-primary text-white hover:bg-primary/90 transition-colors shadow-sm ml-1"
                            title="Email Documents"
                        >
                            <Mail size={16} />
                        </button>
                    )}
                 </div>
            </div>
        </div>
    );
};

const ReportCard: React.FC<ReportCardProps> = ({ 
    report, 
    onClick, 
    onDelete,
    isDeleting,
    layout = 'list',
    isFeatured,
    isNew,
    confirmDelete,
    onConfirmDelete,
    onCancelDelete,
    onViewImage,
    onOpenEmailMenu,
    emailMenuOpen,
    onCloseEmailMenu,
    onEmailAll,
    onEmailReport,
    onEmailSignOff,
    className = ""
}) => {
    const activeClasses = "p-5 opacity-100 scale-100 translate-y-0 h-full";
    // Using collapse-horizontal for deleting to smoothly shrink space
    const deletingClasses = "p-5 h-full pointer-events-none animate-collapse-horizontal overflow-hidden origin-left";
    const newClasses = isNew ? "duration-700 ring-2 ring-primary/50" : "";
    
    // Conditional styling for the delete confirmation pulse
    const glowClasses = confirmDelete 
        ? "border-red-500 border-2 animate-pulse-border-red" 
        : "";

    let styleClasses = "text-left rounded-[24px] shadow-sm relative overflow-hidden group cursor-pointer transition-all duration-300 ease-in-out ";
    
    if (!confirmDelete) {
        styleClasses += "hover:shadow-md ";
    }

    if (isFeatured) {
        styleClasses += "bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/20 ring-1 ring-black/5 dark:ring-white/10 shadow-xl z-10 ";
        if (!confirmDelete) {
            styleClasses += "scale-[1.02] ";
        }
    } else {
        styleClasses += "bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 ";
    }

    const layoutClasses = layout === 'carousel' ? 'h-full' : 'w-full';

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => !confirmDelete && onClick(report.id)}
            className={`${styleClasses} ${layoutClasses} ${isDeleting ? deletingClasses : activeClasses} ${newClasses} ${glowClasses} ${className}`}
        >
             <ReportCardContent 
                report={report} 
                onDelete={(e) => {
                    e.stopPropagation();
                    onDelete(report.id);
                }}
                onViewImage={onViewImage}
                onOpenEmailMenu={onOpenEmailMenu}
            />
            
            {/* Inline Email Menu Overlay */}
            {emailMenuOpen && onEmailAll && onEmailReport && onEmailSignOff && onCloseEmailMenu && (
                 <EmailMenuModal 
                     report={report}
                     onClose={onCloseEmailMenu}
                     onEmailAll={onEmailAll}
                     onEmailReport={onEmailReport}
                     onEmailSignOff={onEmailSignOff}
                 />
            )}

            {/* Inline Delete Confirmation Overlay */}
            {confirmDelete && (
                <div 
                    className="absolute inset-0 z-50 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-fade-in rounded-[24px]"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mb-4 shadow-sm scale-90">
                        <Trash2 size={24} strokeWidth={2} />
                    </div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-6 leading-relaxed px-4">
                        Permanently remove this report?
                    </p>
                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={onCancelDelete}
                            className="flex-1 py-3 rounded-full font-bold text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={onConfirmDelete}
                            className="flex-1 py-3 rounded-full font-bold text-sm text-white bg-red-500 hover:bg-red-600 transition-colors shadow-md active:scale-95"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const SwipePill = ({ className = "", onClick, isDesktop = false }: { className?: string, onClick?: () => void, isDesktop?: boolean }) => (
    <div 
        onClick={onClick}
        className={`flex animate-slow-fade-in opacity-0 transition-opacity duration-1000 ${className} ${onClick ? 'cursor-pointer pointer-events-auto' : 'pointer-events-none'}`}
    >
        <div className={`bg-white/80 dark:bg-slate-800/80 backdrop-blur-md px-8 py-3 rounded-full flex items-center gap-4 border border-white/20 shadow-md transition-all relative overflow-hidden ${onClick ? 'hover:scale-105 active:scale-95' : ''} animate-breathing-glow`}>
             <span className="text-sm font-bold text-slate-600 dark:text-slate-300 relative z-10">
                 {isDesktop ? 'Click to Create' : 'Tap to Create'}
             </span>
        </div>
    </div>
);

const MoreReportsPill = ({ onClick, count, isExiting = false, className = "" }: { onClick: () => void, count: number, isExiting?: boolean, className?: string }) => (
    <div className={`snap-center h-full flex flex-col justify-center pt-0 origin-center ${isExiting ? 'animate-fade-out opacity-0 pointer-events-none' : ''} ${className}`}>
        <button 
            onClick={onClick}
            className="group relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-sm rounded-[24px] w-[80px] h-full py-6 flex flex-col items-center justify-center gap-4 hover:bg-white dark:hover:bg-slate-800 transition-all hover:scale-[1.05] active:scale-95 hover:shadow-md"
        >
            <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-full text-slate-400 group-hover:text-primary dark:group-hover:text-white transition-colors">
                <ChevronRight size={24} strokeWidth={3} />
            </div>
            <div className="h-px w-8 bg-slate-200 dark:bg-slate-700" />
            <div className="flex flex-col items-center gap-0.5">
                <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    More
                </span>
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
                    ({count})
                </span>
            </div>
            <div className="absolute inset-0 rounded-[24px] ring-2 ring-primary/0 group-hover:ring-primary/20 transition-all" />
        </button>
    </div>
);

const CollapsePill = ({ onClick, onDeleteOld, hasOldReports }: { onClick: () => void, onDeleteOld?: () => void, hasOldReports?: boolean }) => (
    <div className="snap-center h-full flex flex-col justify-center pt-0 animate-fade-in-scale origin-center">
        <div className="group relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-sm rounded-[24px] w-[80px] h-auto py-6 flex flex-col items-center justify-center gap-4 hover:bg-white dark:hover:bg-slate-800 transition-all hover:shadow-md">
            <button 
                onClick={onClick}
                className="flex flex-col items-center gap-4 w-full hover:scale-105 active:scale-95 transition-transform"
            >
                <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-full text-slate-400 group-hover:text-primary dark:group-hover:text-white transition-colors">
                    <ChevronLeft size={24} strokeWidth={3} />
                </div>
                <div className="h-px w-8 bg-slate-200 dark:bg-slate-700" />
                <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Less
                </span>
            </button>

            {hasOldReports && onDeleteOld && (
                <>
                    <div className="h-px w-8 bg-slate-200 dark:bg-slate-700" />
                    <button
                        onClick={(e) => { e.stopPropagation(); onDeleteOld(); }}
                        className="p-3 rounded-full text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors hover:scale-110 active:scale-95"
                        title="Delete Old Reports"
                    >
                        <Trash2 size={20} />
                    </button>
                </>
            )}
            
            <div className="absolute inset-0 rounded-[24px] ring-2 ring-primary/0 group-hover:ring-primary/20 pointer-events-none transition-all" />
        </div>
    </div>
);

// Memoized Wrapper for Dashboard to stabilize handlers and prevent re-renders on parent state change
const DashboardWrapper = React.memo((props: any) => {
    const { report, onUpdateReport, ...rest } = props;

    // Create stable handlers bound to the current report ID
    // Note: We use the functional update form of onUpdateReport if possible, 
    // but here we wrap the call to ensure the handler reference passed to Dashboard doesn't change
    const handleUpdateProject = useCallback((d: ProjectDetails) => {
        onUpdateReport({ ...report, project: d });
    }, [report, onUpdateReport]);

    const handleUpdateLocations = useCallback((l: LocationGroup[]) => {
        onUpdateReport({ ...report, locations: l });
    }, [report, onUpdateReport]);

    const handleAddIssueGlobal = useCallback((locationName: string, issue: Issue) => {
        const currentLocations = report.locations;
        const exists = currentLocations.find((l: LocationGroup) => l.name === locationName);
        let newLocations;
        if (exists) {
            newLocations = currentLocations.map((loc: LocationGroup) => {
                if (loc.name === locationName) { return { ...loc, issues: [...loc.issues, issue] }; }
                return loc;
            });
        } else {
            const newLoc: LocationGroup = {
                id: generateUUID(),
                name: locationName,
                issues: [issue]
            };
            newLocations = [...currentLocations, newLoc];
        }
        onUpdateReport({ ...report, locations: newLocations });
    }, [report, onUpdateReport]);

    return (
        <Dashboard
            {...rest}
            project={report.project}
            locations={report.locations}
            reportId={report.id}
            onUpdateProject={handleUpdateProject}
            onUpdateLocations={handleUpdateLocations}
            onAddIssueGlobal={handleAddIssueGlobal}
        />
    );
});

export const ReportList: React.FC<ReportListProps> = ({
    reports,
    onCreateNew,
    onSelectReport,
    onDeleteReport,
    onDeleteOldReports,
    onUpdateReport,
    isDarkMode,
    currentTheme,
    onThemeChange,
    colorTheme,
    onColorThemeChange,
    user,
    companyLogo,
    onUpdateLogo,
    partnerLogo,
    onUpdatePartnerLogo,
    installAvailable,
    onInstall,
    isIOS,
    isStandalone,
    isDashboardOpen,
    hideLogo,
    signOffTemplates,
    onUpdateTemplates,
    isCreating
}) => {
    const isDesktop = useIsDesktop();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [reportToDelete, setReportToDelete] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [showAll, setShowAll] = useState(false);
    const [isTransitioningToAll, setIsTransitioningToAll] = useState(false);
    const [isCollapsing, setIsCollapsing] = useState(false);
    const [isBouncing, setIsBouncing] = useState(false);
    const [areModalsOpen, setAreModalsOpen] = useState(false);
    
    // State for local embedded dashboard selection
    const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
    const [activeLocationId, setActiveLocationId] = useState<string | null>(null);
    
    // State for viewing images
    const [viewingImage, setViewingImage] = useState<{url: string, title: string} | null>(null);
    
    // State for Email Menu
    const [emailMenuReport, setEmailMenuReport] = useState<Report | null>(null);
    
    // State for Focused Card in Carousel
    const [focusedCardId, setFocusedCardId] = useState<string | null>(null);

    // State for Newly Added ID (for animation control)
    const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);

    // --- State for Expanded List (Show all vs Show Active + Pill) ---
    const [isExpanded, setIsExpanded] = useState(false);
    
    // State for Smooth Exits
    const [exitingReportId, setExitingReportId] = useState<string | null>(null);
    const [isPillExiting, setIsPillExiting] = useState(false);

    // Block intersection observer during animations to prevent scaling glitches
    const isAnimatingRef = useRef(false);

    // --- Initial Load Animation State ---
    const [enableInitialFade, setEnableInitialFade] = useState(() => reports.length > 0);

    // Disable initial fade logic after the splash/intro sequence completes
    useEffect(() => {
        if (enableInitialFade) {
            const timer = setTimeout(() => {
                setEnableInitialFade(false);
            }, 4500); // 2.2s delay + 2s animation + buffer
            return () => clearTimeout(timer);
        }
    }, [enableInitialFade]);

    const carouselRef = useRef<HTMLDivElement>(null);
    const listTopRef = useRef<HTMLDivElement>(null);

    // Track Carousel Touch for Swipe-to-Create
    const carouselTouchStartRef = useRef<number | null>(null);
    const lastCarouselCreateRef = useRef<number>(0);
    
    const handleCarouselTouchStart = (e: React.TouchEvent) => {
        e.stopPropagation();
        if (e.touches.length === 1) {
            carouselTouchStartRef.current = e.touches[0].clientX;
        }
    };

    const handleCarouselTouchMove = (e: React.TouchEvent) => {
        e.stopPropagation();
    };

    const handleCarouselTouchEnd = (e: React.TouchEvent) => {
        e.stopPropagation();
        if (carouselTouchStartRef.current === null) return;
        
        // Block new swipes if currently creating a report to prevent double creation
        const now = Date.now();
        if (isCreating || (now - lastCarouselCreateRef.current < 3000)) {
            carouselTouchStartRef.current = null;
            return;
        }
        
        const endX = e.changedTouches[0].clientX;
        const diff = endX - carouselTouchStartRef.current;
        const el = carouselRef.current;
        
        if (el) {
            // Check if at Start (Left edge) within tolerance
            const isAtStart = el.scrollLeft < 20;
            
            // Swipe Right (positive diff) to create when at start
            if (isAtStart && diff > 50) {
                 lastCarouselCreateRef.current = now;
                 onCreateNew();
            }
        }
        carouselTouchStartRef.current = null;
    };

    // Memoized sorted reports to prevent recreation on every render
    const sortedReports = useMemo(() => {
        return [...reports].sort((a, b) => b.lastModified - a.lastModified);
    }, [reports]);

    const prevReportsLengthRef = useRef(reports.length);

    // --- RENDER PHASE OPTIMISTIC DETECTION ---
    // Detect new report synchronously to render it with correct 'new' styles immediately
    // avoiding the single-frame flash of unstyled content
    let effectiveNewlyAddedId = newlyAddedId;
    let effectiveExitingId = exitingReportId;
    const isCountIncreased = reports.length > prevReportsLengthRef.current;

    if (isCountIncreased && sortedReports.length > 0) {
        effectiveNewlyAddedId = sortedReports[0].id; // Optimistically assume first sorted is new
        
        // Optimistic Exit Logic for 2nd Report
        if (reports.length === 2 && !isExpanded) {
             const oldReport = sortedReports[1];
             if (oldReport) {
                 effectiveExitingId = oldReport.id;
             }
        }
    }

    // Auto-select newest report on creation and scroll to it via Effect (State cleanup)
    useEffect(() => {
        if (isCountIncreased) {
            const newest = sortedReports[0]; 
            if (newest) {
                // Update persistent state to match optimistic render
                setInternalSelectedId(newest.id);
                setFocusedCardId(newest.id);
                setNewlyAddedId(newest.id);
                
                if (reports.length === 2 && !isExpanded) {
                    setExitingReportId(oldReport => {
                        const old = sortedReports[1];
                        return old ? old.id : null;
                    });
                    // Reduced timeout to match animation + slight buffer
                    setTimeout(() => setExitingReportId(null), 600);
                }
                
                isAnimatingRef.current = true;
                setIsExpanded(false);
                
                if (carouselRef.current) {
                    carouselRef.current.scrollTo({ left: 0, behavior: 'smooth' });
                }

                setTimeout(() => {
                    setNewlyAddedId(null);
                    isAnimatingRef.current = false;
                }, 2000);
            }
            // Update ref
            prevReportsLengthRef.current = reports.length;
        } else if (reports.length < prevReportsLengthRef.current) {
            // Handle Deletion
            prevReportsLengthRef.current = reports.length;
        }
    }, [reports.length, sortedReports, isCountIncreased]);

    // Ensure we always have a selection if reports exist
    useEffect(() => {
        if (reports.length > 0 && !internalSelectedId) {
             const firstReport = sortedReports[0];
             setInternalSelectedId(firstReport.id);
             if (!focusedCardId) setFocusedCardId(firstReport.id);
        } else if (reports.length === 0 && internalSelectedId) {
             setInternalSelectedId(null);
             setFocusedCardId(null);
        }
    }, [reports, internalSelectedId, focusedCardId, sortedReports]);

    // Intersection Observer to track focused card in carousel
    useEffect(() => {
        if (showAll || !carouselRef.current) return;

        // Block observer updates during creation animation to prevent "scale" glitch
        if (effectiveNewlyAddedId || isAnimatingRef.current) return;

        const options = {
            root: carouselRef.current,
            threshold: 0.55 // >50% visibility triggers focus
        };

        const observer = new IntersectionObserver((entries) => {
            if (isAnimatingRef.current) return;
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('data-report-id');
                    if (id) {
                         setFocusedCardId(id);
                         setInternalSelectedId(id); // Sync dashboard with scroll focus
                    }
                }
            });
        }, options);

        // Observe children
        const children = carouselRef.current.querySelectorAll('.snap-center');
        children.forEach(child => observer.observe(child));

        return () => observer.disconnect();
    // Optimization: Only re-run if the *list of IDs* changes, not on every content update
    }, [showAll, reports.length, reports.map(r => r.id).join(','), effectiveNewlyAddedId]);


    const shareFile = async (blob: Blob, fileName: string, shareData?: { title?: string, text?: string }) => {
        const file = new File([blob], fileName, { type: 'application/pdf' });
        const data = {
            files: [file],
            title: shareData?.title || undefined,
            text: shareData?.text || undefined
        };

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
             try {
                await navigator.share(data);
            } catch (error) {
                console.error("Error sharing", error);
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }
        } else {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
    };

    const handleEmailReport = async (report: Report) => {
         const { project, locations } = report;
         const reportRes = await generatePDFWithMetadata({ project, locations }, companyLogo);
         const reportBlob = new Blob([reportRes.doc.output('arraybuffer')], { type: 'application/pdf' });
         const headerValue = project.fields?.[0]?.value;
         await shareFile(reportBlob, `${headerValue || 'Project'} - New Home Completion List.pdf`, { title: "Punch List Report", text: "Please find attached the completion list report." });
    };

    const handleEmailSignOff = async (report: Report) => {
        const { project } = report;
        const tpl = signOffTemplates[0];
        const signOffUrl = await generateSignOffPDF(project, SIGN_OFF_TITLE, tpl, companyLogo, project.signOffImage ? project.signOffImage : undefined);
        const signOffBlob = await fetch(signOffUrl).then(r => r.blob());
        const headerValue = project.fields?.[0]?.value;
        await shareFile(signOffBlob, `${headerValue || 'Project'} - Sign Off Sheet.pdf`, { title: "Sign Off Sheet", text: "Please find attached the sign off sheet." });
    };

    const handleEmailAll = async (report: Report) => {
         const { project, locations } = report;
         const reportRes = await generatePDFWithMetadata({ project, locations }, companyLogo);
         const reportBlob = new Blob([reportRes.doc.output('arraybuffer')], { type: 'application/pdf' });
         const headerValue = project.fields?.[0]?.value;
         const lotValue = project.fields?.[1]?.value || "Lot";
         const reportFile = new File([reportBlob], `${headerValue || 'Project'} - New Home Completion List.pdf`, { type: 'application/pdf' });

         const tpl = signOffTemplates[0];
         const signOffUrl = await generateSignOffPDF(project, SIGN_OFF_TITLE, tpl, companyLogo, project.signOffImage ? project.signOffImage : undefined);
         const signOffBlob = await fetch(signOffUrl).then(r => r.blob());
         const signOffFile = new File([signOffBlob], `${headerValue || 'Project'} - Sign Off Sheet.pdf`, { type: 'application/pdf' });

         const filesToShare = [reportFile, signOffFile];
         const title = `${lotValue} - Walk Through Docs`;
         const text = `Here are the walk through docs.`;

         if (navigator.share && navigator.canShare && navigator.canShare({ files: filesToShare })) {
             try {
                 await navigator.share({
                     files: filesToShare,
                     title: title,
                     text: text
                 });
             } catch(e) {
                 console.error(e);
             }
         } else {
             // Fallback: download separately if share sheet fails/unsupported
             shareFile(reportBlob, reportFile.name, { title, text });
             setTimeout(() => shareFile(signOffBlob, signOffFile.name, { title, text }), 1000);
         }
    };

    const handleConfirmDelete = () => {
        if (reportToDelete) {
            const id = reportToDelete;
            setReportToDelete(null); // Close overlay state
            
            // Check if this deletion will remove the "More Reports" pill
            // i.e., going from 2 reports (count=1) to 1 report (count=0)
            if (reports.length === 2 && !isExpanded) {
                setIsPillExiting(true);
                setTimeout(() => setIsPillExiting(false), 1000);
            }

            // Start animation
            setDeletingId(id);
            // Wait for transition before actual deletion
            setTimeout(() => {
                onDeleteReport(id);
                setDeletingId(null);
            }, 1000); // 1000ms delay to match animation
        }
    };

    const handleCancelDelete = () => {
        setReportToDelete(null);
    };

    const handleShowAll = () => {
        setIsTransitioningToAll(true);
        setTimeout(() => {
            setShowAll(true);
            setIsTransitioningToAll(false);
        }, 500); // Wait for collapse animation
    };

    const handleShowLess = () => {
        const element = listTopRef.current;
        const scrollDuration = 400; // Slightly faster for snappiness

        const finishCollapse = () => {
             setIsCollapsing(true);
             // After height transition, switch state
             setTimeout(() => {
                 setShowAll(false);
                 setIsCollapsing(false);
             }, 400); // Match transition duration
        };

        if (element) {
             const parent = element.closest('.overflow-y-auto') as HTMLElement; 
             // Check if at least scrolled a bit
             if (parent && parent.scrollTop > 1) { 
                 const startY = parent.scrollTop;
                 let startTime: number | null = null;
                 
                 const animateScroll = (timestamp: number) => {
                     if (!startTime) startTime = timestamp;
                     const progress = Math.min((timestamp - startTime) / scrollDuration, 1);
                     
                     // Ease Out Quint
                     const ease = 1 - Math.pow(1 - progress, 5);
                     
                     parent.scrollTop = startY * (1 - ease);
                     
                     if (progress < 1) {
                         requestAnimationFrame(animateScroll);
                     } else {
                         finishCollapse();
                     }
                 };
                 requestAnimationFrame(animateScroll);
             } else {
                 finishCollapse();
             }
        } else {
            finishCollapse();
        }
    };
    
    // Handle collapse of expanded carousel items
    const handleCollapseExpanded = () => {
        setIsExpanded(false);
    };

    // Determine visible reports with useMemo to ensure stability
    const visibleReports = useMemo(() => {
        let list = sortedReports;
        
        // If not expanding and we have multiple reports, show only the first one (active)
        // CRITICAL: Also show any report that is currently animating out (exitingReportId)
        if (!showAll && !isExpanded && sortedReports.length > 1) {
            const active = sortedReports[0];
            const items = [active];
            
            // Force inclusion of the 2nd report if state dictates it's exiting
            if (effectiveExitingId) {
                const exiting = sortedReports.find(r => r.id === effectiveExitingId);
                if (exiting && exiting.id !== active.id) {
                    items.push(exiting);
                }
            }
            list = items;
        } else if (!showAll) {
            list = sortedReports.slice(0, 5);
        }
        
        return list;
    }, [sortedReports, showAll, isExpanded, effectiveExitingId]);

    const hasMore = sortedReports.length > 5;
    const hasReports = sortedReports.length > 0;
    const moreCount = sortedReports.length - 1; // Count for the pill

    // Derived state for title text animation
    const titleModeAll = (showAll) || isTransitioningToAll;

    // Determine if we have any reports older than 30 days for cleanup UI
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const hasOldReports = reports.some(r => r.lastModified < thirtyDaysAgo);

    // Active report for embedded dashboard
    const activeEmbeddedReport = sortedReports.find(r => r.id === internalSelectedId) || sortedReports[0];

    // Identify active report for modal logic (needed for LocationDetail)
    const activeReportForLocation = reports.find(r => r.locations.some(l => l.id === activeLocationId));

    return (
        <div ref={listTopRef} className={`min-h-screen pb-32 px-0 pt-8 w-full max-w-[1600px] mx-auto relative ${isBouncing ? 'animate-scroll-bounce' : ''}`}>
            
            {/* Header - Centered Logo, Partner Left */}
            <div className="relative h-32 mb-4 px-6 block max-w-3xl mx-auto">
                 
                 {/* Partner Logo (Absolute Left) */}
                 {partnerLogo && (
                     <div className="absolute left-6 top-1/2 -translate-y-1/2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl p-1.5 shadow-sm border border-slate-200 dark:border-slate-700 w-[75px] h-[75px] flex items-center justify-center overflow-hidden z-20">
                         <img src={partnerLogo} alt="Partner" className="w-full h-full object-contain" />
                     </div>
                 )}

                 {/* Main Logo (Absolutely Centered) */}
                 <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 transition-opacity duration-[2000ms] ${hideLogo ? 'opacity-0' : 'opacity-100'}`}>
                     <BlueTagLogo size="header" />
                 </div>
                 
                 {/* Settings Button: Top Right Fixed */}
                 {!isDashboardOpen && !areModalsOpen && (
                     <button 
                        onClick={() => setIsSettingsOpen(true)}
                        className="fixed top-6 right-6 p-3 rounded-full bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 backdrop-blur-md transition-all shadow-sm border border-slate-200 dark:border-slate-700 z-50"
                     >
                        <Settings size={24} strokeWidth={2.5} />
                     </button>
                 )}
            </div>
            
            {/* List / Carousel with Cross-Fade Transition - GRID LAYOUT TO FIX GLITCH */}
            <div className="mt-8 grid grid-cols-1 grid-rows-1 relative items-start">
                
                {/* View: Active Reports List */}
                <div 
                    className={`col-start-1 row-start-1 w-full transition-opacity duration-1000 ${
                        !hasReports ? 'opacity-0 z-0 pointer-events-none' :
                        enableInitialFade ? 'opacity-0 z-20 pointer-events-auto animate-slow-fade-in' :
                        'opacity-100 z-20 pointer-events-auto'
                    }`}
                    style={enableInitialFade ? { animationDelay: '2.2s', animationFillMode: 'forwards' } : {}}
                >
                    <div className="flex flex-col">
                        
                        {/* Swipe/Click Pill - Top Position */}
                        {!showAll && hasReports && (
                            <div className={`${deletingId && deletingId === activeEmbeddedReport?.id ? 'opacity-0 duration-1000' : 'opacity-100 duration-500'} transition-opacity mx-auto max-w-3xl`}>
                                <SwipePill className="mb-6 justify-center" onClick={onCreateNew} isDesktop={isDesktop} />
                            </div>
                        )}

                        {/* Report Title Pill */}
                        <div className={`px-6 mb-1 flex items-center justify-center min-h-[44px] ${deletingId && deletingId === activeEmbeddedReport?.id ? 'opacity-0 duration-1000' : 'opacity-100 duration-500'} transition-opacity`}>
                            {activeEmbeddedReport ? (
                                <div key={activeEmbeddedReport.id} className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-slate-700 shadow-lg ring-1 ring-black/5 dark:ring-white/10 rounded-full px-6 py-2.5 flex items-center gap-3 animate-slow-fade-in transition-all duration-[2000ms]">
                                     <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                     <h1 className="text-sm font-bold text-slate-800 dark:text-white truncate max-w-[200px]">
                                        {activeEmbeddedReport.project.fields[0]?.value || "New Report"}
                                     </h1>
                                </div>
                            ) : (
                                <div className="h-11" />
                            )}
                        </div>

                        {!showAll && !isCollapsing ? (
                            <>
                                {/* Horizontal Carousel with Safe Centering */}
                                <div 
                                    ref={carouselRef}
                                    className={`flex overflow-x-auto w-full pb-8 pt-4 px-6 snap-x snap-mandatory scrollbar-hide relative sm:px-[max(24px,calc(50vw-170px))] min-h-[350px] items-start gap-8`}
                                    onTouchStart={handleCarouselTouchStart}
                                    onTouchMove={handleCarouselTouchMove}
                                    onTouchEnd={handleCarouselTouchEnd}
                                >
                                    {/* Direct children loop */}
                                    {visibleReports.map((report, index) => {
                                        // Effective New State (Use stable LayoutEffect state)
                                        const isNew = report.id === effectiveNewlyAddedId;

                                        // Check if this is the very first report creation (only 1 report in list)
                                        // Use reports.length for stability to avoid flickering animations if visibleReports shifts
                                        const isFirstReportCreation = isNew && reports.length === 1 && !isExpanded;
                                        
                                        // Check if this is the second report creation (1 -> 2)
                                        // NOTE: The 'isExiting' report is rendered absolute, so this new report is essentially solo in flow
                                        const isSecondReportCreation = isNew && reports.length === 2 && !isExpanded;

                                        // Animation States
                                        const isExpanding = isExpanded && index > 0;
                                        const isExiting = report.id === effectiveExitingId;
                                        
                                        // Condition to show "Attached" More Reports Pill (Desktop Only)
                                        const showAttachedPill = isDesktop && index === 0 && !isExpanded && moreCount > 0 && !showAll;
                                        
                                        // When pill is attached, we increase the container max-width to accommodate both
                                        const maxWidthClass = showAttachedPill ? 'sm:max-w-[900px]' : 'sm:max-w-[600px]';

                                        return (
                                        <div 
                                            key={report.id} 
                                            data-report-id={report.id}
                                            className={`snap-center duration-500 ease-in-out group/carousel-item ${
                                                // Handle Deletion
                                                deletingId === report.id 
                                                    ? `opacity-0 duration-1000 min-w-[calc(100vw-3rem)] sm:w-auto sm:min-w-[340px] ${maxWidthClass} pointer-events-none relative transition-all` 
                                                    : (isExiting 
                                                        ? 'absolute left-6 sm:left-[calc(50vw-170px)] w-[calc(100vw-3rem)] sm:w-[340px] z-20 transition-opacity duration-500 opacity-0'
                                                        : `relative opacity-100 transition-all min-w-[calc(100vw-3rem)] sm:w-auto sm:min-w-[340px] ${maxWidthClass}`)
                                            } ${
                                                // Handle "Show All" Collapse
                                                isTransitioningToAll && index > 0 
                                                    ? '-ml-[90vw] sm:-ml-[350px] opacity-0' 
                                                    : ''
                                            } ${
                                                // Z-Index Stacking Strategy: "Fade from Behind"
                                                isNew 
                                                    ? 'z-0' 
                                                    : (index === 0 ? 'z-30' : (index === 1 ? 'z-20' : 'z-10'))
                                            } ${
                                                // ANIMATION LOGIC:
                                                // If FIRST report: Fade In Scale
                                                // If 2nd report: No Expansion (Absolute replacement)
                                                // If 3rd+ report: Expand Horizontal (Standard)
                                                isNew 
                                                    ? (isFirstReportCreation 
                                                        ? 'animate-fade-in-scale origin-center' 
                                                        : (isSecondReportCreation ? '' : 'animate-expand-horizontal origin-left'))
                                                    : (isExpanding ? 'animate-expand-horizontal origin-left' : '')
                                            }`}
                                            style={{ 
                                                scrollSnapStop: 'always',
                                                ...(isExpanding ? { animationDelay: `${(index - 1) * 300}ms` } : {}),
                                            }}
                                        >
                                            {/* Content Wrapper */}
                                            {/* 2nd Report Animation: delay-500 + animate-fade-in-up for smooth entrance after exit */}
                                            {/* Exiting Report: duration-500 opacity-0 for fast exit */}
                                            <div 
                                                className={`w-full flex flex-col ease-out transition-all ${
                                                    isNew && !isFirstReportCreation ? 'animate-fade-in-up delay-500 min-w-[340px]' : ''
                                                }`}
                                                style={isNew && !isFirstReportCreation ? { opacity: 0 } : {}}
                                            >
                                                {/* Top Row: Report Card (+ Attached Pill on Desktop) */}
                                                <div className="flex gap-4 items-stretch w-full">
                                                    {/* If pill is attached, enforce a minimum width on the report card to prevent it from compressing.
                                                        The parent container has enough max-width (900px) to fit both. */}
                                                    <div className={`flex-1 min-w-0 ${showAttachedPill ? 'sm:min-w-[600px]' : ''}`}>
                                                        <ReportCard 
                                                            report={report}
                                                            onClick={() => setInternalSelectedId(report.id)}
                                                            onDelete={(id) => setReportToDelete(id)}
                                                            isDeleting={deletingId === report.id}
                                                            layout="carousel"
                                                            isFeatured={false}
                                                            isNew={isNew}
                                                            confirmDelete={reportToDelete === report.id}
                                                            onConfirmDelete={handleConfirmDelete}
                                                            onCancelDelete={handleCancelDelete}
                                                            onViewImage={(url, title) => setViewingImage({url, title})}
                                                            onOpenEmailMenu={(r) => setEmailMenuReport(r)}
                                                            emailMenuOpen={emailMenuReport?.id === report.id}
                                                            onCloseEmailMenu={() => setEmailMenuReport(null)}
                                                            onEmailAll={handleEmailAll}
                                                            onEmailReport={handleEmailReport}
                                                            onEmailSignOff={handleEmailSignOff}
                                                        />
                                                    </div>

                                                    {/* Desktop Attached Pill - Same Height */}
                                                    {showAttachedPill && (
                                                        <div className={`w-[80px] shrink-0 ${
                                                            isPillExiting 
                                                                ? 'animate-fade-out opacity-0' 
                                                                : (isNew ? '' : 'animate-expand-horizontal origin-left')
                                                        }`}>
                                                            <MoreReportsPill 
                                                                onClick={() => setIsExpanded(true)} 
                                                                count={moreCount}
                                                                isExiting={isPillExiting}
                                                                className="h-full"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                {/* EMBEDDED DASHBOARD - Explicit Key to prevent remount */}
                                                <div className="mt-4" key={report.id}>
                                                    <DashboardWrapper
                                                        embedded={true}
                                                        report={report}
                                                        onUpdateReport={onUpdateReport}
                                                        onSelectLocation={(id: string) => setActiveLocationId(id)}
                                                        onBack={() => {}}
                                                        isDarkMode={isDarkMode}
                                                        toggleTheme={() => {}} 
                                                        companyLogo={companyLogo}
                                                        onModalStateChange={setAreModalsOpen}
                                                        signOffTemplates={signOffTemplates}
                                                        onUpdateTemplates={onUpdateTemplates}
                                                        // Pass initialExpand true ONLY if it's the first report being created (0->1)
                                                        initialExpand={isNew && isFirstReportCreation}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )})}
                                    
                                    {/* Mobile/Carousel More Reports Pill (Hidden on Desktop when not expanded) */}
                                    {!isDesktop && !isExpanded && !showAll && !effectiveExitingId && !effectiveNewlyAddedId && ((moreCount > 0) || isPillExiting) && (
                                        <MoreReportsPill 
                                            onClick={() => setIsExpanded(true)} 
                                            count={moreCount}
                                            isExiting={isPillExiting}
                                        />
                                    )}

                                    {/* Collapse Pill */}
                                    {isExpanded && (
                                        <CollapsePill 
                                            onClick={handleCollapseExpanded} 
                                            onDeleteOld={onDeleteOldReports}
                                            hasOldReports={hasOldReports}
                                        />
                                    )}
                                </div>
                            </>
                        ) : (
                            // Vertical List View
                             <div 
                                className={`transition-all duration-400 ease-in-out overflow-hidden ${isCollapsing ? 'max-h-[0px] opacity-0' : 'max-h-[5000px] opacity-100'}`}
                             >
                                <div className="flex flex-col gap-4 px-6 pt-8 pb-12 max-w-3xl mx-auto">
                                    {visibleReports.map((report, index) => (
                                        <div 
                                            key={report.id} 
                                            className={`transition-all duration-500 ease-in-out h-[350px] ${
                                                index > 0 
                                                ? "animate-slide-down"
                                                : ""
                                            }`}
                                        >
                                            <ReportCard 
                                                report={report}
                                                onClick={() => {
                                                    setInternalSelectedId(report.id);
                                                    setShowAll(false);
                                                }}
                                                onDelete={(id) => setReportToDelete(id)}
                                                isDeleting={deletingId === report.id}
                                                layout="list"
                                                isFeatured={false}
                                                isNew={index === 0 && (Date.now() - report.lastModified) < 2000}
                                                confirmDelete={reportToDelete === report.id}
                                                onConfirmDelete={handleConfirmDelete}
                                                onCancelDelete={handleCancelDelete}
                                                onViewImage={(url, title) => setViewingImage({url, title})}
                                                onOpenEmailMenu={(r) => setEmailMenuReport(r)}
                                                emailMenuOpen={emailMenuReport?.id === report.id}
                                                onCloseEmailMenu={() => setEmailMenuReport(null)}
                                                onEmailAll={handleEmailAll}
                                                onEmailReport={handleEmailReport}
                                                onEmailSignOff={handleEmailSignOff}
                                            />
                                        </div>
                                    ))}

                                    <div className="mt-8 mb-4 flex justify-center animate-fade-in">
                                         <button
                                             onClick={handleShowLess}
                                             className="bg-slate-200/60 dark:bg-slate-800/60 backdrop-blur-md px-8 py-3 rounded-full flex items-center gap-3 border border-white/20 shadow-md transition-all hover:bg-slate-300/60 dark:hover:bg-slate-700/60 active:scale-95 group cursor-pointer"
                                         >
                                              <ChevronUp size={24} className="text-slate-600 dark:text-slate-300 group-hover:-translate-y-1 transition-transform" />
                                              <span className="text-sm font-bold tracking-widest text-slate-600 dark:text-slate-300">Show Less</span>
                                         </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {hasMore && !showAll && !isTransitioningToAll && !isCollapsing && !isExpanded && (
                             <div className="px-6 flex flex-col sm:flex-row items-center justify-center gap-3 mx-auto max-w-3xl">
                                 {hasMore && (
                                     <button 
                                        onClick={handleShowAll}
                                        className="bg-white dark:bg-slate-800 text-primary dark:text-white px-6 py-3 rounded-full font-bold shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all active:scale-95 flex items-center gap-2"
                                     >
                                        View All Reports ({sortedReports.length})
                                        <ChevronRight size={16} />
                                     </button>
                                 )}
                             </div>
                        )}
                    </div>
                </div>

                {/* View: Empty State */}
                <div 
                    className={`col-start-1 row-start-1 flex flex-col h-full transition-opacity duration-1000 ease-in-out ${
                        !hasReports ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                    } mx-auto max-w-3xl w-full pointer-events-none`}
                >
                    <div className="px-6 mb-4 min-h-[44px] opacity-0 pointer-events-none" aria-hidden="true">
                        <div className="h-11 w-48 mx-auto" />
                    </div>
                    <div className="py-8 px-6 pointer-events-auto">
                        <div className="w-full sm:w-[350px] mx-auto bg-surface-container/50 dark:bg-slate-900/50 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-[32px] flex flex-col items-center justify-center py-12 text-center h-[350px]">
                            <div className="w-20 h-20 rounded-full bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 text-slate-300 dark:text-slate-600 shadow-sm">
                                <FileText size={40} />
                            </div>
                            <h3 className="text-xl font-bold text-primary dark:text-white mb-8">No Reports Yet</h3>
                            {!hasReports && <SwipePill className="justify-center" onClick={onCreateNew} isDesktop={isDesktop} />}
                        </div>
                    </div>
                </div>
            </div>
            
            {activeLocationId && activeReportForLocation && activeReportForLocation.locations.find(l => l.id === activeLocationId) && (
                <LocationDetail
                    location={activeReportForLocation.locations.find(l => l.id === activeLocationId)!}
                    onBack={() => setActiveLocationId(null)}
                    onAddIssue={(issue) => {
                        const activeLocation = activeReportForLocation.locations.find(l => l.id === activeLocationId)!;
                        const updatedLoc = { ...activeLocation, issues: [...activeLocation.issues, issue] };
                        const updatedLocations = activeReportForLocation.locations.map(l => l.id === updatedLoc.id ? updatedLoc : l);
                        onUpdateReport({ ...activeReportForLocation, locations: updatedLocations });
                    }}
                    onUpdateIssue={(issue) => {
                        const activeLocation = activeReportForLocation.locations.find(l => l.id === activeLocationId)!;
                        const updatedIssues = activeLocation.issues.map(i => i.id === issue.id ? issue : i);
                        const updatedLoc = { ...activeLocation, issues: updatedIssues };
                        const updatedLocations = activeReportForLocation.locations.map(l => l.id === updatedLoc.id ? updatedLoc : l);
                        onUpdateReport({ ...activeReportForLocation, locations: updatedLocations });
                    }}
                    onDeleteIssue={(issueId) => {
                        const activeLocation = activeReportForLocation.locations.find(l => l.id === activeLocationId)!;
                        const updatedIssues = activeLocation.issues.filter(i => i.id !== issueId);
                        const updatedLoc = { ...activeLocation, issues: updatedIssues };
                        const updatedLocations = activeReportForLocation.locations.map(l => l.id === updatedLoc.id ? updatedLoc : l);
                        onUpdateReport({ ...activeReportForLocation, locations: updatedLocations });
                    }}
                />
            )}

            {isSettingsOpen && (
                <SettingsModal 
                    onClose={() => setIsSettingsOpen(false)}
                    currentTheme={currentTheme}
                    onThemeChange={onThemeChange}
                    colorTheme={colorTheme}
                    onColorThemeChange={onColorThemeChange}
                    user={user}
                    onLogin={() => {
                        loginWithGoogle().catch(console.error);
                    }}
                    currentLogo={companyLogo}
                    onUpdateLogo={onUpdateLogo}
                    currentPartnerLogo={partnerLogo}
                    onUpdatePartnerLogo={onUpdatePartnerLogo}
                    installAvailable={installAvailable}
                    onInstall={onInstall}
                    isIOS={isIOS}
                    isStandalone={isStandalone}
                />
            )}
            
            {viewingImage && (
                <ImageViewerModal 
                    url={viewingImage.url} 
                    title={viewingImage.title} 
                    onClose={() => setViewingImage(null)} 
                />
            )}
        </div>
    );
};