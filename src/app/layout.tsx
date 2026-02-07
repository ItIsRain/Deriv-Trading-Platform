import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MantineProvider, ColorSchemeScript } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/charts/styles.css';
import './globals.css';
import { TrackingWrapper } from '@/components/TrackingWrapper';

export const metadata: Metadata = {
  title: 'LunarGraph | AI-Powered Fraud Detection',
  description: 'Real-time fraud detection and affiliate intelligence platform by Lunar Corporation',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-mantine-color-scheme="dark">
      <head>
        <ColorSchemeScript defaultColorScheme="dark" />
      </head>
      <body>
        <MantineProvider
          forceColorScheme="dark"
          theme={{
            primaryColor: 'red',
            colors: {
              red: [
                '#FFF0F1',
                '#FFD6D8',
                '#FFB3B7',
                '#FF8A90',
                '#FF6169',
                '#FF444F',
                '#E03E48',
                '#C13741',
                '#A2303A',
                '#832933',
              ],
            },
            fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
          }}
        >
          <Notifications position="top-right" />
          <Suspense fallback={null}>
            <TrackingWrapper>
              {children}
            </TrackingWrapper>
          </Suspense>
        </MantineProvider>
      </body>
    </html>
  );
}
