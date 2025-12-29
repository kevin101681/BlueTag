/**
 * PDF Interceptor Service
 * 
 * This service intercepts PDF generation from BlueTag and saves PDFs
 * to Cascade Connect homeowner documents.
 */

import type { ProjectDetails, LocationGroup } from './types';

export interface PDFGenerationCallback {
  (pdfBlob: Blob, filename: string): Promise<void> | void;
}

let pdfCallback: PDFGenerationCallback | null = null;

/**
 * Register a callback to be called when PDFs are generated
 */
export function registerPDFCallback(callback: PDFGenerationCallback) {
  pdfCallback = callback;
}

/**
 * Unregister the PDF callback
 */
export function unregisterPDFCallback() {
  pdfCallback = null;
}

/**
 * Call the registered callback if available
 */
async function callPDFCallback(pdfBlob: Blob, filename: string) {
  if (pdfCallback) {
    try {
      await pdfCallback(pdfBlob, filename);
    } catch (error) {
      console.error('Error in PDF callback:', error);
    }
  }
}

/**
 * Wrapper for generatePDFWithMetadata that saves PDFs
 */
export async function generatePDFWithMetadataAndSave(
  originalGeneratePDF: any,
  data: { project: ProjectDetails; locations: LocationGroup[] },
  companyLogo?: string,
  marks?: Record<string, ('check' | 'x')[]>,
  homeownerName?: string
): Promise<any> {
  const result = await originalGeneratePDF(data, companyLogo, marks);
  
  // Generate PDF blob
  const pdfBlob = result.doc.output('blob');
  const safeName = (homeownerName || 'PunchList').replace(/[^a-z0-9]/gi, '_');
  const timestamp = Date.now();
  const filename = `${safeName}_PunchList_${timestamp}.pdf`;
  
  // Call the callback to save the PDF
  await callPDFCallback(pdfBlob, filename);
  
  return result;
}

/**
 * Wrapper for generateSignOffPDF that saves PDFs
 */
export async function generateSignOffPDFAndSave(
  originalGenerateSignOffPDF: any,
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
  const pdfUrl = await originalGenerateSignOffPDF(
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
  
  // Fetch the PDF blob from the URL
  try {
    const response = await fetch(pdfUrl);
    const pdfBlob = await response.blob();
    const safeName = (homeownerName || 'SignOff').replace(/[^a-z0-9]/gi, '_');
    const timestamp = Date.now();
    const filename = `${safeName}_SignOff_${timestamp}.pdf`;
    
    // Call the callback to save the PDF
    await callPDFCallback(pdfBlob, filename);
  } catch (error) {
    console.error('Error saving sign off PDF:', error);
  }
  
  return pdfUrl;
}
