'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export const ErrorBoundary = ({ children }: ErrorBoundaryProps) => {
  const [hasError, setHasError] = useState(false);
  const t = useTranslations('common');

  useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      console.error('Error caught by boundary:', error.error);
      setHasError(true);
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="border border-[#e6c9c4] bg-[#fcf2f0] p-6 text-center" role="alert">
        <h3 className="mb-2 font-bold text-[#812e35]">{t('loadingError')}</h3>
        <p className="mb-4 text-[#8a4b4d]">{t('loadingErrorDescription')}</p>
        <button
          onClick={() => window.location.reload()}
          className="bg-[#0E3B33] px-4 py-2 font-semibold text-white transition hover:bg-[#0A2F29]"
        >
          {t('retry')}
        </button>
      </div>
    );
  }

  return <>{children}</>;
};
