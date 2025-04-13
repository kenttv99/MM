/**
 * Интерфейс для настройки лимита запросов
 */
export interface RateLimitConfig {
  /** Количество запросов, разрешенных в указанный интервал */
  limit: number;
  /** Интервал в миллисекундах, за который применяется лимит */
  interval: number;
  /** Описание для понимания использования лимита */
  description?: string;
}

/**
 * Типы категорий API-запросов
 */
export type ApiCategoryKey = 'AUTH' | 'PUBLIC' | 'USER' | 'ADMIN';

/**
 * Настройки лимитов API-запросов по категориям
 * 
 * Эти настройки определяют, сколько запросов клиент может отправить к API
 * за определенный интервал времени. Это помогает:
 * 1. Защитить от DDoS атак
 * 2. Предотвратить чрезмерную нагрузку на сервер
 * 3. Обеспечить справедливое использование ресурсов
 */
export const API_RATE_LIMITS = {
  /**
   * Авторизация и аутентификация
   */
  AUTH: {
    login: { 
      limit: 60, 
      interval: 60000,
      description: 'Запросы на вход (логин)' 
    },
    register: { 
      limit: 20, 
      interval: 60000,
      description: 'Запросы на регистрацию' 
    },
    accessMe: { 
      limit: 60, 
      interval: 60000,
      description: 'Запросы к данным текущего пользователя' 
    },
    verifyToken: { 
      limit: 600, 
      interval: 60000,
      description: 'Проверка токена авторизации' 
    },
    verifyTokenAdmin: { 
      limit: 100, 
      interval: 60000,
      description: 'Проверка токена админа' 
    }
  },
  
  /**
   * Публичные данные (не требующие авторизации)
   */
  PUBLIC: {
    getEvents: { 
      limit: 120, 
      interval: 60000,
      description: 'Получение списка событий' 
    },
    getEventById: { 
      limit: 300, 
      interval: 60000,
      description: 'Получение данных по конкретному событию' 
    },
    getContent: { 
      limit: 600, 
      interval: 60000,
      description: 'Получение контента' 
    }
  },
  
  /**
   * Пользовательские данные (требующие авторизации)
   */
  USER: {
    getProfile: { 
      limit: 60, 
      interval: 60000,
      description: 'Запросы на получение профиля пользователя' 
    },
    updateProfile: { 
      limit: 30, 
      interval: 60000,
      description: 'Запросы на обновление профиля' 
    },
    getTickets: { 
      limit: 60, 
      interval: 60000,
      description: 'Получение билетов пользователя' 
    },
    registerForEvent: { 
      limit: 30, 
      interval: 60000,
      description: 'Регистрация на события' 
    }
  },
  
  /**
   * Административные запросы (требующие прав администратора)
   */
  ADMIN: {
    getAllUsers: { 
      limit: 30, 
      interval: 60000,
      description: 'Получение списка всех пользователей' 
    },
    updateEvent: { 
      limit: 30, 
      interval: 60000,
      description: 'Обновление событий' 
    },
    deleteEvent: { 
      limit: 10, 
      interval: 60000,
      description: 'Удаление событий' 
    },
    addEvent: { 
      limit: 10, 
      interval: 60000,
      description: 'Добавление новых событий' 
    }
  }
} as const;

/**
 * Получение человекочитаемого представления лимита
 */
export function formatRateLimit(limit: number, interval: number): string {
  const seconds = interval / 1000;
  if (seconds === 60) {
    return `${limit}/минуту`;
  } else if (seconds === 3600) {
    return `${limit}/час`;
  } else if (seconds === 86400) {
    return `${limit}/день`;
  } else {
    return `${limit}/${seconds} сек`;
  }
}

/**
 * Экспорт функций для работы с лимитами
 */
const rateLimitsExport = {
  API_RATE_LIMITS,
  formatRateLimit
};

export default rateLimitsExport; 