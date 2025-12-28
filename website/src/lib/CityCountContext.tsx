'use client';

import { createContext, useContext, ReactNode } from 'react';

interface CityCountContextType {
  cityCount: number;
}

const CityCountContext = createContext<CityCountContextType>({ cityCount: 0 });

export function CityCountProvider({
  children,
  cityCount
}: {
  children: ReactNode;
  cityCount: number;
}) {
  return (
    <CityCountContext.Provider value={{ cityCount }}>
      {children}
    </CityCountContext.Provider>
  );
}

export function useCityCount(): number {
  const context = useContext(CityCountContext);
  return context.cityCount;
}

// Format city count for display (e.g., "50+" for round numbers)
export function formatCityCount(count: number): string {
  if (count === 0) return '50+'; // Fallback
  if (count >= 100) return `${Math.floor(count / 10) * 10}+`;
  if (count >= 10) return `${Math.floor(count / 5) * 5}+`;
  return `${count}`;
}
