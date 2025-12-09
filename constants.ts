

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
