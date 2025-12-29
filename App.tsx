import React, { useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { INITIAL_PROJECT_STATE, EMPTY_LOCATIONS, generateUUID, DEFAULT_SIGN_OFF_TEMPLATES } from './constants';
import { ProjectDetails, LocationGroup, Issue, Report, ColorTheme, SignOffTemplate, ProjectField } from './types';
import type { NetlifyUser, NetlifyIdentityWidget } from './types/netlify';
import { LocationDetail, DeleteConfirmationModal } from './components/LocationDetail';
import { ReportList, ThemeOption } from './components/ReportList';
import { CloudService } from './services/cloudService';
import { saveWithCleanup, getStorageInfo } from './services/storageService';
import { IndexedDBService, migrateFromLocalStorage } from './services/indexedDBService';
import { syncQueueService } from './services/syncQueueService';
import { AlertCircle, WifiOff, Wifi } from 'lucide-react';

// v1.1.14 - Fixed lazy instantiation
console.log('[BlueTag] App module loaded v1.1.14');

// Global declaration for Netlify Identity
declare global {
  interface Window {
    netlifyIdentity?: NetlifyIdentityWidget;
  }
}

// Logo stored in public/images/logo.png
const CompanyLogoAsset = "/images/logo.png";
const PartnerLogoAsset = "";

const STORAGE_KEY = 'punchlist_reports';
const DELETED_REPORTS_KEY = 'punchlist_deleted_ids';
const THEME_KEY = 'cbs_punch_theme';
const COLOR_THEME_KEY = 'cbs_color_theme';
const LOGO_KEY = 'cbs_company_logo';
const PARTNER_LOGO_KEY = 'cbs_partner_logo';
const TEMPLATES_KEY = 'cbs_sign_off_templates';

const hexToRgb = (hex: string) => {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function(m, r, g, b) {
        return r + r + g + g + b + b;
    });

    const result = /^#?([a-f\d]{2})([a-f\d])([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

const migrateProjectData = (p: any): ProjectDetails => {
    if (p.fields && Array.isArray(p.fields)) return p as ProjectDetails;
    
    const newFields: ProjectField[] = [
        { id: generateUUID(), label: 'Buyer Name(s)', value: p.clientName || '', icon: 'User' },
        { id: generateUUID(), label: 'Lot/Unit Number', value: p.projectLotUnit || '', icon: 'Hash' },
        { id: generateUUID(), label: 'Address', value: p.projectAddress || '', icon: 'MapPin' },
        { id: generateUUID(), label: 'Phone Number', value: p.clientPhone || '', icon: 'Phone' },
        { id: generateUUID(), label: 'Email Address', value: p.clientEmail || '', icon: 'Mail' }
    ];

    return {
        fields: newFields,
        signOffImage: p.signOffImage,
        reportPreviewImage: p.reportPreviewImage
    };
};

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

// Error Boundary to catch runtime crashes and prevent white screen
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 p-6 text-center">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl max-w-md w-full">
                <h2 className="text-2xl font-bold text-red-500 mb-4">Something went wrong</h2>
                <p className="text-slate-600 dark:text-slate-300 mb-4">The application encountered an unexpected error.</p>
                <div className="bg-slate-100 dark:bg-slate-950 p-4 rounded-lg text-left overflow-auto max-h-40 mb-6">
                    <code className="text-xs text-slate-500 font-mono">
                        {this.state.error instanceof Error 
                            ? this.state.error.message + '\n' + (this.state.error.stack || '')
                            : JSON.stringify(this.state.error)}
                    </code>
                </div>
                <button 
                    onClick={() => window.location.reload()}
                    className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors"
                >
                    Reload Application
                </button>
            </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Component to show brief online sync indicator
const OnlineSyncIndicator = ({ isOnline, queuedOperations }: { isOnline: boolean; queuedOperations: number }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isOnline && queuedOperations > 0) {
      setShow(true);
      const timer = setTimeout(() => setShow(false), 3000); // Hide after 3 seconds
      return () => clearTimeout(timer);
    } else {
      setShow(false);
    }
  }, [isOnline, queuedOperations]);

  if (!show) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-green-500 dark:bg-green-600 text-white px-4 py-2 flex items-center justify-center gap-2 shadow-lg animate-fade-in">
      <Wifi size={18} />
      <span className="text-sm font-bold">Connected - Syncing {queuedOperations} changes...</span>
    </div>
  );
};

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [isSplashFading, setIsSplashFading] = useState(false);
  const [currentUser, setCurrentUser] = useState<NetlifyUser | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queuedOperations, setQueuedOperations] = useState(0);
  
  // Reports State
  const [savedReports, setSavedReports] = useState<Report[]>([]);
  // Tombstone state to track deletions across devices
  const [deletedReportIds, setDeletedReportIds] = useState<string[]>([]);
  
  // Ref to track savedReports for async sync operations without stale closures
  const savedReportsRef = useRef<Report[]>(savedReports);
  const deletedReportIdsRef = useRef<string[]>(deletedReportIds);
  
  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  // Initialize syncQueueService with CloudService methods on mount
  useEffect(() => {
    syncQueueService.setCloudService({
      saveReport: CloudService.saveReport.bind(CloudService),
      deleteReport: CloudService.deleteReport.bind(CloudService)
    });
  }, []);

  useEffect(() => {
    // Start fading out after 2.5s
    const fadeTimer = setTimeout(() => {
        setIsSplashFading(true);
    }, 2500);

    // Completely remove splash from DOM after fade completes (3.2s)
    const hideTimer = setTimeout(() => {
        setShowSplash(false);
    }, 3200); 

    return () => {
        clearTimeout(fadeTimer);
        clearTimeout(hideTimer);
    };
  }, []);

  // Keep ref synchronized with state
  useEffect(() => {
    savedReportsRef.current = savedReports;
  }, [savedReports]);

  useEffect(() => {
    deletedReportIdsRef.current = deletedReportIds;
  }, [deletedReportIds]);

  // Online/Offline state management
  useEffect(() => {
    const unsubscribe = syncQueueService.subscribe((online) => {
      setIsOnline(online);
      if (online && currentUser) {
        // Auto-sync when coming back online
        setTimeout(() => {
          refreshReports(true);
          syncQueueService.processQueue();
        }, 500);
      }
    });

    // Initial state
    setIsOnline(syncQueueService.isOnline());
    setQueuedOperations(syncQueueService.getQueueLength());

    // Poll queue length periodically
    const queueCheckInterval = setInterval(() => {
      setQueuedOperations(syncQueueService.getQueueLength());
    }, 2000);

    return () => {
      unsubscribe();
      clearInterval(queueCheckInterval);
    };
  }, [currentUser, refreshReports]);

  // Netlify Identity Effect
  useEffect(() => {
    if (typeof window !== 'undefined' && window.netlifyIdentity) {
      const user = window.netlifyIdentity.currentUser();
      if (user) {
        setCurrentUser(user);
      }

      window.netlifyIdentity.on('init', (user?: NetlifyUser) => {
         if (user) setCurrentUser(user);
      });

      window.netlifyIdentity.on('login', (user?: NetlifyUser) => {
        if (user) setCurrentUser(user);
        window.netlifyIdentity?.close();
      });

      window.netlifyIdentity.on('logout', () => {
        setCurrentUser(null);
        window.location.reload(); 
      });
    }
  }, []);

  const handleLogin = () => {
      if (typeof window !== 'undefined' && window.netlifyIdentity) {
          window.netlifyIdentity.open();
      }
  };

  const handleLogout = () => {
      if (typeof window !== 'undefined' && window.netlifyIdentity) {
          window.netlifyIdentity.logout();
      }
  };

  const [isDataLoaded, setIsDataLoaded] = useState(false); 

  // --- STORAGE LOGIC ---
  
  // 1. Initial Load (IndexedDB with localStorage fallback and migration)
  useEffect(() => {
    if (typeof window !== 'undefined' && !isDataLoaded) {
        const loadData = async () => {
            try {
                // First, migrate from localStorage to IndexedDB if needed
                await migrateFromLocalStorage();
                
                // Load from IndexedDB if available
                if (IndexedDBService.isAvailable()) {
                    const reports = await IndexedDBService.loadReports();
                    const deleted = await IndexedDBService.loadDeletedIds();
                    
                    if (reports.length > 0) {
                        const migrated = reports.map((r: any) => ({
                            ...r,
                            project: migrateProjectData(r.project)
                        }));
                        setSavedReports(migrated);
                    }
                    
                    if (deleted.length > 0) {
                        setDeletedReportIds(deleted);
                    }
                } else {
                    // Fallback to localStorage
                    const saved = localStorage.getItem(STORAGE_KEY);
                    if (saved) {
                        const parsed = JSON.parse(saved);
                        const migrated = parsed.map((r: any) => ({
                            ...r,
                            project: migrateProjectData(r.project)
                        }));
                        setSavedReports(migrated);
                    }
                    const deleted = localStorage.getItem(DELETED_REPORTS_KEY);
                    if (deleted) {
                        setDeletedReportIds(JSON.parse(deleted));
                    }
                }
            } catch (e) {
                console.error("Failed to load local reports", e);
            }
            setIsDataLoaded(true);
        };
        
        loadData();
    }
  }, []);

  // Persistence Effects
  useEffect(() => {
      if (isDataLoaded) {
          saveWithCleanup(STORAGE_KEY, savedReports, savedReports).then(success => {
              if (!success) {
                  console.error("Storage quota exceeded and cleanup failed");
                  // Only show error if it's a persistent issue
                  setSyncError(prev => {
                      if (!prev || !prev.includes("Storage")) {
                          return "Storage full. Please clear old reports or cache in Settings.";
                      }
                      return prev;
                  });
              } else {
                  // Clear any previous storage errors if save succeeds
                  setSyncError(prev => {
                      if (prev && prev.includes("Storage")) {
                          return null;
                      }
                      return prev;
                  });
              }
          }).catch(err => {
              console.error("Error saving reports", err);
              const errorMessage = err?.message || "Error saving reports";
              if (errorMessage.includes('quota') || errorMessage.includes('QuotaExceeded')) {
                  setSyncError("Storage quota exceeded. Please delete old reports or clear cache in Settings.");
              } else {
                  setSyncError(`Error saving reports: ${errorMessage}`);
              }
          });
      }
  }, [savedReports, isDataLoaded]);

  useEffect(() => {
      if (isDataLoaded) {
          if (IndexedDBService.isAvailable()) {
              IndexedDBService.saveDeletedIds(deletedReportIds).catch(err => {
                  console.error("Error saving deleted IDs", err);
              });
          } else {
              localStorage.setItem(DELETED_REPORTS_KEY, JSON.stringify(deletedReportIds));
          }
      }
  }, [deletedReportIds, isDataLoaded]);

  const refreshReports = useCallback(async (silent = false) => {
      if (!currentUser) return;
      if (!silent) {
          setIsSyncing(true);
          setSyncError(null);
      }
      
      try {
          // fetchReports returns null on error (e.g. connection failure), [] on success-but-empty
          const cloudReports = await CloudService.fetchReports();
          
          if (cloudReports === null) {
              if (!silent) setSyncError("Could not connect to sync server.");
              return; 
          }
          
          const migratedCloud = cloudReports.map((r: any) => ({
              ...r,
              project: migrateProjectData(r.project)
          }));
          
          const localReports = savedReportsRef.current;
          const deletedIds = deletedReportIdsRef.current;
          
          const cloudMap = new Map(migratedCloud.map(r => [r.id, r]));
          
          // Base merge on cloud reports that haven't been deleted locally
          // If a cloud report is in our deleted list, we ignore it AND try to delete it from cloud again
          const validCloudReports = migratedCloud.filter(r => !deletedIds.includes(r.id));
          
          // Re-trigger delete for zombies
          const zombies = migratedCloud.filter(r => deletedIds.includes(r.id));
          if (zombies.length > 0) {
              // Fire and forget delete
              Promise.all(zombies.map(z => CloudService.deleteReport(z.id))).catch(console.error);
          }

          const merged = [...validCloudReports];
          const reportsToPush: Report[] = [];

          localReports.forEach(localR => {
               const cloudR = cloudMap.get(localR.id);
               
               if (!cloudR) {
                   // Exists Locally but NOT on Cloud
                   // Assume it's a new report created offline -> Keep & Push
                   merged.push(localR);
                   reportsToPush.push(localR);
               } else {
                   // Exists in Both
                   if (deletedIds.includes(localR.id)) {
                       // Should be deleted, skip
                   } else if (localR.lastModified > cloudR.lastModified) {
                       // Local is newer -> Keep Local & Push update to cloud
                       // Replace the cloud version in merged array
                       const idx = merged.findIndex(m => m.id === localR.id);
                       if (idx !== -1) merged[idx] = localR;
                       else merged.push(localR); // Should exist, but safety check
                       reportsToPush.push(localR);
                   }
                   // Else: Cloud is newer -> Keep Cloud (already in merged)
               }
          });

          // Bi-directional Sync: Push local changes
          if (reportsToPush.length > 0) {
               await Promise.all(reportsToPush.map(r => CloudService.saveReport(r)));
          }
          
          const finalSorted = merged.sort((a, b) => b.lastModified - a.lastModified);
          
          // Update local state
          setSavedReports(finalSorted);
          
      } catch (err) {
          console.error("Sync Error", err);
          if (!silent) setSyncError("Sync failed unexpectedly.");
      } finally {
          if (!silent) setIsSyncing(false);
      }
  }, [currentUser]);

  // 2. Cloud Sync Polling
  useEffect(() => {
    if (currentUser) {
        refreshReports();
        const interval = setInterval(() => {
            refreshReports(true);
        }, 15000); 
        return () => clearInterval(interval);
    }
  }, [currentUser, refreshReports]);

  // 3. Save Changes
  const saveToStorage = (reports: Report[]) => {
      setSavedReports(reports);
  };

  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  const [project, setProject] = useState<ProjectDetails>(INITIAL_PROJECT_STATE);
  const [locations, setLocations] = useState<LocationGroup[]>(EMPTY_LOCATIONS);
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);
  
  const [scrollToLocations, setScrollToLocations] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<string | null>(null);
  const [deleteModalRect, setDeleteModalRect] = useState<DOMRect | null>(null);
  
  const activeLocationIdRef = useRef<string | null>(null);
  
  const lastCreationRef = useRef(0);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleteExiting, setIsDeleteExiting] = useState(false);

  const [theme, setTheme] = useState<ThemeOption>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'system') return saved as ThemeOption;
      return 'dark'; 
    }
    return 'dark';
  });

  const [colorTheme, setColorTheme] = useState<ColorTheme>(() => {
      if (typeof window !== 'undefined') {
          const saved = localStorage.getItem(COLOR_THEME_KEY);
          if (saved) return saved;
      }
      return '#60a5fa'; 
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(THEME_KEY);
        if (saved === 'dark') return true;
        if (saved === 'light') return false;
        if (!saved) return true;
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  const [companyLogo, setCompanyLogo] = useState<string>(() => {
      const saved = localStorage.getItem(LOGO_KEY);
      return saved || CompanyLogoAsset;
  });

  const [partnerLogo, setPartnerLogo] = useState<string>(() => {
      const saved = localStorage.getItem(PARTNER_LOGO_KEY);
      return saved || PartnerLogoAsset;
  });

  const [signOffTemplates, setSignOffTemplates] = useState<SignOffTemplate[]>(() => {
      if (typeof window !== 'undefined') {
          try {
              const saved = localStorage.getItem(TEMPLATES_KEY);
              if (saved) {
                  const parsed = JSON.parse(saved);
                  if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].sections) {
                      return parsed;
                  }
              }
              return DEFAULT_SIGN_OFF_TEMPLATES;
          } catch (e) {
              return DEFAULT_SIGN_OFF_TEMPLATES;
          }
      }
      return DEFAULT_SIGN_OFF_TEMPLATES;
  });

  const handleUpdateTemplates = (newTemplates: SignOffTemplate[]) => {
      setSignOffTemplates(newTemplates);
      localStorage.setItem(TEMPLATES_KEY, JSON.stringify(newTemplates));
  };

  useEffect(() => {
      activeLocationIdRef.current = activeLocationId;
  }, [activeLocationId]);

  useEffect(() => {
      if (window.history.state) {
          window.history.replaceState(null, '', '');
      }

      const handlePopState = (event: PopStateEvent) => {
          const state = event.state;

          if (activeLocationIdRef.current && (!state || !state.locationId)) {
              setScrollToLocations(true);
          } else {
              setScrollToLocations(false);
          }

          if (!state) {
              setActiveReportId(null);
              setActiveLocationId(null);
          } else {
              if (state.reportId) {
                   setActiveReportId(state.reportId);
              } else {
                   setActiveReportId(null);
              }
              setActiveLocationId(state.locationId || null);
          }
      };

      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  
  useEffect(() => {
      if (activeReportId && savedReports.length > 0) {
          const report = savedReports.find(r => r.id === activeReportId);
          if (report) {
               setProject(report.project);
               setLocations(report.locations);
          }
      }
  }, [activeReportId, savedReports]);

  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone || document.referrer.includes('android-app://');
    setIsStandalone(isInStandaloneMode);

    if ((window as any).deferredPrompt) {
      setInstallPrompt((window as any).deferredPrompt);
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
      (window as any).deferredPrompt = e;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    setInstallPrompt(null);
    (window as any).deferredPrompt = null;
  };

  useEffect(() => {
    const root = window.document.documentElement;
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    
    const applyTheme = (dark: boolean) => {
      setIsDarkMode(dark);
      if (dark) {
        root.classList.add('dark');
        metaThemeColor?.setAttribute('content', '#020617');
      } else {
        root.classList.remove('dark');
        metaThemeColor?.setAttribute('content', '#fdfcff');
      }
    };

    if (theme === 'system') {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(systemDark);
      
      const listener = (e: MediaQueryListEvent) => applyTheme(e.matches);
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', listener);
      return () => window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', listener);
    } else {
      applyTheme(theme === 'dark');
    }
    
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
      const root = document.documentElement;
      const rgb = hexToRgb(colorTheme);
      
      if (rgb) {
          root.style.setProperty('--color-primary', `${rgb.r} ${rgb.g} ${rgb.b}`);
          const mix = (c1: number, c2: number, w: number) => Math.round(c1 * (1 - w) + c2 * w);
          const cr = mix(rgb.r, 255, 0.9);
          const cg = mix(rgb.g, 255, 0.9);
          const cb = mix(rgb.b, 255, 0.9);
          root.style.setProperty('--color-primary-container', `${cr} ${cg} ${cb}`);
      }
      
      localStorage.setItem(COLOR_THEME_KEY, colorTheme);
  }, [colorTheme]);

  useEffect(() => {
      localStorage.setItem(LOGO_KEY, companyLogo);
  }, [companyLogo]);

  useEffect(() => {
      localStorage.setItem(PARTNER_LOGO_KEY, partnerLogo);
  }, [partnerLogo]);

  // Handlers for List View
  const handleCreateNew = () => {
    const now = Date.now();
    if (now - lastCreationRef.current < 1000) return; 
    lastCreationRef.current = now;

    setIsCreating(true);

    const newProject = INITIAL_PROJECT_STATE;
    const newLocations = EMPTY_LOCATIONS.map(l => ({ ...l, id: generateUUID() }));
    const newReport: Report = {
        id: generateUUID(),
        project: newProject,
        locations: newLocations,
        lastModified: Date.now()
    };
    
    setProject(newProject);
    setLocations(newLocations);
    
    const newReportList = [newReport, ...savedReports];
    saveToStorage(newReportList);
    
    if (currentUser) {
        CloudService.saveReport(newReport);
    }

    setActiveReportId(newReport.id);
    
    setTimeout(() => {
        setIsCreating(false);
    }, 800);
  };

  const handleSelectReport = (id: string) => {
    const r = savedReports.find(rep => rep.id === id);
    if (r) {
        setActiveReportId(id);
    }
  };

  const handleDeleteReport = (id: string, rect?: DOMRect) => {
      setReportToDelete(id);
      setDeleteModalRect(rect || null);
  };

  const confirmDeleteReport = () => {
      if (reportToDelete) {
          setIsDeleteExiting(true);
          const idToDelete = reportToDelete;
          
          setTimeout(() => {
              // 1. Remove from local state
              const newList = savedReports.filter(r => r.id !== idToDelete);
              saveToStorage(newList);
              
              // 2. Add to deleted IDs tracker (for sync)
              setDeletedReportIds(prev => [...prev, idToDelete]);

              // 3. Attempt cloud delete
              if (currentUser) {
                  CloudService.deleteReport(idToDelete).catch(console.error);
              }

              if (activeReportId === idToDelete) {
                  setActiveReportId(null);
              }
              setReportToDelete(null);
              setDeleteModalRect(null);
              setIsDeleteExiting(false);
          }, 300);
      }
  };

  const handleDeleteOldReports = async () => {
      const { clearOldReports } = await import('./services/storageService');
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const newList = savedReports.filter(r => r.lastModified > thirtyDaysAgo);
      await clearOldReports(savedReports, 30);
      saveToStorage(newList);
  };
  
  const handleUpdateReport = (updatedReport: Report) => {
      const newList = savedReports.map(r => r.id === updatedReport.id ? updatedReport : r);
      saveToStorage(newList);
      
      if (currentUser) {
          CloudService.saveReport(updatedReport);
      }

      if (activeReportId === updatedReport.id) {
          setProject(updatedReport.project);
          setLocations(updatedReport.locations);
      }
  };

  const handleSelectLocation = (id: string) => {
    setActiveLocationId(id);
    window.history.pushState({ reportId: activeReportId, locationId: id }, '', '');
  };

  const handleBackFromLocation = () => {
    if (activeLocationId) {
        const el = document.getElementById(`loc-card-${activeLocationId}`);
        window.history.back();
        setScrollToLocations(true);
    } else {
        window.history.back();
    }
  };

  const handleAddIssueGlobal = (locationName: string, issue: Issue) => {
      if (!activeReportId) return;

      const report = savedReports.find(r => r.id === activeReportId);
      if (!report) return;

      const locIndex = report.locations.findIndex(l => l.name === locationName);
      let newLocations = [...report.locations];
      
      if (locIndex >= 0) {
          const loc = newLocations[locIndex];
          newLocations[locIndex] = { ...loc, issues: [...loc.issues, issue] };
      } else {
          newLocations.push({
              id: generateUUID(),
              name: locationName,
              issues: [issue]
          });
      }

      handleUpdateReport({
          ...report,
          locations: newLocations,
          lastModified: Date.now()
      });
  };

  const handleUpdateProject = (details: ProjectDetails) => {
      if (activeReportId) {
          const r = savedReports.find(rep => rep.id === activeReportId);
          if (r) handleUpdateReport({ ...r, project: details, lastModified: Date.now() });
      }
  };
  
  const handleUpdateLocations = (locs: LocationGroup[]) => {
      if (activeReportId) {
           const r = savedReports.find(rep => rep.id === activeReportId);
           if (r) handleUpdateReport({ ...r, locations: locs, lastModified: Date.now() });
      }
  };

  // Splash Screen Render
  if (showSplash) {
      return (
          <div className={`fixed inset-0 z-[9999] flex items-center justify-center bg-slate-200 dark:bg-slate-950 transition-opacity duration-700 ease-out ${isSplashFading ? 'opacity-0' : 'opacity-100 animate-fade-in'}`}>
              <div className="w-64 h-64 animate-fade-in-up">
                  <img 
                    src="/images/logo2.png" 
                    alt="BlueTag" 
                    className="w-full h-full object-contain drop-shadow-2xl"
                  />
              </div>
          </div>
      );
  }

  return (
    <ErrorBoundary>
      <div className="h-full bg-slate-200 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors duration-300">
        
        {/* Sync Indicator */}
        {isSyncing && (
             <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[300] bg-white/90 dark:bg-slate-800/90 backdrop-blur px-4 py-2 rounded-full shadow-lg border border-primary/20 flex items-center gap-2 animate-fade-in">
                 <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                 <span className="text-xs font-bold text-primary">Syncing...</span>
             </div>
        )}

        {/* Sync Error Toast */}
        {syncError && (
             <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[300] bg-red-100 dark:bg-red-900/90 backdrop-blur px-6 py-3 rounded-full shadow-xl border border-red-500/20 flex items-center gap-2 animate-fade-in" onClick={() => setSyncError(null)}>
                 <AlertCircle size={18} className="text-red-600 dark:text-red-200" />
                 <span className="text-sm font-bold text-red-800 dark:text-red-100">{syncError}</span>
             </div>
        )}

        {/* Main View Switcher */}
        {activeLocationId ? (
            <LocationDetail 
                location={locations.find(l => l.id === activeLocationId) || locations[0]}
                onBack={handleBackFromLocation}
                onUpdateLocation={(issues) => {
                    const newLocs = locations.map(l => l.id === activeLocationId ? { ...l, issues } : l);
                    handleUpdateLocations(newLocs);
                }}
            />
        ) : (
            <>
                {/* Offline Indicator */}
                {!isOnline && (
                    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 dark:bg-yellow-600 text-white px-4 py-2 flex items-center justify-center gap-2 shadow-lg">
                        <WifiOff size={18} />
                        <span className="text-sm font-bold">Offline Mode - Changes will sync when connection is restored</span>
                        {queuedOperations > 0 && (
                            <span className="bg-white/20 px-2 py-1 rounded text-xs">
                                {queuedOperations} pending
                            </span>
                        )}
                    </div>
                )}
                
                {/* Online Indicator (brief show on reconnect) */}
                <OnlineSyncIndicator isOnline={isOnline} queuedOperations={queuedOperations} />
                
                <ReportList 
                    reports={savedReports}
                    onCreateNew={handleCreateNew}
                    onSelectReport={handleSelectReport}
                    onSelectLocation={handleSelectLocation}
                    onDeleteReport={handleDeleteReport}
                    onDeleteOldReports={handleDeleteOldReports}
                    onUpdateReport={handleUpdateReport}
                    isDarkMode={isDarkMode}
                    currentTheme={theme}
                    onThemeChange={setTheme}
                    colorTheme={colorTheme}
                    onColorThemeChange={setColorTheme}
                    user={currentUser}
                    onLogin={handleLogin}
                    onLogout={handleLogout}
                    companyLogo={companyLogo}
                    onUpdateLogo={setCompanyLogo}
                    partnerLogo={partnerLogo}
                    onUpdatePartnerLogo={setPartnerLogo}
                    installAvailable={!!installPrompt}
                    onInstall={handleInstallApp}
                    isIOS={isIOS}
                    isStandalone={isStandalone}
                    isOnline={isOnline}
                    queuedOperations={queuedOperations}
                isDashboardOpen={!!activeReportId}
                signOffTemplates={signOffTemplates}
                onUpdateTemplates={handleUpdateTemplates}
                isCreating={isCreating}
                onAddIssueGlobal={handleAddIssueGlobal}
                deletingReportId={reportToDelete}
                isDeleting={isDeleteExiting}
                onRefresh={() => refreshReports(false)}
                />
            </>
        )}
        
        {reportToDelete && (
            <DeleteConfirmationModal 
                title="Delete Report?"
                message="This will permanently remove this report and all associated photos."
                onConfirm={confirmDeleteReport}
                onCancel={() => {
                    setReportToDelete(null);
                    setDeleteModalRect(null);
                }}
                targetRect={deleteModalRect}
                isExiting={isDeleteExiting}
            />
        )}

      </div>
    </ErrorBoundary>
  );
}