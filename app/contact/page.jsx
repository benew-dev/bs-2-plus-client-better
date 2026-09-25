import { Suspense } from "react";
import PublicContact from "@/components/contact/PublicContact";

// Skeleton de chargement
const ContactSkeleton = () => (
  <div className="animate-pulse max-w-2xl mx-auto p-6 space-y-6">
    <div className="h-12 bg-gray-200 rounded w-2/3"></div>
    <div className="h-4 bg-gray-200 rounded w-full"></div>
    <div className="h-4 bg-gray-200 rounded w-5/6"></div>
    <div className="space-y-4 mt-8">
      <div className="h-12 bg-gray-200 rounded"></div>
      <div className="h-12 bg-gray-200 rounded"></div>
      <div className="h-12 bg-gray-200 rounded"></div>
      <div className="h-32 bg-gray-200 rounded"></div>
      <div className="h-12 bg-gray-200 rounded w-1/3"></div>
    </div>
  </div>
);

export const metadata = {
  title: "Contactez-nous - Buy It Now",
  description:
    "Une question ? Un problème ? Contactez notre équipe, nous sommes là pour vous aider.",
  openGraph: {
    title: "Contactez-nous - Buy It Now",
    description: "Besoin d'aide ? Contactez notre équipe support.",
    type: "website",
  },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Suspense fallback={<ContactSkeleton />}>
        <PublicContact />
      </Suspense>
    </div>
  );
}
