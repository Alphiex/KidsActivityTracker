import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Kids Activity Tracker - Find Kids Activities in Canada",
  description: "Discover swimming, sports, arts, music, and educational activities for kids across Canada. Track schedules, find new programs in Vancouver, Toronto, Calgary, and 50+ Canadian cities. Made in Canada.",
  keywords: "kids activities Canada, children activities, swimming lessons, sports for kids, art classes, music lessons, after school programs, Vancouver kids activities, Toronto kids activities, Canadian families",
  openGraph: {
    title: "Kids Activity Tracker - Made in Canada",
    description: "Find the perfect activities for your children across 50+ Canadian cities",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased min-h-screen flex flex-col`}>
        <Header />
        <main className="flex-grow">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
