
import React, { useState, useEffect, useRef } from 'react';
import { INITIAL_PROJECT_STATE, EMPTY_LOCATIONS, generateUUID, DEFAULT_SIGN_OFF_TEMPLATES } from './constants';
import { ProjectDetails, LocationGroup, Issue, Report, ColorTheme, SignOffTemplate, ProjectField } from './types';
import { LocationDetail, DeleteConfirmationModal } from './components/LocationDetail';
import { ReportList, ThemeOption } from './components/ReportList';
import { BlueTagLogo } from './components/Logo';

// Global declaration for Netlify Identity
declare global {
  interface Window {
    netlifyIdentity: any;
  }
}

const CompanyLogoAsset = "";
const PartnerLogoAsset = "";

const STORAGE_KEY = 'punchlist_reports';
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

const SplashScreen = ({ onAnimationComplete, onRevealApp }: { onAnimationComplete: () => void, onRevealApp: () => void }) => {
    const [animating, setAnimating] = useState(false);
    
    useEffect(() => {
        // Start pause
        const timer1 = setTimeout(() => {
            setAnimating(true);
            // Trigger app reveal slightly after animation starts so it's ready underneath
            onRevealApp();
        }, 800);

        // End animation (match duration)
        const timer2 = setTimeout(() => {
            onAnimationComplete();
        }, 2200); // Extended to ensure smooth transition completes

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
        };
    }, [onAnimationComplete, onRevealApp]);

    return (
        <div className={`fixed inset-0 z-[9999] bg-slate-200 dark:bg-slate-950 flex pointer-events-none transition-all duration-1000 ease-out ${animating ? 'bg-opacity-0' : 'bg-opacity-100'}`}>
            <div 
                className="absolute transition-all duration-[1000ms] cubic-bezier(0.2, 0, 0, 1)"
                style={{
                    top: animating ? '16px' : '50%',
                    left: animating ? '24px' : '50%', 
                    transform: animating ? 'translate(0, 0)' : 'translate(-50%, -50%)',
                }}
            >
                <BlueTagLogo 
                    size='xl' 
                    className={`transition-all duration-[1000ms] cubic-bezier(0.2, 0, 0, 1) ${
                        animating 
                        ? '!w-[54px] !h-[54px] !p-[6px] !rounded-2xl !shadow-sm !border !border-slate-100 dark:!border-slate-700' 
                        : 'shadow-2xl'
                    }`} 
                />
            </div>
        </div>
    );
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [isAppVisible, setIsAppVisible] = useState(false);
  
  // Netlify Identity Effect
  useEffect(() => {
    if (window.netlifyIdentity) {
      const user = window.netlifyIdentity.currentUser();
      if (user) {
        setCurrentUser(user);
      }

      window.netlifyIdentity.on('init', (user: any) => {
         if (user) setCurrentUser(user);
      });

      window.netlifyIdentity.on('login', (user: any) => {
        setCurrentUser(user);
        window.netlifyIdentity.close();
      });

      window.netlifyIdentity.on('logout', () => {
        setCurrentUser(null);
      });
    }
  }, []);

  const handleLogin = () => {
      if (window.netlifyIdentity) {
          window.netlifyIdentity.open();
      }
  };

  const handleLogout = () => {
      if (window.netlifyIdentity) {
          window.netlifyIdentity.logout();
      }
  };

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
  
  const [isDataLoaded, setIsDataLoaded] = useState(true); 

  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  
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

  // PWA and Theme Effects
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

  // Persist to LocalStorage Only
  const persistReport = async (reportData: Report) => {
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
  };

  useEffect(() => {
      if (!activeReportId || !isDataLoaded) return;
      const reportData: Report = {
          id: activeReportId,
          project,
          locations,
          lastModified: Date.now()
      };
      // Auto-save debounced
      const handler = setTimeout(() => {
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
          persistReport(reportData);
      }, 500);
      return () => clearTimeout(handler);
  }, [project, locations, activeReportId, isDataLoaded]); 

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
      persistReport(newReport);
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
      persistReport(updatedReport);
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
  
  const handleUpdateLocation = (issues: Issue[]) => {
      if (activeLocationId) {
          setLocations(prev => prev.map(l => 
              l.id === activeLocationId ? { ...l, issues } : l
          ));
          // Don't close modal here, let LocationDetail call onBack or have LocationDetail call this on Save
      }
  };

  const handleConfirmDeleteReport = async () => {
      if (!reportToDelete) return;
      const id = reportToDelete;
      
      setIsDeleteExiting(true); // Trigger exit animation for modal and report card
      
      // Wait for animations to complete before updating state
      setTimeout(() => {
          setSavedReports(prev => prev.filter(r => r.id !== id));
          if (activeReportId === id) { setActiveReportId(null); }
          
          try {
              const currentString = localStorage.getItem(STORAGE_KEY);
              if (currentString) {
                  const currentList: Report[] = JSON.parse(currentString);
                  const updatedList = currentList.filter(r => r.id !== id);
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
              }
          } catch(e) { console.error("Failed to delete locally", e); }
          
          setReportToDelete(null);
          setDeleteModalRect(null);
          setIsDeleteExiting(false);
      }, 400); // 400ms matches dialog-exit and scale-out duration roughly
  };

  const handleDeleteOldReports = async () => {
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const reportsToDelete = savedReports.filter(r => r.lastModified < thirtyDaysAgo);
      if (reportsToDelete.length === 0) {
          alert("No reports older than 30 days found.");
          return;
      }
      try {
          const currentString = localStorage.getItem(STORAGE_KEY);
          if (currentString) {
              const currentList: Report[] = JSON.parse(currentString);
              const updatedList = currentList.filter(r => r.lastModified >= thirtyDaysAgo);
              localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
              setSavedReports(updatedList);
          }
      } catch(e) {}
      
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
              return [...prev, {
                  id: generateUUID(),
                  name: locationName,
                  issues: [issue]
              }];
          }
      });
  };

  return (
    <div className="w-full h-full min-h-screen overflow-hidden bg-slate-200 dark:bg-slate-950 relative">
      {showSplash && (
          <SplashScreen 
              onAnimationComplete={() => setShowSplash(false)} 
              onRevealApp={() => setIsAppVisible(true)}
          />
      )}
      
      <div className={`fixed inset-0 overflow-y-auto bg-slate-200 dark:bg-slate-950 transition-opacity duration-1000 ease-out ${isAppVisible ? 'opacity-100' : 'opacity-0'}`}>
            <ReportList 
              reports={savedReports}
              onCreateNew={handleCreateNew}
              onSelectReport={handleSelectReport}
              onSelectLocation={handleSelectLocation}
              onDeleteReport={(id, rect) => {
                  setReportToDelete(id);
                  if (rect) setDeleteModalRect(rect);
              }}
              onDeleteOldReports={handleDeleteOldReports}
              onUpdateReport={handleUpdateReport}
              isDarkMode={isDarkMode}
              currentTheme={theme}
              onThemeChange={setTheme}
              colorTheme={colorTheme}
              onColorThemeChange={setColorTheme}
              user={currentUser}
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
              onLogin={handleLogin}
              onLogout={handleLogout}
              deletingReportId={reportToDelete}
              isDeleting={isDeleteExiting}
            />
            
            {activeLocationId && (
                <LocationDetail
                    location={locations.find(l => l.id === activeLocationId)!}
                    onBack={() => {
                        setActiveLocationId(null);
                        window.history.back();
                    }}
                    onUpdateLocation={handleUpdateLocation}
                />
            )}
            
            {reportToDelete && (
                <DeleteConfirmationModal
                    title="Delete Report?"
                    message="Are you sure you want to delete this report? This action cannot be undone."
                    onConfirm={handleConfirmDeleteReport}
                    onCancel={() => {
                        // Prevent cancelling during exit animation
                        if (isDeleteExiting) return;
                        setReportToDelete(null);
                        setDeleteModalRect(null);
                    }}
                    targetRect={deleteModalRect}
                    isExiting={isDeleteExiting}
                />
            )}
        </div>
    </div>
  );
}
