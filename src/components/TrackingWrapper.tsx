'use client';

import { Suspense } from 'react';
import { TrackingProvider } from './TrackingProvider';

interface TrackingWrapperProps {
  children: React.ReactNode;
}

// Wrapper component to handle Suspense boundary for TrackingProvider
export function TrackingWrapper({ children }: TrackingWrapperProps) {
  return (
    <Suspense fallback={null}>
      <TrackingProvider>
        {children}
      </TrackingProvider>
    </Suspense>
  );
}

export default TrackingWrapper;
