
import React, { useState, useRef, useEffect } from 'react';
import { X, Check, Undo, ArrowRight, Pen, Circle as CircleIcon, ZoomIn, Redo, Type } from 'lucide-react';

interface ImageEditorProps {
    imageUrl: string;
    onSave: (newUrl: string) => void;
    onCancel: () => void;
}

type ToolType = 'arrow' | 'pen' | 'circle' | 'text';

const MAX_HISTORY = 15; // Limit history to prevent memory crash on mobile

export const ImageEditor: React.FC<ImageEditorProps> = ({ imageUrl, onSave, onCancel }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [activeTool, setActiveTool] = useState<ToolType>('arrow');
    const [startPos, setStartPos] = useState<{x: number, y: number} | null>(null);
    const [snapshot, setSnapshot] = useState<ImageData | null>(null);
    
    // Text Tool State
    const [pendingText, setPendingText] = useState<{x: number, y: number} | null>(null);
    const [textValue, setTextValue] = useState("");
    
    // History State for Undo/Redo
    const [history, setHistory] = useState<ImageData[]>([]);
    const [historyStep, setHistoryStep] = useState<number>(-1);

    // Zoom & Pan State
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPinching, setIsPinching] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    // Refs for gestures
    const lastPinchCenter = useRef<{x: number, y: number} | null>(null);
    const initialPinchDist = useRef<number>(0);
    const initialZoom = useRef<number>(1);
    const lastTapTime = useRef<number>(0);

    // Load image
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Reset view
        setZoom(1);
        setPan({ x: 0, y: 0 });
        setPendingText(null);
        setTextValue("");

        const img = new Image();
        img.src = imageUrl;
        img.crossOrigin = "anonymous"; 
        img.onload = () => {
            // Resize if too large to prevent memory issues and huge save files
            const MAX_SIZE = 1200;
            let w = img.width;
            let h = img.height;
            
            if (w > MAX_SIZE || h > MAX_SIZE) {
                if (w > h) {
                    h *= MAX_SIZE / w;
                    w = MAX_SIZE;
                } else {
                    w *= MAX_SIZE / h;
                    h = MAX_SIZE;
                }
            }

            canvas.width = w;
            canvas.height = h;
            ctx.drawImage(img, 0, 0, w, h);
            
            // Save initial state for history
            try {
                const initial = ctx.getImageData(0, 0, canvas.width, canvas.height);
                setHistory([initial]);
                setHistoryStep(0);
            } catch (e) {
                console.warn("Could not save history (likely CORS)", e);
            }
        };
    }, [imageUrl]);

    const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        let clientX, clientY;
        if ('touches' in e) {
            if (e.touches.length > 0) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                 return { x: 0, y: 0 };
            }
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };

    const setupContext = (ctx: CanvasRenderingContext2D) => {
        const baseSize = Math.max(canvasRef.current!.width, canvasRef.current!.height);
        const scale = Math.max(baseSize / 1000, 1); // Base scale on ~1000px image
        
        ctx.lineWidth = 6 * scale;
        ctx.strokeStyle = "#ef4444"; // Red-500
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        
        return scale;
    };

    const drawArrow = (ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number) => {
        const scale = setupContext(ctx);
        const headLen = 25 * scale; 
        const angle = Math.atan2(toY - fromY, toX - fromX);
        
        ctx.beginPath();
        
        // Line
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        
        // Arrowhead
        ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(toX, toY);
        ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
        
        ctx.stroke();
    };

    const drawCircle = (ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number) => {
        setupContext(ctx);
        
        const radiusX = Math.abs(toX - fromX) / 2;
        const radiusY = Math.abs(toY - fromY) / 2;
        const centerX = (fromX + toX) / 2;
        const centerY = (fromY + toY) / 2;

        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        ctx.stroke();
    };

    const drawPen = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
         setupContext(ctx);
         ctx.lineTo(x, y);
         ctx.stroke();
         ctx.beginPath();
         ctx.moveTo(x, y);
    };

    const saveToHistory = (ctx: CanvasRenderingContext2D) => {
        try {
            const newState = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
            
            // Discard "future" history if we are in the middle of the stack
            const newHistory = history.slice(0, historyStep + 1);
            newHistory.push(newState);

            // Limit history size to prevent memory issues
            if (newHistory.length > MAX_HISTORY) {
                newHistory.shift();
            }
            
            setHistory(newHistory);
            setHistoryStep(newHistory.length - 1);
        } catch(e) {
            console.error("Failed to save history step", e);
        }
    };

    const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        if (activeTool === 'text') {
            const coords = getCoords(e);
            setPendingText(coords);
            // Don't start drawing
            return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const coords = getCoords(e);
        setStartPos(coords);
        setIsDrawing(true);
        
        try {
            setSnapshot(ctx.getImageData(0, 0, canvas.width, canvas.height));
        } catch (e) {
            setSnapshot(null);
        }

        if (activeTool === 'pen') {
            ctx.beginPath();
            ctx.moveTo(coords.x, coords.y);
            setupContext(ctx);
        }
    };

    const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || !startPos) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        e.preventDefault(); // Stop scrolling while drawing

        const current = getCoords(e);

        if (activeTool === 'pen') {
            drawPen(ctx, current.x, current.y);
        } else {
            if (snapshot) {
                ctx.putImageData(snapshot, 0, 0);
            }
            
            if (activeTool === 'arrow') {
                drawArrow(ctx, startPos.x, startPos.y, current.x, current.y);
            } else if (activeTool === 'circle') {
                drawCircle(ctx, startPos.x, startPos.y, current.x, current.y);
            }
        }
    };

    const handleEnd = () => {
        if (isDrawing && canvasRef.current) {
             const ctx = canvasRef.current.getContext('2d');
             if (ctx) {
                 saveToHistory(ctx);
             }
        }
        setIsDrawing(false);
        setStartPos(null);
        setSnapshot(null);
    };

    const handleAddText = () => {
        if (!pendingText || !textValue.trim()) {
            setPendingText(null);
            setTextValue("");
            return;
        }
        
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const baseSize = Math.max(canvas.width, canvas.height);
        const scale = Math.max(baseSize / 1000, 1); 
        const fontSize = 40 * scale;
        
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textBaseline = 'middle';
        
        // Stroke (Outline)
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 6 * scale;
        ctx.lineJoin = 'round';
        ctx.strokeText(textValue, pendingText.x, pendingText.y);
        
        // Fill
        ctx.fillStyle = '#ef4444'; // Red to match other tools
        ctx.fillText(textValue, pendingText.x, pendingText.y);
        
        saveToHistory(ctx);
        setPendingText(null);
        setTextValue("");
    };

    // --- Touch Handlers for Zoom/Pan/Draw ---
    
    const handleTouchStart = (e: React.TouchEvent) => {
        const now = Date.now();

        // Double tap to reset
        if (now - lastTapTime.current < 300 && e.touches.length === 1) {
            setIsResetting(true);
            setZoom(1);
            setPan({x: 0, y: 0});
            setIsDrawing(false);
            // Allow animation to play then remove transition class
            setTimeout(() => setIsResetting(false), 300);
            return;
        }
        lastTapTime.current = now;
        
        // If user interrupts reset, stop it immediately
        if (isResetting) setIsResetting(false);

        if (e.touches.length === 2) {
            // Two fingers: Zoom/Pan Mode
            setIsPinching(true);
            setIsDrawing(false);
            setSnapshot(null); 
            setStartPos(null);

            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            initialPinchDist.current = dist;
            initialZoom.current = zoom;
            
            lastPinchCenter.current = {
                x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                y: (e.touches[0].clientY + e.touches[1].clientY) / 2
            };
        } else if (e.touches.length === 1 && !isPinching) {
             // One finger: Draw Mode (or Text Select)
             handleStart(e);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            e.preventDefault(); 
            
            // Zoom
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            
            if (initialPinchDist.current > 0) {
                const scaleFactor = dist / initialPinchDist.current;
                const newZoom = Math.min(Math.max(1, initialZoom.current * scaleFactor), 5);
                setZoom(newZoom);
            }

            // Pan
            const currentCenter = {
                x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                y: (e.touches[0].clientY + e.touches[1].clientY) / 2
            };

            if (lastPinchCenter.current) {
                const dx = currentCenter.x - lastPinchCenter.current.x;
                const dy = currentCenter.y - lastPinchCenter.current.y;
                setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            }
            lastPinchCenter.current = currentCenter;

        } else if (e.touches.length === 1 && !isPinching) {
            handleMove(e);
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (e.touches.length < 2) {
            setIsPinching(false);
            lastPinchCenter.current = null;
        }
        if (!isPinching && isDrawing) {
            handleEnd();
        }
    };

    const handleUndo = () => {
        setPendingText(null); // Cancel pending text on undo
        if (historyStep > 0) {
            const newStep = historyStep - 1;
            const prevState = history[newStep];
            
            const ctx = canvasRef.current?.getContext('2d');
            if (ctx && prevState) {
                ctx.putImageData(prevState, 0, 0);
                setHistoryStep(newStep);
            }
        }
    };

    const handleRedo = () => {
        setPendingText(null); // Cancel pending text on redo
        if (historyStep < history.length - 1) {
            const newStep = historyStep + 1;
            const nextState = history[newStep];
            
            const ctx = canvasRef.current?.getContext('2d');
            if (ctx && nextState) {
                ctx.putImageData(nextState, 0, 0);
                setHistoryStep(newStep);
            }
        }
    };

    const handleSave = () => {
        if (canvasRef.current) {
            onSave(canvasRef.current.toDataURL('image/jpeg', 0.85));
        }
    };

    const ToolButton = ({ tool, icon: Icon }: { tool: ToolType, icon: any }) => (
        <button 
            onClick={() => { setActiveTool(tool); setPendingText(null); }} 
            className={`p-3 rounded-2xl transition-all duration-200 ${
                activeTool === tool 
                ? 'bg-white text-red-600 shadow-md scale-110' 
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
        >
            <Icon size={20} strokeWidth={activeTool === tool ? 3 : 2} />
        </button>
    );

    return (
        <div className="fixed inset-0 z-[300] bg-black flex flex-col animate-fade-in">
            {/* Top Floating Toolbar - Tools Only */}
            <div className="absolute top-6 left-0 right-0 flex justify-center items-center px-6 z-20 pointer-events-none">
                <div className="pointer-events-auto flex items-center gap-1 bg-black/60 backdrop-blur-xl px-3 py-2 rounded-full border border-white/10 shadow-2xl">
                     <ToolButton tool="arrow" icon={ArrowRight} />
                     <ToolButton tool="circle" icon={CircleIcon} />
                     <ToolButton tool="pen" icon={Pen} />
                     <ToolButton tool="text" icon={Type} />
                    
                    <div className="w-px h-6 bg-white/20 mx-2" />
                    
                    <button 
                        onClick={handleUndo} 
                        disabled={historyStep <= 0} 
                        className="p-3 hover:bg-white/10 rounded-2xl disabled:opacity-30 transition-colors text-white/70 hover:text-white disabled:cursor-not-allowed"
                    >
                        <Undo size={20} />
                    </button>
                    <button 
                        onClick={handleRedo} 
                        disabled={historyStep >= history.length - 1} 
                        className="p-3 hover:bg-white/10 rounded-2xl disabled:opacity-30 transition-colors text-white/70 hover:text-white disabled:cursor-not-allowed"
                    >
                        <Redo size={20} />
                    </button>
                </div>
            </div>
            
            {/* Canvas Area */}
            <div className="flex-1 flex items-center justify-center overflow-hidden p-6 touch-none bg-[#0f172a] relative">
                <canvas 
                    ref={canvasRef}
                    onMouseDown={handleStart}
                    onMouseMove={handleMove}
                    onMouseUp={handleEnd}
                    onMouseLeave={handleEnd}
                    
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}

                    className="max-w-full max-h-full object-contain shadow-2xl rounded-lg origin-center"
                    style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transition: isResetting ? 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none',
                        cursor: activeTool === 'text' ? 'text' : 'crosshair'
                    }}
                />
            </div>
            
            {/* Bottom Control Bar with Cancel/Save and Status */}
            <div className="absolute bottom-8 left-0 right-0 px-6 flex justify-between items-end z-30 pointer-events-none">
                 {/* Cancel Button */}
                 <button 
                    onClick={onCancel} 
                    className="pointer-events-auto bg-black/40 backdrop-blur-md text-white w-16 h-16 rounded-2xl hover:bg-black/60 transition-colors border border-white/10 shadow-sm flex items-center justify-center active:scale-95"
                    title="Cancel"
                >
                    <X size={24} />
                </button>

                {/* Center Info */}
                <div className="flex flex-col items-center mb-2">
                     <div className="inline-flex items-center gap-3 bg-black/60 backdrop-blur-md text-white/90 px-5 py-2.5 rounded-full border border-white/10 shadow-lg">
                        <div className="flex items-center gap-2 text-sm font-medium">
                            {isPinching ? (
                                <ZoomIn size={16} className="text-sky-400" />
                            ) : (
                                activeTool === 'arrow' ? <ArrowRight size={16} /> :
                                activeTool === 'circle' ? <CircleIcon size={16} /> : 
                                activeTool === 'text' ? <Type size={16} /> : <Pen size={16} />
                            )}
                            <span>
                                {isPinching ? 'Adjusting View' : (
                                    activeTool === 'arrow' ? 'Arrow Tool' :
                                    activeTool === 'circle' ? 'Circle Tool' : 
                                    activeTool === 'text' ? 'Text Tool' : 'Freehand'
                                )}
                            </span>
                        </div>
                        
                        <div className="w-px h-4 bg-white/20" />
                        
                        <div className="text-xs font-bold text-white/60 font-mono min-w-[3ch]">
                            {Math.round(zoom * 100)}%
                        </div>
                     </div>
                     
                     {!isPinching && zoom === 1 && (
                        <div className="mt-2 text-[10px] text-white/40 font-medium tracking-wide uppercase animate-fade-in">
                            Double-tap to reset • Pinch to Zoom
                        </div>
                     )}
                </div>

                {/* Save Button */}
                <button 
                    onClick={handleSave} 
                    className="pointer-events-auto bg-primary text-white w-16 h-16 rounded-2xl hover:bg-primary/90 transition-colors shadow-xl border border-white/10 flex items-center justify-center active:scale-95"
                    title="Save Changes"
                >
                    <Check size={24} strokeWidth={3} />
                </button>
            </div>

            {/* Text Input Overlay */}
            {pendingText && (
                <div className="absolute bottom-32 left-0 right-0 px-4 z-30 flex justify-center animate-slide-up">
                    <div className="bg-black/80 backdrop-blur-xl p-2 rounded-full flex gap-2 w-full max-w-md shadow-2xl border border-white/10">
                         <input 
                            autoFocus
                            type="text" 
                            value={textValue}
                            onChange={(e) => setTextValue(e.target.value)}
                            placeholder="Enter text annotation..."
                            className="flex-1 bg-transparent text-white px-4 py-2 outline-none placeholder:text-white/50 text-base"
                            onKeyDown={(e) => e.key === 'Enter' && handleAddText()}
                         />
                         <button 
                            onClick={handleAddText} 
                            className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-full font-bold text-sm transition-colors shadow-lg"
                         >
                            Add
                         </button>
                         <button 
                            onClick={() => { setPendingText(null); setTextValue(""); }} 
                            className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-colors"
                         >
                            <X size={18} />
                         </button>
                    </div>
                </div>
            )}
        </div>
    );
}
