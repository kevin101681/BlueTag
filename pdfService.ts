

import { jsPDF } from 'jspdf';
import { ProjectDetails, SignOffTemplate, SignOffSection, ProjectField, Point, SignOffStroke, LocationGroup } from './types';

// PDF Save Callback for Cascade Connect integration
let pdfSaveCallback: ((pdfBlob: Blob, filename: string) => Promise<void> | void) | null = null;

export function registerPDFSaveCallback(callback: (pdfBlob: Blob, filename: string) => Promise<void> | void) {
  pdfSaveCallback = callback;
}

export function unregisterPDFSaveCallback() {
  pdfSaveCallback = null;
}

async function callPDFSaveCallback(pdfBlob: Blob, filename: string) {
  if (pdfSaveCallback) {
    try {
      await pdfSaveCallback(pdfBlob, filename);
    } catch (error) {
      console.error('Error in PDF save callback:', error);
    }
  }
}

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

    let contentHeight = 6;
    if (lotStr) contentHeight += 6;
    if (detailFields.length > 0) contentHeight += 6; 
    if (detailFields.length > 0) contentHeight += (detailFields.length * lineHeight) - 2;

    const finalBoxHeight = contentHeight + (paddingY * 2);
    const pageWidth = 210;
    const boxX = (pageWidth - boxWidth) / 2;

    doc.setFillColor(236, 239, 241); 
    doc.setDrawColor(207, 216, 220); 
    doc.setLineWidth(0.1); 
    doc.roundedRect(boxX, startY, boxWidth, finalBoxHeight, 8, 8, 'FD'); 

    let currentY = startY + paddingY + 4; 
    const leftX = boxX + paddingX;

    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59); 
    doc.setFont("helvetica", "bold");
    doc.text(nameStr, leftX, currentY);

    if (lotStr) {
        currentY += 6;
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139); 
        doc.setFont("helvetica", "bold");
        doc.text(lotStr, leftX, currentY);
    }

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
    if (section.title === "Sign Off") {
        const headerH = TITLE_HEIGHT;
        const initialSpacing = 16;
        const text1H = 8; 
        const text2H = 12; 
        const sigRow1H = 20;
        const text3H = 8; 
        const boxH = 18;
        const text4H = 8; 
        const sigRow2H = 20;
        const gaps = 30;
        
        const cardHeight = headerH + initialSpacing + text1H + text2H + sigRow1H + text3H + boxH + text4H + sigRow2H + gaps + CARD_PADDING;

        if (startY + cardHeight > 280) {
            doc.addPage();
            drawVerticalGradient(doc, 0, 0, 210, 35, [226, 232, 240], [255, 255, 255]);
            startY = 20; 
        }

        drawCardHeader(doc, startY, section.title, cardHeight, 'pentool');

        let currentY = startY + TITLE_HEIGHT + initialSpacing;
        const leftX = CARD_X + CARD_PADDING;
        const width = CARD_WIDTH - (CARD_PADDING * 2);

        doc.setFontSize(10);
        doc.setTextColor(51, 65, 85);
        doc.setFont("helvetica", "normal");
        
        doc.text("The following is to be signed at the \"rewalk\" (typically the date of closing)", leftX, currentY);
        currentY += 8;

        doc.setFont("helvetica", "bold");
        const disclaimer = "MY SIGNATURE CERTIFIES THE ACCEPTABLE COMPLETION OF ALL ITEMS LISTED ON THE BUILDER’S NEW HOME COMPLETION LIST:";
        const splitDisclaimer = doc.splitTextToSize(disclaimer, width);
        doc.text(splitDisclaimer, leftX, currentY);
        currentY += (splitDisclaimer.length * 5) + 6;

        doc.setFont("helvetica", "normal");
        
        const sigBoxH = 16;
        const dateBoxH = 8;
        const textOffY = 11;
        const dateBoxY = 4;
        
        // Vertically center "Date" label to the 8mm date box (starts at y+4, ends y+12, mid=8)
        const dateTextY = 9.5; 
        
        doc.text("Homebuyer", leftX, currentY + textOffY);
        const sigBoxX = leftX + 22;
        const sigBoxW = 80;
        
        drawModernBox(doc, sigBoxX, currentY, sigBoxW, sigBoxH, 'signature');
        
        const dateLabelX = sigBoxX + sigBoxW + 5;
        doc.text("Date", dateLabelX, currentY + dateTextY);
        const dateBoxX = dateLabelX + 10;
        const dateBoxW = 30;
        drawModernBox(doc, dateBoxX, currentY + dateBoxY, dateBoxW, dateBoxH, 'initial');
        currentY += sigBoxH + 8;

        doc.text("Item numbers not complete on the date of acceptance/closing:", leftX, currentY);
        currentY += 6;

        drawModernBox(doc, leftX, currentY, width, 18, 'initial');
        currentY += 18 + 6;

        doc.text("All items on the builder's new home completion list have been completed.", leftX, currentY);
        currentY += 8;

        doc.text("Homebuyer", leftX, currentY + textOffY);
        drawModernBox(doc, sigBoxX, currentY, sigBoxW, sigBoxH, 'signature');
        doc.text("Date", dateLabelX, currentY + dateTextY);
        drawModernBox(doc, dateBoxX, currentY + dateBoxY, dateBoxW, dateBoxH, 'initial');

        return startY + cardHeight;
    }

    const isSignatureType = section.type === 'signature' || 
                           /acknowledg(e)?ment/i.test(section.title) ||
                           /sign\s?off/i.test(section.title) ||
                           /signature/i.test(section.title);

    const paragraphs = section.body.split('\n').filter(p => p.trim().length > 0);
    let lineCounter = 1;

    const contentItems = paragraphs.map(text => {
        let currentType = 'text'; 
        let currentText = text;
        
        if (section.type === 'initials') currentType = 'initials';
        
        if (currentText.trim().startsWith('[INITIAL]')) {
             currentType = 'initials';
             currentText = currentText.replace('[INITIAL]', '').trim();
        }

        let leftMargin = 0;
        if (currentType === 'initials') {
            leftMargin = INITIAL_BOX_LEFT_MARGIN;
        } else if (section.title === "Warranty Procedures") {
            leftMargin = 16; 
        }
        
        const availWidth = CARD_WIDTH - (CARD_PADDING * 2) - leftMargin - 4; 
        
        doc.setFontSize(11); 
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(currentText, availWidth);
        const textHeight = lines.length * 5.5; 
        
        let height = textHeight;
        if (currentType === 'initials') {
            height = Math.max(textHeight, INITIAL_BOX_SIZE + 2);
        } else if (section.title === "Warranty Procedures") {
             height = textHeight + 4; 
        }
        
        return { lines, height, type: currentType, textHeight };
    });

    const signatureBlockHeight = isSignatureType ? 36 : 0;
    const totalContentHeight = contentItems.reduce((acc, item) => acc + item.height + 4, 0) + signatureBlockHeight; 
    const cardHeight = TITLE_HEIGHT + totalContentHeight + CARD_PADDING;

    let icon = 'paper';
    const titleLower = section.title.toLowerCase();
    
    if (isSignatureType) icon = 'pentool';
    else if (section.type === 'initials') icon = 'check';
    else if (titleLower.includes('warranty')) icon = 'paper';
    else if (titleLower.includes('note')) icon = 'alert';

    if (startY + cardHeight > 280) {
        doc.addPage();
        drawVerticalGradient(doc, 0, 0, 210, 35, [226, 232, 240], [255, 255, 255]);
        startY = 20; 
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
            const textBgW = CARD_WIDTH - (CARD_PADDING * 2);
            doc.setFillColor(248, 250, 252); 
            doc.roundedRect(boxX, boxY, textBgW, item.height, 2, 2, 'F');

            const iconSize = 7;
            const centerY = boxY + (item.height / 2);
            const iconY = centerY - (iconSize / 2); 
            
            drawSimpleIcon(doc, 'number', boxX + 4, iconY, iconSize, lineCounter.toString(), [207, 216, 220], [51, 65, 85]);
            lineCounter++;
            leftMargin = 16;
        }

        doc.setFontSize(11); 
        doc.setTextColor(51, 65, 85);
        doc.setFont("helvetica", "normal");
        
        const textX = boxX + leftMargin + (item.type === 'initials' ? 4 : 0);
        
        if (section.title === "Warranty Procedures") {
            const startTextY = boxY + 7;
            const lineHeight = 5.5;
            
            if (Array.isArray(item.lines)) {
                item.lines.forEach((line, i) => {
                    doc.text(line, textX, startTextY + (i * lineHeight));
                });
            } else {
                doc.text(item.lines, textX, startTextY);
            }
        } else {
            const textY = currentY + 5;
            doc.text(item.lines, textX, textY);
        }
        
        currentY += item.height + 4; 
    });

    if (isSignatureType) {
         const leftX = CARD_X + CARD_PADDING;
         doc.setFontSize(11);
         doc.setTextColor(51, 65, 85);
         doc.setFont("helvetica", "normal");
         
         const sigBoxH = 16;
         const dateBoxH = 8;
         const textOffY = 11;
         const dateBoxY = 4;
         
         // Vertically center "Date" label to the 8mm date box (starts at y+4, ends y+12, mid=8)
         const dateTextY = 9.5;
         
         doc.text("Homebuyer", leftX, currentY + textOffY);
         
         const sigBoxX = leftX + 22;
         const sigBoxW = 80;
         drawModernBox(doc, sigBoxX, currentY, sigBoxW, sigBoxH, 'signature');

         const dateLabelX = sigBoxX + sigBoxW + 5;
         doc.text("Date", dateLabelX, currentY + dateTextY);

         const dateBoxX = dateLabelX + 10;
         const dateBoxW = 30;
         drawModernBox(doc, dateBoxX, currentY + dateBoxY, dateBoxW, dateBoxH, 'initial');
         
         const dateStr = new Date().toLocaleDateString();
         doc.setFontSize(9);
         doc.text(dateStr, dateBoxX + (dateBoxW/2), currentY + dateBoxY + 5.5, { align: 'center' });
    }

    return startY + cardHeight;
};

const drawStrokesOnPDF = (doc: jsPDF, strokes: (Point[] | SignOffStroke)[], containerWidth: number, pageHeight?: number, gapHeight?: number) => {
    const pdfW = 210;
    const scale = pdfW / containerWidth;
    const screenPageH = pageHeight || (containerWidth * (297 / 210));
    const screenGap = gapHeight !== undefined ? gapHeight : 16; 
    const pageTotalH = screenPageH + screenGap;
    const totalPages = doc.getNumberOfPages();

    strokes.forEach(stroke => {
        const points = Array.isArray(stroke) ? stroke : stroke.points;
        const type = Array.isArray(stroke) ? 'ink' : stroke.type;
        
        if (points.length < 2) return;

        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i+1];

            const pageIndex1 = Math.floor(p1.y / pageTotalH);
            const pageIndex2 = Math.floor(p2.y / pageTotalH); 
            
            if (pageIndex1 !== pageIndex2) continue;

            const relY1 = p1.y % pageTotalH;

            if (relY1 > screenPageH) continue;

            const targetPage = pageIndex1 + 1;
            if (targetPage > totalPages) continue;

            if (doc.getCurrentPageInfo().pageNumber !== targetPage) {
                 doc.setPage(targetPage);
            }
            
            doc.setLineCap('round');
            doc.setLineJoin('round');

            if (type === 'erase') {
                doc.setDrawColor(255, 255, 255);
                doc.setLineWidth(6); 
            } else {
                doc.setDrawColor(0, 0, 0);
                doc.setLineWidth(0.5); 
            }

            const x1 = p1.x * scale;
            const y1 = relY1 * scale;
            const x2 = p2.x * scale;
            const relY2 = p2.y % pageTotalH;
            const y2 = relY2 * scale;

            doc.line(x1, y1, x2, y2);
        }
    });
};

const drawSignatureImageOnPDF = async (doc: jsPDF, base64: string, containerWidth: number, screenPageHeight: number, screenGapHeight: number, contentX: number = 0, contentW: number = 0) => {
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
            
            // Horizontal Crop Calculation
            const sx = contentX * dpr;
            // Use provided content width for the slice, or default to full image width
            const sw = (contentW > 0) ? contentW * dpr : imgW;

            // Create a temp canvas to slice and crop the image
            const canvas = document.createElement('canvas');
            // Canvas should be sized to the sliced content (width of PDF page on screen)
            canvas.width = sw;
            canvas.height = srcPageH;
            const ctx = canvas.getContext('2d');
            
            if (!ctx) { resolve(); return; }

            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                
                // Calculate Source Y start for this page
                const sy = (i - 1) * srcTotalH;
                
                // Clear and draw slice
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                // Source: img, sx=sx (crop left), sy=sy, sw=sw (crop width), sh=srcPageH
                // Dest:   canvas, dx=0, dy=0, dw=sw, dh=srcPageH
                ctx.drawImage(img, sx, sy, sw, srcPageH, 0, 0, sw, srcPageH);
                
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
    signatureImage?: string,
    strokes?: (Point[] | SignOffStroke)[],
    containerWidth?: number,
    pageHeight?: number,
    gapHeight?: number,
    contentX?: number,
    contentW?: number
): Promise<string> => {
    let doc: jsPDF;
    try {
        doc = new jsPDF();
    } catch (e) {
        console.error("jsPDF init failed", e);
        throw new Error("Could not initialize PDF generator. Please refresh the page.");
    }

    drawVerticalGradient(doc, 0, 0, 210, 35, [226, 232, 240], [255, 255, 255]);
    drawVerticalGradient(doc, 0, 297 - 35, 210, 35, [255, 255, 255], [226, 232, 240]);

    doc.setFillColor(84, 110, 122); 
    doc.rect(0, 0, 210, 3, 'F');

    // Use the provided companyLogo or fallback to default path
    const logoToUse = companyLogo || '/images/logo.png';
    try {
        const dims = await getImageDimensions(logoToUse);
        if (dims.width > 0) {
            const maxW = 35; 
            const maxH = 24; 
            const scale = Math.min(maxW / dims.width, maxH / dims.height);
            const w = dims.width * scale;
            const h = dims.height * scale;
            const fmt = getImageFormat(logoToUse);
            doc.addImage(logoToUse, fmt, 200 - w, 8, w, h);
        }
    } catch (e) { 
        console.warn("Could not load logo", e);
    }

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

    let currentY = drawProjectCard(doc, project, 35);
    currentY += 10;

    if (template && template.sections) {
        for (const section of template.sections) {
             currentY = drawSectionCard(doc, currentY, section);
             currentY += 4;
        }
    }

    // Prefer image overlay (handling opacity/erasure correctly) over vector strokes
    if (signatureImage && containerWidth && pageHeight) {
        await drawSignatureImageOnPDF(doc, signatureImage, containerWidth, pageHeight, gapHeight || 16, contentX, contentW);
    } else if (strokes && containerWidth && strokes.length > 0) {
        drawStrokesOnPDF(doc, strokes, containerWidth, pageHeight, gapHeight);
    }

    const pdfUrl = doc.output('bloburl').toString();
    
    // Save PDF if callback is registered
    try {
      const response = await fetch(pdfUrl);
      const pdfBlob = await response.blob();
      const projectName = project.fields?.[0]?.value || 'SignOff';
      const safeName = projectName.replace(/[^a-z0-9]/gi, '_');
      const timestamp = Date.now();
      const filename = `${safeName}_SignOff_${timestamp}.pdf`;
      await callPDFSaveCallback(pdfBlob, filename);
    } catch (error) {
      console.error('Error saving sign off PDF:', error);
    }

    return pdfUrl;
};

export const generatePDFWithMetadata = async (
    data: { project: ProjectDetails; locations: LocationGroup[] }, 
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

  // Use the provided companyLogo or fallback to default path
  const logoToUse = companyLogo || '/images/logo.png';
  try {
      const dims = await getImageDimensions(logoToUse);
      if (dims.width > 0) {
          const maxW = 35; 
          const maxH = 24; 
          const scale = Math.min(maxW / dims.width, maxH / dims.height);
          const w = dims.width * scale;
          const h = dims.height * scale;
          const fmt = getImageFormat(logoToUse);
          doc.addImage(logoToUse, fmt, 200 - w, 8, w, h);
      }
  } catch (e) { 
      console.warn("Could not load logo", e);
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
        // Check if we need a new page before starting the item
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

        // Draw the item description immediately after header
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

        // Start photos immediately after description, allowing page breaks
        let nextY = currentY + Math.max(textHeight, 8) + 4;

        if (issue.photos.length > 0) {
             let px = 28;
             let py = nextY;
             
             // Check if first row of photos fits on current page
             if (py + photoRowHeight > 280) {
                 doc.addPage();
                 drawVerticalGradient(doc, 0, 0, 210, 35, [226, 232, 240], [255, 255, 255]);
                 drawVerticalGradient(doc, 0, 297 - 35, 210, 35, [255, 255, 255], [226, 232, 240]);
                 py = 20;
             }
             
             for (let i = 0; i < issue.photos.length; i++) {
                  // Check if we need a new row (every 4 photos)
                  if (i > 0 && i % 4 === 0) {
                      px = 28;
                      py += photoRowHeight + photoGap;
                      
                      // Check if this new row would exceed page height, add new page if needed
                      if (py + photoRowHeight > 280) {
                          doc.addPage();
                          drawVerticalGradient(doc, 0, 0, 210, 35, [226, 232, 240], [255, 255, 255]);
                          drawVerticalGradient(doc, 0, 297 - 35, 210, 35, [255, 255, 255], [226, 232, 240]);
                          py = 20;
                          px = 28;
                      }
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

  // Save PDF if callback is registered
  try {
    const pdfBlob = doc.output('blob');
    const projectName = data.project.fields?.[0]?.value || 'PunchList';
    const safeName = projectName.replace(/[^a-z0-9]/gi, '_');
    const timestamp = Date.now();
    const filename = `${safeName}_PunchList_${timestamp}.pdf`;
    await callPDFSaveCallback(pdfBlob, filename);
  } catch (error) {
    console.error('Error saving PDF:', error);
  }

  return { doc, imageMap, checkboxMap };
};
