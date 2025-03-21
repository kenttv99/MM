"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface AdminData {
  fio: string;
  email: string;
}

export default function AdminProfilePage() {
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem("admin_token");
      if (!token) {
        router.push("/admin-login");
        return;
      }
      try {
        const response = await fetch("/admin/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error("Ошибка загрузки профиля");
        const data = await response.json();
        setAdminData(data);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Неизвестная ошибка");
        }
        localStorage.removeItem("admin_token");
        router.push("/admin-login");
      }
    };
    fetchProfile();
  }, [router]);

  if (!adminData) return <p className="text-gray-900">Загрузка...</p>;

  return (
    <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 max-w-md mx-auto mt-8">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 tracking-tight">Профиль администратора</h1>
      <p className="text-gray-700 mb-4">
        <strong className="font-semibold">ФИО:</strong> {adminData.fio}
      </p>
      <p className="text-gray-700 mb-4">
        <strong className="font-semibold">Email:</strong> {adminData.email}
      </p>
      {error && (
        <p className="text-red-500 bg-red-50 p-3 rounded-lg border-l-4 border-red-500 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}