// frontend/src/hooks/useAdminAuthForm.ts
import { useState, useCallback } from "react";
// import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

interface FormValues {
  email: string;
  password: string;
}

interface AuthFormOptions {
  initialValues: FormValues;
  endpoint: string;
  redirectTo: string;
}

export const useAdminAuthForm = ({ initialValues, endpoint}: AuthFormOptions) => {
  const [formValues, setFormValues] = useState<FormValues>(initialValues);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  // const router = useRouter();
  const { checkAuth } = useAdminAuth();

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
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
        setIsSuccess(true);

        // Обновляем состояние авторизации в контексте
        await checkAuth();
        // Перенаправление теперь выполняется в AdminLoginPage через useEffect
      } catch (err) {
        setError(err instanceof Error ? err.message : "Произошла ошибка");
      } finally {
        setIsLoading(false);
      }
    },
    [formValues, endpoint, checkAuth]
  );

  return {
    formValues,
    error,
    isLoading,
    isSuccess,
    handleChange,
    handleSubmit,
  };
};