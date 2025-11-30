
import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import { LocationGroup, ProjectDetails, Issue, SignOffTemplate, SignOffSection, ProjectField, Point } from '../types';
import { ChevronRight, ArrowLeft, X, Plus, PenTool, Save, Trash2, Check, ChevronDown, Undo, Redo, Info, Download, Sun, Moon, FileText, MapPin, Eye, RefreshCw, Minimize2, Share, Mail, Pencil, Edit2, Send, Calendar, ChevronUp, Hand, Move, AlertCircle, MousePointer2, Settings, GripVertical, AlignLeft, CheckSquare, PanelLeft, User as UserIcon, Phone, Briefcase, Hash, Sparkles, Camera, Mic, MicOff, Layers } from 'lucide-react';
import { generateSignOffPDF, SIGN_OFF_TITLE, generatePDFWithMetadata, ImageLocation, CheckboxLocation } from '../services/pdfService';
import { AddIssueForm } from './LocationDetail';
import { generateUUID, PREDEFINED_LOCATIONS } from '../constants';
import { jsPDF } from 'jspdf';
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
  onDelete?: () => void;
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
    onDelete?: (e: React.MouseEvent) => void;
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
    const dateStr = new Date(lastModified).toLocaleDateString();
    
    // Header Logic
    const title = fields[0]?.value || "New Project";
    const subtitle = fields[1]?.value || "";
    
    // Remaining fields for list display (skip first 2)
    const detailFields = fields.slice(2);

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

    return (
        <div 
            onClick={!readOnly ? onClick : undefined}
            className={`w-full bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-sm border border-slate-200 dark:border-slate-800 transition-all relative group flex flex-col ${
                !readOnly && !isSelected ? 'hover:shadow-md hover:border-primary/50 cursor-pointer' : ''
            } ${isSelected ? 'ring-2 ring-primary bg-primary/5' : ''}`}
        >
            <div className="flex justify-between items-start mb-4">
                 <div className="flex-1 min-w-0 pr-4">
                     <h4 className="font-bold text-2xl text-slate-900 dark:text-white leading-tight break-words">
                         {title}
                     </h4>
                     {subtitle && (
                         <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm break-words mt-1">
                             {subtitle}
                         </p>
                     )}
                     
                     <div className="mt-3 space-y-1.5">
                        {detailFields.map(field => {
                            if (!field.value) return null;
                            const Icon = getIconComponent(field.icon);
                            const linkProps = getLinkProps(field);
                            const Wrapper = linkProps.href ? 'a' : 'div';
                            
                            return (
                                <Wrapper 
                                    key={field.id}
                                    className={`flex items-start gap-2 text-slate-500 dark:text-slate-400 group/item ${linkProps.href ? 'hover:text-primary dark:hover:text-blue-400 transition-colors' : ''}`}
                                    {...linkProps}
                                    onClick={linkProps.href ? (e) => e.stopPropagation() : undefined}
                                >
                                    <Icon size={14} className="shrink-0 mt-0.5" />
                                    <span className="text-xs font-medium break-words leading-relaxed">{field.value}</span>
                                </Wrapper>
                            );
                        })}
                     </div>
                 </div>
                 
                 {onDelete && (
                     <button 
                         onClick={(e) => { e.stopPropagation(); onDelete(e); }}
                         className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors shrink-0 shadow-sm"
                         title="Delete Report"
                     >
                         <Trash2 size={20} />
                     </button>
                 )}
            </div>
            
            <div className="pt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 mt-auto">
                <div className="bg-slate-100 dark:bg-slate-800 rounded-full px-3 py-1 flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        {issueCount} Items
                    </span>
                </div>

                {/* Date Pill */}
                <div className="bg-slate-100 dark:bg-slate-800 rounded-full px-3 py-1 flex items-center gap-1.5">
                    <Calendar size={12} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        {dateStr}
                    </span>
                </div>
            </div>

            {/* Actions Footer - Only show if docs exist AND actions provided */}
            {hasDocs && actions && (
                <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 animate-fade-in">
                    <button 
                        onClick={(e) => { e.stopPropagation(); actions.onViewReport?.(); }}
                        className="flex flex-col items-center justify-center gap-1 p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400 hover:text-primary"
                    >
                        <FileText size={20} />
                        <span className="text-[10px] font-bold">View Report</span>
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); actions.onViewSignOff?.(); }}
                        className="flex flex-col items-center justify-center gap-1 p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400 hover:text-primary"
                    >
                        <PenTool size={20} />
                        <span className="text-[10px] font-bold">View Sign Off</span>
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); actions.onEmail?.(); }}
                        className="flex flex-col items-center justify-center gap-1 p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400 hover:text-primary"
                    >
                        <Mail size={20} />
                        <span className="text-[10px] font-bold">Email</span>
                    </button>
                </div>
            )}
            
            {isSelected && (
                <div className="absolute right-6 top-6 text-primary">
                    <Check size={24} strokeWidth={3} />
                </div>
            )}
        </div>
    );
};

// --- PDF Canvas Renderer using pdf.js ---
const PDFPageCanvas: React.FC<{ 
    page: any, 
    pageIndex: number,
    onRenderSuccess?: (canvas: HTMLCanvasElement) => void,
    onPageClick?: (e: React.MouseEvent, pageIndex: number) => void
}> = ({ page, pageIndex, onRenderSuccess, onPageClick }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (canvasRef.current && page) {
            const viewport = page.getViewport({ scale: 1.5 }); // Good quality scale
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');
            
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            // Adjust style to be responsive (100% width)
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
        <div onClick={(e) => onPageClick && onPageClick(e, pageIndex)}>
            <canvas ref={canvasRef} className="shadow-lg rounded-sm bg-white mb-4 pdf-page-canvas" />
        </div>
    );
};

const PDFCanvasPreview = ({ 
    pdfUrl, 
    onAllPagesRendered, 
    onPageClick 
}: { 
    pdfUrl: string, 
    onAllPagesRendered?: () => void,
    onPageClick?: (e: React.MouseEvent, pageIndex: number) => void
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
                // Ensure pdfjsLib is available (loaded from CDN in index.html)
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
        <div className="w-full min-h-full flex flex-col items-center pt-8 pb-8">
            {pages.map((page, index) => (
                <PDFPageCanvas 
                    key={index} 
                    page={page} 
                    pageIndex={index + 1}
                    onRenderSuccess={handlePageRender}
                    onPageClick={onPageClick}
                />
            ))}
        </div>
    );
};

// Editable Detail Input with Local State Buffer
const DetailInput = ({ field, onChange }: { field: ProjectField, onChange: (val: string) => void }) => {
    const Icon = getIconComponent(field.icon);
    const isPhone = field.icon === 'Phone';
    const [localValue, setLocalValue] = useState(field.value);

    // Sync local state if prop changes externally (e.g. switching reports)
    useEffect(() => {
        setLocalValue(field.value);
    }, [field.value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setLocalValue(val);
        onChange(val);
    };
    
    return (
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl px-4 py-3 border border-slate-100 dark:border-slate-700 focus-within:ring-2 focus-within:ring-primary/50 transition-all shadow-sm flex items-center gap-3 h-[60px] relative z-10">
            <Icon size={20} className="text-slate-400 shrink-0" />
            <input 
                type="text"
                inputMode={isPhone ? "tel" : "text"}
                value={localValue}
                onChange={handleChange}
                placeholder={field.label}
                className="w-full bg-transparent text-lg font-bold text-slate-800 dark:text-white outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
            />
        </div>
    );
};

// Memoized Location Card
const LocationCard = React.memo(({ location, onClick }: { location: LocationGroup, onClick: (id: string) => void }) => {
    const issueCount = location.issues.length;
    return (
        <button
            onClick={() => onClick(location.id)}
            className="relative p-6 rounded-[24px] text-left transition-all duration-300 group overflow-hidden bg-white dark:bg-slate-700/30 border-2 border-slate-200 dark:border-slate-600 shadow-sm hover:shadow-xl hover:border-primary/50 dark:hover:border-slate-500/50 hover:-translate-y-1 w-full"
        >
            <div className="flex justify-between items-start mb-4">
                <span className="bg-primary dark:bg-slate-600 text-white text-sm font-bold px-3 py-1.5 rounded-full shadow-sm shadow-slate-200 dark:shadow-none">
                    {issueCount}
                </span>
            </div>
            
            <h3 className="text-xl font-bold mb-1 text-primary dark:text-white tracking-tight truncate">
                {location.name}
            </h3>
            <div className="flex items-center text-slate-400 dark:text-slate-400 gap-2 mt-auto">
                <span className="text-sm font-semibold">View Items</span>
                <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </div>
        </button>
    );
});

interface LocationManagerModalProps {
    locations: LocationGroup[];
    onUpdate: (locations: LocationGroup[]) => void;
    onClose: () => void;
}

const LocationManagerModal: React.FC<LocationManagerModalProps> = ({ locations, onUpdate, onClose }) => {
    const [newLocationName, setNewLocationName] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");

    const handleAdd = () => {
        if (!newLocationName.trim()) return;
        const newLoc: LocationGroup = {
            id: generateUUID(),
            name: newLocationName.trim(),
            issues: []
        };
        onUpdate([...locations, newLoc]);
        setNewLocationName("");
    };

    const handleDelete = (id: string) => {
        if (confirm("Delete this location and all its items?")) {
            onUpdate(locations.filter(l => l.id !== id));
        }
    };

    const startEdit = (loc: LocationGroup) => {
        setEditingId(loc.id);
        setEditName(loc.name);
    };

    const saveEdit = () => {
        if (editingId && editName.trim()) {
            onUpdate(locations.map(l => l.id === editingId ? { ...l, name: editName.trim() } : l));
            setEditingId(null);
            setEditName("");
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-[32px] shadow-2xl flex flex-col max-h-[85vh] animate-dialog-enter origin-center">
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 shrink-0 rounded-t-[32px]">
                    <div className="bg-slate-100 dark:bg-slate-700 px-4 py-2 rounded-full">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Manage Locations</h3>
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-400 transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto space-y-4 flex-1">
                    <div className="flex gap-2 mb-6">
                        <input 
                            type="text" 
                            value={newLocationName}
                            onChange={(e) => setNewLocationName(e.target.value)}
                            placeholder="New location name..."
                            className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[20px] px-4 py-3 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                        />
                        <button 
                            onClick={handleAdd}
                            disabled={!newLocationName.trim()}
                            className="bg-primary text-white p-3 rounded-[20px] disabled:opacity-50 hover:bg-primary/90 transition-colors"
                        >
                            <Plus size={24} />
                        </button>
                    </div>

                    <div className="space-y-2">
                        {locations.map(loc => (
                            <div key={loc.id} className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border border-slate-100 dark:border-slate-700">
                                {editingId === loc.id ? (
                                    <>
                                        <input 
                                            autoFocus
                                            type="text" 
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="flex-1 bg-white dark:bg-slate-600 rounded-lg px-2 py-1 outline-none text-slate-800 dark:text-white"
                                            onBlur={saveEdit}
                                            onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                                        />
                                        <button onClick={saveEdit} className="p-2 text-green-500 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-full">
                                            <Check size={18} />
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <span className="flex-1 font-medium text-slate-700 dark:text-slate-200 truncate">{loc.name}</span>
                                        <button onClick={() => startEdit(loc)} className="p-2 text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-600 rounded-full transition-colors">
                                            <Edit2 size={16} />
                                        </button>
                                        <button onClick={() => handleDelete(loc.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors">
                                            <Trash2 size={16} />
                                        </button>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

const ClientInfoEditModal = ({ project, onUpdate, onClose }: { project: ProjectDetails, onUpdate: (p: ProjectDetails) => void, onClose: () => void }) => {
    const [fields, setFields] = useState<ProjectField[]>(project.fields || []);
    
    // Available icons for selection
    const availableIcons = ['User', 'MapPin', 'Phone', 'Mail', 'Calendar', 'FileText', 'Hash', 'Briefcase'];

    const handleUpdateField = (index: number, key: keyof ProjectField, value: string) => {
        const newFields = [...fields];
        newFields[index] = { ...newFields[index], [key]: value };
        setFields(newFields);
    };

    const handleDeleteField = (index: number) => {
        setFields(fields.filter((_, i) => i !== index));
    };

    const handleAddField = () => {
        setFields([...fields, { 
            id: generateUUID(), 
            label: 'New Field', 
            value: '', 
            icon: 'FileText' 
        }]);
    };

    const handleSave = () => {
        onUpdate({ ...project, fields });
        onClose();
    };

    return createPortal(
        <div className="fixed inset-0 z-[160] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
             <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-[32px] shadow-2xl flex flex-col max-h-[85vh] animate-dialog-enter">
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center shrink-0">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Edit Client Info Schema</h3>
                    <button onClick={onClose}><X size={20} className="text-slate-500" /></button>
                </div>
                <div className="p-6 overflow-y-auto space-y-4 flex-1">
                    {fields.map((field, idx) => (
                        <div key={field.id} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-700/30 p-3 rounded-2xl border border-slate-100 dark:border-slate-700">
                             <div className="relative group">
                                 <select 
                                    value={field.icon}
                                    onChange={(e) => handleUpdateField(idx, 'icon', e.target.value)}
                                    className="appearance-none w-10 h-10 rounded-xl bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 flex items-center justify-center text-center outline-none focus:ring-2 focus:ring-primary text-transparent"
                                 >
                                    {availableIcons.map(icon => <option key={icon} value={icon}>{icon}</option>)}
                                 </select>
                                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-600 dark:text-slate-300">
                                     {React.createElement(getIconComponent(field.icon), { size: 18 })}
                                 </div>
                             </div>
                             <input 
                                value={field.label}
                                onChange={(e) => handleUpdateField(idx, 'label', e.target.value)}
                                className="flex-1 bg-transparent font-bold text-slate-700 dark:text-white outline-none border-b border-transparent focus:border-primary px-2 py-1"
                                placeholder="Field Label"
                             />
                             <button onClick={() => handleDeleteField(idx)} className="p-2 text-slate-400 hover:text-red-500">
                                 <Trash2 size={18} />
                             </button>
                        </div>
                    ))}
                    <button onClick={handleAddField} className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-slate-400 font-bold hover:text-primary hover:border-primary/50 transition-colors">
                        + Add Field
                    </button>
                </div>
                <div className="p-5 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-3 rounded-full font-bold text-slate-600 bg-slate-100 hover:bg-slate-200">Cancel</button>
                    <button onClick={handleSave} className="px-6 py-3 rounded-full font-bold text-white bg-primary hover:bg-primary/90">Save Changes</button>
                </div>
             </div>
        </div>,
        document.body
    );
};

const ReportPreviewModal = ({ project, locations, companyLogo, onClose, onUpdateProject }: { project: ProjectDetails, locations: LocationGroup[], companyLogo?: string, onClose: () => void, onUpdateProject: (p: ProjectDetails) => void }) => {
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const previewContainerRef = useRef<HTMLDivElement>(null);
    const [maps, setMaps] = useState<{ imageMap: ImageLocation[], checkboxMap: CheckboxLocation[] }>({ imageMap: [], checkboxMap: [] });
    const [marks, setMarks] = useState<Record<string, ('check' | 'x')[]>>({});

    useEffect(() => {
        let active = true;
        const gen = async () => {
            try {
                // Pass marks to PDF generator
                const { doc, imageMap, checkboxMap } = await generatePDFWithMetadata({ project, locations }, companyLogo, marks);
                if (active) {
                    const blob = doc.output('blob');
                    setPdfUrl(URL.createObjectURL(blob));
                    setMaps({ imageMap, checkboxMap });
                }
            } catch (e) {
                console.error(e);
            }
        };
        gen();
        return () => { active = false; if (pdfUrl) URL.revokeObjectURL(pdfUrl); };
    }, [project, locations, companyLogo, marks]); // Re-gen when marks change

    const handlePageClick = (e: React.MouseEvent, pageIndex: number) => {
        const target = e.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        
        // Calculate scale ratio between PDF A4 width (210mm) and rendered width
        const renderedWidth = rect.width;
        // Approximation: PDF width 210mm.
        // Coordinate conversion: clickX_mm = (clickX_px / renderedWidth_px) * 210
        const scale = 210 / renderedWidth;
        
        const clickX = (e.clientX - rect.left) * scale;
        const clickY = (e.clientY - rect.top) * scale;

        // Check Checkboxes (Toggle Check)
        const hitCheckbox = maps.checkboxMap.find(b => 
            b.pageIndex === pageIndex && 
            clickX >= b.x && clickX <= b.x + b.w &&
            clickY >= b.y && clickY <= b.y + b.h
        );

        if (hitCheckbox) {
            setMarks(prev => {
                const current = prev[hitCheckbox.id] || [];
                const hasCheck = current.includes('check');
                return {
                    ...prev,
                    [hitCheckbox.id]: hasCheck ? current.filter(m => m !== 'check') : [...current, 'check']
                };
            });
            return;
        }

        // Check Images (Toggle X)
        const hitImage = maps.imageMap.find(img => 
            img.pageIndex === pageIndex &&
            clickX >= img.x && clickX <= img.x + img.w &&
            clickY >= img.y && clickY <= img.y + img.h
        );

        if (hitImage) {
            setMarks(prev => {
                const current = prev[hitImage.id] || [];
                const hasX = current.includes('x');
                return {
                    ...prev,
                    [hitImage.id]: hasX ? current.filter(m => m !== 'x') : [...current, 'x']
                };
            });
        }
    };

    const handleGenerateThumbnail = async () => {
        setIsSaving(true);
        try {
            const canvas = previewContainerRef.current?.querySelector('canvas');
            if (canvas) {
                const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                onUpdateProject({ ...project, reportPreviewImage: dataUrl });
                onClose();
            } else {
                 onClose();
            }
        } catch(e) {
            console.error(e);
            onClose();
        } finally {
            setIsSaving(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
             <div className="bg-white dark:bg-slate-800 w-full max-w-2xl h-[90vh] rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-dialog-enter">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center shrink-0">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Report Preview</h3>
                    <button onClick={onClose}><X size={20} className="text-slate-500" /></button>
                </div>
                
                <div ref={previewContainerRef} className="flex-1 bg-slate-100 dark:bg-slate-900 overflow-y-auto relative p-4 flex items-center justify-center">
                     {pdfUrl ? (
                         <div className="w-full">
                            <PDFCanvasPreview 
                                pdfUrl={pdfUrl} 
                                onPageClick={handlePageClick}
                            />
                         </div>
                     ) : (
                         <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                     )}
                </div>
                
                <div className="p-5 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-3 rounded-full font-bold text-slate-600 bg-slate-100 hover:bg-slate-200">Close</button>
                    <button 
                        onClick={handleGenerateThumbnail} 
                        disabled={isSaving || !pdfUrl}
                        className="px-12 bg-white/10 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white py-3 rounded-full font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-all flex items-center justify-center gap-2 active:scale-[0.99] backdrop-blur-sm"
                    >
                        {isSaving ? 'Saving...' : <><Check size={18} /> Save</>}
                    </button>
                </div>
             </div>
        </div>,
        document.body
    );
};

// --- Template Editor Modal ---
const TemplateEditorModal = ({ template, onUpdate, onClose }: { template: SignOffTemplate, onUpdate: (t: SignOffTemplate) => void, onClose: () => void }) => {
    const [name, setName] = useState(template.name);
    const [sections, setSections] = useState(template.sections);

    const handleSectionChange = (idx: number, field: keyof SignOffSection, value: string) => {
        const newSections = [...sections];
        newSections[idx] = { ...newSections[idx], [field]: value };
        setSections(newSections);
    };
    
    const handleAddSection = () => {
        setSections([...sections, {
            id: generateUUID(),
            title: 'New Section',
            body: '',
            type: 'text'
        }]);
    };

    const handleDeleteSection = (idx: number) => {
        if (confirm("Delete this section?")) {
            setSections(sections.filter((_, i) => i !== idx));
        }
    };
    
    const handleMoveSection = (idx: number, direction: 'up' | 'down') => {
        if (direction === 'up' && idx > 0) {
            const newSections = [...sections];
            [newSections[idx], newSections[idx-1]] = [newSections[idx-1], newSections[idx]];
            setSections(newSections);
        } else if (direction === 'down' && idx < sections.length - 1) {
            const newSections = [...sections];
            [newSections[idx], newSections[idx+1]] = [newSections[idx+1], newSections[idx]];
            setSections(newSections);
        }
    };

    const handleSave = () => {
        onUpdate({ ...template, name, sections });
        onClose();
    };

    return createPortal(
        <div className="fixed inset-0 z-[160] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
             <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-[32px] shadow-2xl flex flex-col max-h-[85vh] animate-dialog-enter">
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center shrink-0">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Edit Template</h3>
                    <button onClick={onClose}><X size={20} className="text-slate-500" /></button>
                </div>
                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                    <div>
                        <label className="block text-sm font-bold text-slate-500 mb-1">Template Name</label>
                        <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-800 dark:text-white" />
                    </div>
                    {sections.map((section, idx) => (
                        <div key={section.id || idx} className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 group">
                             <div className="flex justify-between mb-2 items-center">
                                <span className="text-xs font-bold text-slate-400 uppercase">Section {idx + 1}</span>
                                <div className="flex gap-2">
                                     <button onClick={() => handleMoveSection(idx, 'up')} disabled={idx === 0} className="p-1.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"><ChevronUp size={16} /></button>
                                     <button onClick={() => handleMoveSection(idx, 'down')} disabled={idx === sections.length - 1} className="p-1.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"><ChevronDown size={16} /></button>
                                     <button onClick={() => handleDeleteSection(idx)} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
                                </div>
                             </div>
                             <input 
                                value={section.title} 
                                onChange={e => handleSectionChange(idx, 'title', e.target.value)} 
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg p-2 mb-2 font-bold text-slate-800 dark:text-white"
                                placeholder="Section Title"
                             />
                             <textarea 
                                value={section.body} 
                                onChange={e => handleSectionChange(idx, 'body', e.target.value)} 
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg p-2 min-h-[100px] text-slate-800 dark:text-white"
                                placeholder="Section Body Content..."
                             />
                             <div className="mt-2 flex items-center gap-2">
                                 <span className="text-xs text-slate-400 font-bold">Type:</span>
                                 <select 
                                    value={section.type || 'text'}
                                    onChange={(e) => handleSectionChange(idx, 'type', e.target.value)}
                                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-xs p-1"
                                 >
                                     <option value="text">Text Block</option>
                                     <option value="initials">Initials List</option>
                                     <option value="signature">Signature Block</option>
                                 </select>
                             </div>
                        </div>
                    ))}
                    
                    <button onClick={handleAddSection} className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-slate-400 font-bold hover:text-primary hover:border-primary/50 transition-colors flex items-center justify-center gap-2">
                        <Plus size={20} />
                        Add Section
                    </button>
                </div>
                <div className="p-5 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-3 rounded-full font-bold text-slate-600 bg-slate-100 hover:bg-slate-200">Cancel</button>
                    <button onClick={handleSave} className="px-6 py-3 rounded-full font-bold text-white bg-primary hover:bg-primary/90">Save Changes</button>
                </div>
             </div>
        </div>,
        document.body
    );
};

const SignOffModal = ({ project, companyLogo, onClose, onUpdateProject, templates, onUpdateTemplates }: any) => {
    // Safety check for templates array
    const safeTemplates = templates && templates.length > 0 ? templates : [{ id: 'default', name: 'Default', sections: [] }];
    const [selectedTemplateId, setSelectedTemplateId] = useState(safeTemplates[0].id);
    const [isGenerating, setIsGenerating] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [mode, setMode] = useState<'scroll' | 'ink'>('scroll');
    const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const isDrawingRef = useRef(false);
    const lastPoint = useRef<{x: number, y: number} | null>(null);
    
    // Stroke persistence state
    const [strokes, setStrokes] = useState<Point[][]>(project.signOffStrokes || []);
    const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
    
    const [isEditingTemplate, setIsEditingTemplate] = useState(false);

    const activeTemplate = safeTemplates.find((t: SignOffTemplate) => t.id === selectedTemplateId) || safeTemplates[0];

    // Generate Preview on Mount or Template Change
    // IMPORTANT: Depend on JSON.stringify(project.fields) instead of project to avoid refresh on strokes update
    const projectFieldsStr = JSON.stringify(project.fields);
    useEffect(() => {
        let active = true;
        const generatePreview = async () => {
            try {
                // Generate PDF - DO NOT pass saved signature image to prevent "box filling" feature
                const url = await generateSignOffPDF(
                    project, 
                    SIGN_OFF_TITLE, 
                    activeTemplate, 
                    companyLogo, 
                    undefined // Intentionally undefined to keep overlay method pure
                );
                if (active) {
                    setPreviewUrl(url);
                }
            } catch (e) {
                console.error("Preview generation failed", e);
            }
        };
        generatePreview();
        return () => { 
            active = false;
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [activeTemplate, projectFieldsStr, companyLogo]);

    // Ensure context styles are set correctly (resets on resize)
    const ensureContextStyles = (ctx: CanvasRenderingContext2D) => {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    };

    // Replay saved strokes
    const replayStrokes = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
        ctx.clearRect(0, 0, width, height);
        ensureContextStyles(ctx);
        
        strokes.forEach(stroke => {
            if (stroke.length < 1) return;
            ctx.beginPath();
            ctx.moveTo(stroke[0].x, stroke[0].y);
            if (stroke.length === 1) {
                ctx.lineTo(stroke[0].x, stroke[0].y);
            } else {
                for (let i = 1; i < stroke.length; i++) {
                    ctx.lineTo(stroke[i].x, stroke[i].y);
                }
            }
            ctx.stroke();
        });
    };

    // Handle Overlay Resize based on content and redraw strokes
    const handlePagesRendered = () => {
        if (contentRef.current && drawingCanvasRef.current) {
            const container = contentRef.current;
            const canvas = drawingCanvasRef.current;
            const dpr = window.devicePixelRatio || 1;
            
            // Wait a tick for layout to settle
            setTimeout(() => {
                // Use scroll dimensions for full coverage
                const width = container.scrollWidth;
                const height = container.scrollHeight;
                
                // High DPI Setup
                canvas.width = width * dpr;
                canvas.height = height * dpr;
                canvas.style.width = `${width}px`;
                canvas.style.height = `${height}px`;
                
                // Clear and prep canvas
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.scale(dpr, dpr);
                    replayStrokes(ctx, width, height);
                }
            }, 100);
        }
    };

    // Drawing Logic
    const getPoint = (e: React.PointerEvent) => {
        const canvas = drawingCanvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top + contentRef.current!.scrollTop // Adjust for scroll if canvas is static, but here canvas scrolls WITH content? 
            // Actually, canvas is absolute top:0 left:0 inside the scrollable container.
            // So e.clientX - rect.left is correct relative to canvas.
        };
    };

    const startDrawing = (e: React.PointerEvent) => {
        if (mode !== 'ink' || !e.isPrimary) return;
        // Relaxed Palm Rejection
        if (e.pointerType === 'touch' && (e.width > 25 || e.height > 25)) return;
        
        e.preventDefault(); 
        isDrawingRef.current = true;
        
        const pt = getPoint(e);
        lastPoint.current = pt;
        setCurrentStroke([pt]);
        
        const ctx = drawingCanvasRef.current?.getContext('2d');
        if (ctx) {
            ensureContextStyles(ctx); // Re-apply styles to be safe
            ctx.beginPath();
            ctx.moveTo(pt.x, pt.y);
            ctx.lineTo(pt.x, pt.y); // Draw dot
            ctx.stroke();
        }
    };

    const draw = (e: React.PointerEvent) => {
        if (!isDrawingRef.current || mode !== 'ink' || !e.isPrimary) return;
        e.preventDefault();
        
        // Coalesced events for smoother lines
        const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        const ctx = drawingCanvasRef.current?.getContext('2d');
        
        if (ctx && lastPoint.current) {
            ensureContextStyles(ctx); // Ensure styles match
            const newPoints: Point[] = [];
            for (const evt of events) {
                const pt = getPoint(evt);
                ctx.beginPath();
                ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
                ctx.lineTo(pt.x, pt.y);
                ctx.stroke();
                lastPoint.current = pt;
                newPoints.push(pt);
            }
            setCurrentStroke(prev => [...prev, ...newPoints]);
        }
    };

    const stopDrawing = () => {
        if (isDrawingRef.current) {
            isDrawingRef.current = false;
            lastPoint.current = null;
            if (currentStroke.length > 0) {
                const newStrokes = [...strokes, currentStroke];
                setStrokes(newStrokes);
                setCurrentStroke([]);
                // Update project state continuously so it persists if they close without "saving" pdf
                onUpdateProject({ ...project, signOffStrokes: newStrokes });
            }
        }
    };

    const handleSave = async () => {
        setIsGenerating(true);
        try {
            // 1. Capture the signed document (PDF content + Ink Overlay)
            const container = contentRef.current;
            if (!container || !drawingCanvasRef.current) return;

            const pdfCanvases = Array.from(container.querySelectorAll('.pdf-page-canvas')) as HTMLCanvasElement[];
            const inkCanvas = drawingCanvasRef.current;
            
            // Create a master canvas to hold everything
            // Use maximum dimensions found in PDF canvases
            const pdfWidth = Math.max(...pdfCanvases.map(c => c.width));
            const totalHeight = pdfCanvases.reduce((h, c) => h + c.height, 0);
            
            const masterCanvas = document.createElement('canvas');
            masterCanvas.width = pdfWidth;
            masterCanvas.height = totalHeight;
            
            const ctx = masterCanvas.getContext('2d');
            if (!ctx) throw new Error("Could not create master canvas");
            
            // Draw white background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, masterCanvas.width, masterCanvas.height);
            
            // Draw PDF pages stacking down
            let currentY = 0;
            pdfCanvases.forEach(c => {
                ctx.drawImage(c, 0, currentY, c.width, c.height);
                currentY += c.height;
            });
            
            // Draw Ink Overlay
            // Stretch ink canvas to fit master canvas (covers entire doc)
            ctx.drawImage(inkCanvas, 0, 0, masterCanvas.width, masterCanvas.height);
            
            const signedImageBase64 = masterCanvas.toDataURL('image/jpeg', 0.85);
            
            // 2. Generate Final PDF from the signed image
            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'px',
                format: [masterCanvas.width, masterCanvas.height] // Match canvas aspect
            });
            
            pdf.addImage(signedImageBase64, 'JPEG', 0, 0, masterCanvas.width, masterCanvas.height);
            const headerValue = project.fields?.[0]?.value || 'Project';
            pdf.save(`${headerValue} - Sign Off Sheet (Signed).pdf`);

            // 3. Save Thumbnail to Report (Project)
            const thumbCanvas = document.createElement('canvas');
            thumbCanvas.width = 400;
            thumbCanvas.height = 300;
            const tCtx = thumbCanvas.getContext('2d');
            if (tCtx) {
                tCtx.drawImage(masterCanvas, 0, 0, masterCanvas.width, masterCanvas.height, 0, 0, 400, 300);
                const thumbData = thumbCanvas.toDataURL('image/jpeg', 0.6);
                onUpdateProject({ 
                    ...project, 
                    signOffImage: thumbData,
                    signOffStrokes: strokes // Ensure strokes are saved
                });
            }

            onClose();
        } catch (e) {
            console.error("Sign off save failed", e);
        } finally {
            setIsGenerating(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 w-full max-w-2xl h-[90vh] rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-dialog-enter">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 shrink-0 relative z-20">
                    <div className="bg-slate-100 dark:bg-slate-700 px-4 py-2 rounded-full">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Sign Off</h3>
                    </div>
                </div>
                
                {/* PDF Container */}
                <div 
                    ref={contentRef} 
                    className={`flex-1 bg-slate-100 dark:bg-slate-900 relative overflow-x-hidden ${mode === 'ink' ? 'overflow-y-hidden touch-none' : 'overflow-y-auto'}`}
                >
                    {/* Always show template controls if edit needed or multiple templates */}
                    <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm p-4 border-b border-slate-200 dark:border-slate-700 flex gap-2">
                         <div className="flex-1 relative">
                             <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                 <Layers size={16} />
                             </div>
                             <select 
                                value={selectedTemplateId} 
                                onChange={(e) => setSelectedTemplateId(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-3 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-primary appearance-none font-bold"
                            >
                                {safeTemplates.map((t: SignOffTemplate) => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                <ChevronDown size={16} />
                            </div>
                        </div>
                        <button 
                            onClick={() => setIsEditingTemplate(true)}
                            className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 hover:text-primary transition-colors border border-slate-200 dark:border-slate-700"
                            title="Edit Template Text"
                        >
                            <Edit2 size={20} />
                        </button>
                    </div>
                    
                    <div className="relative min-h-full">
                        {previewUrl ? (
                            <PDFCanvasPreview 
                                pdfUrl={previewUrl} 
                                onAllPagesRendered={handlePagesRendered}
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                            </div>
                        )}
                        
                        {/* Ink Overlay Canvas */}
                        <canvas
                            ref={drawingCanvasRef}
                            className={`absolute top-0 left-0 z-50 ${mode === 'ink' ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'}`}
                            style={{ touchAction: 'none' }} 
                            onPointerDown={startDrawing}
                            onPointerMove={draw}
                            onPointerUp={stopDrawing}
                            onPointerLeave={stopDrawing}
                        />
                    </div>
                </div>

                {/* Footer Grid Layout for Perfect Centering */}
                <div className="p-5 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 grid grid-cols-[1fr_auto_1fr] items-center shrink-0 z-20 relative gap-2">
                    {/* Left: Empty spacer or Back button */}
                    <div className="justify-self-start">
                         <button onClick={onClose} className="px-6 py-3 rounded-full font-bold text-slate-600 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
                            Cancel
                        </button>
                    </div>
                    
                    {/* Center: Toggle */}
                    <div className="justify-self-center flex bg-slate-100 dark:bg-slate-700 p-1 rounded-full border border-slate-200 dark:border-slate-600 shadow-sm">
                        <button
                            onClick={() => setMode('scroll')}
                            className={`p-2 rounded-full transition-all flex items-center gap-2 px-4 text-sm font-bold ${
                                mode === 'scroll' 
                                ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm' 
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                            }`}
                        >
                            <Move size={16} />
                            <span className="hidden sm:inline">Scroll</span>
                        </button>
                        <button
                            onClick={() => setMode('ink')}
                            className={`p-2 rounded-full transition-all flex items-center gap-2 px-4 text-sm font-bold ${
                                mode === 'ink' 
                                ? 'bg-primary text-white shadow-sm' 
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                            }`}
                        >
                            <PenTool size={16} />
                            <span className="hidden sm:inline">Ink</span>
                        </button>
                    </div>

                    {/* Right: Actions */}
                    <div className="justify-self-end">
                        <button 
                            onClick={handleSave} 
                            disabled={isGenerating}
                            className="px-12 bg-white/10 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white py-3 rounded-full font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-all flex items-center justify-center gap-2 active:scale-[0.99] backdrop-blur-sm"
                        >
                            {isGenerating ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>

            {isEditingTemplate && (
                <TemplateEditorModal 
                    template={activeTemplate}
                    onUpdate={(updatedTpl) => {
                         const newTemplates = safeTemplates.map((t: SignOffTemplate) => t.id === updatedTpl.id ? updatedTpl : t);
                         onUpdateTemplates(newTemplates);
                    }}
                    onClose={() => setIsEditingTemplate(false)}
                />
            )}
        </div>,
        document.body
    );
};

// ... [Dashboard Component]
// Needs to pass hasDocs to ReportCard
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
  onDelete
}) => {
    // ... [Inside Dashboard Component - Keep logic mostly same but update ReportCard]
    // Capture initial state to prevent refresh when parent toggles prop off
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

    useEffect(() => {
        const anyModalOpen = isManageLocationsOpen || showReportPreview || showSignOff || showGlobalAddIssue || isEditClientInfoOpen || isEmailOptionsOpen;
        onModalStateChange(anyModalOpen);
    }, [isManageLocationsOpen, showReportPreview, showSignOff, showGlobalAddIssue, isEditClientInfoOpen, isEmailOptionsOpen, onModalStateChange]);

    const [isDetailsCollapsed, setIsDetailsCollapsed] = useState(false);
    const [isLocationsCollapsed, setIsLocationsCollapsed] = useState(false);
    
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
            } catch (error: any) {
                if (error.name !== 'AbortError' && error.message !== 'Share canceled' && !error.message?.includes('cancel')) {
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

    const handleEmailAll = async () => {
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
         const text = `Here are the walk through docs. The rewalk is scheduled for `;

         if (navigator.share && navigator.canShare && navigator.canShare({ files: filesToShare })) {
             try {
                 await navigator.share({
                     files: filesToShare,
                     title: title,
                     text: text
                 });
             } catch(e: any) {
                if (e.name !== 'AbortError' && e.message !== 'Share canceled' && !e.message?.includes('cancel')) {
                    console.error(e);
                }
             }
         } else {
             shareFile(reportBlob, reportFile.name, { title, text });
             setTimeout(() => shareFile(signOffBlob, signOffFile.name, { title, text }), 1000);
         }
    };

    const handleEmailPunchList = async () => {
        const reportRes = await generatePDFWithMetadata({ project, locations }, companyLogo);
        const reportBlob = new Blob([reportRes.doc.output('arraybuffer')], { type: 'application/pdf' });
        const headerValue = project.fields?.[0]?.value;
        await shareFile(reportBlob, `${headerValue || 'Project'} - New Home Completion List.pdf`, { title: "", text: "" });
    };

    const handleEmailSignOff = async () => {
        const tpl = signOffTemplates[0]; 
        const signOffUrl = await generateSignOffPDF(project, SIGN_OFF_TITLE, tpl, companyLogo, project.signOffImage ? project.signOffImage : undefined);
        const signOffBlob = await fetch(signOffUrl).then(r => r.blob());
        const headerValue = project.fields?.[0]?.value;
        await shareFile(signOffBlob, `${headerValue || 'Project'} - Sign Off Sheet.pdf`, { title: "", text: "" });
    };
    
    // Email Options Modal
    const EmailOptionsModal = ({ onClose }: { onClose: () => void }) => createPortal(
        <div 
            className="fixed inset-0 z-[160] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
            onClick={onClose}
        >
            <div 
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-800 rounded-[32px] shadow-2xl w-full max-w-sm p-6 animate-dialog-enter border border-slate-100 dark:border-slate-700"
            >
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 text-center">Share Documents</h3>
                <div className="space-y-3">
                    <button 
                        onClick={() => { handleEmailAll(); onClose(); }}
                        className="w-full py-4 rounded-2xl font-bold text-white bg-primary hover:bg-primary/90 flex items-center justify-center gap-2"
                    >
                        <Mail size={20} />
                        Email All Docs
                    </button>
                    <button 
                        onClick={() => { handleEmailPunchList(); onClose(); }}
                        className="w-full py-4 rounded-2xl font-bold text-slate-700 dark:text-white bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center gap-2"
                    >
                        <FileText size={20} />
                        Email Report Only
                    </button>
                    <button 
                         onClick={() => { handleEmailSignOff(); onClose(); }}
                         className="w-full py-4 rounded-2xl font-bold text-slate-700 dark:text-white bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center gap-2"
                     >
                        <PenTool size={20} />
                        Email Sign Off Only
                    </button>
                </div>
                <button 
                    onClick={onClose}
                    className="w-full mt-6 py-3 rounded-full font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                    Cancel
                </button>
            </div>
        </div>,
        document.body
    );

    const hasPunchList = !!project.reportPreviewImage;
    const hasSignOff = !!project.signOffImage;
    const hasDocs = hasPunchList || hasSignOff;
    
    return (
        <div 
            className={`min-h-screen animate-fade-in ${embedded ? 'bg-transparent pb-0 pt-0' : 'bg-slate-200 dark:bg-slate-950 pb-32'}`}
        >
            <div className={`max-w-3xl mx-auto ${embedded ? 'space-y-4 p-0' : 'p-6 space-y-8'} relative ${shouldInitialExpand ? 'animate-expand-sections origin-top overflow-hidden opacity-0' : ''}`}>
                
                {/* Active Report Card Header */}
                <div 
                    className={`animate-slide-up`} 
                    style={{ animationDelay: '0ms' }}
                >
                     <ReportCard 
                        project={project}
                        issueCount={locations.reduce((acc, loc) => acc + loc.issues.length, 0)}
                        lastModified={Date.now()}
                        onDelete={onDelete ? (e) => { e.stopPropagation(); onDelete(); } : undefined}
                        hasDocs={hasDocs}
                        actions={{
                            onEmail: () => setIsEmailOptionsOpen(true),
                            onViewReport: hasPunchList ? () => setShowReportPreview(true) : undefined,
                            onViewSignOff: hasSignOff ? () => setShowSignOff(true) : undefined
                        }}
                     />
                </div>

                {/* Project Details Form */}
                <div 
                    className={`bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-sm border border-slate-200 dark:border-slate-800 transition-all duration-300 ease-in-out overflow-hidden ${animationClass} ${embedded && !shouldInitialExpand ? 'animate-fade-in' : ''} ${isCreating ? 'animate-slide-up' : ''}`}
                    style={{
                        animationDelay: embedded && !shouldInitialExpand ? '0ms' : (isCreating ? '150ms' : undefined)
                    }}
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-slate-200 dark:bg-slate-800 px-4 py-2 rounded-full">
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Client Info</h2>
                            </div>
                            <button
                                onClick={() => setIsEditClientInfoOpen(true)}
                                className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:text-primary dark:text-slate-400 dark:hover:text-white transition-colors"
                                title="Edit Info Schema"
                            >
                                <Pencil size={20} />
                            </button>
                        </div>
                        <button 
                            onClick={() => setIsDetailsCollapsed(!isDetailsCollapsed)}
                            className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            {isDetailsCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                        </button>
                    </div>
                    
                    <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isDetailsCollapsed ? 'max-h-0 opacity-0' : 'max-h-[1000px] opacity-100'}`}>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2 animate-fade-in p-2">
                            {(project.fields || []).map((field, idx) => (
                                <div key={field.id} className={field.icon === 'MapPin' ? 'lg:col-span-2' : ''}>
                                    <DetailInput
                                        field={field}
                                        onChange={(val) => handleFieldChange(idx, val)}
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="mt-6 flex justify-center">
                            <div className="flex justify-center w-full">
                                <button
                                    onClick={() => setIsDetailsCollapsed(true)}
                                    className="px-12 bg-white/10 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white py-3 rounded-full font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-all flex items-center justify-center gap-2 active:scale-[0.99] backdrop-blur-sm"
                                >
                                    <Check size={18} />
                                    Save Info
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Locations Section */}
                <div 
                    ref={locationsRef} 
                    className={`bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-sm border border-slate-200 dark:border-slate-800 transition-all duration-300 ${animationClass} ${embedded && !shouldInitialExpand ? 'animate-fade-in' : ''} ${isCreating ? 'animate-slide-up' : ''}`}
                    style={{
                        animationDelay: embedded && !shouldInitialExpand ? '100ms' : (isCreating ? '300ms' : undefined)
                    }}
                >
                    <div className="flex flex-col sm:flex-row sm:items-center mb-4 gap-3 relative z-30">
                        <div className="flex-1 flex items-center gap-2 w-full relative">
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    value={locationSearch}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setLocationSearch(val);
                                        setShowLocationSuggestions(val.trim().length > 0);
                                    }}
                                    onFocus={() => {
                                        if (locationSearch.trim().length > 0) setShowLocationSuggestions(true);
                                    }}
                                    onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 200)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && locationSearch.trim()) {
                                            handleLocationSelect(locationSearch);
                                        }
                                    }}
                                    placeholder="Start typing to add a location"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-5 py-3 pl-12 text-sm text-slate-800 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                />
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                    <Plus size={20} />
                                </div>
                                
                                {showLocationSuggestions && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-xl max-h-48 overflow-y-auto z-[100] animate-fade-in">
                                        {filteredLocationSuggestions.length > 0 ? (
                                            filteredLocationSuggestions.map(loc => (
                                                <button
                                                    key={loc}
                                                    onClick={() => handleLocationSelect(loc)}
                                                    className="w-full text-left px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium transition-colors border-b border-slate-50 dark:border-slate-700/50 last:border-0 truncate"
                                                >
                                                    {loc}
                                                </button>
                                            ))
                                        ) : (
                                            <button
                                                 onClick={() => handleLocationSelect(locationSearch)}
                                                 className="w-full text-left px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 text-primary dark:text-blue-400 font-bold transition-colors italic"
                                             >
                                                 Create new: "{locationSearch}"
                                             </button>
                                        )}
                                    </div>
                                )}
                            </div>
                            
                            <button
                                onClick={() => setIsManageLocationsOpen(true)}
                                className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:text-primary dark:text-slate-400 dark:hover:text-white transition-colors shrink-0"
                                title="Manage Locations"
                            >
                                <Pencil size={20} />
                            </button>

                            <button 
                                onClick={() => setIsLocationsCollapsed(!isLocationsCollapsed)}
                                className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
                            >
                                 {isLocationsCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                            </button>
                        </div>
                    </div>
                    
                    <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isLocationsCollapsed ? 'max-h-0 opacity-0' : 'max-h-[5000px] opacity-100'}`}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {visibleLocations.map(loc => (
                                <LocationCard 
                                    key={loc.id} 
                                    location={loc} 
                                    onClick={onSelectLocation} 
                                />
                            ))}
                            
                            {visibleLocations.length === 0 && (
                                <div className="col-span-full py-8 text-center text-slate-400">
                                    <p>No active items.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Documents Section */}
                <div 
                    className={`bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-sm border border-slate-200 dark:border-slate-800 ${animationClass} ${embedded && !shouldInitialExpand ? 'animate-fade-in' : ''} ${isCreating ? 'animate-slide-up' : ''}`}
                    style={{
                        animationDelay: embedded && !shouldInitialExpand ? '200ms' : (isCreating ? '450ms' : undefined)
                    }}
                >
                    <div className="bg-slate-200 dark:bg-slate-800 px-4 py-2 rounded-full inline-block mb-4">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Documents</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <button 
                            onClick={() => setShowReportPreview(true)}
                            className={`relative p-6 rounded-[24px] shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center text-center group overflow-hidden h-48 w-full border-2 ${hasPunchList ? 'border-transparent' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700/50'}`}
                        >
                            {hasPunchList ? (
                                <>
                                    <img src={project.reportPreviewImage} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors" />
                                    <div className="relative z-10 flex flex-col items-center justify-center">
                                        <div className="mb-3 w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md text-white flex items-center justify-center shadow-lg">
                                            <FileText size={32} strokeWidth={2} />
                                        </div>
                                        <span className="block text-lg font-bold text-white leading-tight drop-shadow-md">Mark-up List</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="mb-3 w-16 h-16 rounded-2xl bg-primary/10 dark:bg-blue-900/20 text-primary dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                        <FileText size={32} strokeWidth={2} />
                                    </div>
                                    <span className="block text-lg font-bold text-slate-900 dark:text-white leading-tight">Report</span>
                                </>
                            )}
                        </button>

                        <button 
                            onClick={() => setShowSignOff(true)}
                            className={`relative p-6 rounded-[24px] shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center text-center group overflow-hidden h-48 w-full border-2 ${hasSignOff ? 'border-transparent' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700/50'}`}
                        >
                            {hasSignOff ? (
                                <>
                                    <img src={project.signOffImage} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors" />
                                    <div className="relative z-10 flex flex-col items-center justify-center">
                                        <div className="mb-3 w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md text-white flex items-center justify-center shadow-lg">
                                            <PenTool size={32} strokeWidth={2} />
                                        </div>
                                        <span className="block text-lg font-bold text-white leading-tight drop-shadow-md">Final Sign Off</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="mb-3 w-16 h-16 rounded-2xl bg-primary/10 dark:bg-blue-900/20 text-primary dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                        <PenTool size={32} strokeWidth={2} />
                                    </div>
                                    <span className="block text-lg font-bold text-slate-900 dark:text-white leading-tight">Sign Off</span>
                                </>
                            )}
                        </button>
                    </div>

                    {hasDocs && (
                        <div className="mt-6 animate-slide-up">
                            <button 
                                onClick={() => setIsEmailOptionsOpen(true)}
                                className="w-full bg-primary text-white p-4 rounded-[20px] font-bold flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transition-all active:scale-95 hover:bg-primary/90"
                            >
                                <Mail size={20} />
                                Email Documents
                            </button>
                        </div>
                    )}
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
                <EmailOptionsModal onClose={() => setIsEmailOptionsOpen(false)} />
            )}

            {showGlobalAddIssue && (
                <AddIssueForm 
                    onClose={() => setShowGlobalAddIssue(false)}
                    onSubmit={(issue, locationName) => {
                        const targetLoc = pendingLocation || locationName;
                        if (targetLoc) {
                            onAddIssueGlobal(targetLoc, issue);
                            setPendingLocation(""); 
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
        </div>
    );
});
