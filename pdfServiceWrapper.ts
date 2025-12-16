/**
 * PDF Service Wrapper
 * 
 * This wraps BlueTag's PDF service to intercept PDF generation
 * and save PDFs to Cascade Connect homeowner documents.
 */

import type { ProjectDetails, LocationGroup } from './types';

export interface PDFSaveCallback {
  (pdfBlob: Blob, filename: string): Promise<void> | void;
}

let pdfSaveCallback: PDFSaveCallback | null = null;

/**
 * Register callback for saving PDFs
 */
export function registerPDFSaveCallback(callback: PDFSaveCallback) {
  pdfSaveCallback = callback;
}

/**
 * Unregister callback
 */
export function unregisterPDFSaveCallback() {
  pdfSaveCallback = null;
}

/**
 * Call the save callback if registered
 */
async function savePDF(pdfBlob: Blob, filename: string) {
  if (pdfSaveCallback) {
    try {
      await pdfSaveCallback(pdfBlob, filename);
    } catch (error) {
      console.error('Error saving PDF:', error);
    }
  }
}

/**
 * Wrap generatePDFWithMetadata to save PDFs
 */
export async function wrapGeneratePDFWithMetadata(
  originalFn: any,
  data: { project: ProjectDetails; locations: LocationGroup[] },
  companyLogo?: string,
  marks?: Record<string, ('check' | 'x')[]>,
  homeownerName?: string
): Promise<any> {
  // Call original function
  const result = await originalFn(data, companyLogo, marks);
  
  // Generate PDF blob and save
  try {
    const pdfBlob = result.doc.output('blob');
    const safeName = (homeownerName || 'PunchList').replace(/[^a-z0-9]/gi, '_');
    const timestamp = Date.now();
    const filename = `${safeName}_PunchList_${timestamp}.pdf`;
    
    await savePDF(pdfBlob, filename);
  } catch (error) {
    console.error('Error generating PDF blob:', error);
  }
  
  return result;
}

/**
 * Wrap generateSignOffPDF to save PDFs
 */
export async function wrapGenerateSignOffPDF(
  originalFn: any,
  project: ProjectDetails,
  title: string,
  template: any,
  companyLogo?: string,
  signatureImage?: string,
  strokes?: any[],
  containerWidth?: number,
  pageHeight?: number,
  gapHeight?: number,
  contentX?: number,
  contentW?: number,
  homeownerName?: string
): Promise<string> {
  // Call original function
  const pdfUrl = await originalFn(
    project,
    title,
    template,
    companyLogo,
    signatureImage,
    strokes,
    containerWidth,
    pageHeight,
    gapHeight,
    contentX,
    contentW
  );
  
  // Fetch PDF blob and save
  try {
    const response = await fetch(pdfUrl);
    const pdfBlob = await response.blob();
    const safeName = (homeownerName || 'SignOff').replace(/[^a-z0-9]/gi, '_');
    const timestamp = Date.now();
    const filename = `${safeName}_SignOff_${timestamp}.pdf`;
    
    await savePDF(pdfBlob, filename);
  } catch (error) {
    console.error('Error saving sign off PDF:', error);
  }
  
  return pdfUrl;
}
