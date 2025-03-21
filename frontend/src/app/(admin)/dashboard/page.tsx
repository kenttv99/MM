"use client";
import { useState, ChangeEvent } from "react"; // Убираем FocusEvent, так как он не нужен
import InputField from "@/components/common/InputField";
import { FaSearch } from "react-icons/fa";

// Интерфейсы для пользователей и мероприятий
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
    <div>
      <h1>Dashboard</h1>
      <div>
        <h2>Поиск пользователей</h2>
        <label>Поиск пользователей</label> {/* Убираем htmlFor, так как id не передается */}
        <InputField
          type="text" // Убираем id
          value={userSearch}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setUserSearch(e.target.value)}
          placeholder="Введите имя или email"
          icon={FaSearch}
          onBlur={handleUserSearch} // Убираем параметр e, так как он не используется
        />
        <ul>
          {users.map((user) => (
            <li key={user.id}>{user.fio} ({user.email})</li>
          ))}
        </ul>
      </div>
      <div>
        <h2>Поиск мероприятий</h2>
        <label>Поиск мероприятий</label> {/* Убираем htmlFor */}
        <InputField
          type="text" // Убираем id
          value={eventSearch}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setEventSearch(e.target.value)}
          placeholder="Введите название мероприятия"
          icon={FaSearch}
          onBlur={handleEventSearch} // Убираем параметр e
        />
        <ul>
          {events.map((event) => (
            <li key={event.id}>{event.title}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}