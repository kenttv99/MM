// frontend/src/hooks/useChangePasswordForm.ts
import { useState, useCallback, FormEvent, ChangeEvent } from "react";
// import { useRouter } from "next/navigation";
// import { useAuth } from "@/contexts/AuthContext";

interface FormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface ChangePasswordFormOptions {
  initialValues: FormValues;
  onSuccess?: () => void;
}

export const useChangePasswordForm = ({ initialValues, onSuccess }: ChangePasswordFormOptions) => {
  const [formValues, setFormValues] = useState<FormValues>(initialValues);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
//   const { logout } = useAuth();
//   const { push } = useRouter();

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError("");
      setIsLoading(true);

      // Проверка совпадения паролей
      if (formValues.newPassword !== formValues.confirmPassword) {
        setError("Новый пароль и подтверждение не совпадают");
        setIsLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem("token");
        const response = await fetch("/auth/change-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            current_password: formValues.currentPassword,
            new_password: formValues.newPassword,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || "Ошибка при смене пароля");
        }

        setIsSuccess(true);
        setTimeout(() => {
        //   logout();
        //   push("/login");
          if (onSuccess) onSuccess();
        }, 1500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Произошла ошибка");
        setIsSuccess(false);
      } finally {
        setIsLoading(false);
      }
    },
    [formValues, onSuccess]
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