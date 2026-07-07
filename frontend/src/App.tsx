import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { LanguageDropdown, Language } from "./components/LanguageDropdown";
import { LoginForm } from "./components/LoginForm";
import { LandscapePanel } from "./components/LandscapePanel";
import { Dashboard } from "./Dashboard/Dashboard";
import { DotScannerBackground } from "./components/DotScannerBackground";
import { getPersistedLanguageCode, persistLanguageCode } from "./i18n";
import { AUTH_UNAUTHORIZED_EVENT, AuthUser, getAccessToken, getCurrentUser, logout } from "./lib/auth";

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [currentLang, setCurrentLang] = useState<Language>(() => {
    const code = getPersistedLanguageCode();
    const map: Record<string, Language> = {
      ZH: { code: "ZH", name: "简体中文", flag: "🇨🇳" },
      EN: { code: "EN", name: "English", flag: "🇬🇧" },
      JA: { code: "JA", name: "日本語", flag: "🇯🇵" },
      ES: { code: "ES", name: "Español", flag: "🇪🇸" },
    };
    return map[code] || map.ZH;
  });

  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    await logout();
    setCurrentUser(null);
  };

  React.useEffect(() => {
    const restoreSession = async () => {
      if (!getAccessToken()) {
        setIsRestoringSession(false);
        return;
      }
      try {
        setCurrentUser(await getCurrentUser());
      } catch {
        setCurrentUser(null);
      } finally {
        setIsRestoringSession(false);
      }
    };
    const handleUnauthorized = () => setCurrentUser(null);
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    void restoreSession();
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);
  React.useEffect(() => {
    persistLanguageCode(currentLang.code);
    if (currentLang.code === "ZH") {
      document.documentElement.lang = "zh-CN";
    } else if (currentLang.code === "JA") {
      document.documentElement.lang = "ja";
    } else if (currentLang.code === "ES") {
      document.documentElement.lang = "es";
    } else {
      document.documentElement.lang = "en";
    }
  }, [currentLang.code]);

  if (isRestoringSession) {
    return <div className="min-h-screen w-full bg-slate-50" />;
  }

  return (
    <div className={`min-h-screen w-full bg-slate-50 flex items-center justify-center font-sans selection:bg-neutral-900 selection:text-white relative overflow-hidden ${currentUser ? "" : "p-4 sm:p-6 md:p-10"}`}>
      {/* Dynamic Blue & White Dot-Matrix Scanner Ambient Background */}
      <DotScannerBackground />

      <div className={`w-full relative z-10 ${currentUser ? "max-w-full h-screen" : "max-w-5xl"}`}>
        <AnimatePresence mode="wait">
          {!currentUser ? (
            <motion.div
              key="auth-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="w-full bg-white rounded-[2rem] shadow-xl border border-neutral-200/60 overflow-hidden grid grid-cols-1 md:grid-cols-2 min-h-[580px]"
            >
              {/* Left Column (Forms) */}
              <div className="p-8 sm:p-12 flex flex-col justify-between relative bg-white">
                {/* Header line inside form */}
                <div className="flex items-center justify-between mb-8">
                  {/* Brand logo */}
                  <span className="font-display font-black text-xl tracking-wider text-neutral-900 select-none">
                    HAZE.
                  </span>

                  {/* Language selection dropdown wrapper */}
                  <LanguageDropdown
                    currentLang={currentLang}
                    onLangChange={setCurrentLang}
                  />
                </div>

                {/* Actual Login/Form Content */}
                <div className="flex-1 flex flex-col justify-center my-auto">
                  <LoginForm onLoginSuccess={handleLoginSuccess} langCode={currentLang.code} />
                </div>
              </div>

              {/* Right Column (Impasto Art Landscape Illustration) */}
              <div className="hidden md:block border-l border-neutral-100">
                <LandscapePanel />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="dashboard-view"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <Dashboard user={currentUser} onLogout={handleLogout} currentLang={currentLang} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
