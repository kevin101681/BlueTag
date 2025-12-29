

import { LocationGroup, SignOffTemplate, ProjectDetails } from "./types";

// Safe UUID generator that works in non-secure contexts (like mobile IP addresses)
export const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments where crypto.randomUUID is unavailable
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

export const PREDEFINED_LOCATIONS: string[] = [
    "General Interior",
    "Master Bathroom",
    "Master Bedroom",
    "Upper Floor Hallway",
    "Middle Floor Hallway",
    "Laundry Room",
    "Bonus Room",
    "Loft",
    "Upper Floor Bathroom",
    "Middle Floor Bathroom",
    "Roof-top Deck",
    "Bedroom 1",
    "Bedroom 2",
    "Bedroom 3",
    "Bedroom 4",
    "Bedroom 5",
    "Powder Room",
    "Entry",
    "Stairway",
    "Lower Floor Hallway",
    "Dining Room",
    "Nook",
    "Kitchen",
    "Living Room",
    "Family Room",
    "Lower Floor Bedroom",
    "Den/Office",
    "Garage",
    "Basement",
    "Basement Bathroom",
    "Basement Hallway",
    "Basement Bedroom",
    "Exterior",
    "Crawl Space",
    "Attic",
    "Hallway",
    "Hallway Closets",
    "Main Bathroom",
    "Bathroom 2",
    "Notes (Pending Builder Approval)",
    "Rewalk Notes"
];

export const INITIAL_PROJECT_STATE: ProjectDetails = {
    fields: [
        { id: '1', label: 'Name(s)', value: '', icon: 'User' },
        { id: '2', label: 'Project Lot/Unit Number', value: '', icon: 'Hash' },
        { id: '3', label: 'Address', value: '', icon: 'MapPin' },
        { id: '4', label: 'Phone Number', value: '', icon: 'Phone' },
        { id: '5', label: 'Email Address', value: '', icon: 'Mail' }
    ]
};

export const EMPTY_LOCATIONS: LocationGroup[] = PREDEFINED_LOCATIONS.map(name => ({
    id: generateUUID(),
    name,
    issues: []
}));

export const DEFAULT_SIGN_OFF_TEMPLATES: SignOffTemplate[] = [
    {
        id: 'standard',
        name: 'New Home Orientation Sign Off',
        sections: [
            {
                id: 'warranty_proc',
                title: "Warranty Procedures",
                body: "Homeowners are responsible for initiating their requests for warranty repairs and scheduling warranty evaluation appointments. Cascade Builder Services does not send reminders.\nUrgent requests are accepted on an as-needed basis. Non-urgent requests are accepted and reviewed at 60 (if applicable) days and/or 11 months after closing.\nHomeowner will submit appliance warranty requests directly to the manufacturer. Cascade Builder Services does not manage claims for appliances.\nThe homeowner manual and warranty documents are available to download from your online account.\nThe 24-hour emergency procedures were explained.\nThe “Notes” section of the completion list are requests/contractual only and may or may not be approved by the builder.\nIf applicable, the paint touch up kit was present at the time of the walk through.\nI have verified with my CBS representative that my contact information is correct.\n[INITIAL] I understand and acknowledge the items listed above.",
                type: 'text'
            },
            {
                id: 'ack',
                title: "Acknowledgements",
                body: "Buyer(s) agree, other than noted on the Builder’s New Home Completion List, the home has been found in satisfactory condition and understand damage to any surfaces, after closing, are excluded from the builder’s limited warranty.\nBuyer(s) acknowledge that they have inspected the entire home and accept the home, subject to the items noted on the builder's new home completion list.",
                type: 'signature'
            },
            {
                id: 'sign_off',
                title: "Sign Off",
                body: "", // Custom layout handled in code
                type: 'signature'
            }
        ]
    }
];

// Reference images stored in public/images/manual/
export const HOMEOWNER_MANUAL_IMAGES: string[] = [
    "/images/manual/page1.png",
    "/images/manual/page2.png",
    "/images/manual/page3.png",
    "/images/manual/page4.png"
];

// ============================================
// PERFORMANCE & TIMING CONSTANTS
// ============================================

// Sync and polling intervals (milliseconds)
export const SYNC_INTERVAL_MS = 15000; // Cloud sync every 15 seconds
export const QUEUE_CHECK_INTERVAL_MS = 2000; // Check sync queue every 2 seconds
export const AUTO_SYNC_DELAY_MS = 500; // Delay before auto-sync on reconnect
export const SYNC_RETRY_DELAY_MS = 5000; // Retry failed sync operations after 5 seconds

// UI timing
export const DEBOUNCE_DELAY_MS = 300; // General debounce delay
export const DOUBLE_TAP_THRESHOLD_MS = 300; // Double tap detection window
export const ANIMATION_DURATION_MS = 300; // Standard animation duration
export const DELETE_ANIMATION_DELAY_MS = 300; // Delay before deleting items

// Splash screen timing
export const SPLASH_FADE_START_MS = 2500; // When splash starts fading
export const SPLASH_HIDE_MS = 3200; // When splash is removed from DOM

// Creation throttling
export const MIN_CREATION_INTERVAL_MS = 1000; // Minimum time between report creations

// ============================================
// IMAGE & MEDIA CONSTANTS
// ============================================

// Image compression settings
export const MAX_IMAGE_SIZE_PX = 1200; // Maximum dimension for images
export const IMAGE_QUALITY = 0.7; // JPEG quality (0-1)
export const IMAGE_EDITOR_MAX_SIZE_PX = 1200; // Max size for image editor
export const IMAGE_EDITOR_QUALITY = 0.85; // JPEG quality for edited images

// Image editor history
export const MAX_EDITOR_HISTORY = 15; // Limit undo history to prevent memory issues

// PDF rendering
export const PDF_RENDER_SCALE = 1.5; // Scale factor for PDF rendering

// ============================================
// STORAGE & CACHE CONSTANTS
// ============================================

// Storage quota warnings
export const STORAGE_WARNING_THRESHOLD = 90; // Warn at 90% capacity
export const STORAGE_FALLBACK_ESTIMATE_GB = 10; // Conservative storage estimate (GB)

// Data retention
export const DEFAULT_RETENTION_DAYS = 30; // Default retention for old reports
export const AGGRESSIVE_RETENTION_DAYS = 7; // Aggressive cleanup retention

// Sync queue
export const MAX_SYNC_RETRIES = 3; // Maximum retry attempts for failed syncs
export const SYNC_OPERATION_DELAY_MS = 100; // Delay between sync operations

// ============================================
// DRAWING & ANNOTATION CONSTANTS
// ============================================

// Drawing tool line widths (scale multiplier)
export const PEN_LINE_WIDTH = 6; // Base pen width
export const ERASER_LINE_WIDTH = 40; // Eraser width
export const ARROW_HEAD_LENGTH = 25; // Arrow head length multiplier

// Text annotation
export const TEXT_FONT_SIZE = 40; // Base font size multiplier
export const TEXT_OUTLINE_WIDTH = 6; // Text outline width multiplier

// Zoom limits
export const MIN_ZOOM = 1; // Minimum zoom level
export const MAX_ZOOM = 5; // Maximum zoom level

// ============================================
// PDF GENERATION CONSTANTS
// ============================================

export const PDF_WIDTH_MM = 210; // A4 width in mm
export const PDF_HEIGHT_MM = 297; // A4 height in mm
