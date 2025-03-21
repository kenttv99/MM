"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// Интерфейс для данных администратора
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
        const response = await fetch("/admin/me", {  // Относительный путь
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

  if (!adminData) return <p>Загрузка...</p>;

  return (
    <div>
      <h1>Профиль администратора</h1>
      <p><strong>ФИО:</strong> {adminData.fio}</p>
      <p><strong>Email:</strong> {adminData.email}</p>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}