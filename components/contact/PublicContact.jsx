"use client";

import { useState, useRef, useEffect, useContext } from "react";
import { toast } from "react-toastify";
import { Mail, Send, User, MessageSquare } from "lucide-react";
import AuthContext from "@/context/AuthContext";

const PublicContact = () => {
  // Contexte d'authentification
  const { sendEmail, error, clearErrors } = useContext(AuthContext);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSuccess, setIsSuccess] = useState(false);

  const nameRef = useRef(null);

  useEffect(() => {
    if (nameRef.current) {
      nameRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (error) {
      toast.error(error);
      clearErrors();
    }
  }, [error, clearErrors]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Effacer l'erreur du champ modifié
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Le nom est requis";
    } else if (formData.name.length < 2) {
      newErrors.name = "Le nom doit contenir au moins 2 caractères";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      newErrors.email = "L'email est requis";
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = "Email invalide";
    }

    if (!formData.subject.trim()) {
      newErrors.subject = "Le sujet est requis";
    } else if (formData.subject.length < 5) {
      newErrors.subject = "Le sujet doit contenir au moins 5 caractères";
    }

    if (!formData.message.trim()) {
      newErrors.message = "Le message est requis";
    } else if (formData.message.length < 20) {
      newErrors.message = "Le message doit contenir au moins 20 caractères";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Veuillez corriger les erreurs du formulaire");
      return;
    }

    setIsSubmitting(true);

    try {
      // Utiliser la méthode sendEmail du contexte
      const result = await sendEmail({
        name: formData.name,
        email: formData.email,
        subject: formData.subject,
        message: formData.message,
      });

      if (result && result.success) {
        setIsSuccess(true);
        setFormData({
          name: "",
          email: "",
          subject: "",
          message: "",
        });
      } else {
        // L'erreur est déjà affichée par le contexte via setError
        // toast.error déjà appelé dans sendEmail si nécessaire
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Impossible d'envoyer le message. Veuillez réessayer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
          Contactez-nous
        </h1>
        <p className="text-lg text-gray-600 max-w-xl mx-auto">
          Une question ? Un problème ? Notre équipe est là pour vous aider.
          Remplissez le formulaire ci-dessous et nous vous répondrons
          rapidement.
        </p>
      </div>

      {/* Formulaire */}
      <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Nom */}
          <div>
            <label
              htmlFor="name"
              className="flex items-center text-sm font-semibold text-gray-700 mb-2"
            >
              <User className="w-4 h-4 mr-2 text-blue-600" />
              Nom complet
            </label>
            <input
              ref={nameRef}
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={`w-full px-4 py-3 border ${
                errors.name ? "border-red-500" : "border-gray-300"
              } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
              placeholder="Jean Dupont"
              maxLength={50}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="flex items-center text-sm font-semibold text-gray-700 mb-2"
            >
              <Mail className="w-4 h-4 mr-2 text-blue-600" />
              Adresse email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={`w-full px-4 py-3 border ${
                errors.email ? "border-red-500" : "border-gray-300"
              } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
              placeholder="jean.dupont@example.com"
              maxLength={100}
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email}</p>
            )}
          </div>

          {/* Sujet */}
          <div>
            <label
              htmlFor="subject"
              className="flex items-center text-sm font-semibold text-gray-700 mb-2"
            >
              <MessageSquare className="w-4 h-4 mr-2 text-blue-600" />
              Sujet
            </label>
            <input
              type="text"
              id="subject"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              className={`w-full px-4 py-3 border ${
                errors.subject ? "border-red-500" : "border-gray-300"
              } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
              placeholder="De quoi souhaitez-vous parler ?"
              maxLength={100}
            />
            {errors.subject && (
              <p className="mt-1 text-sm text-red-600">{errors.subject}</p>
            )}
          </div>

          {/* Message */}
          <div>
            <label
              htmlFor="message"
              className="flex items-center text-sm font-semibold text-gray-700 mb-2"
            >
              <Send className="w-4 h-4 mr-2 text-blue-600" />
              Message
            </label>
            <textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleChange}
              rows="6"
              className={`w-full px-4 py-3 border ${
                errors.message ? "border-red-500" : "border-gray-300"
              } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none`}
              placeholder="Décrivez votre demande en détail..."
              maxLength={1000}
            />
            <div className="flex justify-between items-center mt-1">
              {errors.message && (
                <p className="text-sm text-red-600">{errors.message}</p>
              )}
              <span
                className={`text-xs ml-auto ${
                  formData.message.length > 900
                    ? "text-orange-500"
                    : "text-gray-500"
                }`}
              >
                {formData.message.length}/1000
              </span>
            </div>
          </div>

          {/* Bouton */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Envoi en cours...
              </>
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" />
                Envoyer le message
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PublicContact;
