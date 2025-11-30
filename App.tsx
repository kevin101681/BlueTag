
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { INITIAL_PROJECT_STATE, EMPTY_LOCATIONS, generateUUID, DEFAULT_SIGN_OFF_TEMPLATES } from './constants';
import { ProjectDetails, LocationGroup, Issue, Report, ColorTheme, SignOffTemplate, ProjectField } from './types';
import { Dashboard } from './components/Dashboard';
import { LocationDetail, DeleteConfirmationModal } from './components/LocationDetail';
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

// ... [PasswordScreen & Helpers kept same]
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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  
  const [savedReports, setSavedReports] = useState<Report[]>(() => {
    if (typeof window !== 'undefined') {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
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

  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  
  const [project, setProject] = useState<ProjectDetails>(INITIAL_PROJECT_STATE);
  const [locations, setLocations] = useState<LocationGroup[]>(EMPTY_LOCATIONS);
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);
  
  const [scrollToLocations, setScrollToLocations] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<string | null>(null);
  
  const activeLocationIdRef = useRef<string | null>(null);

  const isRemoteUpdate = useRef(false);
  const lastWriteId = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hasSynced, setHasSynced] = useState(false);

  const [isAuthenticated, setIsAuthenticated] = useState(true); 
  
  const lastCreationRef = useRef(0);
  const [isCreating, setIsCreating] = useState(false);

  // ... [Theme State Same]
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
               if (!isRemoteUpdate.current) {
                   setProject(report.project);
                   setLocations(report.locations);
               }
          }
      }
  }, [activeReportId, savedReports]);

  // ... [PWA and Theme Effects Same]
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

  // ... [Auth & Sync Effects Same]
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        const q = query(collection(db, "users", currentUser.uid, "reports"));
        const unsubReports = onSnapshot(q, (snapshot) => {
            const loadedReports: Report[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data() as Report;
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
          }
      }
  };

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
      const now = Date.now();
      if (now - lastCreationRef.current < 1000) return;
      lastCreationRef.current = now;
      
      setIsCreating(true);
      setTimeout(() => setIsCreating(false), 2000); 

      const newId = generateUUID();
      const newReport: Report = {
          id: newId,
          project: INITIAL_PROJECT_STATE,
          locations: EMPTY_LOCATIONS.map(l => ({ ...l, id: generateUUID(), issues: [] })),
          lastModified: Date.now()
      };

      setSavedReports(prev => [newReport, ...prev]);
      persistReport(newReport, user);
      if (user) { setHasSynced(true); }
  };

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

  const handleConfirmDeleteReport = async () => {
      if (!reportToDelete) return;
      const id = reportToDelete;
      
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
      setReportToDelete(null);
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
  
  const handleAddIssueGlobal = (locationName: string, issue: Issue) => {
      if (!activeReportId) return;
      
      setLocations(prev => {
          const locIndex = prev.findIndex(l => l.name.toLowerCase() === locationName.toLowerCase());
          if (locIndex >= 0) {
              const newLocs = [...prev];
              newLocs[locIndex] = { ...newLocs[locIndex], issues: [...newLocs[locIndex].issues, issue] };
              return newLocs;
          } else {
              // Create new location group if it doesn't exist
              return [...prev, {
                  id: generateUUID(),
                  name: locationName,
                  issues: [issue]
              }];
          }
      });
  };

  const handleAddIssue = (issue: Issue) => {
      if (!activeLocationId) return;
      setLocations(prev => prev.map(l => {
          if (l.id === activeLocationId) {
              return { ...l, issues: [...l.issues, issue] };
          }
          return l;
      }));
  };

  const handleUpdateIssue = (issue: Issue) => {
      if (!activeLocationId) return;
      setLocations(prev => prev.map(l => {
          if (l.id === activeLocationId) {
              return { ...l, issues: l.issues.map(i => i.id === issue.id ? issue : i) };
          }
          return l;
      }));
  };

  const handleDeleteIssue = (issueId: string) => {
      if (!activeLocationId) return;
      setLocations(prev => prev.map(l => {
          if (l.id === activeLocationId) {
              return { ...l, issues: l.issues.filter(i => i.id !== issueId) };
          }
          return l;
      }));
  };

  return (
    <div className="w-full h-full min-h-screen overflow-hidden bg-slate-200 dark:bg-slate-950">
      {!isAuthenticated ? (
          <PasswordScreen onUnlock={() => {
              localStorage.setItem('cbs_app_access', 'granted');
              setIsAuthenticated(true);
          }} />
      ) : (
            <div className="fixed inset-0 overflow-y-auto bg-slate-200 dark:bg-slate-950">
                <ReportList 
                  reports={savedReports}
                  onCreateNew={handleCreateNew}
                  onSelectReport={handleSelectReport}
                  onDeleteReport={(id) => setReportToDelete(id)}
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
                  isDashboardOpen={false} 
                  signOffTemplates={signOffTemplates}
                  onUpdateTemplates={handleUpdateTemplates}
                  isCreating={isCreating}
                  onAddIssueGlobal={handleAddIssueGlobal}
                />
                
                {activeLocationId && (
                    <LocationDetail
                        location={locations.find(l => l.id === activeLocationId)!}
                        onBack={() => {
                            setActiveLocationId(null);
                            window.history.back();
                        }}
                        onAddIssue={handleAddIssue}
                        onUpdateIssue={handleUpdateIssue}
                        onDeleteIssue={handleDeleteIssue}
                    />
                )}
                
                {reportToDelete && (
                    <DeleteConfirmationModal
                        title="Delete Report?"
                        message="Are you sure you want to delete this report? This action cannot be undone."
                        onConfirm={handleConfirmDeleteReport}
                        onCancel={() => setReportToDelete(null)}
                    />
                )}
            </div>
      )}
    </div>
  );
}
