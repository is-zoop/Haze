import { useEffect, useState, type ReactNode } from "react";
import { loadCapabilityIconBlob } from "@/lib/capabilities";

interface CapabilityIconProps {
  src?: string | null;
  version?: string;
  alt: string;
  className: string;
  fallback: ReactNode;
}

export function CapabilityIcon({ src, version, alt, className, fallback }: CapabilityIconProps) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setResolvedSrc(null);
    if (!src) return () => { active = false; };

    loadCapabilityIconBlob(src, version)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setResolvedSrc(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch(() => {
        if (active) setResolvedSrc(null);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, version]);

  if (!resolvedSrc) return <>{fallback}</>;
  return <img src={resolvedSrc} alt={alt} className={className} onError={() => setResolvedSrc(null)} />;
}