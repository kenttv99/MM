import { useEffect } from "react";
import { useRouter } from "next/navigation"; // Используем next/navigation вместо next/router

export default function IndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.push("/(public)/page"); // Убираем /app, так как это не часть публичного маршрута
  }, [router]);

  return null;
}