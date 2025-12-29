// Shared utilities used by both LocationDetail and Dashboard
import React, { useRef, useLayoutEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { createPortal } from 'react-dom';

// Image compression utility
export const compressImage = (file: File): Promise<string> => {
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

// Auto-Resize Textarea Component
export const AutoResizeTextarea = ({ 
    value, 
    onChange, 
    placeholder, 
    className, 
    autoFocus 
}: { 
    value: string, 
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void, 
    placeholder?: string, 
    className?: string,
    autoFocus?: boolean
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useLayoutEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [value]);

    return (
        <textarea
            ref={textareaRef}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className={`resize-none overflow-hidden ${className}`}
            rows={1}
            autoFocus={autoFocus}
        />
    );
};

// Delete Confirmation Modal
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
            className={`bg-surface dark:bg-gray-800 rounded-[32px] shadow-2xl border-2 border-red-500/50 animate-pulse-border-red flex flex-col items-center text-center overflow-hidden transition-all duration-300 ${isExiting ? 'scale-95 opacity-0' : 'animate-dialog-enter'} ${targetRect ? 'justify-center p-2 box-border' : 'w-full max-w-sm p-6'}`}
        >
            <div className={`w-full h-full flex flex-col items-center justify-center ${targetRect ? 'p-2' : ''}`}>
                
                {!targetRect && (
                    <div className="bg-red-50 dark:bg-red-900/20 text-red-500 rounded-2xl flex items-center justify-center shadow-sm shrink-0 w-16 h-16 mb-4">
                        <Trash2 size={32} strokeWidth={2} />
                    </div>
                )}
                
                {!targetRect && (
                    <div className="bg-surface-container dark:bg-gray-700 px-4 py-2 rounded-full mb-2 shrink-0">
                        <h3 className="text-lg font-bold text-surface-on dark:text-gray-100">{title}</h3>
                    </div>
                )}
                
                <p className={`text-slate-500 dark:text-slate-400 leading-relaxed max-w-[260px] ${targetRect ? 'mb-6 text-sm font-medium' : 'mb-8'}`}>
                    {message}
                </p>
                
                <div className="flex gap-3 w-full max-w-[300px]">
                    <button 
                        onClick={onCancel}
                        disabled={isExiting}
                        className="flex-1 py-3 rounded-[20px] font-bold text-surface-on dark:text-gray-300 bg-surface-container dark:bg-gray-700 hover:bg-surface-container-high dark:hover:bg-gray-600 transition-colors"
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

