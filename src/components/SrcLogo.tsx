import React, { memo } from 'react';

// A custom pure SVG SRC logo reproduction with the signature shopping bag
export const SrcLogo = memo(({ className = "h-12", whiteVariant = false }: { className?: string; whiteVariant?: boolean }) => {
  const primaryColor = whiteVariant ? "#FFFFFF" : "#E11516";
  const bgFill = whiteVariant ? "none" : "#FFFFFF";
  
  return (
    <svg 
      viewBox="0 0 250 100" 
      className={className} 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id="bag-body-clip">
          <rect x="30" y="32" width="50" height="50" rx="4" />
        </clipPath>
        
        <mask id="bag-mask-white">
          <rect x="30" y="32" width="50" height="50" fill="white" rx="4" />
          <g stroke="black" strokeWidth="6" strokeLinecap="round">
            <line x1="20" y1="52" x2="52" y2="20" />
            <line x1="20" y1="72" x2="72" y2="20" />
            <line x1="20" y1="92" x2="92" y2="20" />
            <line x1="40" y1="92" x2="92" y2="40" />
            <line x1="60" y1="92" x2="92" y2="60" />
          </g>
        </mask>
      </defs>

      {/* Background white card if not whiteVariant */}
      {bgFill !== "none" && (
        <rect x="4" y="4" width="242" height="92" rx="16" fill={bgFill} />
      )}
      
      {/* Yellow borders with gaps on left and right */}
      <path 
        d="M 8 40 L 8 18 C 8 10 14 8 22 8 L 228 8 C 236 8 242 10 242 18 L 242 40" 
        stroke="#F2C900" 
        strokeWidth="7" 
        strokeLinecap="round" 
      />
      <path 
        d="M 8 60 L 8 82 C 8 90 14 92 22 92 L 228 92 C 236 92 242 90 242 82 L 242 60" 
        stroke="#F2C900" 
        strokeWidth="7" 
        strokeLinecap="round" 
      />
      
      {/* Bag Handle */}
      <path 
        d="M 41 33 L 41 26 C 41 22 45 20 49 20 L 61 20 C 65 20 69 22 69 26 L 69 33" 
        stroke={primaryColor} 
        strokeWidth="6" 
        strokeLinecap="round"
        strokeLinejoin="round" 
      />
      
      {/* Bag Body */}
      {whiteVariant ? (
        <rect x="30" y="32" width="50" height="50" rx="4" fill="white" mask="url(#bag-mask-white)" />
      ) : (
        <g clipPath="url(#bag-body-clip)">
          <rect x="30" y="32" width="50" height="50" fill="#E11516" />
          {/* White diagonal stripes */}
          <line x1="20" y1="52" x2="52" y2="20" stroke="white" strokeWidth="6" />
          <line x1="20" y1="72" x2="72" y2="20" stroke="white" strokeWidth="6" />
          <line x1="20" y1="92" x2="92" y2="20" stroke="white" strokeWidth="6" />
          <line x1="40" y1="92" x2="92" y2="40" stroke="white" strokeWidth="6" />
          <line x1="60" y1="92" x2="92" y2="60" stroke="white" strokeWidth="6" />
        </g>
      )}
      
      {/* SRC Text */}
      <text 
        x="92" 
        y="75" 
        fill={primaryColor} 
        fontFamily="system-ui, -apple-system, sans-serif" 
        fontWeight="900" 
        fontSize="62"
        letterSpacing="-2"
      >
        SRC
      </text>
    </svg>
  );
});

export default SrcLogo;
