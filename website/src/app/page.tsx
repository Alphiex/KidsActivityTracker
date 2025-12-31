// Force dynamic rendering to avoid build-time API fetching
export const dynamic = 'force-dynamic';

import Hero from '@/components/Hero';
import Stats from '@/components/Stats';
import ActivityShowcase from '@/components/ActivityShowcase';
import AICapabilities from '@/components/AICapabilities';
import AppScreenshots from '@/components/AppScreenshots';
import Features from '@/components/Features';
import HowItWorks from '@/components/HowItWorks';
import CityGrid from '@/components/CityGrid';
import VendorCTA from '@/components/VendorCTA';
import { api, City } from '@/lib/api';
import { CityCountProvider } from '@/lib/CityCountContext';

interface CitiesData {
  cities: City[];
  totalCount: number;
}

async function getCitiesData(): Promise<CitiesData> {
  try {
    const response = await api.getCities();
    const activeCities = response.cities.filter((city) => city.isActive && city.activityCount > 0);

    // Randomly shuffle and pick 8 cities for display
    const shuffled = [...activeCities].sort(() => Math.random() - 0.5);
    const displayCities = shuffled.slice(0, 8);

    return {
      cities: displayCities,
      totalCount: activeCities.length,
    };
  } catch (error) {
    console.error('Failed to fetch cities:', error);
    return { cities: [], totalCount: 0 };
  }
}

export default async function Home() {
  const { cities, totalCount } = await getCitiesData();

  return (
    <CityCountProvider cityCount={totalCount}>
      <Hero />
      <Stats />
      <ActivityShowcase />
      <AICapabilities />
      <AppScreenshots />
      <Features />
      <HowItWorks />
      <CityGrid cities={cities} showViewAll={true} maxDisplay={8} />
      <VendorCTA />
    </CityCountProvider>
  );
}
