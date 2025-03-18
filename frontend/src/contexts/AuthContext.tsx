"use client";

import React, { createContext, useState, useEffect, useContext } from "react";

interface AuthContextType {
  isAuth: boolean;
  setIsAuth: (auth: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuth, setIsAuth] = useState<boolean>(false);

  const checkAuth = async () => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const response = await fetch("http://localhost:8000/auth/me", { // Полный URL
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          setIsAuth(true);
        } else {
          localStorage.removeItem("token"); // Удаляем токен при явной ошибке авторизации
          setIsAuth(false);
        }
      } catch (error) {
        console.error("Ошибка проверки авторизации:", error);
        setIsAuth(false); // Сеть недоступна
      }
    } else {
      setIsAuth(false);
    }
  };

  useEffect(() => {
    checkAuth(); // Проверка при монтировании

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "token") { // Реагируем только на изменения token
        checkAuth();
      }
    };
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