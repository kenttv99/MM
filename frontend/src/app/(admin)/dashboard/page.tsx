"use client";
import { useState, ChangeEvent } from "react";
import InputField from "@/components/common/InputField";
import { FaSearch } from "react-icons/fa";

interface User {
  id: number;
  fio: string;
  email: string;
}

interface Event {
  id: number;
  title: string;
}

export default function DashboardPage() {
  const [userSearch, setUserSearch] = useState("");
  const [eventSearch, setEventSearch] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const token = localStorage.getItem("admin_token");

  const handleUserSearch = async () => {
    try {
      const response = await fetch(`/users?search=${userSearch}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Ошибка поиска пользователей");
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleEventSearch = async () => {
    try {
      const response = await fetch(`/events?search=${eventSearch}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Ошибка поиска мероприятий");
      const data = await response.json();
      setEvents(data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 max-w-4xl mx-auto mt-8">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 tracking-tight">Dashboard</h1>
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-700 mb-4">Поиск пользователей</h2>
        <InputField
          type="text"
          value={userSearch}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setUserSearch(e.target.value)}
          placeholder="Введите имя или email"
          icon={FaSearch}
          onBlur={handleUserSearch}
        />
        <ul className="mt-4 text-gray-700">
          {users.map((user) => (
            <li key={user.id} className="mb-2">{user.fio} ({user.email})</li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="text-xl font-semibold text-gray-700 mb-4">Поиск мероприятий</h2>
        <InputField
          type="text"
          value={eventSearch}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setEventSearch(e.target.value)}
          placeholder="Введите название мероприятия"
          icon={FaSearch}
          onBlur={handleEventSearch}
        />
        <ul className="mt-4 text-gray-700">
          {events.map((event) => (
            <li key={event.id} className="mb-2">{event.title}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}