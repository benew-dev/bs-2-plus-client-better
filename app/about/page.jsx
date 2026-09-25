import { Suspense } from "react";
import AboutContent from "@/components/about/AboutContent";

// Skeleton de chargement
const AboutSkeleton = () => (
  <div className="animate-pulse max-w-6xl mx-auto p-6 space-y-8">
    <div className="text-center space-y-4">
      <div className="h-12 bg-gray-200 rounded w-2/3 mx-auto"></div>
      <div className="h-4 bg-gray-200 rounded w-4/5 mx-auto"></div>
      <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
    </div>
    <div className="grid md:grid-cols-3 gap-6">
      <div className="h-48 bg-gray-200 rounded"></div>
      <div className="h-48 bg-gray-200 rounded"></div>
      <div className="h-48 bg-gray-200 rounded"></div>
    </div>
    <div className="space-y-4">
      <div className="h-8 bg-gray-200 rounded w-1/2"></div>
      <div className="h-4 bg-gray-200 rounded w-full"></div>
      <div className="h-4 bg-gray-200 rounded w-5/6"></div>
    </div>
  </div>
);

export const metadata = {
  title: "À propos - Buy It Now",
  description:
    "Découvrez Buy It Now, votre boutique en ligne de confiance. Notre mission, nos valeurs et notre engagement envers vous.",
  openGraph: {
    title: "À propos de Buy It Now",
    description: "Découvrez notre histoire et nos valeurs.",
    type: "website",
  },
  keywords: [
    "à propos",
    "buy it now",
    "e-commerce",
    "shopping en ligne",
    "notre histoire",
    "nos valeurs",
  ],
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Suspense fallback={<AboutSkeleton />}>
        <AboutContent />
      </Suspense>
    </div>
  );
}
