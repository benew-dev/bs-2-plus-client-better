"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";

const ConditionalFooter = () => {
  const pathname = usePathname();

  // Ne pas afficher le Footer sur la page d'accueil
  if (pathname === "/") {
    return null;
  }

  return <Footer />;
};

export default ConditionalFooter;
