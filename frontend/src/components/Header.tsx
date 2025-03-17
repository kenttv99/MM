// frontend/src/components/Header.tsx
"use client";

import React, { useState, useEffect, ReactNode } from "react";
import Link from "next/link";
import Logo from "./Logo";
import Registration from "./Registration";
import Login from "./Login";
import { useRouter } from "next/navigation";

// NavLink Props
interface NavLinkProps {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
}

// NavLink component to reduce duplication
const NavLink: React.FC<NavLinkProps> = ({ href = "#", onClick, children }) => (
  <li>
    {href === "#" ? (
      <button 
        onClick={onClick}
        className="text-orange-500 hover:text-orange-600 transition-colors duration-200 px-4 py-2 rounded-lg hover:bg-orange-50"
      >
        {children}
      </button>
    ) : (
      <Link
        href={href}
        className="text-orange-500 hover:text-orange-600 transition-colors duration-200 px-4 py-2 rounded-lg hover:bg-orange-50"
      >
        {children}
      </Link>
    )}
  </li>
);

// AuthButton Props
interface AuthButtonProps {
  onClick: () => void;
  children: ReactNode;
}

// Auth button component to reduce duplication
const AuthButton: React.FC<AuthButtonProps> = ({ onClick, children }) => (
  <button
    onClick={onClick}
    className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 active:bg-orange-700 transition-all duration-200"
  >
    {children}
  </button>
);

// NavItem interface
interface NavItem {
  href?: string;
  label: string;
  onClick?: () => void;
}

const Header: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuth, setIsAuth] = useState(false);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const router = useRouter();

  // Check authentication on mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsAuth(!!token);
  }, []);

  // Scroll listener for header styling
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsAuth(false);
    router.push("/");
  };

  // Auth navigation items
  const authNavItems: NavItem[] = [
    { href: "/auth/profile", label: "Профиль" },
    { href: "#", label: "Уведомления", onClick: () => {} },
    { href: "/partner", label: "Стать партнером" },
    { href: "#", label: "Выход", onClick: handleLogout },
  ];

  // Non-auth navigation items
  const nonAuthNavItems: NavItem[] = [
    { label: "Регистрация", onClick: () => setIsRegistrationOpen(true) },
    { label: "Войти", onClick: () => setIsLoginOpen(true) },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out ${
        isScrolled ? "bg-white/95 backdrop-blur-sm shadow-lg py-3" : "bg-white/90 py-4"
      }`}
    >
      <div className="container mx-auto px-4 md:px-6 flex items-center justify-between">
        <Link href="/" className="transition-transform duration-300 hover:scale-105">
          <Logo />
        </Link>

        {/* Mobile menu button */}
        <div className="md:hidden">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-2xl focus:outline-none transition-transform hover:scale-110"
            aria-expanded={isMobileMenuOpen}
            aria-label="Toggle menu"
          >
            ☰
          </button>
          
          {/* Mobile menu dropdown */}
          {isMobileMenuOpen && (
            <div className="absolute top-full left-0 w-full bg-white shadow-lg animate-slide-down">
              <ul className="flex flex-col items-center space-y-4 py-4">
                {isAuth
                  ? authNavItems.map((item, index) => (
                      <NavLink 
                        key={index} 
                        href={item.href === "#" ? "#" : item.href} 
                        onClick={item.onClick}
                      >
                        {item.label}
                      </NavLink>
                    ))
                  : nonAuthNavItems.map((item, index) => (
                      <NavLink key={index} href="#" onClick={item.onClick}>
                        {item.label}
                      </NavLink>
                    ))
                }
              </ul>
            </div>
          )}
        </div>

        {/* Desktop navigation */}
        <div className="hidden md:flex items-center space-x-4">
          {isAuth
            ? authNavItems.map((item, index) => (
                <React.Fragment key={index}>
                  {item.href === "#" ? (
                    <button
                      onClick={item.onClick}
                      className="text-orange-500 hover:text-orange-600 transition-colors duration-200 px-4 py-2 rounded-lg hover:bg-orange-50"
                    >
                      {item.label}
                    </button>
                  ) : (
                    <Link
                      href={item.href || "/"}
                      className="text-orange-500 hover:text-orange-600 transition-colors duration-200 px-4 py-2 rounded-lg hover:bg-orange-50"
                    >
                      {item.label}
                    </Link>
                  )}
                </React.Fragment>
              ))
            : nonAuthNavItems.map((item, index) => (
                <AuthButton key={index} onClick={item.onClick || (() => {})}>
                  {item.label}
                </AuthButton>
              ))
          }
        </div>
      </div>

      {/* Modal components */}
      <Registration isOpen={isRegistrationOpen} onClose={() => setIsRegistrationOpen(false)} />
      <Login isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </header>
  );
};

export default Header;