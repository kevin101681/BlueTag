import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import { LocationGroup, ProjectDetails, Issue, SignOffTemplate, SignOffSection, ProjectField } from '../types';
import { ChevronRight, ArrowLeft, X, Plus, PenTool, Save, Trash2, Check, ChevronDown, Undo, Redo, Info, Download, Sun, Moon, FileText, MapPin, Eye, RefreshCw, Minimize2, Share, Mail, Pencil, Edit2, Send, Calendar, ChevronUp, Hand, Move, AlertCircle, MousePointer2, Settings, GripVertical, AlignLeft, CheckSquare, PanelLeft, User as UserIcon, Phone, Briefcase, Hash, Sparkles, Camera, Mic, MicOff } from 'lucide-react';
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

// --- PDF Canvas Renderer using pdf.js ---
const PDFPageCanvas: React.FC<{ page: any, onRenderSuccess?: (canvas: HTMLCanvasElement) => void }> = ({ page, onRenderSuccess }) => {
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

    return <canvas ref={canvasRef} className="shadow-lg rounded-sm bg-white mb-4 pdf-page-canvas" />;
};

const PDFCanvasPreview = ({ pdfUrl, onAllPagesRendered }: { pdfUrl: string, onAllPagesRendered?: () => void }) => {
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
                <PDFPageCanvas key={index} page={page} onRenderSuccess={handlePageRender} />
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
                type={isPhone ? "tel" : "text"}
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
                            /* Removed autoFocus to prevent keyboard pop-up */
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

// --- Client Info Editor Modal (Dynamic Schema) ---
const ClientInfoEditModal = ({ 
    project, 
    onUpdate, 
    onClose 
}: { 
    project: ProjectDetails, 
    onUpdate: (details: ProjectDetails) => void, 
    onClose: () => void 
}) => {
    // Clone fields for local state editing
    const [fields, setFields] = useState<ProjectField[]>(JSON.parse(JSON.stringify(project.fields || [])));

    const handleUpdateField = (index: number, updates: Partial<ProjectField>) => {
        const newFields = [...fields];
        newFields[index] = { ...newFields[index], ...updates };
        setFields(newFields);
    };

    const handleAddField = () => {
        setFields([
            ...fields,
            { id: generateUUID(), label: 'New Field', value: '', icon: 'FileText' }
        ]);
    };

    const handleDeleteField = (index: number) => {
        setFields(fields.filter((_, i) => i !== index));
    };

    const handleMoveField = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index > 0) {
            const newFields = [...fields];
            [newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]];
            setFields(newFields);
        } else if (direction === 'down' && index < fields.length - 1) {
            const newFields = [...fields];
            [newFields[index + 1], newFields[index]] = [newFields[index], newFields[index + 1]];
            setFields(newFields);
        }
    };

    const handleSave = () => {
        onUpdate({ ...project, fields });
        onClose();
    };

    const AVAILABLE_ICONS = ['User', 'FileText', 'Phone', 'Mail', 'MapPin', 'Calendar', 'Hash', 'Briefcase'];

    return createPortal(
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-[32px] shadow-2xl flex flex-col max-h-[90vh] animate-dialog-enter">
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 shrink-0 rounded-t-[32px]">
                    <div className="bg-slate-100 dark:bg-slate-700 px-4 py-2 rounded-full">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Edit Client Info Fields</h3>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto space-y-4 flex-1">
                    {fields.map((field, idx) => {
                        const IconComponent = getIconComponent(field.icon);
                        return (
                            <div key={field.id} className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 group">
                                <div className="flex items-center gap-3">
                                    {/* Reorder Controls */}
                                    <div className="flex flex-col gap-1 shrink-0">
                                        <button 
                                            onClick={() => handleMoveField(idx, 'up')}
                                            disabled={idx === 0}
                                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded text-slate-400 disabled:opacity-20"
                                        >
                                            <ChevronUp size={16} />
                                        </button>
                                        <button 
                                            onClick={() => handleMoveField(idx, 'down')}
                                            disabled={idx === fields.length - 1}
                                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded text-slate-400 disabled:opacity-20"
                                        >
                                            <ChevronDown size={16} />
                                        </button>
                                    </div>

                                    {/* Icon & Label Display */}
                                    <div className="flex-1 flex items-center gap-3">
                                        {/* Icon Picker */}
                                        <div className="relative group/icon shrink-0">
                                            <button className="p-3 bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 rounded-xl text-slate-500 dark:text-slate-300 hover:text-primary transition-colors">
                                                <IconComponent size={20} />
                                            </button>
                                            {/* Tooltip Picker */}
                                            <div className="absolute top-full left-0 mt-2 bg-white dark:bg-slate-800 p-2 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 hidden group-hover/icon:grid grid-cols-4 gap-1 z-50 w-48">
                                                {AVAILABLE_ICONS.map(iconName => {
                                                    const Ico = getIconComponent(iconName);
                                                    return (
                                                        <button 
                                                            key={iconName}
                                                            onClick={() => handleUpdateField(idx, { icon: iconName })}
                                                            className={`p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center ${field.icon === iconName ? 'bg-primary/10 text-primary' : 'text-slate-500'}`}
                                                        >
                                                            <Ico size={16} />
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        {/* Editable Label */}
                                        <div className="flex-1">
                                            <input 
                                                type="text"
                                                value={field.label}
                                                onChange={(e) => handleUpdateField(idx, { label: e.target.value })}
                                                className="w-full bg-white dark:bg-slate-800 text-lg font-bold text-slate-700 dark:text-white outline-none border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1 focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all"
                                                placeholder="Label"
                                            />
                                        </div>
                                        
                                        <button 
                                            onClick={() => handleDeleteField(idx)}
                                            className="w-8 h-8 flex items-center justify-center rounded-full bg-white dark:bg-slate-600 text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors shrink-0 shadow-sm"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    
                    <button 
                        onClick={handleAddField}
                        className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-[24px] text-slate-400 hover:text-primary dark:hover:text-white hover:border-primary/50 dark:hover:border-slate-500 transition-all font-bold text-sm flex items-center justify-center gap-2"
                    >
                        <Plus size={18} />
                        Add Field
                    </button>
                </div>

                <div className="p-5 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex gap-3 shrink-0 rounded-b-[32px]">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-3.5 rounded-[20px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave}
                        className="px-12 rounded-full font-bold text-white bg-primary hover:bg-primary/90 transition-all shadow-lg hover:shadow-xl active:scale-95 flex items-center justify-center"
                    >
                        Save Info
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

const ReportPreviewModal = ({ project, locations, companyLogo, onClose, onUpdateProject }: any) => {
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [docInstance, setDocInstance] = useState<jsPDF | null>(null);

    useEffect(() => {
        let active = true;
        const generate = async () => {
            try {
                const { doc } = await generatePDFWithMetadata({ project, locations }, companyLogo);
                setDocInstance(doc);
                const blob = doc.output('blob');
                if (active) {
                    setPdfUrl(URL.createObjectURL(blob));
                }
            } catch (err: any) {
                if (active) {
                    console.error("PDF generation failed:", err);
                    setError(err.message || "Failed to generate report preview");
                }
            }
        };
        generate();
        return () => {
            active = false;
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        };
    }, [project, locations, companyLogo]);

    const handleSave = () => {
        // Download PDF
        if (docInstance) {
            const headerValue = project.fields?.[0]?.value || 'Project';
            docInstance.save(`${headerValue} - New Home Completion List.pdf`);
        }

        // Generate a simple preview image using canvas for the dashboard thumbnail
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 400, 300);
            
            ctx.fillStyle = '#334155'; // Slate-700
            ctx.font = 'bold 24px Helvetica';
            ctx.fillText(project.fields[0]?.value || 'Project Report', 20, 50);
            
            ctx.fillStyle = '#64748b'; // Slate-500
            ctx.font = '16px Helvetica';
            ctx.fillText(project.fields[1]?.value || '', 20, 80);
            
            ctx.fillStyle = '#0f172a'; // Slate-900
            ctx.font = 'bold 48px Helvetica';
            const issueCount = locations.reduce((acc: number, l: LocationGroup) => acc + l.issues.length, 0);
            ctx.fillText(issueCount.toString(), 20, 150);
            
            ctx.font = '16px Helvetica';
            ctx.fillStyle = '#94a3b8'; // Slate-400
            ctx.fillText('Total Items', 20, 175);
            
            ctx.font = '14px Helvetica';
            ctx.fillText(new Date().toLocaleDateString(), 20, 270);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            onUpdateProject({ ...project, reportPreviewImage: dataUrl });
        }
        onClose();
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 w-full max-w-4xl h-[90vh] rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-dialog-enter">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 shrink-0">
                    <div className="bg-slate-100 dark:bg-slate-700 px-4 py-2 rounded-full">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Report Preview</h3>
                    </div>
                </div>
                <div className="flex-1 bg-slate-100 dark:bg-slate-900 relative overflow-hidden overflow-y-auto">
                    {pdfUrl ? (
                        <PDFCanvasPreview pdfUrl={pdfUrl} />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                            {error ? (
                                <>
                                    <AlertCircle size={48} className="text-red-500 mb-4" />
                                    <p className="text-red-500 font-medium">{error}</p>
                                    <button onClick={onClose} className="mt-4 px-4 py-2 bg-slate-200 rounded-full text-sm">Close</button>
                                </>
                            ) : (
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                            )}
                        </div>
                    )}
                </div>
                <div className="p-5 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-end gap-3 shrink-0">
                    <button onClick={onClose} className="px-6 py-3 rounded-full font-bold text-slate-600 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="px-6 py-3 rounded-full font-bold text-white bg-primary hover:bg-primary/90 transition-colors shadow-lg">
                        Save & Download
                    </button>
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

    const activeTemplate = safeTemplates.find((t: SignOffTemplate) => t.id === selectedTemplateId) || safeTemplates[0];

    // Generate Preview on Mount or Template Change
    useEffect(() => {
        let active = true;
        const generatePreview = async () => {
            try {
                // Generate PDF - Pass saved signature image if available
                const url = await generateSignOffPDF(
                    project, 
                    SIGN_OFF_TITLE, 
                    activeTemplate, 
                    companyLogo, 
                    project.signOffImage || undefined
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
    }, [activeTemplate, project, companyLogo]);

    // Handle Overlay Resize based on content
    const handlePagesRendered = () => {
        if (contentRef.current && drawingCanvasRef.current) {
            const container = contentRef.current;
            const canvas = drawingCanvasRef.current;
            
            // Wait a tick for layout to settle
            setTimeout(() => {
                const contentHeight = container.scrollHeight;
                const contentWidth = container.scrollWidth;
                
                canvas.width = contentWidth;
                canvas.height = contentHeight;
                
                // Clear and prep canvas
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.strokeStyle = '#000000'; // Black ink
                    ctx.lineWidth = 2;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                }
            }, 100);
        }
    };

    // Drawing Logic
    const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = drawingCanvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        
        // Since the canvas is absolutely positioned and might be scrolled, we need relative coords
        let clientX, clientY;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }
        
        // Scale not needed if canvas size matches rendered size, but rect accounts for scroll
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        if (mode !== 'ink') return;
        isDrawingRef.current = true;
        const ctx = drawingCanvasRef.current?.getContext('2d');
        if (ctx) {
            const { x, y } = getCoords(e);
            ctx.beginPath();
            ctx.moveTo(x, y);
        }
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawingRef.current || mode !== 'ink') return;
        e.preventDefault(); // Prevent scrolling while drawing
        const ctx = drawingCanvasRef.current?.getContext('2d');
        if (ctx) {
            const { x, y } = getCoords(e);
            ctx.lineTo(x, y);
            ctx.stroke();
        }
    };

    const stopDrawing = () => {
        isDrawingRef.current = false;
    };

    const handleSave = async () => {
        setIsGenerating(true);
        try {
            // 1. Capture the signed document (PDF content + Ink Overlay)
            // We need to composite the PDF canvases and the ink canvas into one image
            const container = contentRef.current;
            if (!container || !drawingCanvasRef.current) return;

            const pdfCanvases = Array.from(container.querySelectorAll('.pdf-page-canvas')) as HTMLCanvasElement[];
            const inkCanvas = drawingCanvasRef.current;
            
            // Create a master canvas to hold everything
            const masterCanvas = document.createElement('canvas');
            const totalHeight = pdfCanvases.reduce((h, c) => h + c.height, 0);
            const maxWidth = Math.max(...pdfCanvases.map(c => c.width), inkCanvas.width);
            
            masterCanvas.width = maxWidth;
            masterCanvas.height = totalHeight;
            const ctx = masterCanvas.getContext('2d');
            
            if (!ctx) throw new Error("Could not create master canvas");
            
            // Draw white background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, masterCanvas.width, masterCanvas.height);
            
            // Draw PDF pages
            let currentY = 0;
            pdfCanvases.forEach(c => {
                // Determine scale if needed (assume pdfCanvases fill width)
                // Draw image
                ctx.drawImage(c, 0, currentY, c.width, c.height);
                currentY += c.height;
            });
            
            // Draw Ink Overlay (It should match total dimensions if sized correctly)
            // Resize ink canvas to match master if there's a discrepancy (e.g. mobile pixel ratio)
            ctx.drawImage(inkCanvas, 0, 0, maxWidth, totalHeight);
            
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
            // Scale down for thumbnail
            const thumbCanvas = document.createElement('canvas');
            thumbCanvas.width = 400;
            thumbCanvas.height = 300;
            const tCtx = thumbCanvas.getContext('2d');
            if (tCtx) {
                tCtx.drawImage(masterCanvas, 0, 0, masterCanvas.width, masterCanvas.height, 0, 0, 400, 300);
                const thumbData = thumbCanvas.toDataURL('image/jpeg', 0.6);
                onUpdateProject({ ...project, signOffImage: thumbData });
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
                    {safeTemplates.length > 1 && (
                        <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm p-4 border-b border-slate-200 dark:border-slate-700">
                            <select 
                                value={selectedTemplateId} 
                                onChange={(e) => setSelectedTemplateId(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2"
                            >
                                {safeTemplates.map((t: SignOffTemplate) => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    
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
                            className={`absolute top-0 left-0 w-full h-full z-10 ${mode === 'ink' ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'}`}
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                        />
                    </div>
                </div>

                <div className="p-5 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-between items-center shrink-0 z-20 gap-3">
                    {/* Mode Toggle - Moved to Footer Left */}
                    <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-full border border-slate-200 dark:border-slate-600 shrink-0">
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

                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-6 py-3 rounded-full font-bold text-slate-600 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
                            Cancel
                        </button>
                        <button 
                            onClick={handleSave} 
                            disabled={isGenerating}
                            className="px-6 py-3 rounded-full font-bold text-white bg-primary hover:bg-primary/90 transition-colors shadow-lg disabled:opacity-50 disabled:shadow-none"
                        >
                            {isGenerating ? 'Saving...' : 'Save & Download'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

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
  initialExpand = false
}) => {
    // Capture initial state to prevent refresh when parent toggles prop off
    // This state sticks for the life of the component instance
    const [shouldInitialExpand] = useState(initialExpand);

    const [isManageLocationsOpen, setIsManageLocationsOpen] = useState(false);
    const [isEditClientInfoOpen, setIsEditClientInfoOpen] = useState(false);
    const [showReportPreview, setShowReportPreview] = useState(false);
    const [showSignOff, setShowSignOff] = useState(false);
    const [showGlobalAddIssue, setShowGlobalAddIssue] = useState(false);
    const [pendingLocation, setPendingLocation] = useState<string>("");
    
    const [locationSearch, setLocationSearch] = useState("");
    const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);

    useEffect(() => {
        const anyModalOpen = isManageLocationsOpen || showReportPreview || showSignOff || showGlobalAddIssue || isEditClientInfoOpen;
        onModalStateChange(anyModalOpen);
    }, [isManageLocationsOpen, showReportPreview, showSignOff, showGlobalAddIssue, isEditClientInfoOpen, onModalStateChange]);

    const [isDetailsCollapsed, setIsDetailsCollapsed] = useState(false);
    const [isLocationsCollapsed, setIsLocationsCollapsed] = useState(false);
    const [isInputFocused, setIsInputFocused] = useState(false);

    // Entrance Animation State Management for Embedded Mode
    // Use stored shouldInitialExpand state
    const [animationClass, setAnimationClass] = useState((embedded && !shouldInitialExpand) ? "animate-slide-down" : "");

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
    
    // Filtered Locations for Autocomplete
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

    // Handle inline field updates
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
             } catch(e) {
                 console.error(e);
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

    const hasDocs = !!project.reportPreviewImage || !!project.signOffImage;
    const hasPunchList = !!project.reportPreviewImage;
    const hasSignOff = !!project.signOffImage;
    
    const headerValue = project.fields?.[0]?.value;

    return (
        <div 
            className={`min-h-screen animate-fade-in ${embedded ? 'bg-transparent pb-0 pt-0' : 'bg-slate-200 dark:bg-slate-950 pb-32'}`}
        >
            {/* Header - Pill Shaped - Only show if not embedded */}
            {!embedded && (
                <div className="sticky top-6 z-40 flex justify-center pointer-events-none mb-6">
                    <div className="pointer-events-auto bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-white/20 shadow-lg ring-1 ring-black/5 dark:ring-white/10 rounded-full px-6 py-3 max-w-[85vw] flex items-center gap-2 transition-all">
                         <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                         <h1 className="text-sm font-bold text-slate-800 dark:text-white truncate">
                            {headerValue || "New Report"}
                         </h1>
                    </div>
                </div>
            )}

            {/* Main Wrapper with Expansion Animation if needed */}
            {/* Added opacity-0 if initialExpand is true to ensure it's hidden during the animation delay */}
            <div className={`max-w-3xl mx-auto ${embedded ? 'space-y-4 p-0' : 'p-6 space-y-8'} relative ${shouldInitialExpand ? 'animate-expand-sections origin-top overflow-hidden opacity-0' : ''}`}>
                {/* Project Details Form */}
                <div 
                    /* Removed key to prevent unmount/remount glitch */
                    className={`bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-sm border border-slate-200 dark:border-slate-800 transition-all duration-300 ease-in-out overflow-hidden ${animationClass} ${embedded && !shouldInitialExpand ? 'animate-fade-in' : ''}`}
                    style={embedded && !shouldInitialExpand ? { animationDelay: '0ms' } : {}}
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
                    
                    {/* Collapsible Content using CSS Transitions for Height */}
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
                                    className="px-12 bg-primary text-white py-3 rounded-full font-bold shadow-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
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
                    /* Removed key to prevent unmount/remount glitch */
                    ref={locationsRef} 
                    className={`bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-sm border border-slate-200 dark:border-slate-800 transition-all duration-300 ${animationClass} ${embedded && !shouldInitialExpand ? 'animate-fade-in' : ''}`}
                    style={embedded && !shouldInitialExpand ? { animationDelay: '100ms' } : {}}
                >
                    <div className="flex flex-col sm:flex-row sm:items-center mb-4 gap-3 relative z-30">
                        {/* Locations Input & Header */}
                        <div className="flex-1 flex items-center gap-2 w-full relative">
                            {/* Autocomplete Input */}
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
                        {/* NOTE: Removed animate-slide-down from this inner grid to fix the "refresh" blink glitch on updates */}
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
                    /* Removed key to prevent unmount/remount glitch */
                    className={`bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-sm border border-slate-200 dark:border-slate-800 ${animationClass} ${embedded && !shouldInitialExpand ? 'animate-fade-in' : ''}`}
                    style={embedded && !shouldInitialExpand ? { animationDelay: '200ms' } : {}}
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
                                    <span className="block text-lg font-bold text-slate-900 dark:text-white leading-tight">Review Report</span>
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
                        <div className="mt-6 space-y-4 animate-slide-up">
                            <button 
                                onClick={handleEmailAll}
                                className="w-full bg-primary text-white p-4 rounded-[20px] font-bold flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transition-all active:scale-95 hover:bg-primary/90"
                            >
                                <Mail size={20} />
                                Email All Documents
                            </button>
                            <div className="grid grid-cols-2 gap-4">
                                <button 
                                    onClick={handleEmailPunchList}
                                    className="bg-white dark:bg-slate-800 text-slate-700 dark:text-white border border-slate-200 dark:border-slate-700 p-3 rounded-[20px] font-bold flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                >
                                    <FileText size={18} />
                                    Email Report
                                </button>
                                <button 
                                    onClick={handleEmailSignOff}
                                    className="bg-white dark:bg-slate-800 text-slate-700 dark:text-white border border-slate-200 dark:border-slate-700 p-3 rounded-[20px] font-bold flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                >
                                    <PenTool size={18} />
                                    Email Sign Off
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                 {/* Navigation Text Instruction - Back Swipe - MOVED HERE to be scrollable content */}
                 {!embedded && (
                    <div className={`mt-8 flex justify-center pb-8 transition-all duration-300 pointer-events-none ${isInputFocused ? 'opacity-0' : 'opacity-100'}`}>
                        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md pl-8 pr-6 py-3 rounded-full flex items-center gap-4 border border-white/20 shadow-md transition-all relative overflow-hidden">
                            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-shine-right" />
                            <span className="text-sm font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 relative z-10">Swipe to Home</span>
                            <div className="flex -space-x-4 text-primary dark:text-blue-400 relative z-10">
                                <ChevronRight size={28} className="animate-shuttle-right opacity-60" style={{ animationDelay: '0ms' }} />
                                <ChevronRight size={28} className="animate-shuttle-right opacity-60" style={{ animationDelay: '200ms' }} />
                                <ChevronRight size={28} className="animate-shuttle-right opacity-60" style={{ animationDelay: '400ms' }} />
                            </div>
                        </div>
                    </div>
                )}
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

            {showGlobalAddIssue && (
                <AddIssueForm 
                    onClose={() => setShowGlobalAddIssue(false)}
                    onSubmit={(issue, locationName) => {
                        // Use pendingLocation if available (from header input), otherwise fallback to locationName from form if any
                        const targetLoc = pendingLocation || locationName;
                        if (targetLoc) {
                            onAddIssueGlobal(targetLoc, issue);
                            setPendingLocation(""); // Reset
                        }
                    }}
                    // Remove location selector logic from modal, handled by parent/header
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