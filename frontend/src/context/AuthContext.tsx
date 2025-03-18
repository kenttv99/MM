// frontend/src/contexts/AuthContext.tsx
"use client";

import React, { createContext, useState, useEffect, useContext } from "react";

interface AuthContextType {
  isAuth: boolean;
  setIsAuth: (auth: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuth, setIsAuth] = useState<boolean>(false);

  // Функция проверки авторизации через сервер
  const checkAuth = async () => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const response = await fetch("/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          setIsAuth(true); // Токен валиден, пользователь авторизован
        } else {
          localStorage.removeItem("token"); // Токен недействителен
          setIsAuth(false);
        }
      } catch (error) {
        console.error("Ошибка проверки авторизации:", error);
        setIsAuth(false);
      }
    } else {
      setIsAuth(false); // Токена нет
    }
  };

  // Проверка авторизации при монтировании и изменении localStorage
  useEffect(() => {
    checkAuth(); // Первоначальная проверка

    const handleStorageChange = () => checkAuth();
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuth, setIsAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};