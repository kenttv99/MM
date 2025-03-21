"use client";
import { useState, useEffect, ChangeEvent, FormEvent, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import InputField from "@/components/common/InputField";
import { ModalButton } from "@/components/common/AuthModal";
import { FaPen, FaCalendar, FaMapMarkerAlt, FaDollarSign, FaImage, FaCheck } from "react-icons/fa";
import AdminHeader from "@/components/AdminHeader";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

interface EventData {
  id?: number;
  title: string;
  description: string;
  start_date: string;
  end_date?: string;
  location?: string;
  image_url?: string;
  price: number;
  published: boolean;
  created_at?: string;
  updated_at?: string;
}

export default function EditEventPage() {
  // Используем useMemo для initialEventState, чтобы он не пересоздавался при каждом рендере
  const initialEventState = useMemo<EventData>(() => ({
    title: "",
    description: "",
    start_date: new Date().toISOString().split('T')[0],
    price: 0,
    published: false
  }), []);

  const [event, setEvent] = useState<EventData>(initialEventState);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get("event_id");
  const isNew = searchParams.get("new") === "true";
  
  const { isAdminAuth, isLoading: authLoading } = useAdminAuth();

  // Определяем fetchEvent как useCallback, чтобы он сохранял стабильность между рендерами
  const fetchEvent = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      const response = await fetch(`/events/${id}`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-cache"
        },
      });
      
      if (!response.ok) {
        throw new Error("Не удалось загрузить данные мероприятия");
      }
      
      const data = await response.json();
      
      // Форматируем даты для input[type="date"]
      if (data.start_date) {
        data.start_date = new Date(data.start_date).toISOString().split('T')[0];
      }
      if (data.end_date) {
        data.end_date = new Date(data.end_date).toISOString().split('T')[0];
      }
      
      setEvent(data);
      setIsCreating(false);
      setIsInitialized(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Произошла ошибка");
      console.error("Ошибка загрузки мероприятия:", err);
      
      // При ошибке загрузки перенаправляем на dashboard
      setTimeout(() => {
        router.push("/dashboard");
      }, 3000);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // Проверка параметров URL
    if (!eventId && !isNew) {
      // Если нет параметров, перенаправляем на dashboard
      router.push("/dashboard");
      return;
    }

    // Проверка авторизации
    if (!authLoading && !isAdminAuth) {
      router.push("/admin-login");
      return;
    }

    // Инициализация для создания нового мероприятия
    if (isNew) {
      setIsCreating(true);
      setEvent(initialEventState);
      setIsInitialized(true);
      return;
    }

    // Загрузка данных существующего мероприятия
    if (eventId) {
      fetchEvent(eventId);
    }
  }, [eventId, isNew, isAdminAuth, authLoading, router, fetchEvent, initialEventState]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    if (type === 'checkbox') {
      const target = e.target as HTMLInputElement;
      setEvent({ ...event, [name]: target.checked });
    } else if (type === 'number') {
      setEvent({ ...event, [name]: parseFloat(value) });
    } else {
      setEvent({ ...event, [name]: value });
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);
    
    const token = localStorage.getItem("admin_token");
    if (!token) {
      setError("Не авторизован");
      setIsLoading(false);
      return;
    }
    
    // Форматируем данные для отправки
    const eventData = {
      ...event,
      start_date: new Date(event.start_date).toISOString(),
      end_date: event.end_date ? new Date(event.end_date).toISOString() : null
    };
    
    try {
      // Определяем URL и метод в зависимости от того, создаем или редактируем
      const url = isCreating 
        ? `/admin_edits` 
        : `/admin_edits/${eventId}`;
      
      const method = isCreating ? "POST" : "PUT";
      
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(eventData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Ошибка сохранения мероприятия");
      }
      
      setSuccess(isCreating ? "Мероприятие успешно создано" : "Мероприятие успешно обновлено");
      
      // Если создали новое мероприятие, перенаправляем на страницу редактирования
      if (isCreating) {
        const data = await response.json();
        setTimeout(() => {
          router.push(`/edit-events?event_id=${data.id}`);
        }, 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Произошла ошибка");
      console.error("Ошибка сохранения мероприятия:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Показываем индикатор загрузки
  if (authLoading || (isLoading && !isInitialized)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Если нет прав или не инициализировано, не показываем содержимое
  if (!isAdminAuth || !isInitialized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">
            {isCreating ? "Создание нового мероприятия" : "Редактирование мероприятия"}
          </h1>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            {error && (
              <div className="mb-6 bg-red-50 p-4 rounded-lg border-l-4 border-red-500 text-red-700">
                {error}
              </div>
            )}
            
            {success && (
              <div className="mb-6 bg-green-50 p-4 rounded-lg border-l-4 border-green-500 text-green-700">
                {success}
              </div>
            )}
            
            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <label className="block text-gray-700 mb-2 font-medium">Название мероприятия</label>
                <InputField
                  type="text"
                  value={event.title}
                  onChange={handleChange}
                  placeholder="Введите название"
                  icon={FaPen}
                  name="title"
                  required
                />
              </div>
              
              <div className="mb-6">
                <label className="block text-gray-700 mb-2 font-medium">Описание</label>
                <textarea
                  value={event.description}
                  onChange={handleChange}
                  placeholder="Введите описание мероприятия"
                  name="description"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={5}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-gray-700 mb-2 font-medium">Дата начала</label>
                  <InputField
                    type="date"
                    value={event.start_date}
                    onChange={handleChange}
                    placeholder="Дата начала"
                    icon={FaCalendar}
                    name="start_date"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2 font-medium">Дата окончания</label>
                  <InputField
                    type="date"
                    value={event.end_date || ""}
                    onChange={handleChange}
                    placeholder="Дата окончания"
                    icon={FaCalendar}
                    name="end_date"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-gray-700 mb-2 font-medium">Местоположение</label>
                  <InputField
                    type="text"
                    value={event.location || ""}
                    onChange={handleChange}
                    placeholder="Место проведения"
                    icon={FaMapMarkerAlt}
                    name="location"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2 font-medium">Цена</label>
                  <InputField
                    type="number"
                    value={event.price.toString()}
                    onChange={handleChange}
                    placeholder="Стоимость"
                    icon={FaDollarSign}
                    name="price"
                    required
                  />
                </div>
              </div>
              
              <div className="mb-6">
                <label className="block text-gray-700 mb-2 font-medium">URL изображения</label>
                <InputField
                  type="text"
                  value={event.image_url || ""}
                  onChange={handleChange}
                  placeholder="URL изображения для мероприятия"
                  icon={FaImage}
                  name="image_url"
                />
              </div>
              
              <div className="mb-6 flex items-center">
                <input
                  type="checkbox"
                  id="published"
                  name="published"
                  checked={event.published}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="published" className="ml-2 text-gray-700">
                  Опубликовать мероприятие
                </label>
              </div>
              
              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Отмена
                </button>
                <ModalButton 
                  type="submit"
                  disabled={isLoading}
                >
                  {isLoading ? "Сохранение..." : (
                    <>
                      <FaCheck className="mr-2" />
                      {isCreating ? "Создать мероприятие" : "Сохранить изменения"}
                    </>
                  )}
                </ModalButton>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}