"use client";

import { useState } from "react";
import {
  ShoppingBag,
  Target,
  Heart,
  Shield,
  Zap,
  Award,
  TrendingUp,
} from "lucide-react";

const AboutContent = () => {
  const [activeTab, setActiveTab] = useState("mission");

  const values = [
    {
      icon: <Heart className="w-8 h-8" />,
      title: "Satisfaction Client",
      description:
        "Votre satisfaction est notre priorité absolue. Nous mettons tout en œuvre pour vous offrir une expérience d'achat exceptionnelle.",
      color: "from-red-500 to-pink-500",
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Sécurité",
      description:
        "Vos données sont protégées avec les dernières technologies de sécurité. Achetez en toute confiance.",
      color: "from-blue-500 to-cyan-500",
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: "Rapidité",
      description:
        "Livraison express et service client réactif. Nous valorisons votre temps autant que vous.",
      color: "from-yellow-500 to-orange-500",
    },
    {
      icon: <Award className="w-8 h-8" />,
      title: "Qualité",
      description:
        "Nous sélectionnons rigoureusement nos produits pour vous garantir la meilleure qualité au meilleur prix.",
      color: "from-purple-500 to-indigo-500",
    },
  ];

  const milestones = [
    {
      year: "2020",
      title: "Création",
      description:
        "Lancement de Buy It Now avec une vision claire : simplifier le shopping en ligne.",
    },
    {
      year: "2021",
      title: "Expansion",
      description: "Ouverture de notre catalogue à plus de 10,000 produits.",
    },
    {
      year: "2023",
      title: "Innovation",
      description:
        "Lancement de notre application mobile et amélioration de l'expérience utilisateur.",
    },
    {
      year: "2025",
      title: "Leadership",
      description:
        "Reconnaissance comme l'une des plateformes e-commerce les plus innovantes.",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <h1 className="text-5xl md:text-6xl font-bold text-gray-800 mb-6">
          À propos de{" "}
          <span className="bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Buy It Now
          </span>
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
          Nous sommes bien plus qu'une simple boutique en ligne. Nous sommes
          votre partenaire de confiance pour une expérience shopping
          exceptionnelle, alliant qualité, rapidité et sécurité.
        </p>
      </div>

      {/* Tabs Section */}
      <div className="bg-white rounded-2xl shadow-xl p-8 mb-16">
        <div className="flex flex-wrap justify-center gap-4 mb-8">
          <button
            onClick={() => setActiveTab("mission")}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === "mission"
                ? "bg-blue-600 text-white shadow-lg"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <Target className="w-5 h-5 inline mr-2" />
            Notre Mission
          </button>
          <button
            onClick={() => setActiveTab("histoire")}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === "histoire"
                ? "bg-blue-600 text-white shadow-lg"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <TrendingUp className="w-5 h-5 inline mr-2" />
            Notre Histoire
          </button>
        </div>

        <div className="prose prose-lg max-w-none">
          {activeTab === "mission" && (
            <div className="space-y-6">
              <h2 className="text-3xl font-bold text-gray-800 mb-4">
                Notre Mission
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Chez Buy It Now, notre mission est de révolutionner l'expérience
                du shopping en ligne en rendant l'achat de produits de qualité
                simple, rapide et accessible à tous. Nous croyons que chacun
                mérite d'avoir accès à des produits exceptionnels sans
                compromettre la qualité ou la sécurité.
              </p>
              <p className="text-gray-600 leading-relaxed">
                Nous nous engageons à offrir une plateforme innovante où la
                satisfaction client est au cœur de tout ce que nous faisons.
                Chaque jour, nous travaillons pour améliorer votre expérience et
                dépasser vos attentes.
              </p>
            </div>
          )}

          {activeTab === "histoire" && (
            <div className="space-y-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-6">
                Notre Histoire
              </h2>
              <p className="text-gray-600 leading-relaxed mb-8">
                Depuis nos débuts en 2020, Buy It Now n'a cessé d'évoluer pour
                devenir l'une des plateformes e-commerce les plus fiables et
                innovantes du marché.
              </p>
              <div className="space-y-6">
                {milestones.map((milestone, index) => (
                  <div key={index} className="flex items-start space-x-4">
                    <div className="shrink-0">
                      <div className="w-16 h-16 bg-linear-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                        {milestone.year}
                      </div>
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-lg p-4">
                      <h3 className="text-xl font-bold text-gray-800 mb-2">
                        {milestone.title}
                      </h3>
                      <p className="text-gray-600">{milestone.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Values Section */}
      <div className="mb-16">
        <h2 className="text-4xl font-bold text-center text-gray-800 mb-12">
          Nos Valeurs
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {values.map((value, index) => (
            <div
              key={index}
              className="bg-white rounded-xl shadow-lg p-6 hover:shadow-2xl transition-all hover:-translate-y-2 duration-300"
            >
              <div
                className={`w-16 h-16 bg-linear-to-br ${value.color} rounded-full flex items-center justify-center text-white mb-4 shadow-lg`}
              >
                {value.icon}
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">
                {value.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {value.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-linear-to-r from-blue-600 to-purple-600 rounded-2xl shadow-2xl p-8 md:p-12 text-center text-white">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          Prêt à commencer ?
        </h2>
        <p className="text-lg mb-8 opacity-90">
          Rejoignez des milliers de clients satisfaits et découvrez une nouvelle
          façon de faire du shopping en ligne.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="/shop"
            className="px-8 py-4 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors inline-flex items-center justify-center"
          >
            <ShoppingBag className="w-5 h-5 mr-2" />
            Parcourir la boutique
          </a>
          <a
            href="/contact"
            className="px-8 py-4 bg-transparent border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-blue-600 transition-colors inline-flex items-center justify-center"
          >
            Contactez-nous
          </a>
        </div>
      </div>
    </div>
  );
};

export default AboutContent;
