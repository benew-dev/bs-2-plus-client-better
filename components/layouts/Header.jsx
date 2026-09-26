"use client";

import {
  useContext,
  useEffect,
  useState,
  useCallback,
  memo,
  useRef,
} from "react";
import Link from "next/link";
import Image from "next/image";
import CartContext from "@/context/CartContext";
import AuthContext from "@/context/AuthContext";
import { signOut, useSession } from "@/lib/auth-client";
import { Menu, ShoppingCart, User, X, Heart } from "lucide-react";

// Constantes
const IS_PRODUCTION = process.env.NODE_ENV === "production";

// Liens de navigation
const NAV_LINKS = [
  { href: "/", label: "Accueil" },
  { href: "/shop", label: "Boutique" },
  { href: "/men", label: "Men" },
  { href: "/women", label: "Women" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "À propos" },
  { href: "/contact", label: "Contactez-nous" },
];

// ✅ Dropdown utilisateur avec gestion vérification
const UserDropdown = memo(({ user, handleSignOut }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const menuItems = [
    { href: "/me", label: "Mon profil" },
    { href: "/me/orders", label: "Mes commandes" },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 rounded-full hover:ring-2 hover:ring-blue-400 transition-all"
        aria-label="Menu utilisateur"
        aria-expanded={isOpen}
        title="Menu utilisateur"
      >
        <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-gray-200">
          <Image
            alt={`Photo de profil de ${user?.name || "utilisateur"}`}
            src={user?.image || "/images/default.png"}
            fill
            sizes="32px"
            className="object-cover"
            priority={false}
          />
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
          <div className="py-1">
            {menuItems.map((item, index) => (
              <Link
                key={`menu-item-${index}`}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50"
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={() => {
                setIsOpen(false);
                handleSignOut();
              }}
              className="block cursor-pointer w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              Déconnexion
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

UserDropdown.displayName = "UserDropdown";

const Header = () => {
  // ✅ user vient d'AuthContext (session + optimistic update fusionnés, cohérent avec ProductItem/ProductDetails)
  const { user } = useContext(AuthContext);
  // ✅ useSession gardé uniquement pour détecter la connexion et déclencher le chargement du panier
  const { data, isPending } = useSession();

  const { setCartToState, cartCount, clearCartOnLogout } =
    useContext(CartContext);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoadingCart, setIsLoadingCart] = useState(false);

  const signOutTimeoutRef = useRef(null);
  const isCartLoadingRef = useRef(false);

  // Cleanup des timeouts au démontage
  useEffect(() => {
    return () => {
      if (signOutTimeoutRef.current) clearTimeout(signOutTimeoutRef.current);
    };
  }, []);

  // Fonction loadCart optimisée avec debounce
  const loadCart = useCallback(async () => {
    if (isCartLoadingRef.current) return;

    try {
      isCartLoadingRef.current = true;
      setIsLoadingCart(true);
      await setCartToState();
    } catch (error) {
      if (!IS_PRODUCTION) {
        console.error("Error loading cart:", error);
      }
    } finally {
      setIsLoadingCart(false);
      isCartLoadingRef.current = false;
    }
  }, [setCartToState]);

  // ✅ Charger le panier dès qu'une session est présente
  // (isNewLogin retiré : ce champ n'existe pas côté Better Auth, c'était un reliquat NextAuth mort)
  useEffect(() => {
    let mounted = true;

    if (data && mounted) {
      try {
        loadCart();
      } catch (error) {
        console.error("Error loading user data:", error);
      }
    }

    return () => {
      mounted = false;
    };
  }, [data, loadCart]);

  // Fermer le menu mobile si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event) => {
      const mobileMenu = document.getElementById("mobile-menu");
      const menuButton = event.target.closest("[data-menu-toggle]");

      if (
        mobileMenu &&
        !mobileMenu.contains(event.target) &&
        !menuButton &&
        mobileMenuOpen
      ) {
        setMobileMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen) {
      const timer = setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleEscape);
      }, 100);

      return () => {
        clearTimeout(timer);
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleEscape);
      };
    }
  }, [mobileMenuOpen]);

  // ✅ handleSignOut avec la vraie signature Better Auth (fetchOptions.onSuccess)
  const handleSignOut = useCallback(async () => {
    try {
      clearCartOnLogout();

      await signOut({
        fetchOptions: {
          onSuccess: () => {
            window.location.href = "/login";
          },
        },
      });
    } catch (error) {
      if (!IS_PRODUCTION) {
        console.error("Erreur lors de la déconnexion:", error);
      }
      window.location.href = "/login";
    }
  }, [clearCartOnLogout]);

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  // Toggle menu mobile
  const toggleMobileMenu = (e) => {
    e.stopPropagation();
    setMobileMenuOpen(!mobileMenuOpen);
  };

  // Calculer le nombre de favoris
  const favoritesCount = user?.favorites?.length || 0;

  return (
    <header className="bg-white py-2 border-b sticky top-0 z-50 shadow-sm">
      <div className="container max-w-[1440px] mx-auto px-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="shrink-0 mr-5">
            <Link href="/" aria-label="Accueil Buy It Now">
              <Image
                priority={true}
                src="/images/logo.png"
                height={40}
                width={120}
                alt="BuyItNow"
                className="h-10 w-auto"
              />
            </Link>
          </div>

          {/* Navigation Desktop */}
          <nav className="hidden md:flex items-center justify-center space-x-6 flex-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-gray-700 hover:text-blue-600 transition-colors text-sm font-medium"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Icons Desktop + Mobile */}
          <div className="flex items-center gap-3">
            {/* Icône Favoris - visible uniquement si connecté */}
            {user && (
              <Link
                href="/favorites"
                className="relative p-2 text-gray-700 hover:text-pink-600 transition-colors"
                aria-label="Mes favoris"
                title="Accéder à mes favoris"
              >
                <Heart className="w-6 h-6" />
                {favoritesCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-pink-500 text-white rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center text-xs font-medium">
                    {favoritesCount}
                  </span>
                )}
              </Link>
            )}

            {/* Icône Panier */}
            <Link
              href="/cart"
              className="relative p-2 text-gray-700 hover:text-blue-600 transition-colors"
              aria-label="Panier"
              title="Accéder au panier"
            >
              <ShoppingCart className="w-6 h-6" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center text-xs font-medium">
                  {cartCount}
                </span>
              )}
            </Link>

            {/* Avatar User ou Icône User */}
            {user ? (
              <UserDropdown user={user} handleSignOut={handleSignOut} />
            ) : (
              <Link
                href="/login"
                className="p-2 text-gray-700 hover:text-blue-600 transition-colors"
                aria-label="Connexion"
                title="Se connecter"
              >
                <User className="w-6 h-6" />
              </Link>
            )}

            {/* Menu Hamburger Mobile */}
            <button
              onClick={toggleMobileMenu}
              data-menu-toggle
              className="md:hidden p-2 text-gray-700 hover:text-blue-600 transition-colors"
              aria-label={mobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu - Affiche uniquement les liens de navigation */}
        {mobileMenuOpen && (
          <div
            id="mobile-menu"
            className="md:hidden mt-4 border-t pt-4 pb-2"
            role="dialog"
            aria-modal="true"
            aria-label="Menu principal"
          >
            <nav className="space-y-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMobileMenu}
                  className="block px-4 py-3 text-gray-700 hover:bg-blue-50 rounded-md transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
