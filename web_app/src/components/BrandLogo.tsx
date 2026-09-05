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
      {/* High-Fidelity Healthcare Praxirence Logo Emblem */}
      <div style={{
        width: `${dimensions.box}px`,
        height: `${dimensions.box}px`,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        borderRadius: '24%',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(13, 148, 136, 0.2)'
      }}>
        <img 
          src="/logo.png" 
          alt="Praxirence Logo" 
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
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
