// frontend/src/components/EventRegistration.tsx
"use client";

import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface EventRegistrationProps {
  eventId: number;
}

const EventRegistration: React.FC<EventRegistrationProps> = ({ eventId }) => {
  const { userData, isAuth } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleRegister = async () => {
    if (!isAuth || !userData) {
      setError("Пожалуйста, авторизуйтесь для регистрации на мероприятие.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:8000/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          event_id: eventId,
          user_id: userData.id,
        }),
      });

      if (response.ok) {
        setSuccess(true);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Ошибка при регистрации.");
      }
    } catch (err) {
      setError("Произошла ошибка при регистрации. Попробуйте позже.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4">
      {error && (
        <div className="text-red-500 bg-red-50 p-2 rounded-lg mb-4">{error}</div>
      )}
      {success ? (
        <div className="text-green-600 bg-green-50 p-2 rounded-lg">
          Вы успешно зарегистрированы на мероприятие!
        </div>
      ) : (
        <button
          onClick={handleRegister}
          disabled={loading}
          className={`btn btn-primary ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {loading ? "Регистрация..." : "Зарегистрироваться"}
        </button>
      )}
    </div>
  );
};

export default EventRegistration;