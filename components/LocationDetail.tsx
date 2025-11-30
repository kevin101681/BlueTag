import React, { useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { Issue, LocationGroup, IssuePhoto } from '../types';
import { Plus, Camera, Trash2, X, Edit2, Mic, MicOff, ChevronDown, Sparkles } from 'lucide-react';
import { PREDEFINED_LOCATIONS, generateUUID } from '../constants';
import { ImageEditor } from './ImageEditor';
import { analyzeDefectImage } from '../services/geminiService';
import { createPortal } from 'react-dom';

// --- Shared Helper ---
const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // Max dimension 1200px (approx 150-200kb per image)
                const MAX_SIZE = 1200; 
                
                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error("Could not get canvas context"));
                    return;
                }
                
                ctx.drawImage(img, 0, 0, width, height);
                // Compress to JPEG 0.7 quality
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.onerror = (err) => reject(err);
            img.src = event.target?.result as string;
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
};

// --- Delete Confirmation Modal ---
const DeleteConfirmationModal = ({ onConfirm, onCancel }: { onConfirm: () => void, onCancel: () => void }) => createPortal(
    <div 
        className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
        onClick={onCancel}
    >
        <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 rounded-[32px] shadow-2xl w-full max-w-sm p-6 border border-white/10 ring-1 ring-black/5 dark:ring-white/10 flex flex-col items-center text-center animate-dialog-enter"
        >
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mb-4 shadow-sm">
                <Trash2 size={32} strokeWidth={2} />
            </div>
            <div className="bg-slate-100 dark:bg-slate-700 px-4 py-2 rounded-full mb-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Item?</h3>
            </div>
            <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed max-w-[260px]">
                This action cannot be undone. The item and its photos will be permanently removed.
            </p>
            <div className="flex gap-3 w-full">
                <button 
                    onClick={onCancel}
                    className="flex-1 py-3.5 rounded-[20px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                    Cancel
                </button>
                <button 
                    onClick={onConfirm}
                    className="flex-1 py-3.5 rounded-[20px] font-bold text-white bg-red-500 hover:bg-red-600 transition-colors shadow-lg hover:shadow-xl active:scale-95"
                >
                    Delete
                </button>
            </div>
        </div>
    </div>,
    document.body
);

interface AddIssueFormProps {
  onClose: () => void;
  onSubmit: (issue: Issue, locationName?: string) => void;
  showLocationSelect?: boolean;
  availableLocations?: string[];
  initialIssue?: Issue;
}

export const AddIssueForm: React.FC<AddIssueFormProps> = ({ 
    onClose, 
    onSubmit, 
    showLocationSelect = false, 
    availableLocations,
    initialIssue
}) => {
    const [description, setDescription] = useState(initialIssue?.description || "");
    const [photos, setPhotos] = useState<IssuePhoto[]>(initialIssue?.photos || []);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    // Force scroll to top on open
    useLayoutEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
        }
    }, []);

    useEffect(() => {
        if ('webkitSpeechRecognition' in window) {
            const SpeechRecognition = (window as any).webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.onresult = (event: any) => {
                 let finalTranscript = '';
                 for (let i = event.resultIndex; i < event.results.length; ++i) {
                     if (event.results[i].isFinal) {
                         finalTranscript += event.results[i][0].transcript;
                     }
                 }
                 if (finalTranscript) {
                     const trimmed = finalTranscript.trim();
                     if (trimmed) {
                        setDescription(prev => {
                            const needsSpace = prev.length > 0 && !prev.endsWith(' ');
                            return prev + (needsSpace ? ' ' : '') + trimmed;
                        });
                     }
                 }
            };
            recognitionRef.current.onend = () => {
                setIsListening(false);
            };
        }
        return () => {
            if (recognitionRef.current) recognitionRef.current.stop();
        };
    }, []);

    const toggleListening = () => {
        if (!recognitionRef.current) {
            alert("Speech recognition not supported in this browser.");
            return;
        }
        if (isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        } else {
            try {
                recognitionRef.current.start();
                setIsListening(true);
            } catch (e) {
                console.error("Speech recognition error", e);
                setIsListening(false);
            }
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            try {
                const compressed = await compressImage(e.target.files[0]);
                setPhotos(prev => [...prev, { url: compressed, description: '' }]);
            } catch (err) {
                console.error("Image compression failed", err);
            }
        }
    };

    const handlePhotoDescriptionChange = (index: number, val: string) => {
        setPhotos(prev => {
            const newPhotos = [...prev];
            newPhotos[index] = { ...newPhotos[index], description: val };
            return newPhotos;
        });
    };

    const analyzeLastPhoto = async () => {
        if (photos.length === 0) return;
        setIsAnalyzing(true);
        const lastPhoto = photos[photos.length - 1];
        try {
            const analysis = await analyzeDefectImage(lastPhoto.url);
            if (analysis) {
                 setDescription(prev => {
                     const separator = prev ? ' ' : '';
                     if (prev.includes(analysis)) return prev;
                     return prev + separator + analysis;
                 });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSubmit = () => {
        if (!description.trim()) return;
        
        const newIssue: Issue = {
            id: initialIssue?.id || generateUUID(),
            description,
            severity: initialIssue?.severity || 'Low',
            photos,
            timestamp: initialIssue?.timestamp || Date.now()
        };
        
        onSubmit(newIssue);
        onClose();
    };

    const isSubmitDisabled = !description.trim();
    const isEditing = !!initialIssue;

    // Use createPortal to ensure the modal is top-level and not affected by parent transforms
    return createPortal(
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-[32px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-dialog-enter">
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 shrink-0 z-10">
                    <div className="bg-slate-100 dark:bg-slate-700 px-4 py-2 rounded-full">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                            {isEditing ? 'Edit Item' : 'Add Item'}
                        </h3>
                    </div>
                </div>

                {/* Scrollable Content + Footer Buttons inside */}
                <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
                    <div className="p-6 space-y-6">
                         {/* Photos */}
                         <div>
                             <label className="inline-block bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2">Photos</label>
                             <div className="grid grid-cols-2 gap-3">
                                 {photos.map((photo, idx) => (
                                     <div key={idx} className="bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden relative group">
                                         <div className="aspect-square w-full relative">
                                            <img src={photo.url} alt="Issue" className="w-full h-full object-cover" />
                                            <button 
                                                onClick={() => setPhotos(prev => prev.filter((_, i) => i !== idx))}
                                                className="absolute top-1 right-1 bg-black/50 hover:bg-red-500 text-white p-1.5 rounded-full transition-colors"
                                            >
                                                <X size={14} />
                                            </button>
                                         </div>
                                         <div className="p-2">
                                             <input 
                                                type="text"
                                                value={photo.description || ""}
                                                onChange={(e) => handlePhotoDescriptionChange(idx, e.target.value)}
                                                placeholder="Caption..."
                                                className="w-full bg-white dark:bg-slate-800 text-xs px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 outline-none focus:border-primary dark:text-white"
                                             />
                                         </div>
                                     </div>
                                 ))}
                                 <button 
                                     onClick={() => fileInputRef.current?.click()}
                                     className="aspect-square rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 hover:text-primary dark:hover:text-white hover:border-primary/50 transition-colors"
                                 >
                                     <Camera size={24} />
                                     <span className="text-[10px] font-bold mt-1">Add Photo</span>
                                 </button>
                             </div>
                             <input 
                                 type="file" 
                                 accept="image/*" 
                                 capture="environment" 
                                 ref={fileInputRef} 
                                 className="hidden" 
                                 onChange={handlePhotoUpload} 
                             />
                         </div>

                         {/* Description */}
                         <div>
                             <div className="flex justify-between items-center mb-2">
                                 <label className="inline-block bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Description</label>
                                 <div className="flex items-center gap-3">
                                    {/* Analyze Button */}
                                    {photos.length > 0 && (
                                         <button
                                            onClick={analyzeLastPhoto}
                                            disabled={isAnalyzing}
                                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm ${
                                                isAnalyzing 
                                                    ? 'bg-primary/20 text-primary' 
                                                    : !isAnalyzing 
                                                        ? 'bg-slate-100 dark:bg-slate-700 text-primary dark:text-blue-400 hover:bg-primary hover:text-white animate-breathing-glow ring-2 ring-primary/30'
                                                        : 'bg-slate-100 dark:bg-slate-700 text-primary dark:text-blue-400 hover:bg-primary hover:text-white'
                                            }`}
                                            title="Analyze Image with AI"
                                         >
                                            {isAnalyzing ? (
                                                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <Sparkles size={18} />
                                            )}
                                         </button>
                                    )}
                                    
                                    {/* Voice Button */}
                                    <button 
                                       onClick={toggleListening}
                                       className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                                       title={isListening ? 'Stop Recording' : 'Start Voice Input'}
                                    >
                                        {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                                    </button>
                                 </div>
                             </div>
                             <textarea
                                 value={description}
                                 onChange={(e) => setDescription(e.target.value)}
                                 placeholder="Describe the issue..."
                                 className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[120px] resize-none"
                             />
                         </div>
                    </div>

                    {/* Footer Buttons - Moved inside scrollable area for mobile keyboard friendliness */}
                    <div className="p-5 flex gap-3 pb-8">
                        <button 
                            onClick={onClose}
                            className="flex-1 py-3.5 rounded-[20px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSubmit}
                            disabled={isSubmitDisabled}
                            className="flex-1 py-3.5 rounded-[20px] font-bold text-white bg-primary hover:bg-primary/90 transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                        >
                            {isEditing ? 'Save Changes' : 'Save Item'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

interface LocationDetailProps {
    location: LocationGroup;
    onBack: () => void;
    onAddIssue: (issue: Issue) => void;
    onUpdateIssue: (issue: Issue) => void;
    onDeleteIssue: (issueId: string) => void;
}

export const LocationDetail: React.FC<LocationDetailProps> = ({ 
    location, 
    onBack, 
    onAddIssue, 
    onUpdateIssue, 
    onDeleteIssue 
}) => {
    const [isAddIssueOpen, setIsAddIssueOpen] = useState(false);
    const [issueToEdit, setIssueToEdit] = useState<Issue | null>(null);
    const [issueToDelete, setIssueToDelete] = useState<string | null>(null);
    const [editingImage, setEditingImage] = useState<{ issueId: string, photoIndex: number, url: string } | null>(null);

    // Body scroll lock
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    const handleSaveEditedImage = (newUrl: string) => {
        if (editingImage) {
            const issue = location.issues.find(i => i.id === editingImage.issueId);
            if (issue) {
                const updatedPhotos = [...issue.photos];
                updatedPhotos[editingImage.photoIndex] = { ...updatedPhotos[editingImage.photoIndex], url: newUrl };
                onUpdateIssue({ ...issue, photos: updatedPhotos });
            }
        }
        setEditingImage(null);
    };

    // Portal the entire detail view to the body to avoid clipping/containment by the carousel
    return createPortal(
        <>
            {/* Main Modal Backdrop - Center Alignment */}
            <div className="fixed inset-0 z-[50] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                
                {/* Modal Card */}
                <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-[32px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-dialog-enter">
                    
                    {/* Header */}
                    <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 shrink-0 z-10">
                        <div className="bg-slate-100 dark:bg-slate-700 px-4 py-2 rounded-full truncate mr-4">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white truncate">{location.name}</h3>
                        </div>
                        <button 
                            onClick={onBack} 
                            className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-400 transition-colors shrink-0"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Scrollable List */}
                    <div className="p-6 overflow-y-auto flex-1 space-y-4">
                        
                        {/* Add Item Button */}
                        <button
                            onClick={() => setIsAddIssueOpen(true)}
                            className="w-full py-4 rounded-[24px] border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 text-slate-400 hover:text-primary dark:hover:text-white hover:border-primary/50 dark:hover:border-slate-500 bg-slate-50/50 dark:bg-slate-900/50 transition-all group active:scale-[0.99]"
                        >
                            <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                                <Plus size={20} />
                            </div>
                            <span className="font-bold">Add New Item</span>
                        </button>

                        {/* Issues */}
                        {location.issues.map((issue, index) => (
                            <div key={issue.id} className="bg-white dark:bg-slate-900 rounded-[24px] p-5 shadow-sm border border-slate-100 dark:border-slate-800">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="w-8 h-8 rounded-full bg-primary dark:bg-slate-600 text-white flex items-center justify-center font-bold text-sm shadow-sm shadow-slate-200 dark:shadow-none">
                                        {index + 1}
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => setIssueToEdit(issue)}
                                            className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-primary dark:hover:text-blue-400 transition-colors"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button 
                                            onClick={() => setIssueToDelete(issue.id)}
                                            className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Description styled as text box */}
                                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 mb-4">
                                    <p className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                                        {issue.description}
                                    </p>
                                </div>

                                {issue.photos.length > 0 && (
                                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                                        {issue.photos.map((photo, idx) => (
                                            <div key={idx} className="relative shrink-0 group">
                                                <img 
                                                    src={photo.url} 
                                                    alt="Evidence" 
                                                    className="w-24 h-24 rounded-xl object-cover border border-slate-100 dark:border-slate-800 cursor-pointer"
                                                    onClick={() => setEditingImage({ issueId: issue.id, photoIndex: idx, url: photo.url })}
                                                />
                                                <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                                    <Edit2 size={16} className="text-white" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                        
                        {location.issues.length === 0 && (
                             <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm italic">
                                 No items yet.
                             </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modals - Rendered outside to ensure correct stacking */}
            {isAddIssueOpen && (
                <AddIssueForm 
                    onClose={() => setIsAddIssueOpen(false)}
                    onSubmit={onAddIssue}
                />
            )}
            
            {issueToEdit && (
                <AddIssueForm
                    onClose={() => setIssueToEdit(null)}
                    onSubmit={(updatedIssue) => {
                        onUpdateIssue(updatedIssue);
                        setIssueToEdit(null);
                    }}
                    initialIssue={issueToEdit}
                />
            )}

            {issueToDelete && (
                <DeleteConfirmationModal 
                    onConfirm={() => {
                        if (issueToDelete) onDeleteIssue(issueToDelete);
                        setIssueToDelete(null);
                    }}
                    onCancel={() => setIssueToDelete(null)}
                />
            )}

            {editingImage && (
                <ImageEditor 
                    imageUrl={editingImage.url}
                    onSave={handleSaveEditedImage}
                    onCancel={() => setEditingImage(null)}
                />
            )}
        </>,
        document.body
    );
};