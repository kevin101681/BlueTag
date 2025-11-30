import React, { useState, useEffect, useRef, useCallback } from 'react';
import { INITIAL_PROJECT_STATE, EMPTY_LOCATIONS, generateUUID, DEFAULT_SIGN_OFF_TEMPLATES } from './constants';
import { ProjectDetails, LocationGroup, Issue, Report, ColorTheme, SignOffTemplate, ProjectField } from './types';
import { Dashboard } from './components/Dashboard';
import { LocationDetail } from './components/LocationDetail';
import { ReportList, ThemeOption } from './components/ReportList';
import { BlueTagLogo } from './components/Logo';

// Firebase Imports
import { auth, db } from './services/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';

const CompanyLogoAsset = "";
const PartnerLogoAsset = "";

const STORAGE_KEY = 'punchlist_reports';
const THEME_KEY = 'cbs_punch_theme';
const COLOR_THEME_KEY = 'cbs_color_theme';
const LOGO_KEY = 'cbs_company_logo';
const PARTNER_LOGO_KEY = 'cbs_partner_logo';
const TEMPLATES_KEY = 'cbs_sign_off_templates';

const PasswordScreen = ({ onUnlock }: { onUnlock: () => void }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.toLowerCase() === 'jackwagon') {
      onUnlock();
    } else {
      setError(true);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 animate-fade-in z-50">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[32px] shadow-xl p-8 border border-slate-100 dark:border-slate-800">
        <div className="flex justify-center mb-8">
           <BlueTagLogo size="xl" />
        </div>
        <h2 className="text-2xl font-bold text-center text-slate-800 dark:text-white mb-2">Welcome</h2>
        <p className="text-center text-slate-500 dark:text-slate-400 mb-8">Enter access password to continue</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
            <input 
              type="password" 
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(false); }}
              className={`w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-[20px] text-center text-lg font-bold outline-none border-2 transition-colors ${error ? 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-500' : 'border-transparent focus:border-primary text-slate-800 dark:text-white'}`}
              placeholder="Password"
              autoFocus
            />
            <button 
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-lg py-4 rounded-[20px] shadow-lg hover:shadow-xl transition-all active:scale-95"
            >
              Enter App
            </button>
        </form>
      </div>
    </div>
  );
};

// Helper to convert hex to RGB
const hexToRgb = (hex: string) => {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function(m, r, g, b) {
        return r + r + g + g + b + b;
    });

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

// Migration Helper: Converts legacy ProjectDetails to new Field-based structure
const migrateProjectData = (p: any): ProjectDetails => {
    // If it already has fields, assume migrated
    if (p.fields && Array.isArray(p.fields)) return p as ProjectDetails;
    
    // Create new fields from legacy properties
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

export default function App() {
  // --- State ---
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  const [savedReports, setSavedReports] = useState<Report[]>(() => {
    if (typeof window !== 'undefined') {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Apply migration on load
                return parsed.map((r: any) => ({
                    ...r,
                    project: migrateProjectData(r.project)
                }));
            }
            return [];
        } catch (e) {
            console.error("Failed to load initial reports", e);
            return [];
        }
    }
    return [];
  });
  
  const [isDataLoaded, setIsDataLoaded] = useState(false); 

  // Splash Screen State
  const [minLoadTimePassed, setMinLoadTimePassed] = useState(false);
  // Added 'fade-out' state for smooth splash exit
  const [splashState, setSplashState] = useState<'loading' | 'transitioning' | 'settled' | 'fade-out' | 'complete'>('loading');

  // Install Prompt State
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  
  // Current active report state
  const [project, setProject] = useState<ProjectDetails>(INITIAL_PROJECT_STATE);
  const [locations, setLocations] = useState<LocationGroup[]>(EMPTY_LOCATIONS);
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);
  
  // Scroll restoration state
  const [scrollToLocations, setScrollToLocations] = useState(false);
  
  const activeLocationIdRef = useRef<string | null>(null);

  // Sync Control Refs
  const isRemoteUpdate = useRef(false);
  const lastWriteId = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hasSynced, setHasSynced] = useState(false);

  // App Access Gate State
  const [isAuthenticated, setIsAuthenticated] = useState(true); 
  
  // Global Creation Lock
  const lastCreationRef = useRef(0);
  const [isCreating, setIsCreating] = useState(false);

  // Theme State
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

  // Sign Off Templates State
  const [signOffTemplates, setSignOffTemplates] = useState<SignOffTemplate[]>(() => {
      if (typeof window !== 'undefined') {
          try {
              const saved = localStorage.getItem(TEMPLATES_KEY);
              if (saved) {
                  const parsed = JSON.parse(saved);
                  // Basic validation to ensure schema match: must be array, must have sections
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

  // Animation State for Dashboard Reveal
  const [isDashboardMounted, setIsDashboardMounted] = useState(!!activeReportId);
  const [isDashboardVisible, setIsDashboardVisible] = useState(!!activeReportId);

  // --- SWIPE / TOUCH TRACKING STATE ---
  const [swipeOffset, setSwipeOffset] = useState(0); 
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const touchStartRef = useRef<{ x: number, y: number } | null>(null);
  const dragDirectionRef = useRef<'horizontal' | 'vertical' | null>(null);
  
  const [areModalsOpen, setAreModalsOpen] = useState(false);

  // --- Splash Screen Timing ---
  useEffect(() => {
      const timer = setTimeout(() => {
          setMinLoadTimePassed(true);
      }, 2000);
      return () => clearTimeout(timer);
  }, []);

  const appReady = isAuthReady && isDataLoaded;
  
  // Transition Trigger
  useEffect(() => {
      if (appReady && minLoadTimePassed) {
         setSplashState('transitioning');
         const timer = setTimeout(() => {
            setSplashState('settled'); 
            // After settling (logo in place), start fade out
            setTimeout(() => {
                setSplashState('fade-out');
                // Remove from DOM after fade out completes
                setTimeout(() => setSplashState('complete'), 500);
            }, 700);
         }, 700); // Matches transition duration
         return () => clearTimeout(timer);
      }
  }, [appReady, minLoadTimePassed]);

  // --- Browser History Management ---
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
               if (!isRemoteUpdate.current) {
                   setProject(report.project);
                   setLocations(report.locations);
               }
          }
      }
  }, [activeReportId, savedReports]);

  // Handle Dashboard Transition State
  useEffect(() => {
    if (activeReportId) {
      setIsDashboardMounted(true);
      requestAnimationFrame(() => {
        setIsDashboardVisible(true);
      });
    } else {
      setIsDashboardVisible(false);
      // Wait for exit animation
      const timer = setTimeout(() => {
        setIsDashboardMounted(false);
        setSwipeOffset(0); // Reset swipe offset only after unmount to prevent visual snap
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [activeReportId]);


  // --- PWA Install Prompt Capture & Device Detection ---
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
    console.log(`User response to the install prompt: ${outcome}`);
    setInstallPrompt(null);
    (window as any).deferredPrompt = null;
  };

  // --- Theme Management ---
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

  // Color Theme Management
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
          const ocr = mix(rgb.r, 0, 0.6);
          const ocg = mix(rgb.g, 0, 0.6);
          const ocb = mix(rgb.b, 0, 0.6);
          root.style.setProperty('--color-on-primary-container', `${ocr} ${ocg} ${ocb}`);
      }
      localStorage.setItem(COLOR_THEME_KEY, colorTheme);
  }, [colorTheme]);

  const handleUpdateLogo = (newLogo: string) => {
      setCompanyLogo(newLogo);
      localStorage.setItem(LOGO_KEY, newLogo);
  };

  const handleUpdatePartnerLogo = (newLogo: string) => {
      setPartnerLogo(newLogo);
      localStorage.setItem(PARTNER_LOGO_KEY, newLogo);
  };

  // --- Authentication & Data Loading ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);

      if (currentUser) {
        const q = query(collection(db, "users", currentUser.uid, "reports"));
        const unsubReports = onSnapshot(q, (snapshot) => {
            const loadedReports: Report[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data() as Report;
                // Apply migration on live data
                data.project = migrateProjectData(data.project);
                loadedReports.push(data);
            });
            setSavedReports(loadedReports);
            setIsDataLoaded(true);
        }, (err) => {
            console.error("Firestore Error", err);
            setIsDataLoaded(true);
        });
        return () => { unsubReports(); };
      } else {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Apply migration on load
                setSavedReports(parsed.map((r: any) => ({
                    ...r,
                    project: migrateProjectData(r.project)
                })));
            } catch (e) {
                console.error("Failed to parse saved reports", e);
            }
        }
        setIsDataLoaded(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // --- Real-time Active Report Sync (Firestore) ---
  useEffect(() => {
      if (!user || !activeReportId) return;
      setHasSynced(false);
      const reportRef = doc(db, "users", user.uid, "reports", activeReportId);
      const unsubscribe = onSnapshot(reportRef, (docSnap) => {
          if (docSnap.exists()) {
              const data = docSnap.data() as Report;
              if (lastWriteId.current && data.lastModified?.toString() === lastWriteId.current) {
                   return;
              }
              isRemoteUpdate.current = true;
              
              // Migrate incoming data
              const migratedProject = migrateProjectData(data.project);
              
              setProject(migratedProject);
              setLocations(data.locations);
              setHasSynced(true);
              setTimeout(() => { isRemoteUpdate.current = false; }, 50);
          } else {
              setHasSynced(true);
          }
      }, (error) => {
          console.error("Firestore Sync Error:", error);
          setHasSynced(true);
      });
      return () => unsubscribe();
  }, [user, activeReportId]);

  // --- Unified Save Function ---
  const persistReport = async (reportData: Report, currentUser: User | null) => {
      if (currentUser) {
          try {
              lastWriteId.current = reportData.lastModified.toString();
              await setDoc(doc(db, "users", currentUser.uid, "reports", reportData.id), reportData);
          } catch (e) {
              console.error("Error saving to Firestore", e);
          }
      } else {
          try {
              const currentString = localStorage.getItem(STORAGE_KEY);
              let currentList: Report[] = currentString ? JSON.parse(currentString) : [];
              const idx = currentList.findIndex(r => r.id === reportData.id);
              if (idx >= 0) {
                  currentList[idx] = reportData;
              } else {
                  currentList.push(reportData);
              }
              localStorage.setItem(STORAGE_KEY, JSON.stringify(currentList));
          } catch (e: any) {
              console.error("LocalStorage Save Failed:", e);
              if (e.name === 'QuotaExceededError' || e.message?.includes('quota')) {
                  alert("Storage limit reached! Please delete old reports.");
              }
          }
      }
  };

  // --- Auto-Saving Logic (Debounced) ---
  useEffect(() => {
      if (isRemoteUpdate.current || !activeReportId || (user && !hasSynced) || !isDataLoaded) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
          const currentTimestamp = Date.now();
          const reportData: Report = {
              id: activeReportId,
              project,
              locations,
              lastModified: currentTimestamp
          };
          setSavedReports(prev => {
              const idx = prev.findIndex(r => r.id === activeReportId);
              if (idx >= 0) {
                  const newReports = [...prev];
                  newReports[idx] = reportData;
                  return newReports;
              } else {
                  return [...prev, reportData];
              }
          });
          await persistReport(reportData, user);
      }, 1000);
      return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [project, locations, activeReportId, user, hasSynced, isDataLoaded]); 

  // --- Handlers ---
  const handleCreateNew = () => {
      // Robust lock check: prevents double creation if called < 1s apart
      const now = Date.now();
      if (now - lastCreationRef.current < 1000) {
          console.log("Creation locked (cooldown)");
          return;
      }
      lastCreationRef.current = now;
      
      setIsCreating(true);
      setTimeout(() => setIsCreating(false), 1000);

      const newId = generateUUID();
      const newProject = INITIAL_PROJECT_STATE; // Already uses new field structure
      const newLocations = EMPTY_LOCATIONS.map(l => ({ ...l, id: generateUUID(), issues: [] }));
      
      const newReport: Report = {
          id: newId,
          project: newProject,
          locations: newLocations,
          lastModified: Date.now()
      };

      setSavedReports(prev => [...prev, newReport]);
      persistReport(newReport, user);
      if (user) { setHasSynced(true); }
  };

  // Allow list component to update a report directly (e.g. from embedded dashboard)
  const handleUpdateReport = (updatedReport: Report) => {
      setSavedReports(prev => {
          const idx = prev.findIndex(r => r.id === updatedReport.id);
          if (idx >= 0) {
              const newReports = [...prev];
              newReports[idx] = updatedReport;
              return newReports;
          }
          return prev;
      });
      persistReport(updatedReport, user);
  };

  const handleSelectReport = (id: string) => {
      const report = savedReports.find(r => r.id === id);
      if (report) {
          setProject(migrateProjectData(report.project));
          setLocations(report.locations);
          setActiveReportId(id);
          setActiveLocationId(null);
          setScrollToLocations(false);
          window.history.pushState({ reportId: id }, '', '');
      }
  };

  const handleSelectLocation = (id: string) => {
      setActiveLocationId(id);
      window.history.pushState({ reportId: activeReportId, locationId: id }, '', '');
  };

  const forceSaveCurrent = async () => {
      if (!activeReportId) return;
      const reportData: Report = {
          id: activeReportId,
          project,
          locations,
          lastModified: Date.now()
      };
      setSavedReports(prev => {
          const idx = prev.findIndex(r => r.id === activeReportId);
          if (idx >= 0) {
              const newReports = [...prev];
              newReports[idx] = reportData;
              return newReports;
          }
          return [...prev, reportData];
      });
      return persistReport(reportData, user);
  };

  const handleBackToReports = () => {
      forceSaveCurrent(); 
      setActiveReportId(null);
      setActiveLocationId(null);
      window.history.back();
  };
  
  const handleBackToDashboard = () => {
      forceSaveCurrent();
      setActiveLocationId(null);
      setScrollToLocations(true);
      window.history.back();
  };

  const handleDeleteReport = async (id: string) => {
      setSavedReports(prev => prev.filter(r => r.id !== id));
      if (activeReportId === id) { setActiveReportId(null); }
      if (user) {
          try {
            await deleteDoc(doc(db, "users", user.uid, "reports", id));
          } catch(e: any) {
              console.error("Error deleting from firebase", e);
          }
      } else {
          try {
              const currentString = localStorage.getItem(STORAGE_KEY);
              if (currentString) {
                  const currentList: Report[] = JSON.parse(currentString);
                  const updatedList = currentList.filter(r => r.id !== id);
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
              }
          } catch(e) { console.error("Failed to delete locally", e); }
      }
  };

  const handleDeleteOldReports = async () => {
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const reportsToDelete = savedReports.filter(r => r.lastModified < thirtyDaysAgo);
      if (reportsToDelete.length === 0) {
          alert("No reports older than 30 days found.");
          return;
      }
      if (user) {
          for (const report of reportsToDelete) {
              try { await deleteDoc(doc(db, "users", user.uid, "reports", report.id)); } catch(e: any) {}
          }
      } else {
           try {
              const currentString = localStorage.getItem(STORAGE_KEY);
              if (currentString) {
                  const currentList: Report[] = JSON.parse(currentString);
                  const updatedList = currentList.filter(r => r.lastModified >= thirtyDaysAgo);
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
                  setSavedReports(updatedList);
              }
           } catch(e) {}
      }
      if (activeReportId && reportsToDelete.find(r => r.id === activeReportId)) {
          setActiveReportId(null);
      }
  };

  const handleUpdateProject = (details: ProjectDetails) => { setProject(details); };
  const handleUpdateLocations = (newLocations: LocationGroup[]) => { setLocations(newLocations); };
  const handleAddIssueGlobal = (locationName: string, issue: Issue) => {
      setLocations(prev => {
          const exists = prev.find(l => l.name === locationName);
          if (exists) {
              return prev.map(loc => {
                  if (loc.name === locationName) { return { ...loc, issues: [...loc.issues, issue] }; }
                  return loc;
              });
          } else {
              const newLoc: LocationGroup = {
                  id: generateUUID(),
                  name: locationName,
                  issues: [issue]
              };
              return [...prev, newLoc];
          }
      });
  };
  const handleLocationUpdate = (updatedLoc: LocationGroup) => {
      setLocations(prev => prev.map(l => l.id === updatedLoc.id ? updatedLoc : l));
  };


  // --- TOUCH HANDLERS (Bi-Directional Slide) ---
  
  const handleTouchStart = (e: React.TouchEvent) => {
      if (e.touches.length !== 1) return;
      if (areModalsOpen || isAnimatingOut) return;

      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      setIsDragging(true);
      dragDirectionRef.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (!isDragging || !touchStartRef.current || areModalsOpen || isAnimatingOut) return;
      
      const dx = e.touches[0].clientX - touchStartRef.current.x;
      const dy = e.touches[0].clientY - touchStartRef.current.y;

      if (!dragDirectionRef.current) {
          if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 5) { // More sensitive start (5px)
              dragDirectionRef.current = 'horizontal';
          } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 5) { // More sensitive start (5px)
              dragDirectionRef.current = 'vertical';
          }
      }

      if (dragDirectionRef.current === 'vertical') return;

      if (dragDirectionRef.current === 'horizontal') {
          // If Dashboard Open: Only allow Swipe Right (dx > 0)
          if (isDashboardVisible) {
              if (dx < 0) return; 
              if (activeLocationId) return; // Modal/Detail open
              e.preventDefault();
              setSwipeOffset(dx);
          } 
          // If Home (Dashboard Closed): Only allow Swipe Left (dx < 0)
          else {
              if (dx > 0) return;
              e.preventDefault();
              setSwipeOffset(dx);
          }
      }
  };

  const handleTouchEnd = () => {
      if (!isDragging || areModalsOpen || isAnimatingOut) return;

      setIsDragging(false);
      dragDirectionRef.current = null;
      
      const screenW = window.innerWidth;
      const threshold = screenW * 0.10; // More sensitive completion (10%)

      if (isDashboardVisible) {
          // Closing (Swipe Right)
          if (swipeOffset > threshold && !activeLocationId) {
              setIsAnimatingOut(true);
              setSwipeOffset(screenW); // Animate to fully off-screen right
              
              setTimeout(() => {
                  handleBackToReports();
                  setIsAnimatingOut(false);
              }, 300); 
          } else {
             setSwipeOffset(0); // Snap back to open
          }
      } else {
          // Opening (Swipe Left)
          if (swipeOffset < -threshold) {
             // Directly call protected creation function
             handleCreateNew();
             setSwipeOffset(0);
          } else {
             setSwipeOffset(0); // Snap back to closed
          }
      }
  };

  const transitionClass = isDragging ? 'transition-none' : 'transition-all duration-300 ease-out';
  const scaleTransitionClass = isDragging ? 'transition-none' : 'transition-all duration-300 ease-out';

  // --- UNIFIED RENDERING LOGIC ---
  const screenW = typeof window !== 'undefined' ? window.innerWidth : 375;
  
  let dashboardX = 0;
  if (isDashboardVisible) {
      dashboardX = Math.max(0, swipeOffset);
  } else {
      dashboardX = screenW;
  }

  // Calculate Progress (0 = Closed, 1 = Open)
  const progress = Math.max(0, Math.min(1, 1 - (dashboardX / screenW)));

  // Home Screen Transforms (Background)
  const homeScale = 1 - (0.2 * progress); // 1 -> 0.8
  const homeTransform = `scale(${homeScale})`;
  const homeFilter = `blur(${20 * progress}px) brightness(${100 - (40 * progress)}%)`;
  const homeZIndex = 'z-0';

  // Dashboard Transforms (Foreground)
  const dashboardTransform = `translateX(${dashboardX}px)`;
  const dashboardFilter = ''; 
  const dashboardZIndex = 'z-10';

  const dashboardProject = activeReportId ? project : INITIAL_PROJECT_STATE;
  const dashboardLocations = activeReportId ? locations : EMPTY_LOCATIONS;
  const showDashboardLayer = isDashboardMounted;

  return (
    <div 
        className="w-full h-full overflow-hidden bg-slate-200 dark:bg-slate-950"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
    >
      
      {!isAuthenticated ? (
          <PasswordScreen onUnlock={() => {
              localStorage.setItem('cbs_app_access', 'granted');
              setIsAuthenticated(true);
          }} />
      ) : (
          <>
            <div 
                className={`fixed inset-0 overflow-y-auto bg-slate-200 dark:bg-slate-950 ${homeZIndex} ${isDashboardVisible ? scaleTransitionClass : transitionClass}`}
                style={{ 
                    transform: homeTransform,
                    filter: homeFilter,
                    willChange: 'transform, filter',
                    pointerEvents: isDashboardVisible ? 'none' : 'auto'
                }}
            >
                {/* Background Mask/Overlay - Inside scroll container for correct stacking */}
                {splashState !== 'complete' && (
                    <div className={`fixed inset-0 bg-slate-200 dark:bg-slate-950 z-[100] transition-opacity duration-500 ease-out ${splashState === 'loading' ? 'opacity-100' : 'opacity-0'}`} />
                )}

                {/* Splash Logo Layout Container to match ReportList */}
                {splashState !== 'complete' && (
                    <div className="max-w-3xl mx-auto relative h-full w-full pointer-events-none z-[101]">
                        {/* Splash Logo - Animated Position inside alignment wrapper */}
                        <div className={`absolute left-1/2 transition-all duration-700 ease-gentle ${
                            splashState === 'loading' 
                            ? 'top-1/2 -translate-x-1/2 -translate-y-1/2 scale-[3]' 
                            : splashState === 'fade-out'
                                ? 'top-[92px] -translate-x-1/2 -translate-y-1/2 scale-100 opacity-0' // Fade out at end
                                : 'top-[92px] -translate-x-1/2 -translate-y-1/2 scale-100 opacity-100'
                        }`}>
                            <div className="animate-fade-in">
                                <BlueTagLogo size="header" />
                            </div>
                        </div>
                    </div>
                )}

                <ReportList 
                  reports={savedReports}
                  onCreateNew={handleCreateNew}
                  onSelectReport={handleSelectReport}
                  onDeleteReport={handleDeleteReport}
                  onDeleteOldReports={handleDeleteOldReports}
                  onUpdateReport={handleUpdateReport}
                  isDarkMode={isDarkMode}
                  currentTheme={theme}
                  onThemeChange={setTheme}
                  colorTheme={colorTheme}
                  onColorThemeChange={setColorTheme}
                  user={user}
                  companyLogo={companyLogo}
                  onUpdateLogo={handleUpdateLogo}
                  partnerLogo={partnerLogo}
                  onUpdatePartnerLogo={handleUpdatePartnerLogo}
                  installAvailable={!!installPrompt}
                  onInstall={handleInstallApp}
                  isIOS={isIOS}
                  isStandalone={isStandalone}
                  isDashboardOpen={isDashboardVisible}
                  // Hide static logo only while loading or transitioning. Once settled, show it (behind splash logo)
                  hideLogo={splashState === 'loading' || splashState === 'transitioning'}
                  signOffTemplates={signOffTemplates}
                  onUpdateTemplates={handleUpdateTemplates}
                  isCreating={isCreating}
                />
            </div>

            {showDashboardLayer && (
                <div 
                  className={`fixed inset-0 overflow-y-auto overflow-x-hidden bg-slate-200 dark:bg-slate-950 ${dashboardZIndex} ${isDashboardVisible ? transitionClass : scaleTransitionClass}`}
                  style={{ 
                      transform: dashboardTransform,
                      filter: dashboardFilter,
                      willChange: 'transform',
                      pointerEvents: isDashboardVisible ? 'auto' : 'none',
                      boxShadow: progress > 0 ? `0 0 40px rgba(0,0,0,${0.3 * progress})` : 'none'
                  }}
                >
                    <Dashboard
                      project={dashboardProject}
                      locations={dashboardLocations}
                      onSelectLocation={handleSelectLocation}
                      onUpdateProject={handleUpdateProject}
                      onUpdateLocations={handleUpdateLocations}
                      onBack={handleBackToReports}
                      onAddIssueGlobal={handleAddIssueGlobal}
                      isDarkMode={isDarkMode}
                      toggleTheme={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
                      companyLogo={companyLogo}
                      shouldScrollToLocations={scrollToLocations}
                      onScrollComplete={() => setScrollToLocations(false)}
                      onModalStateChange={setAreModalsOpen}
                      signOffTemplates={signOffTemplates}
                      onUpdateTemplates={handleUpdateTemplates}
                    />

                    {activeLocationId && locations.find(l => l.id === activeLocationId) && (
                        <LocationDetail
                          location={locations.find(l => l.id === activeLocationId)!}
                          onBack={handleBackToDashboard}
                          onAddIssue={(issue) => {
                              const activeLocation = locations.find(l => l.id === activeLocationId)!;
                              const updatedLoc = { ...activeLocation, issues: [...activeLocation.issues, issue] };
                              handleLocationUpdate(updatedLoc);
                          }}
                          onUpdateIssue={(issue) => {
                              const activeLocation = locations.find(l => l.id === activeLocationId)!;
                              const updatedIssues = activeLocation.issues.map(i => i.id === issue.id ? issue : i);
                              handleLocationUpdate({ ...activeLocation, issues: updatedIssues });
                          }}
                          onDeleteIssue={(issueId) => {
                              const activeLocation = locations.find(l => l.id === activeLocationId)!;
                              const updatedIssues = activeLocation.issues.filter(i => i.id !== issueId);
                              handleLocationUpdate({ ...activeLocation, issues: updatedIssues });
                          }}
                        />
                    )}
                </div>
            )}
          </>
      )}
    </div>
  );
}