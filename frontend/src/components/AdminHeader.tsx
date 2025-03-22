// frontend/src/components/AdminHeader.tsx
"use client";

import React, { useState, useEffect, useContext } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "./Logo";
import { AdminAuthContext } from "@/contexts/AdminAuthContext";
import { FaTachometerAlt, FaSignOutAlt, FaBars, FaTimes, FaUser } from "react-icons/fa";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const AdminHeader: React.FC = () => {
  // Безопасно получаем контекст админа
  const adminAuthContext = useContext(AdminAuthContext);
  const isAdminAuth = adminAuthContext?.isAdminAuth || false;
  const adminData = adminAuthContext?.adminData || null;
  const logoutAdmin = adminAuthContext?.logoutAdmin || (() => {
    localStorage.removeItem('admin_token');
    window.location.href = '/admin-login';
  });

  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = () => {
    logoutAdmin();
    router.push("/admin-login");
  };

  const toggleMobileMenu = () => setIsMobileMenuOpen((prev) => !prev);

  const adminNavItems: NavItem[] = [
    { href: "/admin-profile", label: "Профиль", icon: FaUser },
    { href: "/dashboard", label: "Панель управления", icon: FaTachometerAlt }
  ];

  const menuVariants = {
    closed: { opacity: 0, y: -20 },
    open: { opacity: 1, y: 0 },
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-30 transition-all duration-300 ${
        isScrolled ? "bg-white/95 backdrop-blur-sm shadow-lg py-3" : "bg-white/90 py-4"
      }`}
    >
      <div className="container mx-auto px-4 md:px-6 flex items-center justify-between">
        <Link href="/admin-profile" className="transition-transform duration-300 hover:scale-105 flex items-center">
          <Logo />
          <span className="ml-2 text-orange-500 font-semibold">Админ-панель</span>
        </Link>

        {/* Мобильное меню */}
        <div className="flex items-center md:hidden">
          {isAdminAuth && (
            <Link href="/admin-profile" className="mr-4 text-blue-500 hover:text-blue-600">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <FaUser className="h-4 w-4" />
              </div>
            </Link>
          )}
          <button onClick={toggleMobileMenu} className="text-gray-700 hover:text-blue-500">
            {isMobileMenuOpen ? <FaTimes className="h-6 w-6" /> : <FaBars className="h-6 w-6" />}
          </button>
          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div
                className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <button 
                  onClick={toggleMobileMenu}
                  className="absolute top-4 right-4 text-gray-500 hover:text-blue-500"
                >
                  <FaTimes className="h-8 w-8" />
                </button>
                <motion.ul
                  className="flex flex-col items-center space-y-6 text-xl"
                  variants={menuVariants}
                  initial="closed"
                  animate="open"
                  exit="closed"
                >
                  {adminNavItems.map((item, index) => (
                    <motion.li key={index} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Link 
                        href={item.href} 
                        className="text-gray-800 hover:text-blue-500 flex items-center"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <item.icon className="mr-2" />
                        {item.label}
                      </Link>
                    </motion.li>
                  ))}
                  <motion.li whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <button
                      onClick={() => {
                        handleLogout();
                        setIsMobileMenuOpen(false);
                      }}
                      className="text-gray-800 hover:text-blue-500 flex items-center"
                    >
                      <FaSignOutAlt className="mr-2" />
                      Выйти
                    </button>
                  </motion.li>
                </motion.ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Десктопная навигация */}
        <div className="hidden md:flex items-center space-x-4">
          {isAdminAuth ? (
            <>
              <nav className="mr-4">
                <ul className="flex space-x-6">
                  {adminNavItems.map((item, index) => (
                    <li key={index}>
                      <Link 
                        href={item.href} 
                        className="text-gray-600 hover:text-blue-500 flex items-center"
                      >
                        <item.icon className="mr-2" />
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              
              {adminData && (
                <div className="flex items-center mr-4 text-gray-600">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-2">
                    <FaUser className="h-4 w-4 text-blue-500" />
                  </div>
                  <span className="text-sm font-medium truncate max-w-[120px]">{adminData.fio}</span>
                </div>
              )}
              
              <button 
                onClick={handleLogout} 
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all duration-300 flex items-center"
              >
                <FaSignOutAlt className="mr-2" />
                Выйти
              </button>
            </>
          ) : (
            <Link
              href="/admin-login"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all duration-300"
            >
              Войти
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;