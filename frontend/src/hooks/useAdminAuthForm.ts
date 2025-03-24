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
      localStorage.setItem("admin_token", data.access_token);
      const adminData = {
        email: data.email,
        id: data.id,
        fio: data.fio || "Администратор",
      };
      localStorage.setItem("admin_data", JSON.stringify(adminData));
      setIsSuccess(true);

      const isAuthenticated = await checkAuth();
      if (isAuthenticated) {
        push(redirectTo);
      } else {
        setError("Не удалось подтвердить авторизацию после входа");
        setIsSuccess(false);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "Произошла ошибка");
      setIsSuccess(false);
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