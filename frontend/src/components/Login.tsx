// frontend/src/components/Login.tsx
"use client";

import React, { useState, FormEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { FaEnvelope, FaLock } from "react-icons/fa";
import AuthModal, { ModalButton } from "./common/AuthModal";
import InputField from "./common/InputField";
import { useAuth } from "@/contexts/AuthContext";

interface LoginProps {
  isOpen: boolean;
  onClose: () => void;
}

const Login: React.FC<LoginProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const { checkAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem("token", data.access_token);
        
        // Check auth state, this will update context and retrieve user data
        const authSuccess = await checkAuth();
        
        if (authSuccess) {
          // Dispatch global event for all components
          window.dispatchEvent(new Event("auth-change"));
          
          // Navigate to the home page after successful login
          onClose();
          router.push("/");
        } else {
          setError("Не удалось получить данные пользователя");
        }
      } else {
        const errorText = await response.text();
        let errorMessage = "Ошибка авторизации";
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.detail || errorMessage;
        } catch {
          console.error("Не удалось разобрать JSON ошибки:", errorText);
        }
        setError(errorMessage);
      }
    } catch (error) {
      setError("Произошла ошибка при попытке входа");
      console.error("Login error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value);
  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value);

  return (
    <AuthModal isOpen={isOpen} onClose={onClose} title="Вход" error={error}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <InputField
          type="email"
          value={email}
          onChange={handleEmailChange}
          placeholder="Введите email"
          icon={FaEnvelope}
          name="email"
        />
        
        <InputField
          type="password"
          value={password}
          onChange={handlePasswordChange}
          placeholder="Введите пароль"
          icon={FaLock}
          name="password"
        />

        <div className="flex justify-end space-x-4">
          <ModalButton 
            variant="secondary" 
            onClick={onClose}
            disabled={isLoading}
          >
            Закрыть
          </ModalButton>
          <ModalButton 
            type="submit" 
            variant="primary"
            disabled={isLoading}
          >
            {isLoading ? "Вход..." : "Войти"}
          </ModalButton>
        </div>
      </form>
    </AuthModal>
  );
};

export default Login;