import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  className?: string;
  variant?: 'full' | 'icon-only';
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ 
  size = 'md', 
  showSubtitle = false,
  className = '',
  variant = 'full'
}) => {
  const dimensions = {
    sm: { box: 34, font: '1.25rem', subFont: '0.65rem', gap: '8px' },
    md: { box: 44, font: '1.55rem', subFont: '0.725rem', gap: '10px' },
    lg: { box: 58, font: '2.1rem', subFont: '0.825rem', gap: '14px' },
    xl: { box: 76, font: '2.6rem', subFont: '0.95rem', gap: '16px' }
  }[size];

  // SVG Unique gradient identifiers to avoid conflicts
  const idSuffix = React.useId().replace(/:/g, '');
  const leafGrad = `leaf-grad-${idSuffix}`;
  const ribbonGrad = `ribbon-grad-${idSuffix}`;
  const glowFilter = `glow-filter-${idSuffix}`;

  return (
    <div 
      className={`brand-logo-container ${className}`} 
      style={{ 
        display: 'inline-flex', 
        alignItems: 'center', 
        gap: dimensions.gap,
        userSelect: 'none'
      }}
    >
      {/* High-Fidelity Healthcare Leaf + Cross "P" Emblem */}
      <div style={{
        width: `${dimensions.box}px`,
        height: `${dimensions.box}px`,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
      }}>
        <svg 
          viewBox="0 0 100 100" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: '100%', height: '100%', overflow: 'visible' }}
        >
          <defs>
            {/* Organic Life Leaf Gradient */}
            <linearGradient id={leafGrad} x1="15%" y1="0%" x2="85%" y2="100%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="60%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>

            {/* Medical Shield Ribbon Gradient */}
            <linearGradient id={ribbonGrad} x1="0%" y1="20%" x2="100%" y2="80%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="45%" stopColor="#0284c7" />
              <stop offset="100%" stopColor="#1e40af" />
            </linearGradient>

            {/* Soft Ambient Clinical Glow */}
            <filter id={glowFilter} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#06b6d4" floodOpacity="0.28" />
            </filter>
          </defs>

          <g filter={`url(#${glowFilter})`}>
            {/* 1. Organic Health Leaf (Top-Left Crown of the 'P') */}
            <path
              d="M48 10 C32 12, 22 24, 23 42 C28 35, 36 31, 48 30 C49 22, 49 14, 48 10 Z"
              fill={`url(#${leafGrad})`}
            />
            {/* Leaf Vein Subtle Accent */}
            <path
              d="M26 38 C32 34, 38 31, 46 29"
              stroke="#ffffff"
              strokeWidth="1.8"
              strokeOpacity="0.55"
              strokeLinecap="round"
            />

            {/* 2. Stylized Medical 'P' Ribbon Loop */}
            <path
              d="M32 32 L32 86 C32 88.2, 33.8 90, 36 90 C38.2 90, 40 88.2, 40 86 L40 58 C45 58, 76 58, 76 34 C76 14, 44 14, 32 32 Z"
              fill={`url(#${ribbonGrad})`}
            />

            {/* 3. Inner Loop Hollow with Medical Plus Symbol */}
            <circle cx="56" cy="36" r="14" fill="#0b1728" />
            
            {/* Glowing Accent Ring inside Loop */}
            <circle cx="56" cy="36" r="13" stroke="#06b6d4" strokeWidth="1.2" strokeOpacity="0.4" />

            {/* Precision Clinical Cross (+) */}
            <path
              d="M56 28 L56 44 M48 36 L64 36"
              stroke="#ffffff"
              strokeWidth="3.6"
              strokeLinecap="round"
            />

            {/* Spark of Vitality / Innovation Node */}
            <circle cx="73" cy="24" r="3.5" fill="#34d399" />
          </g>
        </svg>
      </div>

      {/* Brand Name Typography */}
      {variant === 'full' && (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{
            fontSize: dimensions.font,
            fontWeight: 800,
            letterSpacing: '-0.035em',
            lineHeight: 1.05,
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'baseline'
          }}>
            <span>prax</span>
            <span style={{ 
              color: '#06b6d4', 
              textShadow: '0 0 10px rgba(6, 182, 212, 0.45)',
              fontWeight: 900
            }}>
              i
            </span>
            <span style={{
              background: 'linear-gradient(135deg, #06b6d4 0%, #0284c7 50%, #10b981 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              rence
            </span>
          </div>

          {showSubtitle && (
            <div style={{
              fontSize: dimensions.subFont,
              fontWeight: 600,
              color: 'var(--text-muted)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginTop: '3px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#10b981' }} />
              <span>Clinical AI & Telehealth</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
