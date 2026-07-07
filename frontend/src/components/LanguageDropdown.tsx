import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface Language {
  code: string;
  name: string;
  flag: string;
}

const LANGUAGES: Language[] = [
  { code: "ZH", name: "简体中文", flag: "🇨🇳" },
  { code: "EN", name: "English", flag: "🇬🇧" },
  { code: "JA", name: "日本語", flag: "🇯🇵" },
  { code: "ES", name: "Español", flag: "🇪🇸" },
];

interface LanguageDropdownProps {
  currentLang: Language;
  onLangChange: (lang: Language) => void;
}

export function LanguageDropdown({ currentLang, onLangChange }: LanguageDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef} id="lang-dropdown">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-xs hover:bg-accent focus:outline-hidden transition-colors cursor-pointer"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span>{currentLang.flag}</span>
        <span className="uppercase text-foreground tracking-wider font-semibold">{currentLang.code}</span>
        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 mt-2 w-40 z-50 origin-top-right rounded-2xl border border-border bg-popover p-1.5 shadow-lg ring-1 ring-black/5 focus:outline-hidden"
          >
            <div className="flex flex-col gap-0.5">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    onLangChange(lang);
                    setIsOpen(false);
                  }}
                  className={`flex items-center justify-between w-full rounded-xl px-2.5 py-2 text-left text-xs font-medium transition-colors cursor-pointer ${
                    currentLang.code === lang.code
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm leading-none">{lang.flag}</span>
                    <span>{lang.name}</span>
                  </div>
                  {currentLang.code === lang.code && (
                    <Check className="h-3.5 w-3.5 text-foreground stroke-[2.5]" />
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
