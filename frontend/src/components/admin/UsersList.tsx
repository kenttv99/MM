"use client";

import React from "react";
import { useRouter } from "next/navigation";

interface User {
  id: number;
  fio: string;
  email: string;
  telegram?: string;
  whatsapp?: string;
}

interface UsersListProps {
  users: User[];
}

const UsersList: React.FC<UsersListProps> = ({ users }) => {
  const router = useRouter();

  // Навигация к странице редактирования пользователя
  const handleEditUser = (userId: number) => {
    router.push(`/edit-user?user_id=${userId}`);
  };

  return (
    <div>
      {/* Список пользователей для мобильных устройств */}
      <div className="md:hidden space-y-4">
        {users.length > 0 ? (
          users.map((user) => (
            <div 
              key={user.id} 
              className="p-4 border border-gray-100 rounded-lg shadow-sm hover:shadow transition-shadow"
            >
              <div className="flex items-center mb-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-3">
                  {user.fio?.charAt(0) || "U"}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">{user.fio || "Без имени"}</h3>
                  <p className="text-sm text-gray-600">{user.email}</p>
                </div>
              </div>
              {(user.telegram || user.whatsapp) && (
                <div className="mb-3 pl-11">
                  {user.telegram && <p className="text-sm text-gray-600">Telegram: {user.telegram}</p>}
                  {user.whatsapp && <p className="text-sm text-gray-600">WhatsApp: {user.whatsapp}</p>}
                </div>
              )}
              <div className="mt-2 text-right">
                <button
                  onClick={() => handleEditUser(user.id)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  Управлять
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center py-4 text-gray-500">
            Нет доступных пользователей
          </p>
        )}
      </div>

      {/* Таблица пользователей для десктопа */}
      <div className="hidden md:block">
        {users.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ФИО</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Контакты</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{user.id}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-3">
                          {user.fio?.charAt(0) || "U"}
                        </div>
                        <span className="text-sm font-medium text-gray-900">{user.fio || "Без имени"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{user.email}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {user.telegram && <div>Telegram: {user.telegram}</div>}
                      {user.whatsapp && <div>WhatsApp: {user.whatsapp}</div>}
                      {!user.telegram && !user.whatsapp && <span>—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleEditUser(user.id)}
                        className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
                      >
                        Управлять
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center py-6 text-gray-500">
            Нет доступных пользователей
          </p>
        )}
      </div>
    </div>
  );
};

export default UsersList; 