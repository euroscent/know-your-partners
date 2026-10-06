import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type Props = {
  urls: string[];
  alt: string;
  className?: string;
  /** Optional querystring suffix (e.g. cache-busting) appended to every URL */
  urlSuffix?: string;
  intervalMs?: number;
};

export function TaskImageRotator({
  urls,
  alt,
  className,
  urlSuffix,
  intervalMs = 10000,
}: Props) {
  const cleaned = useMemo(() => {
    const unique = Array.from(
      new Set(urls.filter((u): u is string => typeof u === "string" && u.trim().length > 0))
    );
    return unique;
  }, [urls]);

  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [cleaned.join("|")]);

  useEffect(() => {
    if (cleaned.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % cleaned.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [cleaned.length, intervalMs]);

  if (cleaned.length === 0) return null;

  const base = cleaned[index] ?? cleaned[0];
  const src = urlSuffix ? `${base}${base.includes("?") ? "&" : "?"}${urlSuffix}` : base;

  return (
    <AnimatePresence mode="wait">
      <motion.img
        key={src}
        src={src}
        alt={alt}
        className={className}
        loading="lazy"
        initial={{ opacity: 0, scale: 1.05 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.69 }}
        transition={{ duration: 2.5, ease: [0.4, 0, 0.2, 1] }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    </AnimatePresence>
  );
}
