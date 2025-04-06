// Ищем и сокращаем логи в функции apiFetch и других ключевых функциях
// Оставляем только важные логи о состоянии запросов

// Функция для обработки изменения стадии загрузки
function handleStageChange(event: CustomEvent) {
  if (!event.detail || !event.detail.stage) return;
  
  const stage = event.detail.stage;
  const prevStage = currentStage;
  currentStage = stage;
  
  // Логируем только значимые изменения стадий
  console.log('API: Loading stage updated to', prevStage, {
    prevStage,
    requestStats: getRequestStats(),
    activeRequests: requestQueue.length
  });
}

// Функция для проверки нужно ли выполнять запрос
function shouldProcessRequest(url: string, init?: RequestInit): boolean {
  // В режиме тестирования разрешаем все запросы
  if (process.env.NODE_ENV === 'test') return true;
  
  // Если это API запрос к бэкенду
  if (!url.startsWith('/')) return true;
  
  // Проверка текущей стадии загрузки и других условий
  const isProbablyUserSpecificRequest = url.includes('/user/') || 
                                         url.includes('/me') || 
                                         url.includes('/notifications');
  
  switch(currentStage) {
    case LoadingStage.AUTHENTICATION:
      // Только запросы связанные с авторизацией разрешены
      const isAuthRequest = url.includes('/auth/') || url.includes('/login') || url.includes('/check-auth');
      const shouldProcess = isAuthRequest;
      
      // Логируем только отклоненные запросы
      if (!shouldProcess) {
        console.log('API: Request rejected during authentication', { url, stage: currentStage });
      }
      
      return shouldProcess;
      
    case LoadingStage.STATIC_CONTENT:
      // Разрешены только не-специфичные запросы
      const isStaticContentRequest = !isProbablyUserSpecificRequest && !url.includes('/profile');
      return isStaticContentRequest;
      
    case LoadingStage.DYNAMIC_CONTENT:
      // Разрешены все запросы кроме специфичных для пользователя
      return !isProbablyUserSpecificRequest;
      
    case LoadingStage.DATA_LOADING:
    case LoadingStage.COMPLETED:
      // Все запросы разрешены
      return true;
      
    default:
      return true;
  }
}

// Основная функция apiFetch
export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T | AbortedRequest> {
  // ... existing code ...
  
  // Проверяем, можно ли выполнить запрос на текущей стадии загрузки
  if (!shouldProcessRequest(url, init)) {
    // Только для отклоненных запросов
    console.log('API: Request skipped due to loading stage', { url, stage: currentStage });
    return { aborted: true, reason: 'Request skipped due to loading stage' } as AbortedRequest;
  }
  
  // ... rest of the function ...
  
  try {
    // ... fetching code ...
    
    // Лог только для ошибок или важных событий
    if (!response.ok) {
      console.error('API: Error response', { 
        url, 
        status: response.status, 
        statusText: response.statusText 
      });
      // ... error handling ...
    }
    
    // ... parsing response ...
    
  } catch (error) {
    // Логируем только ошибки
    console.error('API: Request failed', { url, error });
    // ... error handling ...
  }
  
  // ... rest of the function ...
}

// ... rest of the code ... 