import React, { useState } from 'react';
import { Layers } from 'lucide-react';
import { resolveAssetUrl } from '../utils/assetUrl';

interface SafeImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  className = '',
  fallbackLabel,
}) => {
  const [failed, setFailed] = useState(false);

  const resolved = resolveAssetUrl(src);

  if (!resolved || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#10264B] via-[#0B1D3D] to-[#06142E] text-slate-300 p-4 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <Layers className="w-7 h-7 text-[#35AFFF] mb-1.5 opacity-80" aria-hidden="true" />
        <span className="text-xs font-medium text-[#FFD369] line-clamp-2">
          {fallbackLabel || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={resolved}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
