

import React, { useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { Issue, LocationGroup, IssuePhoto } from '../types';
import { Plus, Camera, Trash2, X, Edit2, Mic, MicOff, ChevronDown, Sparkles, Save, Check } from 'lucide-react';
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
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.onerror = (err) => reject(err);
            img.src = event.target?.result as string;
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
};

export const DeleteConfirmationModal = ({ 
    onConfirm, 
    onCancel, 
    title = "Delete Item?", 
    message = "This action cannot be undone. The item and its photos will be permanently removed.",
    targetRect,
    isExiting = false
}: { 
    onConfirm: () => void, 
    onCancel: () => void, 
    title?: string, 
    message?: string,
    targetRect?: DOMRect | null,
    isExiting?: boolean
}) => createPortal(
    <div 
        className={`fixed inset-0 z-[250] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-300 ${isExiting ? 'opacity-0' : 'animate-fade-in'}`}
        onClick={isExiting ? undefined : onCancel}
    >
        <div 
            onClick={(e) => e.stopPropagation()}
            style={targetRect ? {
                position: 'fixed',
                top: targetRect.top,
                left: targetRect.left,
                width: targetRect.width,
                height: targetRect.height,
                margin: 0,
                transform: 'none'
            } : {}}
            className={`bg-white dark:bg-slate-800 rounded-[32px] shadow-2xl border-2 border-red-500/50 animate-pulse-border-red flex flex-col items-center text-center overflow-hidden transition-all duration-300 ${isExiting ? 'scale-95 opacity-0' : 'animate-dialog-enter'} ${targetRect ? 'justify-center p-2 box-border' : 'w-full max-w-sm p-6'}`}
        >
            <div className={`w-full h-full flex flex-col items-center justify-center ${targetRect ? 'p-2' : ''}`}>
                
                {!targetRect && (
                    <div className="bg-red-50 dark:bg-red-900/20 text-red-500 rounded-2xl flex items-center justify-center shadow-sm shrink-0 w-16 h-16 mb-4">
                        <Trash2 size={32} strokeWidth={2} />
                    </div>
                )}
                
                {!targetRect && (
                    <div className="bg-slate-100 dark:bg-slate-700 px-4 py-2 rounded-full mb-2 shrink-0">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
                    </div>
                )}
                
                <p className={`text-slate-500 dark:text-slate-400 leading-relaxed max-w-[260px] ${targetRect ? 'mb-6 text-sm font-medium' : 'mb-8'}`}>
                    {message}
                </p>
                
                <div className="flex gap-3 w-full max-w-[300px]">
                    <button 
                        onClick={onCancel}
                        disabled={isExiting}
                        className="flex-1 py-3 rounded-[20px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={onConfirm}
                        disabled={isExiting}
                        className="flex-1 py-3 rounded-[20px] font-bold text-white bg-red-500 hover:bg-red-600 transition-colors shadow-lg hover:shadow-xl active:scale-95"
                    >
                        Delete
                    </button>
                </div>
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
    const [showSuccessToast, setShowSuccessToast] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    
    // Editor State
    const [editingPhotoIndex, setEditingPhotoIndex] = useState<number | null>(null);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
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
                // Add unique ID for the new photo
                setPhotos(prev => [...prev, { id: generateUUID(), url: compressed, description: '' }]);
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
    
    const handleSaveEditedImage = (newUrl: string) => {
        if (editingPhotoIndex !== null) {
            setPhotos(prev => {
                const newPhotos = [...prev];
                // Preserve ID when updating image
                newPhotos[editingPhotoIndex] = { ...newPhotos[editingPhotoIndex], url: newUrl };
                return newPhotos;
            });
            setEditingPhotoIndex(null);
        }
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
        
        // Ensure all photos have IDs (migrating old data lazily)
        const finalPhotos = photos.map(p => ({
            ...p,
            id: p.id || generateUUID()
        }));

        const newIssue: Issue = {
            id: initialIssue?.id || generateUUID(),
            description,
            severity: initialIssue?.severity || 'Low',
            photos: finalPhotos,
            timestamp: initialIssue?.timestamp || Date.now()
        };
        
        onSubmit(newIssue);

        if (initialIssue) {
            // Editing mode - close modal
            onClose();
        } else {
            // Adding mode - reset for next item
            setDescription("");
            setPhotos([]);
            setShowSuccessToast(true);
            setTimeout(() => setShowSuccessToast(false), 2000);
        }
    };

    const isSubmitDisabled = !description.trim();
    const isEditing = !!initialIssue;

    return createPortal(
        <>
            <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md overflow-y-auto animate-fade-in flex items-center justify-center min-h-full">
                <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-[32px] shadow-2xl flex flex-col animate-dialog-enter relative m-4">
                    <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 shrink-0 z-10 rounded-t-[32px]">
                        <div className="bg-slate-100 dark:bg-slate-700 px-4 py-2 rounded-full">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                                {isEditing ? 'Edit Item' : 'Add Item'}
                            </h3>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">
                        <div>
                            <label className="inline-block bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2">Photos</label>
                            <div className="grid grid-cols-2 gap-3">
                                {photos.map((photo, idx) => (
                                    <div key={idx} className="bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden relative group">
                                        <div className="aspect-square w-full relative">
                                            <img 
                                                src={photo.url} 
                                                alt="Issue" 
                                                className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity" 
                                                onClick={() => setEditingPhotoIndex(idx)}
                                            />
                                            {/* Edit Icon Always Visible */}
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                                                <Edit2 size={24} className="text-white drop-shadow-md" />
                                            </div>
                                            <button 
                                                onClick={() => setPhotos(prev => prev.filter((_, i) => i !== idx))}
                                                className="absolute top-1 right-1 bg-black/50 hover:bg-red-500 text-white p-1.5 rounded-full transition-colors z-10"
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

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="inline-block bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Description</label>
                                <div className="flex items-center gap-3">
                                    {photos.length > 0 && (
                                        <button
                                            onClick={analyzeLastPhoto}
                                            disabled={isAnalyzing}
                                            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all shadow-sm ${
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
                                    
                                    <button 
                                    onClick={toggleListening}
                                    className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all shadow-sm ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
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
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[120px] resize-none"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="p-5 flex gap-3 pb-8">
                        <button 
                            onClick={onClose}
                            className="flex-1 py-3.5 rounded-[20px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                        >
                            {isEditing ? 'Cancel' : 'Done'}
                        </button>
                        <button 
                            onClick={handleSubmit}
                            disabled={isSubmitDisabled}
                            className={`flex-1 py-3.5 rounded-[20px] font-bold transition-all shadow-sm hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2 ${
                                showSuccessToast 
                                ? 'bg-green-500 text-white' 
                                : isEditing ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-white'
                            }`}
                        >
                            {showSuccessToast ? (
                                <>
                                    <Check size={20} />
                                    Added!
                                </>
                            ) : (
                                isEditing ? 'Save Changes' : 'Save Item'
                            )}
                        </button>
                    </div>
                </div>
            </div>
            
            {editingPhotoIndex !== null && (
                <ImageEditor 
                    imageUrl={photos[editingPhotoIndex].url}
                    onSave={handleSaveEditedImage}
                    onCancel={() => setEditingPhotoIndex(null)}
                />
            )}
        </>,
        document.body
    );
};

// --- Summary Issue Card (Opens Modal) ---
const IssueCard: React.FC<{
    issue: Issue;
    index: number;
    onClick: () => void;
    onDelete: (e: React.MouseEvent) => void;
}> = ({ issue, index, onClick, onDelete }) => {
    return (
        <div 
            onClick={onClick}
            className="w-full bg-white dark:bg-slate-900 rounded-[24px] shadow-sm border border-slate-200 dark:border-slate-800 p-5 relative cursor-pointer hover:border-primary/50 hover:shadow-md transition-all active:scale-[0.99] group"
        >
            <div className="flex gap-3 items-start">
                <div className="w-8 h-8 rounded-full bg-primary dark:bg-slate-600 text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0 mt-1">
                    {index + 1}
                </div>

                <div className="flex-1 min-w-0">
                    <p className="text-slate-800 dark:text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">
                        {issue.description}
                    </p>
                    
                    {issue.photos.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide pt-3 mt-1">
                            {issue.photos.map((photo, idx) => (
                                <div key={idx} className="w-16 h-16 shrink-0 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                                    <img 
                                        src={photo.url} 
                                        alt="Thumbnail" 
                                        className="w-full h-full object-cover" 
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <button 
                onClick={(e) => { e.stopPropagation(); onDelete(e); }}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                title="Delete Item"
            >
                <Trash2 size={16} />
            </button>
        </div>
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
    const [issueToDelete, setIssueToDelete] = useState<string | null>(null);
    const [editingIssue, setEditingIssue] = useState<Issue | null>(null);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    const handleEditSave = (updatedIssue: Issue) => {
        onUpdateIssue(updatedIssue);
        // Editing modal closes automatically inside AddIssueForm when initialIssue is present
    };

    return createPortal(
        <>
            <div className="fixed inset-0 z-[50] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                
                <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-[32px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-dialog-enter">
                    
                    <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 shrink-0 z-10">
                        <div className="bg-slate-100 dark:bg-slate-700 px-4 py-2 rounded-2xl truncate mr-4">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white truncate">{location.name}</h3>
                        </div>
                        <button 
                            onClick={onBack} 
                            className="p-2 bg-slate-100 dark:bg-slate-700 rounded-2xl text-slate-500 hover:text-slate-800 dark:text-slate-400 transition-colors shrink-0"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-6 overflow-y-auto flex-1 space-y-4">
                        
                        <button
                            onClick={() => setIsAddIssueOpen(true)}
                            className="w-full py-4 rounded-[24px] border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 text-slate-400 hover:text-primary dark:hover:text-white hover:border-primary/50 dark:hover:border-slate-500 bg-slate-50/50 dark:bg-slate-900/50 transition-all group active:scale-[0.99]"
                        >
                            <div className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                                <Plus size={20} />
                            </div>
                            <span className="font-bold">Add New Item</span>
                        </button>

                        {location.issues.map((issue, index) => (
                            <IssueCard 
                                key={issue.id}
                                issue={issue}
                                index={index}
                                onClick={() => setEditingIssue(issue)}
                                onDelete={() => setIssueToDelete(issue.id)}
                            />
                        ))}
                        
                        {location.issues.length === 0 && (
                             <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm italic">
                                 No items yet.
                             </div>
                        )}
                    </div>
                </div>
            </div>

            {isAddIssueOpen && (
                <AddIssueForm 
                    onClose={() => setIsAddIssueOpen(false)}
                    onSubmit={onAddIssue}
                />
            )}
            
            {editingIssue && (
                <AddIssueForm 
                    onClose={() => setEditingIssue(null)}
                    onSubmit={handleEditSave}
                    initialIssue={editingIssue}
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
        </>,
        document.body
    );
};