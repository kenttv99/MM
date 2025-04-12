// frontend/src/hooks/useAdminAuthForm.ts
"use client";

import { useState, useCallback, FormEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminFormValues, AdminAuthFormOptions } from "@/types/index";
import { apiFetch } from "@/utils/api";
import { ApiAbortedResponse, ApiErrorResponse } from '@/types/api';

export interface AdminAuthResponse {
  access_token: string;
  email: string;
  id: number;
  fio?: string;
}

export const useAdminAuthForm = ({ initialValues, endpoint, redirectTo }: AdminAuthFormOptions) => {
  const [formValues, setFormValues] = useState<AdminFormValues>(initialValues);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { push } = useRouter();
  const { checkAuth } = useAdminAuth();

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setFormValues((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }, []);

  const handleSubmit = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await apiFetch<AdminAuthResponse>(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        data: JSON.stringify(formValues),
        bypassLoadingStageCheck: true,
      });
      
      if ('aborted' in response) {
        const abortedResponse = response as unknown as ApiAbortedResponse;
        throw new Error(abortedResponse.reason || "Запрос был прерван");
      }
      
      if ('error' in response) {
        const errorResponse = response as unknown as ApiErrorResponse;
        const errorMessage = typeof errorResponse.error === 'string' ? errorResponse.error : "Ошибка авторизации";
        throw new Error(errorMessage);
      }

      localStorage.setItem("admin_token", response.access_token);
      const adminData = {
        email: response.email,
        id: response.id,
        fio: response.fio || "Администратор",
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