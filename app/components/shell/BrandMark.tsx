/** Three script lines; the Bluebell one is the private cue. */
export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden="true" className="brand-mark">
      <rect width="26" height="26" rx="7" fill="#070600" />
      <rect x="6" y="7.5" width="14" height="2.4" rx="1.2" fill="#fce4d8" />
      <rect x="6" y="11.8" width="10" height="2.4" rx="1.2" fill="#279af1" />
      <rect x="6" y="16.1" width="7" height="2.4" rx="1.2" fill="#fce4d8" opacity="0.55" />
    </svg>
  );
}
