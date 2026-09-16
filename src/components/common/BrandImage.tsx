import { BRANDING } from '../../config/branding';

interface BrandImageProps {
  orientation: 'horizontal' | 'vertical';
  className?: string;
}

export function BrandImage({ orientation, className = '' }: BrandImageProps): React.JSX.Element {
  return (
    <img
      src={
        orientation === 'horizontal'
          ? BRANDING.horizontalBrandPath
          : BRANDING.verticalBrandPath
      }
      alt={BRANDING.brandAlt}
      className={`block h-auto max-w-full object-contain ${className}`}
    />
  );
}
