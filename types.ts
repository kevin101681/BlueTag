

export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';
export type ColorTheme = string;

export interface ProjectField {
  id: string;
  label: string;
  value: string;
  icon: string; // 'User' | 'MapPin' | 'Phone' | 'Mail' | 'Calendar' | 'FileText' | 'Hash' etc.
}

export interface Point {
    x: number;
    y: number;
}

export interface SignOffStroke {
    points: Point[];
    type: 'ink' | 'erase';
}

export interface ProjectDetails {
  fields: ProjectField[];
  signOffImage?: string; // Base64 string of the signed document thumbnail
  reportPreviewImage?: string; // Base64 string of the marked-up report thumbnail
  signOffStrokes?: (Point[] | SignOffStroke)[]; // Array of strokes (legacy Point[] or new SignOffStroke)
  reportMarks?: Record<string, ('check' | 'x')[]>; // Persist report preview markups
}

export interface IssuePhoto {
    id?: string;
    url: string;
    description: string;
}

export interface Issue {
  id: string;
  description: string;
  severity: Severity;
  photos: IssuePhoto[]; // Array of objects with url and description
  timestamp: number;
}

export interface LocationGroup {
  id: string;
  name: string;
  issues: Issue[];
}

export interface Report {
  id: string;
  project: ProjectDetails;
  locations: LocationGroup[];
  lastModified: number;
}

export interface AppState {
  project: ProjectDetails;
  locations: LocationGroup[];
  cameraAccess?: boolean;
}

export interface SignOffSection {
  id: string;
  title: string;
  body: string;
  type: 'text' | 'initials' | 'signature';
}

export interface SignOffTemplate {
  id: string;
  name: string;
  sections: SignOffSection[];
}