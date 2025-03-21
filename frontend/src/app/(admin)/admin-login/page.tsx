"use client";
import { useState, ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";
import InputField from "@/components/common/InputField";
import { ModalButton } from "@/components/common/AuthModal"; // Используем только кнопку из AuthModal
import { FaEnvelope, FaLock } from "react-icons/fa";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const response = await fetch("/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) throw new Error("Неверный логин или пароль");
      const { access_token } = await response.json();
      localStorage.setItem("admin_token", access_token);
      router.push("/admin-profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-gray-900 tracking-tight">
          Вход для администраторов
        </h1>
        <form onSubmit={handleSubmit}>
          <InputField
            type="email"
            value={email}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            placeholder="Email"
            icon={FaEnvelope}
            required
          />
          <InputField
            type="password"
            value={password}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            placeholder="Пароль"
            icon={FaLock}
            required
          />
          {error && (
            <div className="text-red-500 bg-red-50 p-3 rounded-lg border-l-4 border-red-500 text-sm mb-6">
              {error}
            </div>
          )}
          <ModalButton type="submit">Войти</ModalButton>
        </form>
      </div>
    </div>
  );
}