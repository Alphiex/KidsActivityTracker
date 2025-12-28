import Hero from '@/components/Hero';
import Stats from '@/components/Stats';
import ActivityShowcase from '@/components/ActivityShowcase';
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
    const activeCities = response.cities.filter((city) => city.isActive);
    // Sort by activity count and return top 8 for display
    const displayCities = activeCities
      .sort((a, b) => b.activityCount - a.activityCount)
      .slice(0, 8);
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
      <AppScreenshots />
      <Features />
      <HowItWorks />
      <CityGrid cities={cities} showViewAll={true} maxDisplay={8} />
      <VendorCTA />
    </CityCountProvider>
  );
}
