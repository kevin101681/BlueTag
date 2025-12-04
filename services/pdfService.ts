
import { jsPDF } from 'jspdf';
import { AppState, ProjectDetails, SignOffTemplate, SignOffSection, ProjectField, Point, SignOffStroke } from '../types';

// --- CONFIGURATION ---

export const SIGN_OFF_PDF_BASE64: string = "";
export const LOGO_BASE64: string = ""; // Paste your Base64 logo string here to override everything else
const HARDCODED_LOGO_PATH = '/logo.png';

// --- EDITABLE TEXT CONTENT ---

const REPORT_TITLE = "New Home Completion List";
const REPORT_DISCLAIMER = "The following definitions of comment descriptions represent this New Home Orientation/Walk Through. These report items are either not complete or are not meeting an industry standard. THESE ARE ITEMS THAT ARE YOUR BUILDER'S RESPONSIBILITY TO COMPLETE. Please allow your builder 30 days for completion.\n\nNOTES SECTION: The \"Notes\" section contains items that may or may not be addressed by your builder. They are either contractual issues or items that your builder is not required to correct. You will be notified when a decision is made.";

export const SIGN_OFF_TITLE = "New Home Orientation Sign Off";

export interface ImageLocation {
    pageIndex: number; 
    x: number; 
    y: number; 
    w: number; 
    h: number; 
    id: string;
}

export interface CheckboxLocation {
    pageIndex: number; 
    x: number; 
    y: number; 
    w: number; 
    h: number; 
    id: string;
    strikethroughLines?: { x: number, y: number, w: number }[];
}

export interface PDFGenerationResult {
    doc: jsPDF;
    imageMap: ImageLocation[];
    checkboxMap: CheckboxLocation[];
}

// --- HELPER FUNCTIONS ---

const getImageDimensions = (base64: string): Promise<{ width: number, height: number }> => {
    return new Promise((resolve) => {
        if (!base64) {
            resolve({ width: 0, height: 0 });
            return;
        }

        const img = new Image();
        const timeoutId = setTimeout(() => {
            console.warn("Image load timeout");
            resolve({ width: 0, height: 0 });
        }, 3000);

        img.onload = () => {
            clearTimeout(timeoutId);
            resolve({ width: img.width, height: img.height });
        };
        img.onerror = () => {
            clearTimeout(timeoutId);
            console.warn("Image load error");
            resolve({ width: 0, height: 0 });
        };
        img.src = base64;
    });
};

const getImageFormat = (base64: string): string => {
    if (!base64) return 'JPEG';
    if (base64.includes('image/png')) return 'PNG';
    if (base64.includes('image/jpeg') || base64.includes('image/jpg')) return 'JPEG';
    const lower = base64.toLowerCase();
    if (lower.endsWith('.png')) return 'PNG';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'JPEG';
    return 'JPEG';
};

const drawVerticalGradient = (doc: jsPDF, x: number, y: number, w: number, h: number, c1: [number, number, number], c2: [number, number, number]) => {
    const steps = 20; 
    const stepH = h / steps;
    for (let i = 0; i < steps; i++) {
        const ratio = i / steps;
        const r = Math.round(c1[0] * (1 - ratio) + c2[0] * ratio);
        const g = Math.round(c1[1] * (1 - ratio) + c2[1] * ratio);
        const b = Math.round(c1[2] * (1 - ratio) + c2[2] * ratio);
        doc.setFillColor(r, g, b);
        doc.rect(x, y + (i * stepH), w, stepH + 0.5, 'F');
    }
};

const drawSimpleIcon = (doc: jsPDF, type: string, x: number, y: number, size: number = 5, numberValue?: string, customColor?: [number, number, number], textColor?: [number, number, number]) => {
    const s = size; 
    doc.saveGraphicsState();

    const themeColor = [55, 71, 79]; 
    doc.setFillColor(themeColor[0], themeColor[1], themeColor[2]);
    doc.setDrawColor(themeColor[0], themeColor[1], themeColor[2]);
    doc.setLineWidth(0.5); 
    doc.setLineCap('round');
    doc.setLineJoin('round');
    
    const cx = x + s/2;
    const cy = y + s/2;
    
    const t = type.toLowerCase();

    if (t === 'user' || t === 'users') {
        doc.circle(cx, y + s*0.3, s*0.2, 'S'); 
        doc.path([
            { op: 'm', c: [cx - s*0.4, y + s*0.9] },
            { op: 'c', c: [cx - s*0.4, y + s*0.6, cx + s*0.4, y + s*0.6, cx + s*0.4, y + s*0.9] }
        ]);
        doc.stroke();
    } else if (t === 'calendar') {
         doc.roundedRect(x + s*0.1, y + s*0.1, s*0.8, s*0.8, s*0.1, s*0.1, 'S');
         doc.line(x + s*0.1, y + s*0.35, x + s*0.9, y + s*0.35); 
         doc.circle(cx - s*0.2, cy + s*0.2, s*0.05, 'F');
         doc.circle(cx + s*0.2, cy + s*0.2, s*0.05, 'F');
    } else if (t === 'mappin' || t === 'map') {
        const r = s * 0.3;
        doc.path([
            { op: 'm', c: [cx, y + s] }, 
            { op: 'c', c: [cx, y + s, cx + r, y + s*0.5, cx + r, y + s*0.35] }, 
            { op: 'c', c: [cx + r, y - s*0.1, cx - r, y - s*0.1, cx - r, y + s*0.35] }, 
            { op: 'c', c: [cx - r, y + s*0.5, cx, y + s, cx, y + s] } 
        ]);
        doc.stroke();
        doc.circle(cx, y + s*0.35, s*0.1, 'F'); 
    } else if (t === 'phone') {
        doc.roundedRect(x + s*0.25, y + s*0.05, s*0.5, s*0.9, s*0.08, s*0.08, 'S');
        doc.line(cx - s*0.1, y + s*0.85, cx + s*0.1, y + s*0.85); 
    } else if (t === 'mail') {
        doc.roundedRect(x + s*0.1, y + s*0.25, s*0.8, s*0.5, s*0.05, s*0.05, 'S');
        doc.path([
            { op: 'm', c: [x + s*0.1, y + s*0.25] },
            { op: 'l', c: [cx, y + s*0.55] },
            { op: 'l', c: [x + s*0.9, y + s*0.25] }
        ]);
        doc.stroke();
    } else if (t === 'home') {
         doc.path([
            { op: 'm', c: [x + s*0.15, y + s*0.4] },
            { op: 'l', c: [cx, y + s*0.15] },
            { op: 'l', c: [x + s*0.85, y + s*0.4] },
            { op: 'l', c: [x + s*0.85, y + s*0.9] },
            { op: 'l', c: [x + s*0.15, y + s*0.9] },
            { op: 'h', c: [] } 
         ]);
         doc.stroke();
    } else if (t === 'check') {
        doc.moveTo(x + s*0.15, y + s*0.55);
        doc.lineTo(x + s*0.4, y + s*0.8);
        doc.lineTo(x + s*0.9, y + s*0.2);
        doc.stroke();
    } else if (t === 'check-mark-thick') {
        doc.setDrawColor(74, 222, 128); 
        doc.setLineWidth(1.5); 
        doc.setLineCap('round');
        doc.setLineJoin('round');
        doc.moveTo(x + s*0.15, y + s*0.55);
        doc.lineTo(x + s*0.4, y + s*0.8);
        doc.lineTo(x + s*0.9, y + s*0.2);
        doc.stroke();
    } else if (t === 'list' || t === 'filetext') {
        doc.line(x + s*0.2, y + s*0.2, x + s*0.8, y + s*0.2);
        doc.line(x + s*0.2, y + s*0.5, x + s*0.8, y + s*0.5);
        doc.line(x + s*0.2, y + s*0.8, x + s*0.8, y + s*0.8);
        doc.rect(x + s*0.1, y, s*0.8, s, 'S');
        doc.stroke();
    } else if (t === 'pen') {
        const tipLen = s * 0.25;
        doc.moveTo(x, y + s); 
        doc.lineTo(x + tipLen, y + s - tipLen);
        doc.lineTo(x + s, y + 0.2 * s); 
        doc.lineTo(x + 0.8 * s, y);
        doc.lineTo(x + 0.2 * s, y + s - 0.8 * s);
        doc.lineTo(x, y + s);
        doc.moveTo(x + tipLen, y + s - tipLen);
        doc.lineTo(x + 0.2 * s, y + s - 0.8 * s);
        doc.stroke();
    } else if (t === 'paper') {
        doc.roundedRect(x + 0.5, y, s - 1, s, 0.5, 0.5, 'S');
        doc.line(x + 1.5, y + 1.5, x + s - 1.5, y + 1.5);
        doc.line(x + 1.5, y + 2.5, x + s - 1.5, y + 2.5);
    } else if (t === 'handshake') {
         doc.roundedRect(x, y + 1.5, 3.5, 2.5, 0.6, 0.6, 'S');
         doc.roundedRect(x + 2, y + 0.5, 3.5, 2.5, 0.6, 0.6, 'S');
    } else if (t === 'pen-tip' || t === 'pentool') {
         doc.moveTo(cx - s*0.35, y); 
         doc.lineTo(cx + s*0.35, y); 
         doc.curveTo(cx + s*0.35, y + s*0.4, cx + s*0.15, y + s*0.8, cx, y + s); 
         doc.curveTo(cx - s*0.15, y + s*0.8, cx - s*0.35, y + s*0.4, cx - s*0.35, y); 
         doc.fill();
    } else if (t === 'alert' || t === 'alertcircle') {
         doc.circle(cx, cy, s*0.45, 'S');
         doc.line(cx, cy - s*0.15, cx, cy + s*0.15);
         doc.line(cx, cy + s*0.25, cx, cy + s*0.25);
    } else if (t === 'number') {
         const rn = s / 2; 
         // Aligning: Use simple centering, no vertical offset for icon
         // Remove vertical offset - s*0.3
         
         const c = customColor || [14, 165, 233];
         doc.setFillColor(c[0], c[1], c[2]); 
         doc.circle(x + rn, y + rn, rn, 'F');
         
         const tc = textColor || [255, 255, 255];
         doc.setTextColor(tc[0], tc[1], tc[2]);
         doc.setFontSize(8);
         doc.setFont("helvetica", "bold");
         doc.text(numberValue || "", x + rn, y + rn + 1.1, { align: 'center' });
    } else {
        doc.circle(cx, cy, s*0.4, 'S');
    }
    
    doc.restoreGraphicsState();
};

const drawModernBox = (doc: jsPDF, x: number, y: number, w: number, h: number, type: 'initial' | 'signature') => {
    doc.saveGraphicsState();
    doc.setFillColor(255, 255, 255);
    if (type === 'initial') {
        doc.setDrawColor(203, 213, 225); 
        doc.setLineWidth(0.4);
        doc.roundedRect(x, y, w, h, 3, 3, 'FD');
    } else {
        doc.setDrawColor(148, 163, 184);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, w, h, 3, 3, 'FD');
    }
    doc.restoreGraphicsState();
};

const drawProjectCard = (doc: jsPDF, project: ProjectDetails, startY: number): number => {
    const fields = project.fields || [];
    if (fields.length === 0) return startY;

    const headerField = fields[0];
    const subheaderField = fields.length > 1 ? fields[1] : null;
    const detailFields = fields.slice(2).filter(f => f.value && f.value.trim() !== "");

    const paddingX = 12;
    const paddingY = 6;
    const iconSize = 3.5;
    const iconGap = 5;
    const lineHeight = 6;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    const nameStr = headerField.value || "Project";
    const nameWidth = doc.getTextWidth(nameStr);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    const lotStr = subheaderField ? subheaderField.value : "";
    const lotWidth = doc.getTextWidth(lotStr);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    let maxDetailWidth = 0;
    detailFields.forEach(line => {
        const w = doc.getTextWidth(line.value);
        if (w > maxDetailWidth) maxDetailWidth = w;
    });
    const detailsContentWidth = detailFields.length > 0 ? (iconSize + iconGap + maxDetailWidth) : 0;

    const minWidth = 80;
    const maxContentWidth = Math.max(nameWidth, lotWidth, detailsContentWidth);
    const boxWidth = Math.max(minWidth, maxContentWidth + (paddingX * 2));
    
    // Calculate Height
    let boxHeight = paddingY * 2 + 7; // Header + Subheader gap
    if (detailFields.length > 0) {
        boxHeight += 4; 
        boxHeight += detailFields.length * lineHeight; 
    }

    // Center Logic
    const pageWidth = 210;
    const boxX = (pageWidth - boxWidth) / 2;
    
    // Draw Box
    doc.saveGraphicsState();
    doc.setFillColor(248, 250, 252); 
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(boxX, startY, boxWidth, boxHeight, 4, 4, 'FD');
    doc.restoreGraphicsState();

    let curY = startY + paddingY + 4;
    
    // Header
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(51, 65, 85);
    doc.text(nameStr, pageWidth / 2, curY, { align: 'center' });
    
    // Subheader
    if (lotStr) {
        curY += 5;
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text(lotStr, pageWidth / 2, curY, { align: 'center' });
    }

    // Details
    if (detailFields.length > 0) {
        curY += 6;
        doc.setDrawColor(226, 232, 240);
        doc.line(boxX + 10, curY, boxX + boxWidth - 10, curY);
        curY += 6;

        const contentStartX = boxX + (boxWidth - detailsContentWidth) / 2;

        detailFields.forEach(field => {
             drawSimpleIcon(doc, field.icon, contentStartX, curY - 3, iconSize);
             
             doc.setFontSize(9);
             doc.setFont("helvetica", "normal");
             doc.setTextColor(71, 85, 105);
             doc.text(field.value, contentStartX + iconSize + iconGap, curY);
             
             curY += lineHeight;
        });
    }

    return startY + boxHeight;
};

// --- PDF GENERATOR (REPORT) ---

export const generatePDFWithMetadata = async (
    state: AppState, 
    companyLogo?: string,
    marks?: Record<string, ('check' | 'x')[]>
): Promise<PDFGenerationResult> => {
    const doc = new jsPDF();
    const imageMap: ImageLocation[] = [];
    const checkboxMap: CheckboxLocation[] = [];
    
    let y = 10;
    const pageWidth = 210;
    const margin = 15;
    
    // --- LOAD ASSETS ---
    let logoDataUrl = companyLogo;

    // Prioritize LOGO_BASE64 if provided
    if (LOGO_BASE64) {
        logoDataUrl = LOGO_BASE64;
    } else {
        // Force load logo.png for consistency if no base64 override
        try {
            const logoResp = await fetch(HARDCODED_LOGO_PATH);
            if (logoResp.ok) {
                const blob = await logoResp.blob();
                logoDataUrl = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });
            }
        } catch(e) { console.warn("Fallback logo failed", e); }
    }

    // --- HEADER ---
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(55, 71, 79);
    doc.text(REPORT_TITLE, margin, y + 8);
    
    // Draw Logo Top Right
    if (logoDataUrl) {
        const logoDims = await getImageDimensions(logoDataUrl);
        if (logoDims.width > 0) {
            const logoW = 35; 
            const logoH = (logoDims.height / logoDims.width) * logoW;
            const logoX = pageWidth - margin - logoW;
            doc.addImage(logoDataUrl, getImageFormat(logoDataUrl), logoX, y - 5, logoW, logoH);
        }
    }

    y += 20;

    // --- PROJECT CARD ---
    const cardEndY = drawProjectCard(doc, state.project, y);
    y = cardEndY + 12; // Increased space

    // --- DISCLAIMER ---
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    
    const disclaimerLines = doc.splitTextToSize(REPORT_DISCLAIMER, pageWidth - (margin * 2) - 10);
    const disclaimerHeight = (disclaimerLines.length * 3.5) + 4; // Add padding height
    
    doc.setFillColor(245, 247, 250);
    doc.setDrawColor(220);
    doc.roundedRect(margin, y, pageWidth - (margin * 2), disclaimerHeight, 2, 2, 'FD');
    
    // Center Text Vertically
    const textBlockHeight = disclaimerLines.length * 3.5;
    const textStartY = y + (disclaimerHeight - textBlockHeight) / 2 + 2.5; // +2.5 approx baseline adjustment
    
    doc.text(disclaimerLines, margin + 5, textStartY);
    
    y += disclaimerHeight + 10;

    // --- LOCATIONS & ISSUES ---
    const locations = state.locations.filter(l => l.issues.length > 0);
    let itemCounter = 0;

    for (const loc of locations) {
        // Check Page Break (Location Header)
        if (y > 270) {
            doc.addPage();
            y = 20;
        }

        // Location Header
        doc.setFillColor(240, 248, 255); // Light Blue
        doc.setDrawColor(200, 220, 240);
        doc.roundedRect(margin, y, pageWidth - (margin * 2), 8, 2, 2, 'FD');
        
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 80, 160);
        doc.text(loc.name.toUpperCase(), margin + 4, y + 5.5);
        
        y += 12;

        for (const issue of loc.issues) {
            itemCounter++;
            const issueId = issue.id;
            
            // Check Page Break (Issue Block)
            // Estimate height: Text + Photos + Gap
            const descLines = doc.splitTextToSize(issue.description, pageWidth - margin * 2 - 25);
            const textHeight = descLines.length * 5;
            const photoHeight = issue.photos.length > 0 ? 45 : 0; // Increased for larger photos
            const blockHeight = Math.max(textHeight, 10) + photoHeight + 8;
            
            if (y + blockHeight > 280) {
                doc.addPage();
                y = 20;
            }

            // --- ITEM ROW ---
            const iconY = y;
            
            // Checkbox / Number Icon
            const isChecked = marks?.[issueId]?.includes('check');
            
            // Number Icon (replaces checkbox)
            drawSimpleIcon(doc, 'number', margin + 2, iconY, 6, itemCounter.toString(), isChecked ? [74, 222, 128] : [203, 213, 225], isChecked ? [255,255,255] : [100,116,139]);
            
            checkboxMap.push({
                pageIndex: doc.getNumberOfPages(),
                x: margin + 2,
                y: iconY,
                w: 6,
                h: 6,
                id: issueId,
                // Add strike line data for preview renderer
                strikethroughLines: isChecked ? descLines.map((line: string, i: number) => ({
                    x: margin + 14,
                    y: iconY + 4.5 + (i * 5) - 1.0, // Match PDF line calc
                    w: doc.getTextWidth(line)
                })) : undefined
            });

            // Description
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(50);
            
            // Render text line by line to support strikethrough alignment
            let textY = iconY + 4.5;
            descLines.forEach((line: string) => {
                doc.text(line, margin + 14, textY);
                
                // Strike-through if checked
                if (isChecked) {
                    const lw = doc.getTextWidth(line);
                    doc.setDrawColor(50);
                    doc.setLineWidth(0.2);
                    // y-offset -1.0mm from baseline looks good for middle strikethrough
                    doc.line(margin + 14, textY - 1.0, margin + 14 + lw, textY - 1.0);
                }
                textY += 5;
            });

            y = Math.max(y + textHeight, iconY + 8);

            // --- PHOTOS ---
            if (issue.photos.length > 0) {
                y += 2;
                let px = margin + 14;
                const photoSize = 40; // Bigger photos
                const gap = 4;
                
                for (let i = 0; i < issue.photos.length; i++) {
                    const photo = issue.photos[i];
                    // Fallback to index-based ID if issuePhoto.id is missing (legacy data)
                    const photoId = photo.id || `${issueId}_p${i}`; 

                    if (px + photoSize > pageWidth - margin) {
                        px = margin + 14;
                        y += photoSize + gap;
                    }

                    // Rounded Clip
                    doc.saveGraphicsState();
                    doc.roundedRect(px, y, photoSize, photoSize, 3, 3);
                    doc.clip();
                    
                    try {
                        const dims = await getImageDimensions(photo.url);
                        const fmt = getImageFormat(photo.url);
                        if (dims.width > 0) {
                             doc.addImage(photo.url, fmt, px, y, photoSize, photoSize, undefined, 'FAST');
                        }
                    } catch (e) {
                        doc.setFillColor(240);
                        doc.rect(px, y, photoSize, photoSize, 'F');
                    }
                    doc.restoreGraphicsState();
                    
                    // Add White Masking Stroke to cover anti-aliased corners
                    doc.setDrawColor(255, 255, 255);
                    doc.setLineWidth(3.0); // Thicker mask
                    doc.roundedRect(px, y, photoSize, photoSize, 3, 3, 'S');

                    // Draw Border
                    doc.setDrawColor(200);
                    doc.setLineWidth(0.1);
                    doc.roundedRect(px, y, photoSize, photoSize, 3, 3, 'S');

                    // Photo Number Pill
                    const label = `${itemCounter}.${i+1}`;
                    doc.setFontSize(7);
                    doc.setFont("helvetica", "bold");
                    const labelW = doc.getTextWidth(label) + 4;
                    
                    // Pill Background
                    doc.setFillColor(255, 255, 255);
                    doc.setDrawColor(200);
                    doc.roundedRect(px + 2, y + 2, labelW, 5, 1, 1, 'FD');
                    
                    // Pill Text
                    doc.setTextColor(50);
                    doc.text(label, px + 2 + (labelW/2), y + 5.5, { align: 'center' });

                    // Add to interactive map
                    imageMap.push({
                        pageIndex: doc.getNumberOfPages(),
                        x: px,
                        y: y,
                        w: photoSize,
                        h: photoSize,
                        id: photoId
                    });

                    // Draw 'X' if marked
                    if (marks?.[photoId]?.includes('x')) {
                         doc.setDrawColor(220, 38, 38); // Red
                         doc.setLineWidth(2);
                         doc.setLineCap('round');
                         doc.setLineJoin('round');
                         
                         const padding = photoSize * 0.2;
                         doc.line(px + padding, y + padding, px + photoSize - padding, y + photoSize - padding);
                         doc.line(px + photoSize - padding, y + padding, px + padding, y + photoSize - padding);
                    }

                    px += photoSize + gap;
                }
                y += photoSize + 6;
            } else {
                y += 4;
            }
            
            // Divider Line
            doc.setDrawColor(240);
            doc.setLineWidth(0.1);
            doc.line(margin, y, pageWidth - margin, y);
            y += 4;
        }
        
        y += 4;
    }
    
    // Page Numbers
    const pageCount = doc.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, 290, { align: 'center' });
    }

    return { doc, imageMap, checkboxMap };
};


// --- SIGN OFF PDF ---

const drawSignatureImageOnPDF = (
    doc: jsPDF, 
    signatureImage: string, 
    containerWidth: number, 
    startY: number, 
    pageHeightPx?: number, 
    gapHeightPx: number = 16
): number => {
    // 1. Calculate ratios
    const pdfPageHeightMM = 297; 
    const pdfPageWidthMM = 210;
    
    // Determine scale factor based on container width vs PDF width
    // Assuming the container fills the PDF width (minus minimal margin?)
    // In SignOffModal, we render PDFCanvasPreview which fills width. 
    // The canvas overlay matches that scrollWidth.
    // So ratio = 210mm / scrollWidthPx
    const ratio = pdfPageWidthMM / containerWidth;

    const img = new Image();
    img.src = signatureImage;
    
    // Since loading is sync in jsPDF addImage if base64, we can assume dimensions:
    const imgWidthPx = img.width;
    const imgHeightPx = img.height; // Total height of long canvas

    // If we have accurate page height from DOM, use it to slice. 
    // Otherwise fall back to PDF page height logic (less accurate if DOM varies).
    // pageHeightPx is the height of ONE PDF page rendered in DOM
    if (!pageHeightPx) {
         // Fallback: estimate from ratio
         pageHeightPx = pdfPageHeightMM / ratio;
    }
    
    // Calculate total PDF pages needed
    const totalPages = doc.getNumberOfPages();
    
    // Iterate through pages and draw slice
    // Visual check: The overlay is one long canvas. The PDF is paginated.
    // We need to slice the canvas corresponding to each page.
    // Between pages in the UI, there is a GAP (gapHeightPx).
    // The canvas COVERS that gap too (it's absolute over the whole column).
    // So for Page N:
    // Source Y = (PageHeight + Gap) * (N-1)
    // Source H = PageHeight
    // Dest X = 0 (or margin?), Dest Y = 0, Dest W = 210, Dest H = 297
    
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        
        const sourceY = (pageHeightPx + gapHeightPx) * (i - 1);
        const sourceH = pageHeightPx;
        
        // Safety check
        if (sourceY >= imgHeightPx) break;

        // Create a temporary canvas to slice the image
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imgWidthPx;
        tempCanvas.height = sourceH;
        
        const ctx = tempCanvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(
                img, 
                0, sourceY, imgWidthPx, sourceH, // Source
                0, 0, imgWidthPx, sourceH        // Dest on temp canvas
            );
            
            const sliceData = tempCanvas.toDataURL('image/png');
            
            // Draw onto PDF
            // The canvas overlay matches the PDF coordinates 1:1 visually
            doc.addImage(sliceData, 'PNG', 0, 0, pdfPageWidthMM, pdfPageHeightMM);
        }
    }
    
    return 0;
};

// Original vector function kept but updated to handle page switching correctly
const drawStrokesOnPDF = (doc: jsPDF, strokes: (Point[] | SignOffStroke)[], containerWidth: number, startY: number, pageHeightPx?: number, gapHeightPx: number = 16) => {
    // Ratio calc (see above)
    const pdfPageWidthMM = 210;
    const ratio = pdfPageWidthMM / containerWidth;
    
    const domPageH = pageHeightPx || (297 / ratio);
    const domGapH = gapHeightPx;
    
    const totalHeightPerBlock = domPageH + domGapH;

    strokes.forEach(s => {
        const points = Array.isArray(s) ? s : s.points;
        const type = Array.isArray(s) ? 'ink' : s.type;

        if (points.length < 2) return;

        // Calculate which page this stroke belongs to based on the FIRST point
        // NOTE: Strokes crossing pages might look weird. We'll handle segment by segment.
        
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i+1];
            
            // Determine page index for p1
            const pageIndex = Math.floor(p1.y / totalHeightPerBlock) + 1;
            
            // Determine local Y on that page
            // Global Y - (Pages Before * BlockHeight)
            const localY1 = p1.y - ((pageIndex - 1) * totalHeightPerBlock);
            const localY2 = p2.y - ((pageIndex - 1) * totalHeightPerBlock);
            
            // If segment crosses into the gap or next page, skip or clip it
            if (localY1 > domPageH) continue; // In the gap
            
            // Scale to PDF MM
            const pdfX1 = p1.x * ratio;
            const pdfY1 = localY1 * ratio;
            const pdfX2 = p2.x * ratio;
            const pdfY2 = localY2 * ratio;
            
            if (pageIndex > doc.getNumberOfPages()) continue;
            
            doc.setPage(pageIndex);
            
            // Apply styles explicitly per segment/page to ensure state is correct
            if (type === 'erase') {
                doc.setDrawColor(255, 255, 255);
                doc.setLineWidth(12); // ~40px scaled roughly
            } else {
                doc.setDrawColor(0, 0, 0);
                doc.setLineWidth(0.5);
            }
            doc.setLineCap('round');
            doc.setLineJoin('round');
            
            doc.line(pdfX1, pdfY1, pdfX2, pdfY2);
        }
    });
};

const drawSignatureImageOnPDF = async (doc: jsPDF, base64: string, containerWidth: number, screenPageHeight: number, screenGapHeight: number) => {
    return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
            const totalPages = doc.getNumberOfPages();
            const pdfW = 210;
            const pdfH = 297;
            
            const imgW = img.width;
            
            // DPR calc: Image Width / Container CSS Width
            const dpr = imgW / containerWidth;
            
            // Dimensions in Image Pixels
            const srcPageH = screenPageHeight * dpr;
            const srcGapH = screenGapHeight * dpr;
            const srcTotalH = srcPageH + srcGapH;
            
            // Create a temp canvas to slice the image
            const canvas = document.createElement('canvas');
            canvas.width = imgW;
            canvas.height = srcPageH;
            const ctx = canvas.getContext('2d');
            
            if (!ctx) { resolve(); return; }

            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                
                // Calculate Source Y start for this page
                const sy = (i - 1) * srcTotalH;
                
                // Clear and draw slice
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                // Source: img, sx=0, sy=sy, sw=imgW, sh=srcPageH
                // Dest:   canvas, dx=0, dy=0, dw=imgW, dh=srcPageH
                ctx.drawImage(img, 0, sy, imgW, srcPageH, 0, 0, imgW, srcPageH);
                
                const sliceData = canvas.toDataURL('image/png');
                
                // Draw slice onto PDF page, stretched to fit A4
                doc.addImage(sliceData, 'PNG', 0, 0, pdfW, pdfH);
            }
            resolve();
        };
        img.src = base64;
    });
};

export const generateSignOffPDF = async (
    project: ProjectDetails, 
    title: string, 
    template: SignOffTemplate, 
    companyLogo?: string,
    signatureImage?: string, // New: Full canvas snapshot
    strokes?: (Point[] | SignOffStroke)[], // Legacy/Fallback
    containerWidth?: number,
    pageHeightPx?: number,
    gapHeightPx?: number
): Promise<string> => {
    const doc = new jsPDF();
    const pageWidth = 210;
    const margin = 20;
    let y = 15;

    // --- LOAD LOGO ---
    let logoDataUrl = companyLogo;

    // Prioritize LOGO_BASE64 if provided
    if (LOGO_BASE64) {
        logoDataUrl = LOGO_BASE64;
    } else {
        try {
            const logoResp = await fetch(HARDCODED_LOGO_PATH);
            if (logoResp.ok) {
                const blob = await logoResp.blob();
                logoDataUrl = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });
            }
        } catch(e) {}
    }

<<<<<<< HEAD
    // Draw Logo Top Right
    if (logoDataUrl) {
        const logoDims = await getImageDimensions(logoDataUrl);
        if (logoDims.width > 0) {
            const logoW = 30; 
            const logoH = (logoDims.height / logoDims.width) * logoW;
            const logoX = pageWidth - margin - logoW + 5;
            doc.addImage(logoDataUrl, getImageFormat(logoDataUrl), logoX, 8, logoW, logoH);
        }
=======
    drawVerticalGradient(doc, 0, 0, 210, 35, [226, 232, 240], [255, 255, 255]);
    drawVerticalGradient(doc, 0, 297 - 35, 210, 35, [255, 255, 255], [226, 232, 240]);

    doc.setFillColor(84, 110, 122); 
    doc.rect(0, 0, 210, 3, 'F');

    // Hardcoded logo path
    const hardcodedLogo = '/logo.png';
    try {
        const dims = await getImageDimensions(hardcodedLogo);
        if (dims.width > 0) {
            const maxW = 35; 
            const maxH = 24; 
            const scale = Math.min(maxW / dims.width, maxH / dims.height);
            const w = dims.width * scale;
            const h = dims.height * scale;
            doc.addImage(hardcodedLogo, 'PNG', 200 - w, 8, w, h);
        }
    } catch (e) { 
        // fallback to param if provided and hardcode fails (optional)
>>>>>>> 8a9c3f04dde3b8074d6cc60f2e447dc2d68d0c0b
    }

    // --- HEADER ---
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(title, margin, y);
    y += 15;

    // --- PROJECT CARD ---
    const cardEndY = drawProjectCard(doc, project, y);
    y = cardEndY + 10;

    // --- SECTIONS ---
    for (const section of template.sections) {
        // --- CUSTOM SIGN OFF SECTION LAYOUT ---
        if (section.title === "Sign Off") {
            if (y + 60 > 280) { doc.addPage(); y = 20; }
            
            y += 10; // Extra spacing before header
            doc.setFillColor(240, 248, 255);
            doc.setDrawColor(200, 220, 240);
            doc.roundedRect(margin, y, pageWidth - margin*2, 8, 2, 2, 'FD');
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(0, 80, 160);
            doc.text(section.title.toUpperCase(), margin + 4, y + 5.5);
            y += 16; // Increased space after header

            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(60);
            doc.text("The following is to be signed at the \"rewalk\" (typically the date of closing)", margin, y);
            y += 6;
            
            doc.setFont("helvetica", "bold");
            doc.text("MY SIGNATURE CERTIFIES THE ACCEPTABLE COMPLETION OF ALL ITEMS LISTED ON THE BUILDER’S NEW HOME COMPLETION LIST:", margin, y);
            y += 10;

            // Row 1: Homebuyer Sig | Date
            doc.setFont("helvetica", "normal");
            doc.text("Homebuyer", margin, y + 5);
            drawModernBox(doc, margin + 25, y, 80, 10, 'signature');
            
            doc.text("Date", margin + 115, y + 5);
            drawModernBox(doc, margin + 125, y, 40, 10, 'initial');
            y += 18;

            // Item numbers not complete
            doc.text("Item numbers not complete on the date of acceptance/closing:", margin, y);
            y += 5;
            drawModernBox(doc, margin, y, pageWidth - margin*2, 12, 'initial');
            y += 18;

            // Final Statement
            doc.text("All items on the builder's new home completion list have been completed.", margin, y);
            y += 8;

            // Row 2: Homebuyer Sig | Date
            doc.text("Homebuyer", margin, y + 5);
            drawModernBox(doc, margin + 25, y, 80, 10, 'signature');
            
            doc.text("Date", margin + 115, y + 5);
            drawModernBox(doc, margin + 125, y, 40, 10, 'initial');
            y += 20;

            continue; 
        }

<<<<<<< HEAD
        // --- STANDARD SECTION LAYOUT ---
        const lines = doc.splitTextToSize(section.body, pageWidth - (margin * 2));
        const textHeight = lines.length * 5;
        const boxHeight = textHeight + 20; 

        if (y + boxHeight > 280) {
            doc.addPage();
            y = 20;
        }

        doc.setFillColor(240, 248, 255);
        doc.setDrawColor(200, 220, 240);
        doc.roundedRect(margin, y, pageWidth - (margin * 2), 8, 2, 2, 'FD');
        
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 80, 160);
        doc.text(section.title.toUpperCase(), margin + 4, y + 5.5);
        
        y += 10;
        
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(60);
        
        // Render lines manually to control spacing
        let textY = y;
        lines.forEach((line: string) => {
            // Check for [INITIAL] placeholder
            if (line.includes('[INITIAL]')) {
                 const parts = line.split('[INITIAL]');
                 doc.text(parts[0], margin, textY);
                 const preWidth = doc.getTextWidth(parts[0]);
                 
                 // Draw box
                 drawModernBox(doc, margin + preWidth + 2, textY - 4, 12, 6, 'initial');
                 
                 if (parts[1]) {
                     doc.text(parts[1], margin + preWidth + 16, textY);
                 }
            } else {
                doc.text(line, margin, textY);
            }
            textY += 6; // Line height
        });
        
        y = textY + 5;
    }
    
    // --- DRAW STROKES OR SIGNATURE IMAGE ---
    if (signatureImage && containerWidth) {
        // Preferred: Draw full raster image (handles eraser correctly)
        drawSignatureImageOnPDF(doc, signatureImage, containerWidth, 0, pageHeightPx, gapHeightPx);
    } else if (strokes && containerWidth) {
        // Fallback: Draw vector strokes (eraser might show as white lines on white bg)
        drawStrokesOnPDF(doc, strokes, containerWidth, 0, pageHeightPx, gapHeightPx);
=======
    // Prefer image overlay (handling opacity/erasure correctly) over vector strokes
    if (signatureImage && containerWidth && pageHeight) {
        await drawSignatureImageOnPDF(doc, signatureImage, containerWidth, pageHeight, gapHeight || 16);
    } else if (strokes && containerWidth && strokes.length > 0) {
        drawStrokesOnPDF(doc, strokes, containerWidth, pageHeight, gapHeight);
>>>>>>> 8a9c3f04dde3b8074d6cc60f2e447dc2d68d0c0b
    }

    return doc.output('bloburl').toString();
};
<<<<<<< HEAD
=======

export const generatePDFWithMetadata = async (
    data: AppState, 
    companyLogo?: string, 
    marks?: Record<string, ('check' | 'x')[]>
): Promise<PDFGenerationResult> => {
  let doc: jsPDF;
  try {
     doc = new jsPDF();
  } catch (e) {
     console.error("jsPDF init failed", e);
     throw new Error("Could not initialize PDF generator. Please refresh the page.");
  }

  const imageMap: ImageLocation[] = [];
  const checkboxMap: CheckboxLocation[] = [];
  
  const { project, locations: rawLocations } = data;
  const locations = [
      ...rawLocations.filter(l => l.name !== "Rewalk Notes"),
      ...rawLocations.filter(l => l.name === "Rewalk Notes")
  ];

  drawVerticalGradient(doc, 0, 0, 210, 35, [226, 232, 240], [255, 255, 255]);
  drawVerticalGradient(doc, 0, 297 - 35, 210, 35, [255, 255, 255], [226, 232, 240]);

  doc.setFillColor(84, 110, 122); 
  doc.rect(0, 0, 210, 3, 'F');

  // Hardcoded logo path
  const hardcodedLogo = '/logo.png';
  try {
      const dims = await getImageDimensions(hardcodedLogo);
      if (dims.width > 0) {
          const maxW = 35; 
          const maxH = 24; 
          const scale = Math.min(maxW / dims.width, maxH / dims.height);
          const w = dims.width * scale;
          const h = dims.height * scale;
          doc.addImage(hardcodedLogo, 'PNG', 200 - w, 8, w, h);
      }
  } catch (e) { }

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  const titleStr = REPORT_TITLE; 
  const titleWidth = doc.getTextWidth(titleStr);
  const pillW = titleWidth + 20;
  const pillX = (210 - pillW) / 2;
  const pillY = 18;

  doc.setFillColor(84, 110, 122); 
  doc.roundedRect(pillX, pillY, pillW, 10, 5, 5, 'F'); 

  doc.setTextColor(255, 255, 255);
  doc.text(titleStr, 105, pillY + 6.5, { align: 'center' });

  const cardEndY = drawProjectCard(doc, project, 35);
  
  // Increased gap between card and disclaimer
  const disclaimerY = cardEndY + 12; 
  const splitDisclaimer = doc.splitTextToSize(REPORT_DISCLAIMER, 170); 
  
  // Adjusted height calculation for better vertical centering
  const lineHeight = 4;
  const textBlockHeight = splitDisclaimer.length * lineHeight;
  const verticalPadding = 6;
  const disclaimerHeight = textBlockHeight + (verticalPadding * 2);
  
  doc.setFillColor(241, 245, 249); 
  doc.setDrawColor(226, 232, 240); 
  doc.roundedRect(14, disclaimerY, 182, disclaimerHeight, 3, 3, 'FD');

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); 
  
  // Center text vertically within the box
  // disclaimerY is top of box. 
  // Add verticalPadding + ascent offset (~3 for size 9)
  doc.text(splitDisclaimer, 105, disclaimerY + verticalPadding + 3, { align: 'center' });

  let currentY = Math.max(disclaimerY + disclaimerHeight + 14, 115); 
  let issueCounter = 1;

  for (const loc of locations) {
    if (loc.issues.length === 0) continue;
    
    await new Promise(resolve => setTimeout(resolve, 0));

    if (currentY + 25 > 280) {
        doc.addPage();
        drawVerticalGradient(doc, 0, 0, 210, 35, [226, 232, 240], [255, 255, 255]);
        drawVerticalGradient(doc, 0, 297 - 35, 210, 35, [255, 255, 255], [226, 232, 240]);
        currentY = 20;
    }
    
    const isRewalkNotes = loc.name === "Rewalk Notes";
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    
    let locationTitle = loc.name; 
    if (isRewalkNotes) {
        const dateStr = new Date().toLocaleDateString();
        locationTitle += ` - ${dateStr}`;
    }
    
    const locTitleWidth = doc.getTextWidth(locationTitle);
    const locPillW = locTitleWidth + 16;
    const locPillX = (210 - locPillW) / 2; 

    if (isRewalkNotes) {
        doc.setFillColor(255, 205, 210); 
        doc.setDrawColor(255, 205, 210);
        doc.setTextColor(183, 28, 28); 
    } else {
        doc.setFillColor(176, 190, 197); 
        doc.setDrawColor(176, 190, 197); 
        doc.setTextColor(38, 50, 56);
    }
    
    doc.roundedRect(locPillX, currentY, locPillW, 10, 5, 5, 'F'); 
    doc.text(locationTitle, 105, currentY + 6.5, { align: 'center' });
    currentY += 18;

    for (const issue of loc.issues) {
        if (currentY > 270) {
            doc.addPage();
            drawVerticalGradient(doc, 0, 0, 210, 35, [226, 232, 240], [255, 255, 255]);
            drawVerticalGradient(doc, 0, 297 - 35, 210, 35, [255, 255, 255], [226, 232, 240]);
            currentY = 20;
        }

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        const descriptionLines = doc.splitTextToSize(issue.description, 148);
        const textHeight = (Array.isArray(descriptionLines) ? descriptionLines.length : 1) * 4;
        
        const photoSize = 40; 
        const photoGap = 4;
        const descGap = 6; 
        
        let photoRowHeight = photoSize; 
        let hasPhotoDesc = false;
        if (issue.photos.length > 0) {
             hasPhotoDesc = issue.photos.some(p => p.description && p.description.trim().length > 0);
             if (hasPhotoDesc) photoRowHeight += descGap; 
        }

        let photoBlockHeight = 0;
        if (issue.photos.length > 0) {
            const rows = Math.ceil(issue.photos.length / 4);
            photoBlockHeight = (rows * photoRowHeight) + ((rows - 1) * photoGap);
        }

        const itemHeight = Math.max(textHeight, 8) + (photoBlockHeight > 0 ? photoBlockHeight + 8 : 0) + 8; 

        if (currentY + itemHeight > 280) {
             doc.addPage();
             drawVerticalGradient(doc, 0, 0, 210, 35, [226, 232, 240], [255, 255, 255]);
             drawVerticalGradient(doc, 0, 297 - 35, 210, 35, [255, 255, 255], [226, 232, 240]);
             currentY = 20;
        }

        const boxSize = 6;
        const boxX = 14;
        
        doc.setDrawColor(51, 65, 85); 
        doc.setLineWidth(1); 
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(boxX, currentY + 1, boxSize, boxSize, 1, 1, 'FD');
        
        const linesData: { x: number, y: number, w: number }[] = [];
        const lineSpacing = 4;
        const textStartX = 30;
        const textStartY = currentY + 4.0;
        
        if (Array.isArray(descriptionLines)) {
            descriptionLines.forEach((line, i) => {
                const lw = doc.getTextWidth(line);
                // Offset calculation: baseline (textStartY + i*spacing) - 1.0mm (move down slightly from 1.2)
                const lineY = textStartY + (i * lineSpacing) - 1.0;
                linesData.push({ x: textStartX, y: lineY, w: lw });
            });
        } else if (typeof descriptionLines === 'string') {
             const lw = doc.getTextWidth(descriptionLines);
             const lineY = textStartY - 1.0;
             linesData.push({ x: textStartX, y: lineY, w: lw });
        }

        checkboxMap.push({
            pageIndex: doc.getNumberOfPages(),
            x: boxX,
            y: currentY + 1,
            w: boxSize,
            h: boxSize,
            id: issue.id,
            strikethroughLines: linesData
        });

        const isChecked = marks && marks[issue.id]?.includes('check');

        if (isChecked) {
             drawSimpleIcon(doc, 'check-mark-thick', boxX - 1, currentY, 8);
        }

        doc.setTextColor(38, 50, 56);
        doc.setFontSize(10);
        
        drawSimpleIcon(doc, 'number', boxX + 8, currentY + 1.25, 5.5, issueCounter.toString(), [207, 216, 220], [51, 65, 85]);
        
        // Manual Text Drawing Loop to ensure strikethrough alignment matches text exactly
        if (Array.isArray(descriptionLines)) {
            descriptionLines.forEach((line, i) => {
                doc.text(line, 30, textStartY + (i * lineSpacing));
            });
        } else {
             doc.text(descriptionLines, 30, textStartY);
        }

        if (isChecked) {
            doc.saveGraphicsState();
            doc.setDrawColor(50, 50, 50); 
            doc.setLineWidth(0.3);
            linesData.forEach(line => {
                doc.line(line.x, line.y, line.x + line.w, line.y);
            });
            doc.restoreGraphicsState();
        }

        let nextY = currentY + Math.max(textHeight, 8) + 4;

        if (issue.photos.length > 0) {
             let px = 28;
             let py = nextY;
             for (let i = 0; i < issue.photos.length; i++) {
                  if (i > 0 && i % 4 === 0) {
                      px = 28;
                      py += photoRowHeight + photoGap;
                  }
                  const photo = issue.photos[i];
                  const photoId = photo.id || `${issue.id}_img_${i}`;
                  
                  try {
                      const format = getImageFormat(photo.url);
                      
                      // Explicit clipping path for rounded image
                      doc.saveGraphicsState();
                      doc.roundedRect(px, py, photoSize, photoSize, 3, 3, null); // Add path
                      doc.clip(); // Clip to path
                      doc.addImage(photo.url, format, px, py, photoSize, photoSize);
                      doc.restoreGraphicsState();

                      // Draw thicker white masking stroke to clean up square edges
                      doc.saveGraphicsState();
                      doc.setDrawColor(255, 255, 255); 
                      doc.setLineWidth(3.0); 
                      doc.roundedRect(px, py, photoSize, photoSize, 3, 3, 'S');
                      doc.restoreGraphicsState();

                      // Draw border stroke AFTER image to cover anti-aliasing artifacts
                      doc.saveGraphicsState();
                      doc.setDrawColor(226, 232, 240); 
                      doc.setLineWidth(0.5); 
                      doc.roundedRect(px, py, photoSize, photoSize, 3, 3, 'S');
                      doc.restoreGraphicsState();

                      imageMap.push({
                          pageIndex: doc.getNumberOfPages(),
                          x: px, y: py, w: photoSize, h: photoSize,
                          id: photoId
                      });

                      const photoLabel = `${issueCounter}.${i + 1}`;
                      doc.saveGraphicsState();
                      doc.setFillColor(51, 65, 85); 
                      doc.roundedRect(px + 1, py + 1, 9, 5, 1.5, 1.5, 'F');
                      doc.setTextColor(255, 255, 255);
                      doc.setFontSize(8);
                      doc.setFont("helvetica", "bold");
                      doc.text(photoLabel, px + 5.5, py + 4.5, { align: 'center' });
                      doc.restoreGraphicsState();
                      
                      if (photo.description && photo.description.trim()) {
                          const descY = py + photoSize + 1;
                          const descH = 5;
                          doc.setFillColor(236, 239, 241); 
                          doc.setDrawColor(236, 239, 241);
                          doc.roundedRect(px, descY, photoSize, descH, 1.5, 1.5, 'F');
                          
                          doc.setFontSize(7);
                          doc.setTextColor(51, 65, 85);
                          doc.text(photo.description, px + (photoSize/2), descY + 3.5, { align: 'center', maxWidth: photoSize - 2 });
                          doc.setFontSize(10); 
                          doc.setTextColor(38, 50, 56);
                      }

                      if (marks && marks[photoId]?.includes('x')) {
                          doc.saveGraphicsState();
                          doc.setDrawColor(220, 38, 38);
                          doc.setLineWidth(2);
                          doc.setLineCap('round'); 
                          doc.setLineJoin('round');
                          
                          const padding = photoSize * 0.2; 
                          doc.line(px + padding, py + padding, px + photoSize - padding, py + photoSize - padding);
                          doc.line(px + photoSize - padding, py + padding, px + padding, py + photoSize - padding);
                          doc.restoreGraphicsState();
                      }
                  } catch (e) {
                      console.warn("Failed to draw image", e);
                  }
                  px += photoSize + photoGap;
             }
             nextY = py + photoRowHeight + 4;
        }
        
        currentY = nextY + 4;
        issueCounter++;
    }
  }

  return { doc, imageMap, checkboxMap };
};
>>>>>>> 8a9c3f04dde3b8074d6cc60f2e447dc2d68d0c0b
