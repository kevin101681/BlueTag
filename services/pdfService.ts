import { jsPDF } from 'jspdf';
import { AppState, ProjectDetails, SignOffTemplate, SignOffSection, ProjectField } from '../types';

// --- CONFIGURATION ---

export const SIGN_OFF_PDF_BASE64: string = "";

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
    textX: number; 
    textY: number; 
    textW: number; 
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
    
    // Normalize icon type to lower case for comparison
    const t = type.toLowerCase();

    // Map common lucide names to internal drawing logic
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
    } else if (t === 'list' || t === 'filetext') {
        doc.line(x + s*0.2, y + s*0.2, x + s*0.8, y + s*0.2);
        doc.line(x + s*0.2, y + s*0.5, x + s*0.8, y + s*0.5);
        doc.line(x + s*0.2, y + s*0.8, x + s*0.8, y + s*0.8);
        doc.rect(x + s*0.1, y, s*0.8, s, 'S');
        doc.stroke();
    } else if (t === 'pen' || t === 'pentool') {
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
    } else if (t === 'pen-tip') {
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
         // Use custom color if provided, otherwise default blue
         const c = customColor || [14, 165, 233];
         doc.setFillColor(c[0], c[1], c[2]); 
         doc.circle(x + rn, y + rn - (s*0.3), rn, 'F');
         
         // Use custom text color if provided, otherwise white
         const tc = textColor || [255, 255, 255];
         doc.setTextColor(tc[0], tc[1], tc[2]);
         doc.setFontSize(8);
         doc.setFont("helvetica", "bold");
         doc.text(numberValue || "", x + rn, y + rn - (s*0.3) + 1.1, { align: 'center' });
    } else {
        // Default Circle
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
    // Dynamic Field Rendering
    // Convention:
    // Field 0: Header (Large)
    // Field 1: Subheader (Medium)
    // Field 2+: Detail List (Small with Icon)
    
    const fields = project.fields || [];
    if (fields.length === 0) return startY;

    const headerField = fields[0];
    const subheaderField = fields.length > 1 ? fields[1] : null;
    const detailFields = fields.slice(2).filter(f => f.value && f.value.trim() !== "");

    // Prepare styles
    const paddingX = 12;
    const paddingY = 6;
    const iconSize = 3.5;
    const iconGap = 5;
    const lineHeight = 6;

    // Measure Header
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    const nameStr = headerField.value || "Project";
    const nameWidth = doc.getTextWidth(nameStr);

    // Measure Subheader
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    const lotStr = subheaderField ? subheaderField.value : "";
    const lotWidth = doc.getTextWidth(lotStr);

    // Measure Details
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
    let contentHeight = 6; // Header height approx
    if (lotStr) contentHeight += 6;
    if (detailFields.length > 0) contentHeight += 6; // Gap before details
    if (detailFields.length > 0) contentHeight += (detailFields.length * lineHeight) - 2;

    const finalBoxHeight = contentHeight + (paddingY * 2);

    const pageWidth = 210;
    const boxX = (pageWidth - boxWidth) / 2;

    // Draw Box
    doc.setFillColor(236, 239, 241); 
    doc.setDrawColor(207, 216, 220); 
    doc.setLineWidth(0.1); 
    doc.roundedRect(boxX, startY, boxWidth, finalBoxHeight, 8, 8, 'FD'); 

    let currentY = startY + paddingY + 4; 
    const leftX = boxX + paddingX;

    // Draw Header
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59); 
    doc.setFont("helvetica", "bold");
    doc.text(nameStr, leftX, currentY);

    // Draw Subheader
    if (lotStr) {
        currentY += 6;
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139); 
        doc.setFont("helvetica", "bold");
        doc.text(lotStr, leftX, currentY);
    }

    // Draw Details
    if (detailFields.length > 0) {
        currentY += 6; 
        
        doc.setFontSize(9); 
        doc.setTextColor(51, 65, 85); 
        doc.setFont("helvetica", "normal");

        detailFields.forEach(line => {
            drawSimpleIcon(doc, line.icon, leftX, currentY - 3, iconSize);
            doc.text(line.value, leftX + iconSize + iconGap, currentY);
            currentY += lineHeight;
        });
    }

    return startY + finalBoxHeight;
};

// --- SIGN OFF CARD RENDERERS ---

const CARD_WIDTH = 190;
const CARD_X = (210 - CARD_WIDTH) / 2;
const CARD_PADDING = 8;
const TITLE_HEIGHT = 12;
const INITIAL_BOX_SIZE = 10;
const INITIAL_BOX_LEFT_MARGIN = 14;

const drawCardHeader = (doc: jsPDF, y: number, title: string, cardHeight: number, iconType: string) => {
    const headerColor = [207, 216, 220]; 
    const bodyColor = [236, 242, 245]; 

    doc.setFillColor(bodyColor[0], bodyColor[1], bodyColor[2]);
    doc.setDrawColor(bodyColor[0], bodyColor[1], bodyColor[2]); 
    doc.roundedRect(CARD_X, y, CARD_WIDTH, cardHeight, 4, 4, 'FD');

    doc.setFillColor(headerColor[0], headerColor[1], headerColor[2]);
    doc.setDrawColor(headerColor[0], headerColor[1], headerColor[2]);
    
    doc.roundedRect(CARD_X, y, CARD_WIDTH, TITLE_HEIGHT + 2, 4, 4, 'F');
    doc.rect(CARD_X, y + TITLE_HEIGHT - 2, CARD_WIDTH, 4, 'F');
    
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85); 
    doc.setFont("helvetica", "bold");
    
    drawSimpleIcon(doc, iconType, CARD_X + 6, y + 3.5, 5);
    doc.text(title, CARD_X + 16, y + 7.5);
};

const drawSectionCard = (doc: jsPDF, startY: number, section: SignOffSection): number => {
    const paragraphs = section.body.split('\n').filter(p => p.trim().length > 0);
    
    let lineCounter = 1;

    // Calculate content height
    const contentItems = paragraphs.map(text => {
        let currentType = 'text'; // Default lines to text
        let currentText = text;
        
        if (section.type === 'initials') currentType = 'initials';
        
        // Marker override for mixed types
        if (currentText.trim().startsWith('[INITIAL]')) {
             currentType = 'initials';
             currentText = currentText.replace('[INITIAL]', '').trim();
        }

        // Indent logic
        let leftMargin = 0;
        if (currentType === 'initials') {
            leftMargin = INITIAL_BOX_LEFT_MARGIN;
        } else if (section.title === "Warranty Procedures") {
            leftMargin = 16; // Indent for numbered list + box padding
        }
        
        const availWidth = CARD_WIDTH - (CARD_PADDING * 2) - leftMargin - 4; // Extra padding
        
        doc.setFontSize(11); 
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(currentText, availWidth);
        const textHeight = lines.length * 5.5; 
        
        let height = textHeight;
        if (currentType === 'initials') {
            height = Math.max(textHeight, INITIAL_BOX_SIZE + 2);
        } else if (section.title === "Warranty Procedures") {
             height = textHeight + 4; // Add padding for background box
        }
        
        return { lines, height, type: currentType };
    });

    const signatureBlockHeight = section.type === 'signature' ? 24 : 0;

    const totalContentHeight = contentItems.reduce((acc, item) => acc + item.height + 4, 0) + signatureBlockHeight; 
    const cardHeight = TITLE_HEIGHT + totalContentHeight + CARD_PADDING;

    // Detect icon based on section type or title keywords
    let icon = 'paper';
    const titleLower = section.title.toLowerCase();
    if (section.type === 'signature') icon = 'pen-tip';
    else if (section.type === 'initials') icon = 'check';
    else if (titleLower.includes('warranty')) icon = 'paper';
    else if (titleLower.includes('warning') || titleLower.includes('note')) icon = 'alert';

    // Page Break Check
    if (startY + cardHeight > 280) {
        doc.addPage();
        drawVerticalGradient(doc, 0, 0, 210, 35, [226, 232, 240], [255, 255, 255]);
        startY = 20; // Reset Y
    }

    drawCardHeader(doc, startY, section.title, cardHeight, icon);

    let currentY = startY + TITLE_HEIGHT + 8;

    contentItems.forEach((item) => {
        const boxX = CARD_X + CARD_PADDING;
        const boxY = currentY;
        
        let leftMargin = 0;

        if (item.type === 'initials') {
            drawModernBox(doc, boxX, boxY, INITIAL_BOX_SIZE, INITIAL_BOX_SIZE, 'initial');
            leftMargin = INITIAL_BOX_LEFT_MARGIN;
        } else if (section.title === "Warranty Procedures") {
            // Draw background box for text
            const textBgW = CARD_WIDTH - (CARD_PADDING * 2);
            doc.setFillColor(248, 250, 252); // slate-50
            doc.roundedRect(boxX, boxY, textBgW, item.height, 2, 2, 'F');

            // Vertically center the icon relative to the BACKGROUND box
            const iconSize = 7;
            const centerY = boxY + (item.height / 2);
            
            // Adjust offset for custom icon drawing shift:
            // Circle is drawn at y + 1.4 relative to y input (which is iconY)
            // We want circle center at centerY. 
            // So iconY + 1.4 = centerY => iconY = centerY - 1.4
            // Formula below: centerY - 3.5 + 2.5 = centerY - 1.0.
            // Adjusted offset to 2.5 to push icon slightly down visually
            
            // Re-tuned for perfect centering, especially for single lines
            let offset = 2.1;
            
            // Special adjustment for single lines to fix visual balance
            if (item.lines.length === 1) {
                offset += 0.75;
            }

            const iconY = centerY - (iconSize / 2) + offset;

            // Draw number
            drawSimpleIcon(doc, 'number', boxX + 4, iconY, iconSize, lineCounter.toString(), [207, 216, 220], [51, 65, 85]);
            lineCounter++;
            leftMargin = 16;
        }

        doc.setFontSize(11); 
        doc.setTextColor(51, 65, 85);
        doc.setFont("helvetica", "normal");
        
        const textX = boxX + leftMargin + (item.type === 'initials' ? 4 : 0);
        
        let textY;
        if (section.title === "Warranty Procedures") {
             // Center text block vertically within the item height
             const textBlockH = item.lines.length * 5.5;
             const centerY = boxY + (item.height / 2);
             // Cap height adj approx 1.5. Baseline is below center.
             textY = centerY - (textBlockH / 2) + 4; 
        } else {
             textY = currentY + 5;
        }
        
        doc.text(item.lines, textX, textY);
        
        currentY += item.height + 4; 
    });

    // Draw Signature Block at the bottom if needed
    if (section.type === 'signature') {
         const leftX = CARD_X + CARD_PADDING;
         
         // Homebuyer Label
         doc.setFontSize(11);
         doc.setTextColor(51, 65, 85);
         doc.setFont("helvetica", "normal");
         doc.text("Homebuyer", leftX, currentY + 5);
         
         // Signature Box
         const sigBoxX = leftX + 22;
         const sigBoxW = 80;
         const sigBoxH = 8;
         drawModernBox(doc, sigBoxX, currentY, sigBoxW, sigBoxH, 'signature');

         // Date Label
         const dateLabelX = sigBoxX + sigBoxW + 5;
         doc.text("Date", dateLabelX, currentY + 5);

         // Date Box
         const dateBoxX = dateLabelX + 10;
         const dateBoxW = 30;
         drawModernBox(doc, dateBoxX, currentY, dateBoxW, sigBoxH, 'initial');
         
         // Current Date
         const dateStr = new Date().toLocaleDateString();
         doc.setFontSize(9);
         doc.text(dateStr, dateBoxX + (dateBoxW/2), currentY + 5.5, { align: 'center' });
    }

    return startY + cardHeight;
};

const drawSignaturesCard = (doc: jsPDF, startY: number, signatureImage?: string): number => {
    const cardHeight = 110;
    
    // Page Break Check
    if (startY + cardHeight > 280) {
        doc.addPage();
        drawVerticalGradient(doc, 0, 0, 210, 35, [226, 232, 240], [255, 255, 255]);
        startY = 20;
    }

    drawCardHeader(doc, startY, "Sign Off", cardHeight, 'pen-tip');

    // Increased spacing before first line
    let currentY = startY + TITLE_HEIGHT + 16; 
    const padding = CARD_PADDING;
    const leftX = CARD_X + padding;
    const dateStr = new Date().toLocaleDateString();

    doc.setFontSize(11); 
    doc.setTextColor(51, 65, 85);
    doc.setFont("helvetica", "italic");
    doc.text('The following is to be signed at the "rewalk" (typically the date of closing)', leftX, currentY);
    currentY += 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const certText = "MY SIGNATURE CERTIFIES THE ACCEPTABLE COMPLETION OF ALL ITEMS LISTED ON THE BUILDER’S NEW HOME COMPLETION LIST:";
    doc.text(doc.splitTextToSize(certText, CARD_WIDTH - padding * 2), leftX, currentY);
    currentY += 10;

    // First Signature Row
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11); 
    doc.text("Homebuyer", leftX, currentY + 5);
    
    const sigBoxX = leftX + 22;
    const sigBoxY = currentY;
    const sigBoxW = 80;
    const sigBoxH = 8;
    
    // Signature Box
    drawModernBox(doc, sigBoxX, sigBoxY, sigBoxW, sigBoxH, 'signature');
    
    if (signatureImage) {
        try {
            const format = getImageFormat(signatureImage);
            doc.addImage(signatureImage, format, sigBoxX + 1, sigBoxY + 1, sigBoxW - 2, sigBoxH - 2);
        } catch (e) {
            console.error("Failed to draw signature", e);
        }
    }

    // Date Box
    const dateLabelX = leftX + 107;
    doc.text("Date", dateLabelX, currentY + 5);
    
    const dateBoxX = dateLabelX + 10;
    const dateBoxW = 30;
    drawModernBox(doc, dateBoxX, sigBoxY, dateBoxW, sigBoxH, 'initial');
    doc.setFontSize(9);
    // Centered date
    doc.text(dateStr, dateBoxX + (dateBoxW/2), currentY + 5.5, { align: 'center' });
    
    currentY += 16;

    // Incomplete Items Box
    doc.setFontSize(11);
    doc.text("Item numbers not complete on the date of acceptance/closing:", leftX, currentY);
    currentY += 4;
    drawModernBox(doc, leftX, currentY, CARD_WIDTH - (padding * 2), 12, 'signature');
    currentY += 20;

    // Completion Statement
    doc.text("All items on the builder's new home completion list have been completed.", leftX, currentY);
    currentY += 8;

    // Second Signature Row
    doc.text("Homebuyer", leftX, currentY + 5);
    drawModernBox(doc, leftX + 22, currentY, 80, 8, 'signature');
    
    doc.text("Date", dateLabelX, currentY + 5);
    drawModernBox(doc, dateBoxX, currentY, dateBoxW, sigBoxH, 'initial');
    doc.setFontSize(9);
    // Centered date
    doc.text(dateStr, dateBoxX + (dateBoxW/2), currentY + 5.5, { align: 'center' });

    return startY + cardHeight;
};

// --- PDF GENERATION ENTRY POINTS ---

const createPDFDocument = async (
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

  if (companyLogo) {
    try {
        const dims = await getImageDimensions(companyLogo);
        if (dims.width > 0) {
            const maxW = 35; 
            const maxH = 24; 
            const scale = Math.min(maxW / dims.width, maxH / dims.height);
            const w = dims.width * scale;
            const h = dims.height * scale;
            const format = getImageFormat(companyLogo);
            doc.addImage(companyLogo, format, 200 - w, 8, w, h);
        }
    } catch (e) { }
  }

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
  
  const disclaimerY = cardEndY + 10;
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); 

  const splitDisclaimer = doc.splitTextToSize(REPORT_DISCLAIMER, 170); 
  doc.text(splitDisclaimer, 105, disclaimerY, { align: 'center' });

  const disclaimerHeight = splitDisclaimer.length * 4; 
  let currentY = Math.max(disclaimerY + disclaimerHeight + 10, 115); 
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
        const descriptionLines = doc.splitTextToSize(issue.description, 153);
        
        let maxLineWidth = 0;
        if (Array.isArray(descriptionLines)) {
             descriptionLines.forEach((l: string) => {
                 const w = doc.getTextWidth(l);
                 if (w > maxLineWidth) maxLineWidth = w;
             });
        } else {
             maxLineWidth = doc.getTextWidth(descriptionLines as string);
        }

        const textHeight = (Array.isArray(descriptionLines) ? descriptionLines.length : 1) * 4;
        
        // Photos
        const photoSize = 32;
        const photoGap = 4;
        const descGap = 6; 
        
        // Determine Photo Row Height based on description presence
        let photoRowHeight = photoSize; 
        
        // Check if any photo has a description to add vertical space
        let hasPhotoDesc = false;
        if (issue.photos.length > 0) {
             hasPhotoDesc = issue.photos.some(p => p.description && p.description.trim().length > 0);
             if (hasPhotoDesc) photoRowHeight += descGap; // Pill Height
        }

        let photoBlockHeight = 0;
        if (issue.photos.length > 0) {
            const rows = Math.ceil(issue.photos.length / 4);
            photoBlockHeight = (rows * photoRowHeight) + ((rows - 1) * photoGap);
        }

        const itemHeight = Math.max(textHeight, 8) + (photoBlockHeight > 0 ? photoBlockHeight + 8 : 0) + 8; // Padding

        if (currentY + itemHeight > 280) {
             doc.addPage();
             drawVerticalGradient(doc, 0, 0, 210, 35, [226, 232, 240], [255, 255, 255]);
             drawVerticalGradient(doc, 0, 297 - 35, 210, 35, [255, 255, 255], [226, 232, 240]);
             currentY = 20;
        }

        // Checkbox Logic
        const boxSize = 6;
        // Move checkbox to left margin
        const boxX = 14;
        
        doc.setDrawColor(51, 65, 85); // Darker Slate color for visibility
        doc.setLineWidth(1); // Thicker line
        doc.setFillColor(255, 255, 255);
        // Explicitly draw the checkbox square
        doc.roundedRect(boxX, currentY + 1, boxSize, boxSize, 1, 1, 'FD');
        
        checkboxMap.push({
            pageIndex: doc.getNumberOfPages(),
            x: boxX,
            y: currentY + 1,
            w: boxSize,
            h: boxSize,
            id: issue.id,
            textX: 0, textY: 0, textW: 0
        });

        if (marks && marks[issue.id]?.includes('check')) {
             drawSimpleIcon(doc, 'check', boxX - 1, currentY, 8);
        }

        // Description
        doc.setTextColor(38, 50, 56);
        doc.text(descriptionLines, 28, currentY + 3.5);

        let nextY = currentY + Math.max(textHeight, 8) + 4;

        // Photos
        if (issue.photos.length > 0) {
             let px = 28;
             let py = nextY;
             for (let i = 0; i < issue.photos.length; i++) {
                  if (i > 0 && i % 4 === 0) {
                      px = 28;
                      py += photoRowHeight + photoGap;
                  }
                  const photo = issue.photos[i];
                  try {
                      const format = getImageFormat(photo.url);
                      doc.addImage(photo.url, format, px, py, photoSize, photoSize);
                      imageMap.push({
                          pageIndex: doc.getNumberOfPages(),
                          x: px, y: py, w: photoSize, h: photoSize,
                          id: issue.id
                      });
                      
                      // Draw Description Pill if present
                      if (photo.description && photo.description.trim()) {
                          const descY = py + photoSize + 1;
                          const descH = 5;
                          doc.setFillColor(236, 239, 241); 
                          doc.setDrawColor(236, 239, 241);
                          doc.roundedRect(px, descY, photoSize, descH, 1.5, 1.5, 'F');
                          
                          doc.setFontSize(7);
                          doc.setTextColor(51, 65, 85);
                          doc.text(photo.description, px + (photoSize/2), descY + 3.5, { align: 'center', maxWidth: photoSize - 2 });
                          doc.setFontSize(10); // Reset
                          doc.setTextColor(38, 50, 56); // Reset
                      }

                      if (marks && marks[issue.id]?.includes('x')) {
                          doc.setDrawColor(220, 38, 38);
                          doc.setLineWidth(1);
                          doc.line(px, py, px + photoSize, py + photoSize);
                          doc.line(px + photoSize, py, px, py + photoSize);
                      }
                  } catch (e) {}
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

export const generatePDFWithMetadata = async (
    data: AppState, 
    companyLogo?: string, 
    marks?: Record<string, ('check' | 'x')[]>
): Promise<PDFGenerationResult> => {
    return createPDFDocument(data, companyLogo, marks);
};

export const generateSignOffPDF = async (
    project: ProjectDetails, 
    title: string, 
    template: SignOffTemplate, 
    companyLogo?: string, 
    signatureImage?: string
): Promise<string> => {
    const doc = new jsPDF();
    
    // Header Gradient
    drawVerticalGradient(doc, 0, 0, 210, 35, [226, 232, 240], [255, 255, 255]);
    drawVerticalGradient(doc, 0, 297 - 35, 210, 35, [255, 255, 255], [226, 232, 240]);
    doc.setFillColor(84, 110, 122); 
    doc.rect(0, 0, 210, 3, 'F');

    // Logo
    if (companyLogo) {
        try {
            const dims = await getImageDimensions(companyLogo);
            if (dims.width > 0) {
                const maxW = 35; 
                const maxH = 24; 
                const scale = Math.min(maxW / dims.width, maxH / dims.height);
                const w = dims.width * scale;
                const h = dims.height * scale;
                const format = getImageFormat(companyLogo);
                doc.addImage(companyLogo, format, 200 - w, 8, w, h);
            }
        } catch (e) { }
    }

    // Title Pill
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    const titleWidth = doc.getTextWidth(title);
    const pillW = titleWidth + 20;
    const pillX = (210 - pillW) / 2;
    const pillY = 18;

    doc.setFillColor(84, 110, 122); 
    doc.roundedRect(pillX, pillY, pillW, 10, 5, 5, 'F'); 

    doc.setTextColor(255, 255, 255);
    doc.text(title, 105, pillY + 6.5, { align: 'center' });

    // Project Info
    let currentY = drawProjectCard(doc, project, 35) + 10;

    // Sections
    if (template && template.sections) {
        for (const section of template.sections) {
             currentY = drawSectionCard(doc, currentY, section);
             currentY += 10;
        }
    }

    // Final Signatures
    drawSignaturesCard(doc, currentY, signatureImage);

    return URL.createObjectURL(doc.output('blob'));
};