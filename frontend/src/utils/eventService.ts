// frontend/src/utils/eventService.ts
import {
  // EventResponse, // Удаляем неиспользуемый импорт
  EventData,
  EventDateFilter
} from '@/types/events';
import { createLogger } from '@/utils/logger';

// Интерфейс для ответа с событиями
export interface EventsResponse {
  success: boolean;
  data?: Array<EventData>;
  error?: string;
  page?: number;
  totalPages?: number;
  hasMore?: boolean;
  aborted?: boolean;
}

// Создаем логгер для сервиса
const logger = createLogger('eventService');

/**
 * Получение списка событий с поддержкой пагинации и фильтрации
 *
 * @param page - Номер страницы для пагинации (начиная с 1)
 * @param filters - Опциональные фильтры для запроса (даты начала и конца)
 * @param signal - Сигнал для отмены запроса
 * @returns Объект с результатами запроса, данными и статусами
 */
export async function fetchEvents(
  page: number = 1,
  filters?: EventDateFilter,
  signal?: AbortSignal
): Promise<EventsResponse> {
  // Создаем ID для отслеживания запроса в логах
  const requestId = Math.random().toString(36).substring(2, 10);

  logger.info('Fetching events list', {
    requestId,
    page,
    filters: filters ? JSON.stringify(filters) : 'none',
    hasSignal: !!signal
  });

  try {
    // Формируем URL с параметрами
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', '6'); // Стандартный лимит для страницы

    // Всегда добавляем параметры фильтрации, даже если они пустые
    const startDate = filters?.startDate || '';
    const endDate = filters?.endDate || '';

    params.append('start_date', startDate);
    params.append('end_date', endDate);

    logger.debug('Adding filters to request', {
      start_date: startDate || 'empty',
      end_date: endDate || 'empty'
    });

    // Формируем URL для запроса
    // Используем относительный URL, Next.js rewrites позаботятся о перенаправлении
    const url = `/v1/public/events?${params.toString()}`;
    logger.info('Making API request', { requestId, url });

    // Устанавливаем таймаут для запроса
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort('Request timeout');
    }, 15000); // 15 секунд

    // Получаем наш сигнал отмены
    const internalSignal = controller.signal;

    try {
      // Выполняем запрос с внешним или внутренним сигналом
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
        signal: signal || internalSignal
      });

      // Очищаем таймаут после получения ответа
      clearTimeout(timeoutId);

      // Обработка прерванного запроса
      if ((signal && signal.aborted) || internalSignal.aborted) {
        logger.info('Request aborted', { requestId });
        return {
          success: false,
          error: 'Запрос был отменен',
          aborted: true
        };
      }

      // Проверяем статус ответа
      if (!response.ok) {
        let errorMessage: string;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || `Ошибка сервера: ${response.status}`;
        } catch {
          errorMessage = `Ошибка HTTP ${response.status}: ${response.statusText}`;
        }

        logger.error('API request failed', {
          requestId,
          status: response.status,
          error: errorMessage
        });

        // Генерируем событие для обработки ошибок авторизации
        if (response.status === 401) {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('auth-error', {
              detail: { message: errorMessage }
            }));
          }
        }

        return {
          success: false,
          error: errorMessage
        };
      }

      // Парсим JSON-ответ
      const responseData = await response.json();

      // Приводим ответ к единому формату
      let events: EventData[] = [];
      let totalPages = 1;
      let currentPage = page;
      let hasMore = false;

      // Проверяем, какой формат ответа мы получили
      if (Array.isArray(responseData)) {
        // Массив событий напрямую
        events = responseData;

        // Определяем, есть ли еще страницы, основываясь на количестве полученных событий
        // Если получено полное количество событий на странице (6), вероятно есть еще
        hasMore = events.length === 6;
        totalPages = hasMore ? currentPage + 1 : currentPage;
      } else if (responseData && typeof responseData === 'object') {
        // Проверяем наличие пагинации в ответе
        if ('data' in responseData && Array.isArray(responseData.data)) {
          events = responseData.data;
        }

        if ('page' in responseData && typeof responseData.page === 'number') {
          currentPage = responseData.page;
        }

        if ('totalPages' in responseData && typeof responseData.totalPages === 'number') {
          totalPages = responseData.totalPages;
        }

        if ('hasMore' in responseData && typeof responseData.hasMore === 'boolean') {
          hasMore = responseData.hasMore;
        } else {
          // Вычисляем hasMore на основе текущей страницы и общего количества страниц
          hasMore = currentPage < totalPages;
        }
      }

      logger.info('Events fetch successful', {
        requestId,
        count: events.length,
        currentPage,
        totalPages,
        hasMore
      });

      return {
        success: true,
        data: events,
        page: currentPage,
        totalPages,
        hasMore
      };
    } finally {
      // Всегда очищаем таймаут
      clearTimeout(timeoutId);
    }
  } catch (error) {
    // Проверяем, был ли запрос отменен
    if (error instanceof Error && error.name === 'AbortError') {
      logger.info('Request aborted', { requestId });
      return {
        success: false,
        error: 'Запрос был отменен',
        aborted: true
      };
    }

    // Логируем другие ошибки
    logger.error('Error fetching events', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    // Генерируем событие ошибки загрузки для интеграции с системой загрузки
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('loading-error', {
        detail: {
          error: error instanceof Error ? error.message : String(error),
          source: 'eventService.fetchEvents'
        }
      }));
    }

    // Возвращаем объект с ошибкой
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Получение детальной информации о событии по slug
 *
 * @param slug - URL slug или ID события
 * @param signal - Сигнал для отмены запроса
 * @returns Объект с информацией о событии или ошибкой
 */
export const fetchEventBySlug = async (
  slug: string,
  signal?: AbortSignal
): Promise<{
  success: boolean;
  data?: EventData;
  error?: string;
}> => {
  const requestId = Math.random().toString(36).substring(2, 10);

  logger.info('Fetching event details', {
    requestId,
    slug,
    hasSignal: !!signal
  });

  try {
    // Формируем URL для запроса
    // Используем относительный URL
    const url = `/v1/public/events/${encodeURIComponent(slug)}`;

    // Устанавливаем таймаут для запроса
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort('Request timeout');
    }, 15000); // 15 секунд

    // Получаем наш сигнал отмены
    const internalSignal = controller.signal;

    try {
      // Выполняем запрос с внешним или внутренним сигналом
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
        signal: signal || internalSignal
      });

      // Очищаем таймаут после получения ответа
      clearTimeout(timeoutId);

      // Обработка прерванного запроса
      if ((signal && signal.aborted) || internalSignal.aborted) {
        logger.info('Request aborted', { requestId });
        return {
          success: false,
          error: 'Запрос был отменен'
        };
      }

      // Проверяем статус ответа
      if (!response.ok) {
        // Если событие не найдено, возвращаем специфичную ошибку
        if (response.status === 404) {
          logger.warn('Event not found', { requestId, slug });

          // Генерируем событие для обработки в системе загрузки
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('loading-error', {
              detail: {
                error: 'Событие не найдено',
                source: 'eventService.fetchEventBySlug',
                status: 404
              }
            }));
          }

          return {
            success: false,
            error: 'Событие не найдено'
          };
        }

        // Пытаемся получить детальную информацию об ошибке из ответа
        let errorMessage: string;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || `Ошибка сервера: ${response.status}`;
        } catch {
          errorMessage = `Ошибка HTTP ${response.status}: ${response.statusText}`;
        }

        logger.error('API request failed', {
          requestId,
          status: response.status,
          error: errorMessage
        });

        // Генерируем событие для обработки в системе загрузки
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('loading-error', {
            detail: {
              error: errorMessage,
              source: 'eventService.fetchEventBySlug',
              status: response.status
            }
          }));
        }

        return {
          success: false,
          error: errorMessage
        };
      }

      // Парсим JSON-ответ
      const eventData = await response.json();

      logger.info('Event fetch successful', {
        requestId,
        eventId: eventData.id,
        title: eventData.title?.substring(0, 30)
      });

      return {
        success: true,
        data: eventData
      };
    } finally {
      // Всегда очищаем таймаут
      clearTimeout(timeoutId);
    }
  } catch (error) {
    // Проверяем, был ли запрос отменен
    if (error instanceof Error && error.name === 'AbortError') {
      logger.info('Request aborted', { requestId });
      return {
        success: false,
        error: 'Запрос был отменен'
      };
    }

    // Логируем другие ошибки
    logger.error('Error fetching event', {
      requestId,
      slug,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    // Генерируем событие ошибки загрузки для интеграции с системой загрузки
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('loading-error', {
        detail: {
          error: error instanceof Error ? error.message : String(error),
          source: 'eventService.fetchEventBySlug'
        }
      }));
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Произошла ошибка при загрузке события'
    };
  }
};