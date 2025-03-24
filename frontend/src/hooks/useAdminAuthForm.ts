// frontend/src/hooks/useAdminAuthForm.ts
import { useState, useCallback, FormEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

interface FormValues {
  email: string;
  password: string;
  [key: string]: string;
}

interface AuthFormOptions {
  initialValues: FormValues;
  endpoint: string;
  redirectTo: string;
}

export const useAdminAuthForm = ({ initialValues, endpoint, redirectTo }: AuthFormOptions) => {
  const [formValues, setFormValues] = useState<FormValues>(initialValues);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { checkAuth } = useAdminAuth();
  const { push } = useRouter();

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormValues(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formValues),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Ошибка авторизации");
      }

      const data = await response.json();
      console.log("Server response on /admin/login:", data);

      // Сохраняем токен
      localStorage.setItem("admin_token", data.access_token);
      // Сохраняем данные администратора
      const adminData = {
        email: data.email,
        id: data.id,
        fio: data.fio,
      };
      console.log("Saving to localStorage:", adminData);
      localStorage.setItem("admin_data", JSON.stringify(adminData));
      setIsSuccess(true);

      // Обновляем контекст
      await checkAuth();
      // Перенаправляем после успешной авторизации
      push(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Произошла ошибка");
    } finally {
      setIsLoading(false);
    }
  }, [formValues, endpoint, checkAuth, redirectTo, push]);

  return {
    formValues,
    error,
    isLoading,
    isSuccess,
    handleChange,
    handleSubmit,
  };
};