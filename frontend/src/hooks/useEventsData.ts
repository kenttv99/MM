import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '@/utils/api';
import type { EventData } from '@/types/events';
import { ApiAbortedResponse, ApiErrorResponse } from '@/types/api';

export interface EventsResponse {
  data: EventData[];
  total: number;
}

// Глобальные переменные для кэширования и отслеживания запросов
const cache: { [key: string]: { data: EventsResponse; timestamp: number } } = {};
const MIN_REQUEST_INTERVAL = 2000; // 2 секунды между запросами
const CACHE_TTL = 5 * 60 * 1000; // 5 минут
const requestAbortControllers: { [key: string]: AbortController } = {};
const lastRequestTimes: { [key: string]: number } = {};

// Функция для очистки устаревших записей кэша
const cleanupCache = () => {
  const now = Date.now();
  Object.keys(cache).forEach(key => {
    if (now - cache[key].timestamp > CACHE_TTL) {
      delete cache[key];
    }
  });
};

// Запускаем очистку кэша каждые CACHE_TTL миллисекунд
setInterval(cleanupCache, CACHE_TTL);

export const useEventsData = ({
  page,
  limit,
  search,
  startDate,
  endDate,
  setDynamicLoading,
}: {
  page: number;
  limit: number;
  search: string;
  startDate?: string;
  endDate?: string;
  setDynamicLoading: (isLoading: boolean) => void;
}) => {
  const [data, setData] = useState<EventsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const isMounted = useRef(true);
  const requestKeyRef = useRef<string>("");
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadingStateRef = useRef({ isLoading: true, isFetching: false });
  const hasInitialData = useRef(false);

  // Функция для безопасного обновления состояния загрузки
  const updateLoadingState = useCallback((newLoading: boolean, newFetching: boolean) => {
    console.log('useEventsData: Attempting to update loading state:', { 
      newLoading, 
      newFetching, 
      isMounted: isMounted.current,
      currentState: loadingStateRef.current,
      hasInitialData: hasInitialData.current
    });
    
    // Проверяем, не заблокирована ли уже загрузка
    const isLocked = document.querySelector('.global-spinner');
    if (isLocked) {
      console.log('useEventsData: Loading is locked, skipping loading state update');
      return;
    }
    
    // Проверяем, смонтирован ли компонент
    if (!isMounted.current) {
      console.log('useEventsData: Component unmounted, skipping loading state update');
      return;
    }
    
    // Проверяем, изменилось ли состояние
    if (newLoading === loadingStateRef.current.isLoading && 
        newFetching === loadingStateRef.current.isFetching) {
      console.log('useEventsData: Loading state unchanged, skipping update');
      return;
    }
    
    // Обновляем локальное состояние загрузки
    setIsLoading(newLoading);
    setIsFetching(newFetching);
    
    // Обновляем ссылку на текущее состояние
    loadingStateRef.current = { isLoading: newLoading, isFetching: newFetching };
    
    // Очищаем предыдущий таймаут, если он есть
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    
    // Устанавливаем новый таймаут для обновления глобального состояния загрузки
    loadingTimeoutRef.current = setTimeout(() => {
      // Проверяем, смонтирован ли компонент
      if (!isMounted.current) {
        console.log('useEventsData: Component unmounted during loading timeout');
        return;
      }
      
      // Проверяем, не заблокирована ли уже загрузка
      const isStillLocked = document.querySelector('.global-spinner');
      if (isStillLocked) {
        console.log('useEventsData: Loading is still locked, skipping global loading state update');
        return;
      }
      
      // Обновляем глобальное состояние загрузки только если есть начальные данные
      if (hasInitialData.current || newLoading || newFetching) {
        console.log('useEventsData: Updating global loading state:', { newLoading, newFetching });
        setDynamicLoading(newLoading || newFetching);
      }
    }, 500); // Увеличиваем таймаут до 500мс
  }, [setDynamicLoading]);

  // Обновляем данные
  const updateData = useCallback((newData: EventsResponse | null) => {
    if (!isMounted.current) return;
    
    console.log('useEventsData: Updating data:', { 
      hasNewData: newData !== null, 
      currentData: data !== null,
      isMounted: isMounted.current,
      hasInitialData: hasInitialData.current
    });
    
    // Проверяем, изменились ли данные
    if (JSON.stringify(newData) !== JSON.stringify(data)) {
      setData(newData);
      
      // Если данные успешно загружены, сбрасываем состояние загрузки
      if (newData !== null) {
        hasInitialData.current = true;
        updateLoadingState(false, false);
      }
    }
  }, [data, updateLoadingState]);

  // Обновляем ошибку
  const updateError = useCallback((newError: Error | null) => {
    if (!isMounted.current) return;
    
    console.log('useEventsData: Updating error:', { 
      hasNewError: newError !== null, 
      currentError: error !== null,
      isMounted: isMounted.current,
      hasInitialData: hasInitialData.current
    });
    
    // Проверяем, изменилась ли ошибка
    if (newError?.message !== error?.message) {
      setError(newError);
      
      // Если произошла ошибка, сбрасываем состояние загрузки
      if (newError !== null) {
        updateLoadingState(false, false);
      }
    }
  }, [error, updateLoadingState]);

  const fetchData = useCallback(async () => {
    if (!isMounted.current) return;

    const currentTime = Date.now();
    const currentRequestKey = `events-${page}-${limit}-${search}-${startDate}-${endDate}`;

    console.log('useEventsData: Fetching data:', { 
      currentRequestKey, 
      isMounted: isMounted.current,
      currentLoadingState: loadingStateRef.current,
      hasInitialData: hasInitialData.current
    });

    // Проверяем, не слишком ли рано для нового запроса
    const lastRequestTime = lastRequestTimes[currentRequestKey] || 0;
    if (currentTime - lastRequestTime < MIN_REQUEST_INTERVAL) {
      console.log('Events: Skipping request due to rate limiting');
      // Если запрос пропускается из-за ограничения скорости, сбрасываем состояние загрузки
      updateLoadingState(false, false);
      return;
    }

    // Проверяем, не выполняется ли уже запрос с таким же ключом
    if (requestKeyRef.current === currentRequestKey) {
      console.log('Events: Using existing pending request for', currentRequestKey);
      return;
    }

    // Если у нас уже есть данные для этого запроса, используем их
    if (data && requestKeyRef.current === currentRequestKey) {
      console.log('Events: Using cached data for', currentRequestKey);
      updateLoadingState(false, false);
      return;
    }

    // Обновляем ключ текущего запроса и время последнего запроса
    requestKeyRef.current = currentRequestKey;
    lastRequestTimes[currentRequestKey] = currentTime;

    // Отменяем предыдущий запрос, если он есть
    if (requestAbortControllers[currentRequestKey]) {
      requestAbortControllers[currentRequestKey].abort();
    }

    // Создаем новый контроллер для этого запроса
    const controller = new AbortController();
    requestAbortControllers[currentRequestKey] = controller;

    try {
      updateLoadingState(true, true);
      
      const response = await apiFetch<EventsResponse | EventData[]>(`/v1/public/events?page=${page}&limit=${limit}&search=${search}&start_date=${startDate}&end_date=${endDate}`, {
        signal: controller.signal
      });
      
      if (!isMounted.current) {
        console.log('useEventsData: Component unmounted during fetch');
        return;
      }
      
      if ('error' in response) {
        const errorResponse = response as unknown as ApiErrorResponse;
        throw new Error(errorResponse.error);
      }
      
      if ('aborted' in response) {
        const abortedResponse = response as unknown as ApiAbortedResponse;
        throw new Error('Request was aborted: ' + abortedResponse.reason);
      }

      // Преобразуем ответ в нужный формат, если это массив
      const formattedResponse = Array.isArray(response) 
        ? { data: response, total: response.length } 
        : response;

      // Сохраняем в кэш
      cache[currentRequestKey] = {
        data: formattedResponse,
        timestamp: Date.now()
      };

      console.log('Events: Server response:', formattedResponse);
      updateData(formattedResponse);
      updateError(null);
    } catch (err) {
      if (!isMounted.current) {
        console.log('useEventsData: Component unmounted during error handling');
        return;
      }
      console.error('Events: Request error:', err);
      updateError(err instanceof Error ? err : new Error('An error occurred'));
    } finally {
      if (isMounted.current) {
        updateLoadingState(false, false);
      }
    }
  }, [page, limit, search, startDate, endDate, updateLoadingState, updateData, updateError]);

  // Эффект для инициализации данных
  useEffect(() => {
    console.log('useEventsData: Initializing data fetch');
    fetchData();
    
    return () => {
      console.log('useEventsData: Cleanup effect triggered');
      isMounted.current = false;
      
      // Очищаем таймаут загрузки
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      
      // Отменяем текущий запрос
      if (requestAbortControllers[requestKeyRef.current]) {
        requestAbortControllers[requestKeyRef.current].abort();
      }
      
      // Сбрасываем глобальное состояние загрузки
      setDynamicLoading(false);
    };
  }, [fetchData, setDynamicLoading]);

  // Эффект для сброса состояния загрузки при размонтировании
  useEffect(() => {
    return () => {
      console.log('useEventsData: Unmounting effect triggered');
      isMounted.current = false;
      
      // Очищаем таймаут загрузки
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      
      // Сбрасываем глобальное состояние загрузки
      setDynamicLoading(false);
    };
  }, [setDynamicLoading]);

  const refetch = useCallback(async () => {
    if (isMounted.current) {
      await fetchData();
    }
  }, [fetchData]);

  return {
    data,
    isLoading,
    isFetching,
    error,
    refetch
  };
}; 