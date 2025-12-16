
import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import { LocationGroup, ProjectDetails, Issue, SignOffTemplate, SignOffSection, ProjectField, Point, SignOffStroke } from '../types';
import { ChevronRight, ArrowLeft, X, Plus, PenTool, Save, Trash2, Check, ChevronDown, Undo, Redo, Info, Download, Sun, Moon, FileText, MapPin, Eye, RefreshCw, Minimize2, Share, Mail, Pencil, Edit2, Send, Calendar, ChevronUp, Hand, Move, AlertCircle, MousePointer2, Settings, GripVertical, AlignLeft, CheckSquare, PanelLeft, User as UserIcon, Phone, Briefcase, Hash, Sparkles, Camera, Mic, MicOff, Layers, Eraser } from 'lucide-react';
import { generateSignOffPDF, SIGN_OFF_TITLE, generatePDFWithMetadata, ImageLocation, CheckboxLocation } from '../pdfService';
import { AddIssueForm, LocationDetail, AutoResizeTextarea, compressImage, DeleteConfirmationModal } from './LocationDetail';
import { generateUUID, PREDEFINED_LOCATIONS } from '../constants';
import { createPortal } from 'react-dom';
import { ImageEditor } from './ImageEditor';

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
  isClientInfoCollapsed?: boolean;
  onToggleClientInfo?: (collapsed: boolean) => void;
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
        onDownloadReportPDF?: () => void;
        onDownloadSignOffPDF?: () => void;
    };
    hasDocs?: boolean;
    onViewAllItems?: () => void;
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
    hasDocs,
    onViewAllItems
}) => {
    const fields = project.fields || [];
    const isSearchResult = !actions; // Identify if this is a search result/list card vs main dashboard card
    
    // Format date as MM/DD/YY
    const d = new Date(lastModified);
    const dateStr = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear().toString().slice(-2)}`;

    const cardRef = useRef<HTMLDivElement>(null);
    
    // Header Logic - for contact info icons
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
            return `${base} bg-primary-container dark:bg-primary/20 border-primary/30 dark:border-primary/30 text-primary dark:text-primary hover:bg-primary-container/80 dark:hover:bg-primary/30 border-solid`;
        }
        return `${base} bg-surface-container dark:bg-gray-700 border-surface-outline-variant dark:border-gray-600 text-surface-on-variant dark:text-gray-300 hover:bg-surface-container-high dark:hover:bg-gray-600 hover:text-primary border-solid`;
    };

    return (
        <div 
            ref={cardRef}
            onClick={!readOnly ? onClick : undefined}
            className={`w-full bg-surface dark:bg-gray-800 rounded-3xl px-4 py-6 shadow-sm border border-surface-outline-variant dark:border-gray-700 transition-all relative group flex flex-col ${
                !readOnly && !isSelected ? 'hover:shadow-md hover:border-primary/50 cursor-pointer' : ''
            } ${isSelected ? 'ring-2 ring-primary bg-primary-container/20' : ''}`}
        >
            {/* Client Info Section - Re-enabled for visual confirmation */}
            {fields.length > 0 && (
                <div className="mb-6 pb-6 border-b border-surface-outline-variant dark:border-gray-700">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {fields.map((field, idx) => {
                            const IconComponent = getIconComponent(field.icon);
                            const linkProps = getLinkProps(field);
                            const hasValue = field.value && field.value.trim() !== '';
                            
                            if (!hasValue && idx >= 2) return null; // Skip empty detail fields
                            
                            return (
                                <div 
                                    key={field.id} 
                                    className={`flex items-center gap-3 p-3 rounded-xl bg-surface-container dark:bg-gray-700 ${
                                        linkProps.href ? 'hover:bg-surface-container-high dark:hover:bg-gray-600 transition-colors cursor-pointer' : ''
                                    }`}
                                    {...(linkProps.href ? { onClick: (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (linkProps.href) window.open(linkProps.href, linkProps.target || '_self');
                                    }} : {})}
                                >
                                    <div className="p-2 bg-surface dark:bg-gray-800 rounded-lg text-primary dark:text-primary shrink-0">
                                        <IconComponent size={18} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs text-surface-on-variant dark:text-gray-400 font-medium mb-0.5">
                                            {field.label}
                                        </div>
                                        <div className="text-sm text-surface-on dark:text-gray-200 font-semibold truncate">
                                            {field.value || '—'}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            
            {/* Footer Row - Unified Group, Centered, Equal Spacing */}
            <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-auto w-full overflow-x-auto">
                {/* Actions */}
                {actions && (
                    <>
                        <button 
                            onClick={(e) => { 
                                e.preventDefault();
                                e.stopPropagation();
                                console.log('Report preview button clicked');
                                actions.onViewReport?.(); 
                            }}
                            className={`h-12 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center transition-colors active:scale-95 shadow-sm shrink-0 border px-3 sm:px-4 gap-1.5 ${
                                isReportSaved 
                                    ? 'bg-primary-container dark:bg-primary/20 border-primary/30 dark:border-primary/30 text-primary dark:text-primary hover:bg-primary-container/80 dark:hover:bg-primary/30 border-solid' 
                                    : 'bg-surface-container dark:bg-gray-700 border-surface-outline-variant dark:border-gray-600 text-surface-on-variant dark:text-gray-300 hover:bg-surface-container-high dark:hover:bg-gray-600 hover:text-primary border-solid'
                            }`}
                            title="View/Generate Report"
                            type="button"
                        >
                            <FileText size={18} className="sm:w-[20px] sm:h-[20px]" />
                            <span className="text-xs font-bold whitespace-nowrap">View Report</span>
                        </button>
                        <button 
                            onClick={(e) => { 
                                e.preventDefault();
                                e.stopPropagation();
                                console.log('Sign off button clicked');
                                actions.onViewSignOff?.(); 
                            }}
                            className={`h-12 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center transition-colors active:scale-95 shadow-sm shrink-0 border px-3 sm:px-4 gap-1.5 ${
                                isSignOffSaved 
                                    ? 'bg-primary-container dark:bg-primary/20 border-primary/30 dark:border-primary/30 text-primary dark:text-primary hover:bg-primary-container/80 dark:hover:bg-primary/30 border-solid' 
                                    : 'bg-surface-container dark:bg-gray-700 border-surface-outline-variant dark:border-gray-600 text-surface-on-variant dark:text-gray-300 hover:bg-surface-container-high dark:hover:bg-gray-600 hover:text-primary border-solid'
                            }`}
                            title="View/Sign Off"
                            type="button"
                        >
                            <PenTool size={18} className="sm:w-[20px] sm:h-[20px]" />
                            <span className="text-xs font-bold whitespace-nowrap">View Sign Off</span>
                        </button>
                        <button 
                            onClick={(e) => { 
                                e.preventDefault();
                                e.stopPropagation();
                                console.log('Download Report PDF button clicked');
                                actions.onDownloadReportPDF?.(); 
                            }}
                            className={`h-12 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center transition-colors active:scale-95 shadow-sm shrink-0 border px-3 sm:px-4 gap-1.5 ${
                                isReportSaved 
                                    ? 'bg-primary-container dark:bg-primary/20 border-primary/30 dark:border-primary/30 text-primary dark:text-primary hover:bg-primary-container/80 dark:hover:bg-primary/30 border-solid' 
                                    : 'bg-surface-container dark:bg-gray-700 border-surface-outline-variant dark:border-gray-600 text-surface-on-variant dark:text-gray-300 hover:bg-surface-container-high dark:hover:bg-gray-600 hover:text-primary border-solid'
                            }`}
                            title="Download Report PDF"
                            type="button"
                        >
                            <Download size={18} className="sm:w-[20px] sm:h-[20px]" />
                            <span className="text-xs font-bold whitespace-nowrap">Download Report</span>
                        </button>
                        <button 
                            onClick={(e) => { 
                                e.preventDefault();
                                e.stopPropagation();
                                console.log('Download Sign Off PDF button clicked');
                                actions.onDownloadSignOffPDF?.(); 
                            }}
                            className={`h-12 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center transition-colors active:scale-95 shadow-sm shrink-0 border px-3 sm:px-4 gap-1.5 ${
                                isSignOffSaved 
                                    ? 'bg-primary-container dark:bg-primary/20 border-primary/30 dark:border-primary/30 text-primary dark:text-primary hover:bg-primary-container/80 dark:hover:bg-primary/30 border-solid' 
                                    : 'bg-surface-container dark:bg-gray-700 border-surface-outline-variant dark:border-gray-600 text-surface-on-variant dark:text-gray-300 hover:bg-surface-container-high dark:hover:bg-gray-600 hover:text-primary border-solid'
                            }`}
                            title="Download Sign Off PDF"
                            type="button"
                        >
                            <Download size={18} className="sm:w-[20px] sm:h-[20px]" />
                            <span className="text-xs font-bold whitespace-nowrap">Download Sign Off</span>
                        </button>
                    </>
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
            <div className="flex items-center justify-center h-full w-full bg-surface-container dark:bg-gray-800">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full w-full bg-surface-container dark:bg-gray-800 p-4 text-center">
                <AlertCircle size={48} className="text-red-500 mb-4" />
                <p className="text-red-500 font-medium">Could not render PDF preview.</p>
                <p className="text-xs text-surface-on-variant dark:text-gray-400 mt-2">{error}</p>
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

    // Determine autocomplete attribute based on field properties
    // This enables the browser to suggest addresses, emails, and names
    const getAutoCompleteType = (label: string, icon: string): string => {
        const l = label.toLowerCase();
        if (l.includes('email')) return 'email';
        if (l.includes('phone')) return 'tel';
        if (l.includes('address')) return 'street-address';
        if (l.includes('zip') || l.includes('postal')) return 'postal-code';
        if (l.includes('city')) return 'address-level2';
        if (l.includes('state')) return 'address-level1';
        if (l.includes('name')) return 'name';
        
        // Fallback to icon hints
        if (icon === 'Mail') return 'email';
        if (icon === 'Phone') return 'tel';
        if (icon === 'User') return 'name';
        if (icon === 'MapPin') return 'street-address';

        return 'on';
    };

    const autoCompleteType = getAutoCompleteType(field.label, field.icon);

    useEffect(() => {
        setLocalValue(field.value);
    }, [field.value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setLocalValue(val);
        onChange(val);
    };
    
    return (
        <div className="bg-surface-container dark:bg-gray-700/50 rounded-2xl px-4 py-3 border border-surface-outline-variant dark:border-gray-600 focus-within:ring-2 focus-within:ring-primary/50 transition-all shadow-sm flex items-center justify-between gap-3 h-[60px] relative z-10">
            <Icon size={20} className="text-surface-on-variant dark:text-gray-400 shrink-0" />
            <input 
                type={isPhone ? "tel" : (autoCompleteType === 'email' ? 'email' : 'text')}
                inputMode={isPhone ? "tel" : (autoCompleteType === 'email' ? 'email' : 'text')}
                autoComplete={autoCompleteType}
                name={field.label}
                value={localValue}
                onChange={handleChange}
                placeholder={field.label}
                className="w-full bg-transparent text-lg font-bold text-surface-on dark:text-gray-200 outline-none placeholder:text-surface-on-variant dark:placeholder:text-gray-500"
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
            className="relative px-4 py-3 rounded-[20px] text-left transition-all duration-300 group overflow-hidden bg-surface dark:bg-gray-700/30 border-2 border-surface-outline-variant dark:border-gray-600 shadow-sm hover:shadow-xl hover:border-primary/50 dark:hover:border-primary/50 hover:-translate-y-1 w-full flex flex-row items-center justify-between gap-3 min-h-[60px]"
        >
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="bg-primary dark:bg-primary text-primary-on dark:text-primary-on text-sm font-bold px-2.5 py-0.5 rounded-2xl shadow-sm shadow-surface-outline-variant dark:shadow-none shrink-0 min-w-[24px] text-center h-6 flex items-center justify-center">
                    {issueCount}
                </span>

                {photoCount > 0 && (
                    <span className="bg-primary dark:bg-primary text-primary-on dark:text-primary-on text-xs font-bold px-2 py-0.5 rounded-2xl flex items-center justify-center gap-1 shrink-0 h-6 min-w-[24px] shadow-sm">
                        <Camera size={10} />
                        {photoCount}
                    </span>
                )}

                <h3 className="text-base font-bold text-primary dark:text-gray-200 tracking-tight truncate">
                    {location.name}
                </h3>
            </div>
            
            <div className="text-surface-on-variant dark:text-gray-400 shrink-0">
                <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </div>
        </button>
    );
});

// ... [Modal Components: LocationManagerModal, AllItemsModal, ClientInfoEditModal, ReportPreviewModal, TemplateEditorModal, SignOffModal, EmailOptionsModal remain same] ...
// Re-exporting them implicitly via the rest of the file which is unchanged except for DashboardProps and logic

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
            <div className="bg-surface dark:bg-gray-800 w-full max-w-lg rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-surface-outline-variant dark:border-gray-700 flex justify-center items-center bg-surface dark:bg-gray-800 shrink-0">
                    <div className="bg-surface-container dark:bg-gray-700 px-4 py-2 rounded-full">
                         <h3 className="font-bold text-surface-on dark:text-gray-100">Manage Locations</h3>
                    </div>
                </div>
                <div className="p-4 space-y-4 overflow-y-auto flex-1 bg-surface dark:bg-gray-800">
                    <div className="flex gap-2">
                        <input value={newLocName} onChange={e => setNewLocName(e.target.value)} placeholder="New Location..." className="flex-1 p-3 rounded-xl bg-surface-container dark:bg-gray-700 border border-surface-outline-variant dark:border-gray-600 outline-none dark:text-gray-200" />
                        <button onClick={handleAdd} className="bg-primary text-white p-3 rounded-xl"><Plus size={24} /></button>
                    </div>
                    <div className="space-y-2">
                        {localLocations.map(loc => (
                            <div key={loc.id} className="flex justify-between items-center p-3 bg-surface-container dark:bg-gray-700/50 rounded-xl border border-surface-outline-variant dark:border-gray-600">
                                <span className="font-medium text-surface-on dark:text-gray-200">{loc.name}</span>
                                <button onClick={() => setLocalLocations(localLocations.filter(l => l.id !== loc.id))} className="text-red-500 p-2"><Trash2 size={18} /></button>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="p-4 border-t border-surface-outline-variant dark:border-gray-700 flex gap-3 shrink-0 bg-surface dark:bg-gray-800">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-3 rounded-[20px] font-bold text-surface-on dark:text-gray-300 bg-surface-container dark:bg-gray-700 hover:bg-surface-container-high dark:hover:bg-gray-600 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave}
                        className="flex-1 py-3 rounded-[20px] font-bold text-surface-on dark:text-gray-200 bg-surface dark:bg-gray-800 border border-surface-outline-variant dark:border-gray-600 hover:bg-surface-container dark:hover:bg-gray-700 transition-colors shadow-sm"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>, document.body
    );
};

// ... (AllItemsModal, ClientInfoEditModal, ReportPreviewModal, TemplateEditorModal, SignOffModal, EmailOptionsModal omitted for brevity but remain unchanged) ...
// Re-including them briefly to ensure file integrity

export const AllItemsModal = ({ locations, onUpdate, onClose }: { locations: LocationGroup[], onUpdate: (locs: LocationGroup[]) => void, onClose: () => void }) => {
    // ... logic unchanged ...
    const [localLocations, setLocalLocations] = useState(locations);
    const [itemToDelete, setItemToDelete] = useState<{ locId: string, issueId: string } | null>(null);
    const [editingPhoto, setEditingPhoto] = useState<{ locId: string, issueId: string, photoIndex: number } | null>(null);
    const [uploadTarget, setUploadTarget] = useState<{ locId: string, issueId: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDescChange = (locId: string, issueId: string, val: string) => {
        setLocalLocations(prev => prev.map(l => {
            if (l.id !== locId) return l;
            return {
                ...l,
                issues: l.issues.map(i => i.id !== issueId ? i : { ...i, description: val })
            };
        }));
    };
    const handlePhotoCaptionChange = (locId: string, issueId: string, photoIndex: number, val: string) => {
        setLocalLocations(prev => prev.map(l => {
            if (l.id !== locId) return l;
            return {
                ...l,
                issues: l.issues.map(i => {
                    if (i.id !== issueId) return i;
                    const newPhotos = [...i.photos];
                    if (newPhotos[photoIndex]) {
                        newPhotos[photoIndex] = { ...newPhotos[photoIndex], description: val };
                    }
                    return { ...i, photos: newPhotos };
                })
            };
        }));
    };
    const handleDeletePhoto = (locId: string, issueId: string, photoIndex: number) => {
        setLocalLocations(prev => prev.map(l => {
            if (l.id !== locId) return l;
            return {
                ...l,
                issues: l.issues.map(i => {
                    if (i.id !== issueId) return i;
                    return { ...i, photos: i.photos.filter((_, idx) => idx !== photoIndex) };
                })
            };
        }));
    };
    const handleDeleteItem = () => {
        if (!itemToDelete) return;
        setLocalLocations(prev => prev.map(l => {
            if (l.id !== itemToDelete.locId) return l;
            return {
                ...l,
                issues: l.issues.filter(i => i.id !== itemToDelete.issueId)
            };
        }));
        setItemToDelete(null);
    };
    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && uploadTarget) {
            const file = e.target.files[0];
            try {
                // Show thumbnail immediately using object URL (instant)
                const tempUrl = URL.createObjectURL(file);
                const tempPhoto = { id: generateUUID(), url: tempUrl, description: '' };
                
                // Add photo immediately with temp URL
                setLocalLocations(prev => prev.map(l => {
                    if (l.id !== uploadTarget.locId) return l;
                    return {
                        ...l,
                        issues: l.issues.map(i => {
                            if (i.id !== uploadTarget.issueId) return i;
                            return { ...i, photos: [...i.photos, tempPhoto] };
                        })
                    };
                }));
                
                // Compress image in background and replace temp URL
                const compressed = await compressImage(file);
                setLocalLocations(prev => prev.map(l => {
                    if (l.id !== uploadTarget.locId) return l;
                    return {
                        ...l,
                        issues: l.issues.map(i => {
                            if (i.id !== uploadTarget.issueId) return i;
                            return {
                                ...i,
                                photos: i.photos.map(p => 
                                    p.id === tempPhoto.id ? { ...p, url: compressed } : p
                                )
                            };
                        })
                    };
                }));
                
                // Clean up temporary object URL
                URL.revokeObjectURL(tempUrl);
                
                if (fileInputRef.current) fileInputRef.current.value = '';
                setUploadTarget(null);
            } catch (err) { 
                console.error("Image upload failed", err);
                // Clean up on error
                if (fileInputRef.current) fileInputRef.current.value = '';
                setUploadTarget(null);
            }
        }
    };
    const triggerUpload = (locId: string, issueId: string) => {
        setUploadTarget({ locId, issueId });
        fileInputRef.current?.click();
    };
    const handleSaveEditedPhoto = (newUrl: string) => {
        if (editingPhoto) {
             setLocalLocations(prev => prev.map(l => {
                if (l.id !== editingPhoto.locId) return l;
                return {
                    ...l,
                    issues: l.issues.map(i => {
                        if (i.id !== editingPhoto.issueId) return i;
                        const newPhotos = [...i.photos];
                        if (newPhotos[editingPhoto.photoIndex]) {
                            newPhotos[editingPhoto.photoIndex] = { ...newPhotos[editingPhoto.photoIndex], url: newUrl };
                        }
                        return { ...i, photos: newPhotos };
                    })
                };
            }));
            setEditingPhoto(null);
        }
    };
    const handleSave = () => { onUpdate(localLocations); onClose(); };
    const totalItems = localLocations.reduce((acc, l) => acc + l.issues.length, 0);

    return createPortal(
        <>
            <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-surface dark:bg-gray-800 w-full max-w-2xl h-[85vh] rounded-3xl shadow-xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b border-surface-outline-variant dark:border-gray-700 flex justify-center items-center bg-surface dark:bg-gray-800 shrink-0 z-20">
                        <div className="bg-surface-container dark:bg-gray-700 px-4 py-2 rounded-full">
                            <h3 className="font-bold text-surface-on dark:text-gray-100">All Items ({totalItems})</h3>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto bg-surface-container dark:bg-gray-900/50">
                        <div className="pb-4">
                            {localLocations.map(loc => {
                                if (loc.issues.length === 0) return null;
                                return (
                                    <div key={loc.id} className="relative">
                                        <div className="sticky top-0 z-10 py-3 flex justify-center pointer-events-none">
                                            <div className="bg-surface-container/95 dark:bg-gray-800/95 backdrop-blur-md border border-surface-outline-variant dark:border-gray-700 px-4 py-1.5 rounded-full shadow-sm pointer-events-auto">
                                                 <h4 className="font-bold text-surface-on dark:text-gray-300 text-xs uppercase tracking-wide">{loc.name}</h4>
                                            </div>
                                        </div>
                                        <div className="space-y-3 px-4 pb-3">
                                            {loc.issues.map((issue, idx) => (
                                                <div key={issue.id} className="bg-surface dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-surface-outline-variant dark:border-gray-700">
                                                    <div className="flex justify-between items-start mb-2 gap-2">
                                                        <div className="bg-primary-container text-primary dark:bg-gray-700 dark:text-gray-300 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-1">
                                                            {idx + 1}
                                                        </div>
                                                        <AutoResizeTextarea value={issue.description} onChange={(e) => handleDescChange(loc.id, issue.id, e.target.value)} className="flex-1 bg-surface-container dark:bg-gray-700 rounded-xl p-3 text-sm text-surface-on dark:text-gray-200 border border-surface-outline-variant dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[40px]" placeholder="Item description..." />
                                                        <button onClick={() => setItemToDelete({ locId: loc.id, issueId: issue.id })} className="p-2 text-surface-on-variant dark:text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors shrink-0" title="Delete Item"><Trash2 size={18} /></button>
                                                    </div>
                                                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide ml-8 items-start">
                                                        {issue.photos.map((photo, pIdx) => (
                                                            <div key={pIdx} className="flex flex-col w-24 shrink-0 gap-1.5 group/wrapper">
                                                                <div className="w-full aspect-square rounded-xl overflow-hidden border border-surface-outline-variant dark:border-gray-600 relative group/photo cursor-pointer">
                                                                    <img src={photo.url} className="w-full h-full object-cover" onClick={() => setEditingPhoto({ locId: loc.id, issueId: issue.id, photoIndex: pIdx })} />
                                                                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover/photo:opacity-100 transition-opacity pointer-events-none"><Edit2 size={16} className="text-white drop-shadow-md" /></div>
                                                                    <button onClick={(e) => { e.stopPropagation(); handleDeletePhoto(loc.id, issue.id, pIdx); }} className="absolute top-1 right-1 bg-black/50 hover:bg-red-500 text-white p-1 rounded-full opacity-0 group-hover/photo:opacity-100 transition-opacity"><X size={12} /></button>
                                                                </div>
                                                                <input value={photo.description || ""} onChange={(e) => handlePhotoCaptionChange(loc.id, issue.id, pIdx, e.target.value)} placeholder="Caption..." className="w-full bg-surface-container dark:bg-gray-700 text-[10px] px-2 py-1.5 rounded-lg border border-surface-outline-variant dark:border-gray-600 outline-none focus:border-primary dark:text-gray-200" />
                                                            </div>
                                                        ))}
                                                        <button onClick={() => triggerUpload(loc.id, issue.id)} className="w-16 h-16 shrink-0 rounded-xl border-2 border-dashed border-surface-outline-variant dark:border-gray-600 flex flex-col items-center justify-center text-surface-on-variant dark:text-gray-400 hover:text-primary hover:border-primary/50 hover:bg-surface-container dark:hover:bg-gray-700/50 transition-colors" title="Add Photo"><Camera size={20} /><span className="text-[9px] font-bold mt-1">Add</span></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                            {totalItems === 0 && <div className="text-center text-surface-on-variant dark:text-gray-400 py-10">No items found.</div>}
                        </div>
                    </div>
                    <div className="p-4 border-t border-surface-outline-variant dark:border-gray-700 bg-surface dark:bg-gray-800 shrink-0 z-20 flex gap-3">
                        <button onClick={onClose} className="flex-1 py-3 rounded-[20px] font-bold text-surface-on dark:text-gray-300 bg-surface-container dark:bg-gray-700 hover:bg-surface-container-high dark:hover:bg-gray-600 transition-colors">Cancel</button>
                        <button onClick={handleSave} className="flex-1 py-3 rounded-[20px] font-bold text-surface-on dark:text-gray-200 bg-surface dark:bg-gray-800 border border-surface-outline-variant dark:border-gray-600 hover:bg-surface-container dark:hover:bg-gray-700 transition-colors shadow-sm">Save</button>
                    </div>
                </div>
            </div>
            <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handlePhotoUpload} />
            {itemToDelete && <DeleteConfirmationModal onConfirm={handleDeleteItem} onCancel={() => setItemToDelete(null)} title="Delete Item?" message="This action cannot be undone." />}
            {editingPhoto && (() => {
                const issue = localLocations.find(l => l.id === editingPhoto.locId)?.issues.find(i => i.id === editingPhoto.issueId);
                const photo = issue?.photos[editingPhoto.photoIndex];
                if (!issue || !photo) return null;
                return <ImageEditor imageUrl={photo.url} onSave={handleSaveEditedPhoto} onCancel={() => setEditingPhoto(null)} />;
            })()}
        </>,
        document.body
    );
};

export const ClientInfoEditModal = ({ project, onUpdate, onClose }: { project: ProjectDetails, onUpdate: (p: ProjectDetails) => void, onClose: () => void }) => {
    const [fields, setFields] = useState(project.fields || []);
    const handleSave = () => { onUpdate({ ...project, fields }); onClose(); };
    return createPortal(
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-surface dark:bg-gray-800 w-full max-w-lg rounded-3xl shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-surface-outline-variant dark:border-gray-700 flex justify-between items-center">
                    <div className="bg-surface-container dark:bg-gray-700 px-4 py-2 rounded-full"><h3 className="font-bold text-surface-on dark:text-gray-100">Edit Client Info</h3></div>
                    <button onClick={onClose} className="p-2 bg-surface-container dark:bg-gray-700 rounded-full text-surface-on-variant hover:text-surface-on dark:text-gray-400 dark:hover:text-gray-100 transition-colors"><X size={20} /></button>
                </div>
                <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
                    {fields.map((field, i) => (
                        <div key={field.id} className="flex gap-2 items-center">
                             <div className="p-2 bg-surface-container dark:bg-gray-700 rounded-lg text-surface-on-variant dark:text-gray-400"><Hash size={16}/></div>
                             <input value={field.label} onChange={e => { const newF = [...fields]; newF[i] = { ...field, label: e.target.value }; setFields(newF); }} className="flex-1 p-2 bg-surface-container dark:bg-gray-700 rounded-lg border border-surface-outline-variant dark:border-gray-600 dark:text-gray-200" />
                             <button onClick={() => setFields(fields.filter((_, idx) => idx !== i))} className="text-red-500 p-2"><Trash2 size={16}/></button>
                        </div>
                    ))}
                    <button onClick={() => setFields([...fields, { id: generateUUID(), label: 'New Field', value: '', icon: 'FileText' }])} className="w-full p-3 bg-surface-container dark:bg-gray-700 rounded-xl font-bold text-surface-on dark:text-gray-300 mt-2">+ Add Field</button>
                </div>
                <div className="p-4 border-t border-surface-outline-variant dark:border-gray-700">
                    <button onClick={handleSave} className="w-full bg-primary text-primary-on dark:text-primary-on py-3.5 rounded-[20px] font-bold shadow-sm hover:shadow-md transition-all active:scale-95">Save Changes</button>
                </div>
            </div>
        </div>, document.body
    );
};

export const ReportPreviewModal = ({ project, locations, companyLogo, onClose, onUpdateProject }: any) => {
    const [url, setUrl] = useState<string>("");
    const [maps, setMaps] = useState<{ imageMap: ImageLocation[], checkboxMap: CheckboxLocation[] } | undefined>(undefined);
    const [marks, setMarks] = useState<Record<string, ('check' | 'x')[]>>(project.reportMarks || {});

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    useEffect(() => {
        generatePDFWithMetadata({ project, locations }, companyLogo).then(res => {
            setUrl(res.doc.output('bloburl').toString());
            setMaps({ imageMap: res.imageMap, checkboxMap: res.checkboxMap });
        });
    }, [project, locations, companyLogo]); 

    const handlePageClick = (e: React.MouseEvent, pageIndex: number, rect: DOMRect) => {
        if (!maps) return;
        const pdfWidthMM = 210;
        const scale = pdfWidthMM / rect.width;
        const x = (e.clientX - rect.left) * scale;
        const y = (e.clientY - rect.top) * scale;
        
        const hitImage = maps.imageMap.find(m => m.pageIndex === pageIndex && x >= m.x && x <= m.x + m.w && y >= m.y && y <= m.y + m.h);
        const hitCheckbox = maps.checkboxMap.find(m => m.pageIndex === pageIndex && x >= m.x - 2 && x <= m.x + m.w + 2 && y >= m.y - 2 && y <= m.y + m.h + 2);

        if (hitImage) {
            setMarks(prev => {
                const current = prev[hitImage.id] || [];
                const hasX = current.includes('x');
                return { ...prev, [hitImage.id]: hasX ? current.filter(m => m !== 'x') : [...current, 'x'] };
            });
        } else if (hitCheckbox) {
             setMarks(prev => {
                const current = prev[hitCheckbox.id] || [];
                const hasCheck = current.includes('check');
                return { ...prev, [hitCheckbox.id]: hasCheck ? current.filter(m => m !== 'check') : [...current, 'check'] };
            });
        }
    };

    const handleSave = async () => {
        try {
            onUpdateProject({ ...project, reportMarks: marks });
            const res = await generatePDFWithMetadata({ project, locations }, companyLogo, marks);
            const pdfBlobUrl = res.doc.output('bloburl');
            window.open(pdfBlobUrl, '_blank');
        } catch(e) { console.error("Failed to generate PDF on save", e); }
        onClose();
    };

    const handleClose = () => {
        onUpdateProject({ ...project, reportMarks: marks });
        onClose();
    }

    return createPortal(
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={handleClose}>
             <div className="bg-surface dark:bg-gray-800 w-full max-w-4xl h-[90vh] rounded-3xl shadow-xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-surface-outline-variant dark:border-gray-700 flex justify-center items-center shrink-0">
                    <div className="bg-surface-container dark:bg-gray-700 px-4 py-2 rounded-2xl"><h3 className="font-bold text-surface-on dark:text-gray-100">Report Preview</h3></div>
                </div>
                <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900 relative">
                     {url ? <PDFCanvasPreview pdfUrl={url} onPageClick={handlePageClick} maps={maps} marks={marks} /> : <div className="flex justify-center p-10"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"/></div>}
                </div>
                <div className="p-4 border-t border-surface-outline-variant dark:border-gray-700 flex gap-3 shrink-0 bg-surface dark:bg-gray-800">
                    <button onClick={handleClose} className="flex-1 py-3 rounded-[20px] font-bold text-surface-on dark:text-gray-300 bg-surface-container dark:bg-gray-700 hover:bg-surface-container-high dark:hover:bg-gray-600 transition-colors">Cancel</button>
                    <button onClick={handleSave} className="flex-1 py-3 rounded-[20px] font-bold text-surface-on dark:text-gray-200 bg-surface dark:bg-gray-800 border border-surface-outline-variant dark:border-gray-600 hover:bg-surface-container dark:hover:bg-gray-700 transition-colors shadow-sm">Save</button>
                </div>
             </div>
        </div>, document.body
    );
};

export const TemplateEditorModal = ({ templates, onUpdate, onClose }: any) => {
    const [temp, setTemp] = useState(templates);
    const handleSave = () => { onUpdate(temp); onClose(); };
    return createPortal(
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
             <div className="bg-surface dark:bg-gray-800 w-full max-w-2xl h-[80vh] rounded-3xl shadow-xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                 <div className="p-4 border-b border-surface-outline-variant dark:border-gray-700 flex justify-between items-center">
                    <h3 className="font-bold text-surface-on dark:text-gray-100">Edit Templates</h3>
                    <button onClick={onClose}><X size={20} className="text-surface-on-variant dark:text-gray-400" /></button>
                </div>
                <div className="flex-1 overflow-auto p-6 space-y-6">
                    {temp.map((t: any, i: number) => (
                        <div key={t.id} className="space-y-4">
                            <input value={t.name} onChange={e => { const n = [...temp]; n[i].name = e.target.value; setTemp(n); }} className="w-full font-bold text-lg bg-transparent border-b border-surface-outline-variant dark:border-gray-700 outline-none dark:text-gray-200" />
                            {t.sections.map((s: any, j: number) => (
                                    <div key={s.id} className="p-4 bg-surface-container dark:bg-gray-700 rounded-2xl border border-surface-outline-variant dark:border-gray-600 space-y-2">
                                        <input value={s.title} onChange={e => { const n = [...temp]; n[i].sections[j].title = e.target.value; setTemp(n); }} className="w-full font-bold bg-transparent outline-none dark:text-gray-200" />
                                        <textarea value={s.body} onChange={e => { const n = [...temp]; n[i].sections[j].body = e.target.value; setTemp(n); }} className="w-full h-32 bg-transparent outline-none resize-none dark:text-gray-300" />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t border-surface-outline-variant dark:border-gray-700">
                    <button onClick={handleSave} className="w-full bg-primary text-white p-3 rounded-xl font-bold">Save Templates</button>
                </div>
             </div>
        </div>, document.body
    );
};

export const SignOffModal = ({ project, companyLogo, onClose, onUpdateProject, templates, onUpdateTemplates }: any) => {
    // ... same content as previous ...
    const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [strokes, setStrokes] = useState<(Point[] | SignOffStroke)[]>(project.signOffStrokes || []);
    const [resizeTrigger, setResizeTrigger] = useState(0);
    const overlayRef = useRef<HTMLDivElement>(null);
    const currentStroke = useRef<Point[]>([]);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const activePointers = useRef<Map<number, {x: number, y: number, type: string}>>(new Map());
    const currentTool = useRef<'ink' | 'erase' | null>(null);
    const isPanning = useRef(false);
    const lastPanPoint = useRef<{x: number, y: number} | null>(null);
    const isDrawing = useRef(false);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    useEffect(() => {
        generateSignOffPDF(project, SIGN_OFF_TITLE, templates[0], companyLogo, undefined).then(url => setPdfUrl(url));
    }, [project.fields, templates, companyLogo]);

    // ... pointer event handlers and layout effects omitted for brevity, logic remains identical ...
    const getPoint = (e: React.PointerEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const endCurrentStroke = (e: React.PointerEvent) => {
        if (!isDrawing.current || !currentTool.current) return;
        isDrawing.current = false;
        const newStroke: SignOffStroke = { points: currentStroke.current, type: currentTool.current };
        const newStrokes = [...strokes, newStroke];
        setStrokes(newStrokes);
        onUpdateProject({ ...project, signOffStrokes: newStrokes });
        currentStroke.current = [];
        currentTool.current = null;
    };
    const handlePointerDown = (e: React.PointerEvent) => {
        e.preventDefault(); e.stopPropagation();
        const canvas = canvasRef.current; if (canvas) canvas.setPointerCapture(e.pointerId);
        if (e.pointerType === 'pen') activePointers.current.clear();
        else if (e.pointerType === 'touch') { for (const [id, data] of activePointers.current.entries()) { if (data.type !== 'touch') activePointers.current.delete(id); } }
        activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
        if (e.pointerType === 'pen' || e.pointerType === 'mouse') { if (activePointers.current.size > 1) return; currentTool.current = 'ink'; isDrawing.current = true; const p = getPoint(e); currentStroke.current = [p]; return; }
        if (e.pointerType === 'touch') { const count = activePointers.current.size; if (count === 1) { currentTool.current = 'erase'; isDrawing.current = true; const p = getPoint(e); currentStroke.current = [p]; isPanning.current = false; } else if (count === 2) { if (isDrawing.current) endCurrentStroke(e); isPanning.current = true; currentTool.current = null; const points = Array.from(activePointers.current.values()) as {x: number, y: number}[]; if (points.length >= 2) { const cx = (points[0].x + points[1].x) / 2; const cy = (points[0].y + points[1].y) / 2; lastPanPoint.current = { x: cx, y: cy }; } } }
    };
    const handlePointerMove = (e: React.PointerEvent) => {
        e.preventDefault(); e.stopPropagation();
        const existing = activePointers.current.get(e.pointerId); if (existing) activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, type: existing.type }); else activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
        const ctx = canvasRef.current?.getContext('2d'); if (!ctx) return;
        if (isPanning.current && activePointers.current.size === 2) { const points = Array.from(activePointers.current.values()) as {x: number, y: number}[]; if (points.length >= 2) { const cx = (points[0].x + points[1].x) / 2; const cy = (points[0].y + points[1].y) / 2; if (lastPanPoint.current && overlayRef.current) { const dx = lastPanPoint.current.x - cx; const dy = lastPanPoint.current.y - cy; overlayRef.current.scrollLeft += dx; overlayRef.current.scrollTop += dy; } lastPanPoint.current = { x: cx, y: cy }; } return; }
        if (isDrawing.current && currentTool.current) { const p = getPoint(e); currentStroke.current.push(p); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; if (currentTool.current === 'ink') { ctx.lineWidth = 2; ctx.strokeStyle = 'black'; ctx.globalCompositeOperation = 'source-over'; } else if (currentTool.current === 'erase') { ctx.lineWidth = 40; ctx.strokeStyle = 'rgba(0,0,0,1)'; ctx.globalCompositeOperation = 'destination-out'; } const points = currentStroke.current; if (points.length >= 2) { const prev = points[points.length - 2]; ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); ctx.stroke(); } ctx.globalCompositeOperation = 'source-over'; }
    };
    const handlePointerUp = (e: React.PointerEvent) => { activePointers.current.delete(e.pointerId); const canvas = canvasRef.current; if (canvas && canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId); if (isDrawing.current) endCurrentStroke(e); if (activePointers.current.size < 2) { isPanning.current = false; lastPanPoint.current = null; } };
    const handleWheel = (e: React.WheelEvent) => { if (overlayRef.current) { overlayRef.current.scrollTop += e.deltaY; overlayRef.current.scrollLeft += e.deltaX; } };

    useLayoutEffect(() => {
        const overlay = overlayRef.current; const canvas = canvasRef.current; if (!overlay || !canvas) return;
        const resizeCanvas = () => { const { scrollWidth, scrollHeight } = overlay; const dpr = window.devicePixelRatio || 1; if (canvas.width !== scrollWidth * dpr || canvas.height !== scrollHeight * dpr) { canvas.width = scrollWidth * dpr; canvas.height = scrollHeight * dpr; canvas.style.width = `${scrollWidth}px`; canvas.style.height = `${scrollHeight}px`; const ctx = canvas.getContext('2d'); if (ctx) { ctx.scale(dpr, dpr); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; strokes.forEach(s => { const isV1 = Array.isArray(s); const points = isV1 ? s : s.points; const type = isV1 ? 'ink' : s.type; if (points.length < 2) return; ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y); for (let i = 1; i < points.length; i++) { ctx.lineTo(points[i].x, points[i].y); } if (type === 'erase') { ctx.lineWidth = 40; ctx.globalCompositeOperation = 'destination-out'; } else { ctx.lineWidth = 2; ctx.strokeStyle = 'black'; ctx.globalCompositeOperation = 'source-over'; } ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; }); } } };
        const observer = new ResizeObserver(() => { resizeCanvas(); }); observer.observe(overlay); resizeCanvas(); return () => observer.disconnect();
    }, [strokes, resizeTrigger]);

    const handleSave = async () => {
        const canvas = canvasRef.current; let signatureImage = undefined; if (canvas) { signatureImage = canvas.toDataURL('image/png'); }
        onUpdateProject({ ...project, signOffStrokes: strokes, signOffImage: signatureImage });
        const overlay = overlayRef.current; const containerWidth = overlay ? overlay.scrollWidth : 800; let pageHeight = undefined; let gapHeight = 16; let contentX = 0; let contentW = containerWidth;
        if (overlay) { const canvasEl = overlay.querySelector('.pdf-page-canvas'); if (canvasEl) { const canvasRect = canvasEl.getBoundingClientRect(); pageHeight = canvasRect.height; const overlayRect = overlay.getBoundingClientRect(); contentX = (canvasRect.left - overlayRect.left) + overlay.scrollLeft; contentW = canvasRect.width; if (canvasEl.parentElement) { const style = window.getComputedStyle(canvasEl.parentElement); const mb = parseFloat(style.marginBottom); if (!isNaN(mb)) gapHeight = mb; } } }
        const finalPdfUrl = await generateSignOffPDF(project, SIGN_OFF_TITLE, templates[0], companyLogo, signatureImage, undefined, containerWidth, pageHeight, gapHeight, contentX, contentW);
        window.open(finalPdfUrl, '_blank'); onClose();
    };

    return createPortal(
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            {isTemplateEditorOpen ? ( <TemplateEditorModal templates={templates} onUpdate={onUpdateTemplates} onClose={() => setIsTemplateEditorOpen(false)} /> ) : (
                <div className="bg-surface dark:bg-gray-800 w-full max-w-2xl h-[90vh] rounded-3xl shadow-xl flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-surface-outline-variant dark:border-gray-700 flex justify-center items-center shrink-0 relative">
                        <div className="bg-surface-container dark:bg-gray-700 px-4 py-2 rounded-2xl"><h3 className="font-bold text-surface-on dark:text-gray-100">Sign Off</h3></div>
                        <button onClick={() => setIsTemplateEditorOpen(true)} className="absolute right-4 p-2 bg-surface-container dark:bg-gray-700 rounded-2xl text-surface-on-variant hover:text-surface-on dark:text-gray-400 dark:hover:text-gray-100"><Settings size={20} className="text-surface-on-variant dark:text-gray-400" /></button>
                    </div>
                    <div ref={overlayRef} style={{ overflow: 'hidden' }} className="flex-1 bg-gray-100 dark:bg-gray-900 relative touch-none" onWheel={handleWheel}>
                         {pdfUrl ? ( <div className="relative min-h-full"><PDFCanvasPreview pdfUrl={pdfUrl} onAllPagesRendered={() => setResizeTrigger(prev => prev + 1)} /><canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, zIndex: 50, cursor: 'crosshair', touchAction: 'none' }} className="touch-none" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onLostPointerCapture={handlePointerUp} /></div> ) : ( <div className="flex justify-center p-10"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"/></div> )}
                    </div>
                    <div className="border-t border-surface-outline-variant dark:border-gray-700 bg-surface dark:bg-gray-800 shrink-0 z-20">
                        <div className="py-2 text-center select-none"><span className="text-[10px] font-bold text-surface-on-variant dark:text-gray-400 uppercase tracking-wide">2 Fingers to Scroll • Pen to Ink • 1 Finger to Erase</span></div>
                        <div className="p-4 pt-0 flex gap-3">
                            <button onClick={onClose} className="flex-1 py-3 rounded-[20px] font-bold text-surface-on dark:text-gray-300 bg-surface-container dark:bg-gray-700 hover:bg-surface-container-high dark:hover:bg-gray-600 transition-colors">Cancel</button>
                            <button onClick={handleSave} className="flex-1 py-3 rounded-[20px] font-bold text-surface-on dark:text-gray-200 bg-surface dark:bg-gray-800 border border-surface-outline-variant dark:border-gray-600 hover:bg-surface-container dark:hover:bg-gray-700 transition-colors shadow-sm">Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>, document.body
    );
};

// ... (EmailOptionsModal remains same) ...
const EmailOptionsModal = ({ onClose, project, locations, companyLogo, signOffTemplates }: { onClose: () => void; project: ProjectDetails; locations: LocationGroup[]; companyLogo?: string; signOffTemplates: SignOffTemplate[]; }) => {
    // ... logic unchanged ...
    const [isGenerating, setIsGenerating] = useState(false);
    const getSafeName = () => { const name = project.fields?.[0]?.value || "Project"; return name.replace(/[^a-z0-9]/gi, '_'); };
    const handleShare = async (files: File[], title?: string, text?: string) => { if (navigator.share && navigator.canShare && navigator.canShare({ files })) { try { await navigator.share({ files, title, text }); onClose(); } catch (error) { console.error("Share failed", error); } } else { alert("Sharing files is not supported on this browser/device."); } };
    const generateReportFile = async () => { const res = await generatePDFWithMetadata({ project, locations }, companyLogo, project.reportMarks); const blob = res.doc.output('blob'); const filename = `${getSafeName()} - New Home Completion List.pdf`; return new File([blob], filename, { type: 'application/pdf' }); };
    const generateSignOffFile = async () => { const blobUrl = await generateSignOffPDF(project, SIGN_OFF_TITLE, signOffTemplates[0], companyLogo, project.signOffImage, project.signOffStrokes, 800, undefined, 16); const blob = await fetch(blobUrl).then(r => r.blob()); const filename = `${getSafeName()} - Sign Off Sheet.pdf`; return new File([blob], filename, { type: 'application/pdf' }); };
    const handleEmailAll = async () => { setIsGenerating(true); try { const reportFile = await generateReportFile(); const signOffFile = await generateSignOffFile(); const safeProjectName = project.fields?.[0]?.value || "Project"; await handleShare([reportFile, signOffFile], `${safeProjectName} - Walk through docs`, "Here's the punch list and sign off sheet. The rewalk is scheduled for"); } catch (e) { console.error("Failed to generate files", e); } finally { setIsGenerating(false); } };
    const handleEmailReport = async () => { setIsGenerating(true); try { const reportFile = await generateReportFile(); await handleShare([reportFile]); } catch (e) { console.error("Failed to generate report", e); } finally { setIsGenerating(false); } };
    const handleEmailSignOff = async () => { setIsGenerating(true); try { const signOffFile = await generateSignOffFile(); await handleShare([signOffFile]); } catch (e) { console.error("Failed to generate sign off", e); } finally { setIsGenerating(false); } };
    return createPortal(
    <div className="fixed inset-0 z-[160] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} className="bg-surface dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-sm p-6 animate-dialog-enter border border-surface-outline-variant dark:border-gray-700">
            <h3 className="text-xl font-bold text-surface-on dark:text-gray-100 mb-6 text-center">Share Documents</h3>
            {isGenerating ? ( <div className="flex flex-col items-center justify-center py-8"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div><p className="text-surface-on-variant dark:text-gray-400 font-medium">Generating PDFs...</p></div> ) : (
                <div className="space-y-3">
                    <button onClick={handleEmailAll} className="w-full py-4 rounded-2xl font-bold text-white bg-primary hover:bg-primary/90 flex items-center justify-center gap-2"><Mail size={20} />Email All Docs</button>
                    <button onClick={handleEmailReport} className="w-full py-4 rounded-2xl font-bold text-surface-on dark:text-gray-100 bg-surface-container dark:bg-gray-700 hover:bg-surface-container-high dark:hover:bg-gray-600 flex items-center justify-center gap-2"><FileText size={20} />Email Report Only</button>
                    <button onClick={handleEmailSignOff} className="w-full py-4 rounded-2xl font-bold text-surface-on dark:text-gray-100 bg-surface-container dark:bg-gray-700 hover:bg-surface-container-high dark:hover:bg-gray-600 flex items-center justify-center gap-2"><PenTool size={20} />Email Sign Off Only</button>
                </div>
            )}
            <button onClick={onClose} disabled={isGenerating} className="w-full mt-6 py-3 rounded-full font-bold text-surface-on-variant dark:text-gray-400 hover:bg-surface-container dark:hover:bg-gray-800/50 disabled:opacity-50">Cancel</button>
        </div>
    </div>, document.body );
};

// [Dashboard Component]
export const Dashboard = React.memo<DashboardProps>(({ 
  project, 
  locations, 
  onSelectLocation, 
  onUpdateProject, 
  onUpdateLocations, 
  onBack, 
  onAddIssueGlobal, 
  isDarkMode, 
  toggleTheme,
  companyLogo,
  shouldScrollToLocations,
  onScrollComplete,
  onModalStateChange,
  signOffTemplates,
  onUpdateTemplates,
  embedded = false,
  reportId,
  initialExpand = false,
  isCreating = false,
  isExiting = false,
  onDelete,
  isClientInfoCollapsed,
  onToggleClientInfo
}) => {
    const [shouldInitialExpand] = useState(initialExpand);

    const [isManageLocationsOpen, setIsManageLocationsOpen] = useState(false);
    const [isEditClientInfoOpen, setIsEditClientInfoOpen] = useState(false);
    const [showReportPreview, setShowReportPreview] = useState(false);
    const [showSignOff, setShowSignOff] = useState(false);
    const [showGlobalAddIssue, setShowGlobalAddIssue] = useState(false);
    const [pendingLocation, setPendingLocation] = useState<string>("");
    
    const [locationSearch, setLocationSearch] = useState("");
    const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
    const [isEmailOptionsOpen, setIsEmailOptionsOpen] = useState(false);
    const [isAllItemsOpen, setIsAllItemsOpen] = useState(false);

    useEffect(() => {
        const anyModalOpen = isManageLocationsOpen || showReportPreview || showSignOff || showGlobalAddIssue || isEditClientInfoOpen || isEmailOptionsOpen || isAllItemsOpen;
        onModalStateChange(anyModalOpen);
    }, [isManageLocationsOpen, showReportPreview, showSignOff, showGlobalAddIssue, isEditClientInfoOpen, isEmailOptionsOpen, isAllItemsOpen, onModalStateChange]);

    // Lifted State handling for Client Info Collapse
    const [localDetailsCollapsed, setLocalDetailsCollapsed] = useState(false);
    
    // Use prop if available, otherwise local state
    const isDetailsCollapsed = isClientInfoCollapsed !== undefined ? isClientInfoCollapsed : localDetailsCollapsed;
    
    const setDetailsCollapsed = (val: boolean) => {
        setLocalDetailsCollapsed(val);
        if (onToggleClientInfo) {
            onToggleClientInfo(val);
        }
    };

    const [isLocationsCollapsed, setIsLocationsCollapsed] = useState(false);
    
    useEffect(() => {
        if (isCreating) {
            setDetailsCollapsed(false);
        }
    }, [isCreating]);
    
    const [animationClass] = useState((embedded && !shouldInitialExpand) ? "animate-slide-down" : "");

    const locationsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (shouldScrollToLocations && locationsRef.current) {
            locationsRef.current.scrollIntoView({ behavior: 'smooth' });
            if (onScrollComplete) onScrollComplete();
        }
    }, [shouldScrollToLocations]);

    const visibleLocations = useMemo(() => {
        return locations.filter(l => l.issues.length > 0);
    }, [locations]);
    
    const filteredLocationSuggestions = useMemo(() => {
        const allLocs = Array.from(new Set([...locations.map(l => l.name), ...PREDEFINED_LOCATIONS]));
        return allLocs.filter(loc => 
            loc.toLowerCase().includes(locationSearch.toLowerCase())
        );
    }, [locationSearch, locations]);

    const handleLocationSelect = (locName: string) => {
        setLocationSearch("");
        setShowLocationSuggestions(false);
        setPendingLocation(locName);
        setShowGlobalAddIssue(true);
    };

    const handleFieldChange = (index: number, newValue: string) => {
        const newFields = [...(project.fields || [])];
        if (newFields[index]) {
            const updatedField = { ...newFields[index], value: newValue };
            newFields[index] = updatedField;
            onUpdateProject({ ...project, fields: newFields });
        }
    };
    
    const handleUpdateLocationIssues = (updatedIssues: Issue[], locationId: string) => {
        onUpdateLocations(locations.map(l => 
            l.id === locationId ? { ...l, issues: updatedIssues } : l
        ));
    };

    const hasPunchList = !!project.reportPreviewImage;
    const hasSignOff = !!project.signOffImage;
    const hasDocs = hasPunchList || hasSignOff;
    
    return (
        <div 
            className={`min-h-screen animate-fade-in ${embedded ? 'bg-gray-200 dark:bg-gray-950 pb-6 pt-6' : 'bg-gray-200 dark:bg-gray-950 pb-32'}`}
            style={{ pointerEvents: 'auto' }}
        >
            <div className={`max-w-3xl mx-auto ${embedded ? 'space-y-4 p-0 pt-8 pb-8' : 'p-6 space-y-8'} relative ${shouldInitialExpand ? 'animate-expand-sections origin-top overflow-hidden opacity-0' : ''}`} style={{ pointerEvents: 'auto' }}>
                
                {/* Active Report Card Header */}
                <div 
                    className={`${isCreating ? 'opacity-0 animate-slide-up' : 'opacity-100'} ${isExiting ? 'animate-scale-out' : ''} ${embedded ? 'pt-8' : ''}`} 
                    style={{ 
                        animationDelay: '0ms',
                        animationFillMode: isCreating ? 'both' : undefined
                    }}
                >
                     <ReportCard 
                        project={project}
                        issueCount={locations.reduce((acc, loc) => acc + loc.issues.length, 0)}
                        lastModified={Date.now()}
                        onDelete={onDelete}
                        hasDocs={hasDocs}
                        actions={{
                            onEmail: () => {
                                console.log('Email button clicked');
                                setIsEmailOptionsOpen(true);
                            },
                            onViewReport: () => {
                                console.log('Report preview button clicked, setting showReportPreview to true');
                                setShowReportPreview(true);
                            },
                            onViewSignOff: () => {
                                console.log('Sign off button clicked, setting showSignOff to true');
                                setShowSignOff(true);
                            },
                            onDownloadReportPDF: async () => {
                                console.log('Download Report PDF button clicked');
                                try {
                                    const getSafeName = () => {
                                        const name = project.fields?.[0]?.value || "Project";
                                        return name.replace(/[^a-z0-9]/gi, '_');
                                    };
                                    const res = await generatePDFWithMetadata({ project, locations }, companyLogo, project.reportMarks);
                                    const blob = res.doc.output('blob');
                                    const filename = `${getSafeName()} - New Home Completion List.pdf`;
                                    
                                    // Create download link
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = filename;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    URL.revokeObjectURL(url);
                                } catch (error) {
                                    console.error('Error downloading report PDF:', error);
                                }
                            },
                            onDownloadSignOffPDF: async () => {
                                console.log('Download Sign Off PDF button clicked');
                                try {
                                    const getSafeName = () => {
                                        const name = project.fields?.[0]?.value || "Project";
                                        return name.replace(/[^a-z0-9]/gi, '_');
                                    };
                                    const blobUrl = await generateSignOffPDF(project, SIGN_OFF_TITLE, signOffTemplates[0], companyLogo, project.signOffImage, project.signOffStrokes, 800, undefined, 16);
                                    const blob = await fetch(blobUrl).then(r => r.blob());
                                    const filename = `${getSafeName()} - Sign Off Sheet.pdf`;
                                    
                                    // Create download link
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = filename;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    URL.revokeObjectURL(url);
                                } catch (error) {
                                    console.error('Error downloading sign off PDF:', error);
                                }
                            }
                        }}
                        onViewAllItems={() => {
                            console.log('View all items clicked, setting isAllItemsOpen to true');
                            setIsAllItemsOpen(true);
                        }}
                     />
                </div>

                {/* Locations Section */}
                <div 
                    ref={locationsRef} 
                    className={`bg-surface dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-surface-outline-variant dark:border-gray-700 transition-all duration-300 ${animationClass} ${embedded && !shouldInitialExpand ? 'animate-fade-in' : ''} ${isCreating ? 'opacity-0 animate-slide-up' : ''} ${isExiting ? 'animate-slide-down-exit' : ''}`}
                    style={{
                        animationDelay: embedded && !shouldInitialExpand ? '100ms' : (isCreating ? '700ms' : '100ms'),
                        animationFillMode: isCreating || isExiting ? 'both' : undefined
                    }}
                >
                    {/* Locations Header Row */}
                    <div className="flex items-center justify-between mb-6 relative z-30">
                        <div className="flex items-center gap-3 w-full justify-center relative">
                            {/* Manage Locations Left */}
                            <button
                                onClick={() => setIsManageLocationsOpen(true)}
                                className="absolute left-0 p-3 bg-surface-container dark:bg-gray-700 rounded-2xl text-surface-on-variant hover:text-primary dark:text-gray-400 dark:hover:text-primary transition-colors shrink-0 z-10"
                                title="Manage Locations"
                            >
                                <Pencil size={20} />
                            </button>

                            {/* Title Center - Updated to Rounded Full (Pill) */}
                            <div className="bg-surface-container dark:bg-gray-700 px-6 py-2.5 rounded-full">
                                <h2 className="text-lg font-bold text-surface-on dark:text-gray-200">Report Items</h2>
                            </div>
                        </div>
                    </div>
                    
                    <div className="transition-all duration-500 ease-in-out overflow-hidden pt-2">
                        {/* Search Row */}
                        <div className="flex justify-center mb-6 relative z-20 px-2">
                            <div className="w-full max-w-md relative">
                                <input
                                    type="text"
                                    value={locationSearch}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setLocationSearch(val);
                                        setShowLocationSuggestions(val.trim().length > 0);
                                    }}
                                    onFocus={(e) => {
                                        if (locationSearch.trim().length > 0) setShowLocationSuggestions(true);
                                        // Mobile Keyboard Scroll Fix
                                        setTimeout(() => {
                                            e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        }, 300);
                                    }}
                                    onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 200)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && locationSearch.trim()) {
                                            handleLocationSelect(locationSearch);
                                        }
                                    }}
                                    placeholder="Start typing to add a location"
                                    className="w-full bg-surface-container dark:bg-gray-700 border border-surface-outline-variant dark:border-gray-600 rounded-full pl-14 pr-5 py-3 text-left text-sm text-surface-on dark:text-gray-200 font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                />
                                
                                {showLocationSuggestions && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-surface dark:bg-gray-800 border border-surface-outline-variant dark:border-gray-700 rounded-2xl shadow-xl max-h-48 overflow-y-auto z-[200] animate-fade-in text-left">
                                        {filteredLocationSuggestions.length > 0 ? (
                                            filteredLocationSuggestions.map(loc => (
                                                <button
                                                    key={loc}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        console.log('Location suggestion clicked:', loc);
                                                        handleLocationSelect(loc);
                                                    }}
                                                    className="w-full text-left px-5 py-3 hover:bg-surface-container dark:hover:bg-gray-700 text-surface-on dark:text-gray-200 font-medium transition-colors border-b border-surface-outline-variant/50 dark:border-gray-700/50 last:border-0 truncate"
                                                    type="button"
                                                >
                                                    {loc}
                                                </button>
                                            ))
                                        ) : (
                                            <button
                                                 onClick={(e) => {
                                                     e.preventDefault();
                                                     e.stopPropagation();
                                                     console.log('Create new location clicked:', locationSearch);
                                                     handleLocationSelect(locationSearch);
                                                 }}
                                                 className="w-full text-left px-5 py-3 hover:bg-surface-container dark:hover:bg-gray-700 text-primary dark:text-primary font-bold transition-colors italic"
                                                 type="button"
                                             >
                                                 Create new: "{locationSearch}"
                                             </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-1">
                            {visibleLocations.map(loc => (
                                <LocationCard 
                                    key={loc.id} 
                                    location={loc} 
                                    onClick={onSelectLocation} 
                                />
                            ))}
                            
                            {visibleLocations.length === 0 && (
                                <div className="col-span-full py-8 text-center text-surface-on-variant dark:text-gray-400">
                                    <p>No active items.</p>
                                </div>
                            )}
                        </div>

                         <div className="mt-8 flex justify-center pb-2">
                             <button 
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    console.log('View all items button clicked (from locations section)');
                                    setIsAllItemsOpen(true);
                                }}
                                className="px-8 bg-surface-container dark:bg-gray-700 border border-surface-outline-variant dark:border-gray-600 text-surface-on dark:text-gray-200 py-2 rounded-full text-xs font-bold shadow-sm hover:bg-surface-container-high dark:hover:bg-gray-600 transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
                            >
                                <Layers size={14} />
                                View All Items
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {isManageLocationsOpen && (
                <LocationManagerModal 
                    locations={locations} 
                    onUpdate={onUpdateLocations} 
                    onClose={() => setIsManageLocationsOpen(false)} 
                />
            )}
            
            {isEditClientInfoOpen && (
                <ClientInfoEditModal
                    project={project}
                    onUpdate={onUpdateProject}
                    onClose={() => setIsEditClientInfoOpen(false)}
                />
            )}
            
            {isEmailOptionsOpen && (
                <EmailOptionsModal 
                    onClose={() => setIsEmailOptionsOpen(false)} 
                    project={project}
                    locations={locations}
                    companyLogo={companyLogo}
                    signOffTemplates={signOffTemplates}
                />
            )}

            {showGlobalAddIssue && (
                <AddIssueForm 
                    onClose={() => setShowGlobalAddIssue(false)}
                    onSubmit={(issue, locationName) => {
                        const targetLoc = pendingLocation || locationName;
                        if (targetLoc) {
                            onAddIssueGlobal(targetLoc, issue);
                        }
                    }}
                    showLocationSelect={false} 
                    availableLocations={locations.map(l => l.name)}
                />
            )}

            {showReportPreview && (
                <ReportPreviewModal 
                    project={project}
                    locations={locations}
                    companyLogo={companyLogo}
                    onClose={() => setShowReportPreview(false)}
                    onUpdateProject={onUpdateProject}
                />
            )}

            {showSignOff && (
                <SignOffModal 
                    project={project}
                    companyLogo={companyLogo}
                    onClose={() => setShowSignOff(false)}
                    onUpdateProject={onUpdateProject}
                    templates={signOffTemplates}
                    onUpdateTemplates={onUpdateTemplates}
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
});
