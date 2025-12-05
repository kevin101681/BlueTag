

import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import { LocationGroup, ProjectDetails, Issue, SignOffTemplate, SignOffSection, ProjectField, Point, SignOffStroke } from '../types';
import { ChevronRight, ArrowLeft, X, Plus, PenTool, Save, Trash2, Check, ChevronDown, Undo, Redo, Info, Download, Sun, Moon, FileText, MapPin, Eye, RefreshCw, Minimize2, Share, Mail, Pencil, Edit2, Send, Calendar, ChevronUp, Hand, Move, AlertCircle, MousePointer2, Settings, GripVertical, AlignLeft, CheckSquare, PanelLeft, User as UserIcon, Phone, Briefcase, Hash, Sparkles, Camera, Mic, MicOff, Layers, Eraser } from 'lucide-react';
import { generateSignOffPDF, SIGN_OFF_TITLE, generatePDFWithMetadata, ImageLocation, CheckboxLocation } from '../services/pdfService';
import { AddIssueForm, LocationDetail } from './LocationDetail';
import { generateUUID, PREDEFINED_LOCATIONS } from '../constants';
import { createPortal } from 'react-dom';

export interface DashboardProps {
  project: ProjectDetails;
  locations: LocationGroup[];
  onSelectLocation: (id: string) => void;
  onUpdateProject: (details: ProjectDetails) => void;
  onUpdateLocations: (locations: LocationGroup[]) => void;
  onBack: () => void;
  onAddIssueGlobal: (locationName: string, issue: Issue) => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
  companyLogo?: string;
  shouldScrollToLocations?: boolean;
  onScrollComplete?: () => void;
  onModalStateChange: (isOpen: boolean) => void;
  signOffTemplates: SignOffTemplate[];
  onUpdateTemplates: (templates: SignOffTemplate[]) => void;
  embedded?: boolean;
  reportId?: string;
  initialExpand?: boolean;
  isCreating?: boolean;
  isExiting?: boolean;
  onDelete?: (e: React.MouseEvent, rect?: DOMRect) => void;
}

// Map strings to Icon components for display
const getIconComponent = (iconName: string) => {
    switch (iconName) {
        case 'User': return UserIcon;
        case 'Phone': return Phone;
        case 'Mail': return Mail;
        case 'MapPin': return MapPin;
        case 'Calendar': return Calendar;
        case 'FileText': return FileText;
        case 'Hash': return Hash;
        case 'Briefcase': return Briefcase;
        default: return FileText;
    }
};

// --- ReportCard Component ---
export interface ReportCardProps {
    project: ProjectDetails;
    issueCount: number;
    lastModified: number;
    onClick?: () => void;
    onDelete?: (e: React.MouseEvent, rect?: DOMRect) => void;
    isSelected?: boolean;
    readOnly?: boolean;
    actions?: {
        onEmail?: () => void;
        onViewReport?: () => void;
        onViewSignOff?: () => void;
    };
    hasDocs?: boolean;
}

export const ReportCard: React.FC<ReportCardProps> = ({ 
    project, 
    issueCount, 
    lastModified, 
    onClick, 
    onDelete, 
    isSelected, 
    readOnly,
    actions,
    hasDocs
}) => {
    const fields = project.fields || [];
    const isSearchResult = !actions; // Identify if this is a search result/list card vs main dashboard card
    
    // Format date as MM/DD/YY
    const d = new Date(lastModified);
    const dateStr = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear().toString().slice(-2)}`;

    const cardRef = useRef<HTMLDivElement>(null);
    
    // Header Logic
    const nameStr = fields[0]?.value || "Project";
    const subtitle = fields[1]?.value || "";
    const detailFields = fields.slice(2);
    const hasContactInfo = detailFields.some(f => f.value && f.value.trim() !== "");

    // Saved State Logic
    const isReportSaved = project.reportMarks !== undefined;
    const isSignOffSaved = project.signOffStrokes !== undefined;
    const isEmailActive = isReportSaved || isSignOffSaved;

    const getLinkProps = (field: ProjectField) => {
        const val = field.value;
        if (!val) return {};
        const icon = field.icon;
        const label = field.label.toLowerCase();
        
        if (icon === 'Phone' || label.includes('phone')) {
            return { href: `tel:${val}`, target: '_self' };
        }
        if (icon === 'Mail' || label.includes('email')) {
            return { href: `mailto:${val}`, target: '_self' };
        }
        if (icon === 'MapPin' || label.includes('address')) {
            return { href: `https://maps.google.com/?q=${encodeURIComponent(val)}`, target: '_blank', rel: 'noopener noreferrer' };
        }
        return {};
    };

    const getButtonStyle = (isActive: boolean) => {
        const base = "w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center transition-colors active:scale-95 shadow-sm shrink-0 border";
        if (isActive) {
            return `${base} bg-primary/10 dark:bg-primary/20 border-primary/20 dark:border-primary/30 text-primary hover:bg-primary/20 dark:hover:bg-primary/30`;
        }
        return `${base} bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-primary`;
    };

    return (
        <div 
            ref={cardRef}
            onClick={!readOnly ? onClick : undefined}
            className={`w-full bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-sm border border-slate-200 dark:border-slate-800 transition-all relative group flex flex-col ${
                !readOnly && !isSelected ? 'hover:shadow-md hover:border-primary/50 cursor-pointer' : ''
            } ${isSelected ? 'ring-2 ring-primary bg-primary/5' : ''}`}
        >
            {/* Header: Stacked Pills */}
            <div className="flex flex-col items-center gap-2 mb-6 relative z-10 w-full">
                 {/* Decorative Line connecting to Name Pill center */}
                 <div className="absolute top-[20px] left-0 right-0 h-px bg-slate-100 dark:bg-slate-800 -z-10" />

                 {/* Name Pill - Smaller, Removed Pulse */}
                 <div className="bg-slate-100 dark:bg-slate-800 px-6 py-2 rounded-full flex items-center gap-3 border border-slate-200 dark:border-slate-700 relative bg-white dark:bg-slate-900 z-20">
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0 animate-pulse" />
                    <span className="text-base font-bold text-slate-700 dark:text-slate-200 truncate max-w-[50vw]">
                        {nameStr}
                    </span>
                 </div>

                 {/* Lot/Unit Pill - Only shown in header if NOT a search result (Main Card) */}
                 {!isSearchResult && subtitle && (
                    <div className="h-10 px-4 rounded-2xl flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 relative bg-white dark:bg-slate-900 shadow-sm z-20">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 max-w-[40vw] truncate">
                            {subtitle}
                        </span>
                    </div>
                 )}
            </div>

            {/* Content Body: Gray Box with Contact Info Pills */}
            {hasContactInfo && (
                <div className="w-full mb-6 flex-1 flex flex-col items-center justify-center animate-fade-in">
                     <div className="w-full px-3 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                        <div className="flex flex-wrap items-center justify-center gap-2 w-full">
                            {detailFields.map(field => {
                                if (!field.value) return null;
                                const Icon = getIconComponent(field.icon);
                                const linkProps = getLinkProps(field);
                                const Wrapper = linkProps.href ? 'a' : 'div';
                                const isInteractive = !!linkProps.href;
                                
                                return (
                                    <Wrapper 
                                        key={field.id}
                                        className={`flex items-center justify-center gap-2 group/item px-4 py-2 rounded-2xl border shadow-sm transition-all max-w-full ${
                                            isInteractive 
                                                ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-primary dark:text-blue-400 font-semibold hover:border-primary/50 hover:shadow-md cursor-pointer' 
                                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-medium'
                                        }`}
                                        {...linkProps}
                                        onClick={linkProps.href ? (e) => e.stopPropagation() : undefined}
                                    >
                                        <Icon size={14} className="shrink-0 opacity-70" />
                                        <span className="text-sm break-words leading-relaxed text-center line-clamp-1">{field.value}</span>
                                    </Wrapper>
                                );
                            })}
                        </div>
                     </div>
                </div>
            )}

            {!hasContactInfo && <div className="mb-4"></div>}
            
            {/* Footer Row - Unified Group, Centered, Equal Spacing */}
            <div className="flex items-center justify-center mt-auto w-full gap-2 sm:gap-3">
                {/* Item Count */}
                <div className="h-12 sm:h-14 rounded-xl sm:rounded-2xl bg-slate-100 dark:bg-slate-800 px-4 sm:px-6 flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 shadow-sm shrink">
                    <span className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {issueCount} Items
                    </span>
                </div>

                {/* Lot/Unit Pill - Shown in footer for Search Results */}
                {isSearchResult && subtitle && (
                    <div className="h-12 sm:h-14 rounded-xl sm:rounded-2xl bg-slate-100 dark:bg-slate-800 px-4 sm:px-6 flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 shadow-sm shrink min-w-0">
                        <span className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap truncate">
                            {subtitle}
                        </span>
                    </div>
                )}

                {/* Actions */}
                {actions && (
                    <>
                        <button 
                            onClick={(e) => { e.stopPropagation(); actions.onViewReport?.(); }}
                            className={getButtonStyle(isReportSaved)}
                            title="View/Generate Report"
                        >
                            <FileText size={20} className="sm:w-[24px] sm:h-[24px]" />
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); actions.onViewSignOff?.(); }}
                            className={getButtonStyle(isSignOffSaved)}
                            title="View/Sign Off"
                        >
                            <PenTool size={20} className="sm:w-[24px] sm:h-[24px]" />
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); actions.onEmail?.(); }}
                            className={getButtonStyle(isEmailActive)}
                            title="Email Documents"
                        >
                            <Mail size={20} className="sm:w-[24px] sm:h-[24px]" />
                        </button>
                    </>
                )}

                {/* Date Pill */}
                <div className="h-12 sm:h-14 rounded-xl sm:rounded-2xl bg-slate-100 dark:bg-slate-800 px-4 sm:px-6 flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 shadow-sm shrink min-w-0">
                    <span className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap truncate">
                        {dateStr}
                    </span>
                </div>

                {/* Delete Button */}
                {onDelete && (
                     <button 
                         onClick={(e) => { 
                             e.stopPropagation(); 
                             const rect = cardRef.current?.getBoundingClientRect();
                             onDelete(e, rect); 
                         }}
                         className="w-12 h-12 sm:w-14 sm:h-14 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl sm:rounded-2xl transition-colors flex items-center justify-center shadow-sm active:scale-95 shrink-0"
                         title="Delete Report"
                     >
                         <Trash2 size={20} className="sm:w-[24px] sm:h-[24px]" />
                     </button>
                )}
            </div>
            
            {isSelected && (
                <div className="absolute right-6 top-6 text-primary z-20">
                    <Check size={24} strokeWidth={3} />
                </div>
            )}
        </div>
    );
};

// ... (PDF Components) ...
const PDFPageCanvas: React.FC<{ 
    page: any, 
    pageIndex: number,
    onRenderSuccess?: (canvas: HTMLCanvasElement) => void,
    onPageClick?: (e: React.MouseEvent, pageIndex: number, rect: DOMRect) => void,
    overlayElements?: React.ReactNode
}> = ({ page, pageIndex, onRenderSuccess, onPageClick, overlayElements }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (canvasRef.current && page) {
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');
            
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            canvas.style.width = '100%';
            canvas.style.height = 'auto';
            canvas.style.maxWidth = `${viewport.width}px`;

            const renderContext = {
                canvasContext: context,
                viewport: viewport,
            };
            page.render(renderContext).promise.then(() => {
                if (onRenderSuccess) onRenderSuccess(canvas);
            });
        }
    }, [page]);

    return (
        <div 
            ref={containerRef}
            className="relative mb-4 w-full" 
            onClick={(e) => {
                if (containerRef.current && onPageClick) {
                    const rect = containerRef.current.getBoundingClientRect();
                    onPageClick(e, pageIndex, rect);
                }
            }}
        >
            <canvas ref={canvasRef} className="shadow-lg rounded-sm bg-white pdf-page-canvas block w-full" />
            <div className="absolute inset-0 pointer-events-none">
                {overlayElements}
            </div>
        </div>
    );
};

const PDFCanvasPreview = ({ 
    pdfUrl, 
    onAllPagesRendered, 
    onPageClick,
    maps,
    marks,
    triggerResize 
}: { 
    pdfUrl: string, 
    onAllPagesRendered?: () => void,
    onPageClick?: (e: React.MouseEvent, pageIndex: number, rect: DOMRect) => void,
    maps?: { imageMap: ImageLocation[], checkboxMap: CheckboxLocation[] },
    marks?: Record<string, ('check' | 'x')[]>,
    triggerResize?: number
}) => {
    const [pages, setPages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const renderedCount = useRef(0);

    useEffect(() => {
        const loadPdf = async () => {
            if (!pdfUrl) return;
            setLoading(true);
            setError(null);
            renderedCount.current = 0;
            try {
                const pdfjsLib = (window as any).pdfjsLib;
                if (!pdfjsLib) throw new Error("PDF Library not loaded");

                const loadingTask = pdfjsLib.getDocument(pdfUrl);
                const pdf = await loadingTask.promise;
                
                const pagePromises = [];
                for (let i = 1; i <= pdf.numPages; i++) {
                    pagePromises.push(pdf.getPage(i));
                }
                const loadedPages = await Promise.all(pagePromises);
                setPages(loadedPages);
            } catch (err: any) {
                console.error("PDF Load Error", err);
                setError(err.message || "Failed to load PDF");
            } finally {
                setLoading(false);
            }
        };
        loadPdf();
    }, [pdfUrl]);

    const handlePageRender = () => {
        renderedCount.current += 1;
        if (renderedCount.current === pages.length && onAllPagesRendered) {
            onAllPagesRendered();
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full w-full bg-slate-100 dark:bg-slate-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full w-full bg-slate-100 dark:bg-slate-900 p-4 text-center">
                <AlertCircle size={48} className="text-red-500 mb-4" />
                <p className="text-red-500 font-medium">Could not render PDF preview.</p>
                <p className="text-xs text-slate-400 mt-2">{error}</p>
            </div>
        );
    }

    return (
        <div className="w-full min-h-full flex flex-col items-center">
            {pages.map((page, index) => {
                const pageIndex = index + 1;
                let overlays: React.ReactNode = null;
                if (maps && marks) {
                    const PDF_W = 210; 
                    const PDF_H = 297; 
                    
                    overlays = (
                        <>
                            {maps.checkboxMap.filter(m => m.pageIndex === pageIndex).map(box => {
                                const isChecked = marks[box.id]?.includes('check');
                                if (!isChecked) return null;
                                return (
                                    <React.Fragment key={`chk-grp-${box.id}`}>
                                        <div 
                                            key={`chk-${box.id}`}
                                            style={{
                                                position: 'absolute',
                                                left: `${(box.x / PDF_W) * 100}%`,
                                                top: `${(box.y / PDF_H) * 100}%`,
                                                width: `${(box.w / PDF_W) * 100}%`,
                                                height: `${(box.h / PDF_H) * 100}%`,
                                                pointerEvents: 'none'
                                            }}
                                            className="text-green-400 opacity-90"
                                        >
                                            <Check strokeWidth={4} className="w-full h-full" />
                                        </div>
                                        {/* Strikethrough Overlay */}
                                        {box.strikethroughLines?.map((line, idx) => (
                                            <div 
                                                key={`strike-${box.id}-${idx}`}
                                                style={{
                                                    position: 'absolute',
                                                    left: `${(line.x / PDF_W) * 100}%`,
                                                    top: `${(line.y / PDF_H) * 100}%`, 
                                                    width: `${(line.w / PDF_W) * 100}%`,
                                                    height: '2px', 
                                                    backgroundColor: 'rgba(50, 50, 50, 0.8)',
                                                    transform: 'translateY(-50%)',
                                                    pointerEvents: 'none'
                                                }}
                                            />
                                        ))}
                                    </React.Fragment>
                                );
                            })}
                            {maps.imageMap.filter(m => m.pageIndex === pageIndex).map(img => {
                                const isXed = marks[img.id]?.includes('x');
                                if (!isXed) return null;
                                return (
                                    <div 
                                        key={`x-${img.id}`}
                                        style={{
                                            position: 'absolute',
                                            left: `${(img.x / PDF_W) * 100}%`,
                                            top: `${(img.y / PDF_H) * 100}%`,
                                            width: `${(img.w / PDF_W) * 100}%`,
                                            height: `${(img.h / PDF_H) * 100}%`,
                                            pointerEvents: 'none'
                                        }}
                                        className="text-red-600 flex items-center justify-center"
                                    >
                                        <X strokeWidth={3} className="w-full h-full" />
                                    </div>
                                );
                            })}
                        </>
                    );
                }

                return (
                    <PDFPageCanvas 
                        key={index} 
                        page={page} 
                        pageIndex={pageIndex}
                        onRenderSuccess={handlePageRender}
                        onPageClick={onPageClick}
                        overlayElements={overlays}
                    />
                );
            })}
        </div>
    );
};

const DetailInput = ({ field, onChange }: { field: ProjectField, onChange: (val: string) => void }) => {
    const Icon = getIconComponent(field.icon);
    const isPhone = field.icon === 'Phone';
    const [localValue, setLocalValue] = useState(field.value);

    useEffect(() => {
        setLocalValue(field.value);
    }, [field.value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setLocalValue(val);
        onChange(val);
    };
    
    return (
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl px-4 py-3 border border-slate-100 dark:border-slate-700 focus-within:ring-2 focus-within:ring-primary/50 transition-all shadow-sm flex items-center justify-between gap-3 h-[60px] relative z-10">
            <Icon size={20} className="text-slate-400 shrink-0" />
            <input 
                type="text"
                inputMode={isPhone ? "tel" : "text"}
                value={localValue}
                onChange={handleChange}
                placeholder={field.label}
                className="w-full bg-transparent text-lg font-bold text-slate-800 dark:text-slate-200 outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
            />
        </div>
    );
};

const LocationCard = React.memo(({ location, onClick }: { location: LocationGroup, onClick: (id: string) => void }) => {
    const issueCount = location.issues.length;
    const photoCount = location.issues.reduce((acc, issue) => acc + issue.photos.length, 0);

    return (
        <button
            onClick={() => onClick(location.id)}
            className="relative px-4 py-3 rounded-[20px] text-left transition-all duration-300 group overflow-hidden bg-white dark:bg-slate-700/30 border-2 border-slate-200 dark:border-slate-600 shadow-sm hover:shadow-xl hover:border-primary/50 dark:hover:border-slate-500/50 hover:-translate-y-1 w-full flex flex-row items-center justify-between gap-3 min-h-[60px]"
        >
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="bg-primary dark:bg-slate-600 text-white text-sm font-bold px-2.5 py-0.5 rounded-2xl shadow-sm shadow-slate-200 dark:shadow-none shrink-0 min-w-[24px] text-center h-6 flex items-center justify-center">
                    {issueCount}
                </span>

                {photoCount > 0 && (
                    <span className="bg-primary dark:bg-slate-600 text-white text-xs font-bold px-2 py-0.5 rounded-2xl flex items-center justify-center gap-1 shrink-0 h-6 min-w-[24px] shadow-sm">
                        <Camera size={10} />
                        {photoCount}
                    </span>
                )}

                <h3 className="text-base font-bold text-primary dark:text-slate-200 tracking-tight truncate">
                    {location.name}
                </h3>
            </div>
            
            <div className="text-slate-400 dark:text-slate-400 shrink-0">
                <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </div>
        </button>
    );
});

export const LocationManagerModal = ({ locations, onUpdate, onClose }: { locations: LocationGroup[], onUpdate: (locs: LocationGroup[]) => void, onClose: () => void }) => {
    const [localLocations, setLocalLocations] = useState(locations);
    const [newLocName, setNewLocName] = useState("");

    const handleAdd = () => {
        if (!newLocName.trim()) return;
        setLocalLocations([...localLocations, { id: generateUUID(), name: newLocName.trim(), issues: [] }]);
        setNewLocName("");
    };

    const handleSave = () => {
        onUpdate(localLocations);
        onClose();
    };

    return createPortal(
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-[32px] shadow-xl overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-center items-center bg-white dark:bg-slate-800 shrink-0">
                    <div className="bg-slate-100 dark:bg-slate-700 px-4 py-2 rounded-full">
                         <h3 className="font-bold text-slate-800 dark:text-white">Manage Locations</h3>
                    </div>
                </div>
                <div className="p-4 space-y-4 overflow-y-auto flex-1 bg-white dark:bg-slate-800">
                    <div className="flex gap-2">
                        <input value={newLocName} onChange={e => setNewLocName(e.target.value)} placeholder="New Location..." className="flex-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none dark:text-white" />
                        <button onClick={handleAdd} className="bg-primary text-white p-3 rounded-xl"><Plus size={24} /></button>
                    </div>
                    <div className="space-y-2">
                        {localLocations.map(loc => (
                            <div key={loc.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                <span className="font-medium text-slate-700 dark:text-slate-200">{loc.name}</span>
                                <button onClick={() => setLocalLocations(localLocations.filter(l => l.id !== loc.id))} className="text-red-500 p-2"><Trash2 size={18} /></button>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex gap-3 shrink-0 bg-white dark:bg-slate-800">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-3 rounded-[20px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave}
                        className="flex-1 py-3 rounded-[20px] font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>, document.body
    );
};

export const AllItemsModal = ({ locations, onUpdate, onClose }: { locations: LocationGroup[], onUpdate: (locs: LocationGroup[]) => void, onClose: () => void }) => {
    const [localLocations, setLocalLocations] = useState(locations);

    const handleDescChange = (locId: string, issueId: string, val: string) => {
        setLocalLocations(prev => prev.map(l => {
            if (l.id !== locId) return l;
            return {
                ...l,
                issues: l.issues.map(i => i.id !== issueId ? i : { ...i, description: val })
            };
        }));
    };

    const handleSave = () => {
        onUpdate(localLocations);
        onClose();
    };
    
    const totalItems = localLocations.reduce((acc, l) => acc + l.issues.length, 0);

    return createPortal(
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 w-full max-w-2xl h-[85vh] rounded-[32px] shadow-xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header with Title Centered and No X Button */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-center items-center bg-white dark:bg-slate-800 shrink-0 z-20">
                    <div className="bg-slate-100 dark:bg-slate-700 px-4 py-2 rounded-full">
                        <h3 className="font-bold text-slate-800 dark:text-white">All Items ({totalItems})</h3>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900/50">
                    <div className="pb-4">
                        {localLocations.map(loc => {
                            if (loc.issues.length === 0) return null;
                            return (
                                <div key={loc.id} className="relative">
                                    {/* Clean Pill Header */}
                                    <div className="sticky top-0 z-10 py-3 flex justify-center pointer-events-none">
                                        <div className="bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 px-4 py-1.5 rounded-full shadow-sm pointer-events-auto">
                                             <h4 className="font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wide">{loc.name}</h4>
                                        </div>
                                    </div>
                                    <div className="space-y-3 px-4 pb-3">
                                        {loc.issues.map(issue => (
                                            <div key={issue.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                                                <textarea 
                                                    value={issue.description}
                                                    onChange={(e) => handleDescChange(loc.id, issue.id, e.target.value)}
                                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 outline-none resize-none text-slate-800 dark:text-slate-200 text-sm font-medium mb-3 min-h-[80px] focus:ring-2 focus:ring-primary/20 transition-all"
                                                />
                                                {issue.photos.length > 0 && (
                                                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                                        {issue.photos.map(p => (
                                                            <img key={p.id || generateUUID()} src={p.url} className="w-16 h-16 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0" />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                        {totalItems === 0 && (
                            <div className="text-center text-slate-400 py-10">No items found.</div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0 z-20 flex gap-3">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-3 rounded-[20px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave}
                        className="flex-1 py-3 rounded-[20px] font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export const ClientInfoEditModal = ({ project, onUpdate, onClose }: { project: ProjectDetails, onUpdate: (p: ProjectDetails) => void, onClose: () => void }) => {
    const [fields, setFields] = useState(project.fields || []);
    const handleSave = () => { onUpdate({ ...project, fields }); onClose(); };
    return createPortal(
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-[32px] shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <div className="bg-slate-100 dark:bg-slate-700 px-4 py-2 rounded-full">
                        <h3 className="font-bold text-slate-800 dark:text-white">Edit Client Info</h3>
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
                    {fields.map((field, i) => (
                        <div key={field.id} className="flex gap-2 items-center">
                             <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-500"><Hash size={16}/></div>
                             <input value={field.label} onChange={e => { const newF = [...fields]; newF[i] = { ...field, label: e.target.value }; setFields(newF); }} className="flex-1 p-2 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 dark:text-white" />
                             <button onClick={() => setFields(fields.filter((_, idx) => idx !== i))} className="text-red-500 p-2"><Trash2 size={16}/></button>
                        </div>
                    ))}
                    <button onClick={() => setFields([...fields, { id: generateUUID(), label: 'New Field', value: '', icon: 'FileText' }])} className="w-full p-3 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 font-bold flex items-center justify-center gap-2">
                        <Plus size={18} /> Add Field
                    </button>
                </div>
                <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex gap-3">
                     <button onClick={onClose} className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 rounded-xl font-bold text-slate-600 dark:text-slate-300">Cancel</button>
                     <button onClick={handleSave} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/30">Save</button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export const Dashboard: React.FC<DashboardProps> = ({ 
    project, 
    locations, 
    onSelectLocation, 
    onUpdateProject, 
    onUpdateLocations,
    onBack,
    companyLogo,
    isCreating,
    isExiting,
    onDelete,
    isDarkMode
}) => {
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [isLocManagerOpen, setIsLocManagerOpen] = useState(false);
    const [isAllItemsOpen, setIsAllItemsOpen] = useState(false);

    // Calculate stats
    const totalIssues = locations.reduce((acc, loc) => acc + loc.issues.length, 0);

    return (
        <div className={`h-full flex flex-col bg-slate-200 dark:bg-slate-950 transition-transform duration-500 ease-out ${isCreating ? 'translate-x-[100%]' : 'translate-x-0'} ${isExiting ? 'translate-x-[100%] opacity-0' : 'opacity-100'}`}>
            {/* Header */}
            <div className="px-6 py-5 flex items-center justify-between bg-transparent shrink-0">
                <button 
                    onClick={onBack}
                    className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-700 dark:text-slate-200 shadow-sm border border-slate-200 dark:border-slate-700 active:scale-95 transition-transform"
                >
                    <ArrowLeft size={24} strokeWidth={2.5} />
                </button>
                
                <div className="flex gap-3">
                     {onDelete && (
                        <button 
                            onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                onDelete(e, rect);
                            }}
                            className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 shadow-sm border border-slate-200 dark:border-slate-700 active:scale-95 transition-all"
                        >
                            <Trash2 size={24} />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-24">
                {/* Project Info Card */}
                <div 
                    onClick={() => setIsClientModalOpen(true)}
                    className="bg-white dark:bg-slate-800 rounded-[32px] p-6 shadow-sm border border-slate-200 dark:border-slate-700 mb-6 cursor-pointer hover:shadow-md transition-shadow group relative overflow-hidden"
                >
                     <div className="absolute top-4 right-4 text-slate-300 dark:text-slate-600 group-hover:text-primary transition-colors">
                        <Edit2 size={20} />
                     </div>
                     
                     <div className="flex items-center gap-4 mb-4">
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500">
                             {companyLogo ? <img src={companyLogo} className="w-10 h-10 object-contain" /> : <FileText size={32} />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-2xl font-bold text-slate-800 dark:text-white truncate">
                                {project.fields.find(f => f.label.includes("Name"))?.value || "Project Name"}
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400 truncate">
                                {project.fields.find(f => f.label.includes("Lot") || f.label.includes("Unit"))?.value || "Lot/Unit"}
                            </p>
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-2">
                        {project.fields.slice(2, 4).map(f => (
                            <div key={f.id} className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                <span className="text-xs font-bold text-slate-400 uppercase block mb-1">{f.label}</span>
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate block">{f.value || "-"}</span>
                            </div>
                        ))}
                     </div>
                </div>

                {/* Locations Header */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        Locations
                        <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs px-2 py-0.5 rounded-full">{locations.length}</span>
                    </h2>
                    <button 
                        onClick={() => setIsLocManagerOpen(true)}
                        className="p-2 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:text-primary transition-colors"
                    >
                        <Settings size={20} />
                    </button>
                </div>

                {/* Locations Grid */}
                <div className="space-y-3">
                    {locations.map(loc => (
                        <LocationCard 
                            key={loc.id}
                            location={loc}
                            onClick={onSelectLocation}
                        />
                    ))}
                    <button 
                        onClick={() => setIsLocManagerOpen(true)}
                        className="w-full py-4 rounded-[24px] border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600 transition-all font-bold flex items-center justify-center gap-2"
                    >
                        <Plus size={20} />
                        Add Location
                    </button>
                </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="fixed bottom-6 left-6 right-6 flex gap-3 z-30 pointer-events-none">
                 <button 
                    onClick={() => setIsAllItemsOpen(true)}
                    className="flex-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-2xl font-bold shadow-xl flex items-center justify-center gap-3 pointer-events-auto active:scale-95 transition-transform"
                 >
                    <Layers size={20} />
                    All Items ({totalIssues})
                 </button>
            </div>

            {/* Modals */}
            {isClientModalOpen && (
                <ClientInfoEditModal 
                    project={project}
                    onUpdate={onUpdateProject}
                    onClose={() => setIsClientModalOpen(false)}
                />
            )}

            {isLocManagerOpen && (
                <LocationManagerModal 
                    locations={locations}
                    onUpdate={onUpdateLocations}
                    onClose={() => setIsLocManagerOpen(false)}
                />
            )}

            {isAllItemsOpen && (
                <AllItemsModal 
                    locations={locations}
                    onUpdate={onUpdateLocations}
                    onClose={() => setIsAllItemsOpen(false)}
                />
            )}
        </div>
    );
};
