import { Suspense } from "react";
import Profile from "@/components/auth/Profile";

// Force dynamic rendering
export const dynamic = "force-dynamic";

const ProfileSkeleton = () => (
  <div className="animate-pulse space-y-6" aria-busy="true" aria-live="polite">
    {/* Skeleton pour l'avatar et header */}
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="bg-gray-200 h-24"></div>
      <div className="px-6 pb-6">
        <div className="flex items-start justify-between -mt-12">
          <div className="w-24 h-24 bg-gray-300 rounded-full border-4 border-white"></div>
          <div className="w-8 h-8 bg-gray-200 rounded-full mt-4"></div>
        </div>
        <div className="mt-6 space-y-4">
          <div className="flex items-start space-x-3 p-3">
            <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-gray-200 rounded w-1/4"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          </div>
          <div className="flex items-start space-x-3 p-3">
            <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-gray-200 rounded w-1/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Skeleton pour l'adresse */}
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="h-5 bg-gray-200 rounded w-1/4"></div>
      </div>
      <div className="px-6 py-6">
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
        </div>
      </div>
    </div>

    <span className="sr-only">Chargement du profil...</span>
  </div>
);

export const metadata = {
  title: "Buy It Now - Mon Profil",
  description: "Gérez votre compte et vos informations personnelles",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ProfilePage() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <Profile />
    </Suspense>
  );
}
