"use client";

import { useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import EditUserForm from "@/components/EditUserForm";

const EditUserPageContent: React.FC = () => {
  const searchParams = useSearchParams();
  const userId = searchParams.get("user_id");
  const router = useRouter();
  const { isAuthenticated } = useAdminAuth();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    if (!isAuthenticated) {
      router.push("/admin-login");
    }
  }, [isAuthenticated, router]);

  if (!userId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="container mx-auto px-4 pt-24 pb-12">
          <div className="text-center py-8">
            <h1 className="text-2xl font-bold mb-4 text-gray-800">Ошибка</h1>
            <p className="text-gray-600 mb-6">Не указан ID пользователя</p>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Вернуться к списку пользователей
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 pt-24 pb-12">
        <h1 className="text-3xl font-bold mb-8 text-gray-800">Редактирование пользователя</h1>
        
        <EditUserForm 
          userId={userId} 
          onSuccess={() => {
            setTimeout(() => router.push("/dashboard"), 1500);
          }}
        />
      </main>
    </div>
  );
};

const EditUserPage: React.FC = () => {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-600">Загрузка...</p>
    </div>}>
      <EditUserPageContent />
    </Suspense>
  );
};

export default EditUserPage;