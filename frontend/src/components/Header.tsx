"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Logo from "./Logo";
import Registration from "./Registration";
import Login from "./Login";
import { useRouter } from "next/navigation";

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuth, setIsAuth] = useState(false);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsAuth(!!token);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsAuth(false);
    router.push("/");
  };

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

        {/* Мобильное меню */}
        <div className="md:hidden">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-2xl focus:outline-none transition-transform hover:scale-110"
          >
            ☰
          </button>
          {isMobileMenuOpen && (
            <div className="absolute top-full left-0 w-full bg-white shadow-lg animate-slide-down">
              <ul className="flex flex-col items-center space-y-4 py-4">
                {isAuth ? (
                  <>
                    <li>
                      <Link
                        href="/auth/profile"
                        className="text-orange-500 hover:text-orange-600 transition-colors duration-200 px-4 py-2 rounded-lg hover:bg-orange-50"
                      >
                        Профиль
                      </Link>
                    </li>
                    <li>
                      <button className="text-orange-500 hover:text-orange-600 transition-colors duration-200 px-4 py-2 rounded-lg hover:bg-orange-50">
                        Уведомления
                      </button>
                    </li>
                    <li>
                      <Link
                        href="#"
                        className="text-orange-500 hover:text-orange-600 transition-colors duration-200 px-4 py-2 rounded-lg hover:bg-orange-50"
                      >
                        Стать партнером
                      </Link>
                    </li>
                    <li>
                      <button
                        onClick={handleLogout}
                        className="text-orange-500 hover:text-orange-600 transition-colors duration-200 px-4 py-2 rounded-lg hover:bg-orange-50"
                      >
                        Выход
                      </button>
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      <button
                        onClick={() => setIsRegistrationOpen(true)}
                        className="text-orange-500 hover:text-orange-600 transition-colors duration-200 px-4 py-2 rounded-lg hover:bg-orange-50"
                      >
                        Регистрация
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => setIsLoginOpen(true)}
                        className="text-orange-500 hover:text-orange-600 transition-colors duration-200 px-4 py-2 rounded-lg hover:bg-orange-50"
                      >
                        Войти
                      </button>
                    </li>
                  </>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Десктопная версия */}
        <div className="hidden md:flex items-center space-x-4">
          {isAuth ? (
            <>
              <Link
                href="/auth/profile"
                className="text-orange-500 hover:text-orange-600 transition-colors duration-200 px-4 py-2 rounded-lg hover:bg-orange-50"
              >
                Профиль
              </Link>
              <button className="text-orange-500 hover:text-orange-600 transition-colors duration-200 px-4 py-2 rounded-lg hover:bg-orange-50">
                Уведомления
              </button>
              <Link
                href="#"
                className="text-orange-500 hover:text-orange-600 transition-colors duration-200 px-4 py-2 rounded-lg hover:bg-orange-50"
              >
                Стать партнером
              </Link>
              <button
                onClick={handleLogout}
                className="text-orange-500 hover:text-orange-600 transition-colors duration-200 px-4 py-2 rounded-lg hover:bg-orange-50"
              >
                Выход
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsRegistrationOpen(true)}
                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 active:bg-orange-700 transition-all duration-200"
              >
                Регистрация
              </button>
              <button
                onClick={() => setIsLoginOpen(true)}
                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 active:bg-orange-700 transition-all duration-200"
              >
                Войти
              </button>
            </>
          )}
        </div>
      </div>

      <Registration isOpen={isRegistrationOpen} onClose={() => setIsRegistrationOpen(false)} />
      <Login isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </header>
  );
};

export default Header;