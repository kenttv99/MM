# Project Structure Documentation

## Directory Tree with File Descriptions

```
frontend/src/
├── types/                   # Type definitions for the application
│   ├── api.ts               # API-related interfaces and types (ApiResponse, FetchOptionsType, etc.)
│   ├── events.ts            # Event-related interfaces (EventData, TicketType, EventResponse, etc.)
│   ├── index.ts             # Aggregation of component-specific interfaces and types
│   └── user.ts              # User-related interfaces (UserResponse, etc.)
│
├── config/                  # Configuration files for the application
│   └── rateLimits.ts        # API rate limits configuration and utility functions
│
├── utils/                   # Utility functions and services
│   ├── api.ts               # Core API communication layer with caching, queueing, and loading stage integration
│   ├── logger.ts            # Centralized logging system with levels, module configs, and performance tracking
│   ├── timerManager.ts      # Timer management to prevent memory leaks and track timeouts/intervals
│   ├── eventService.ts      # Event-related operations and API interactions
│   └── userService.ts       # User-related operations and API interactions
│
└── contexts/                # React Context providers for global state
    ├── AdminAuthContext.tsx # Authentication state and functions for admin users
    ├── AuthContext.tsx      # Authentication state for regular users (login/logout, tokens, etc.)
    ├── LoadingContextLegacy.tsx # Compatibility layer for legacy loading system
    ├── index.ts             # Exports all context providers and hooks
    └── loading/             # Modular loading state management system
        ├── index.ts         # Exports: providers, hooks and utilities
        ├── types.ts         # Type definitions: LoadingStage, StageHistoryEntry, etc.
        ├── LoadingStageContext.tsx    # Manages stage transitions with validation (427 lines)
        ├── LoadingFlagsContext.tsx    # Handles loading flags with admin route special logic
        ├── LoadingProgressContext.tsx # Tracks numerical progress (0-100%)
        ├── LoadingErrorContext.tsx    # Error handling with auto-clear timers
        ├── LoadingProvider.tsx        # Main provider: inconsistency checks, error recovery
        └── README.md                  # Technical documentation (95 lines)
```

## Key Components and Responsibilities

### Types Directory
The `types` directory provides TypeScript interfaces and type definitions used throughout the application:

- **api.ts**: Defines core API-related interfaces including response types, request options, and cancellable promises.
- **events.ts**: Contains interfaces for event data, ticket types, and form handling for creating/updating events.
- **user.ts**: Defines user-related interfaces for user profile data.
- **index.ts**: Aggregates component-specific interfaces for props, state, and form handling across the application.

### Config Directory
The `config` directory contains configuration files that define application-wide settings:

- **rateLimits.ts**: Defines rate limits for different API endpoints categorized by type (AUTH, PUBLIC, USER, ADMIN), including limits, intervals, and descriptions for each endpoint. Also provides utility functions for working with rate limits.

### Utils Directory
The `utils` directory contains utility modules with functions used across the application:

- **api.ts**: Implements the API communication layer with advanced features like request caching, deduplication, loading stage management, request queueing, and error handling. Also implements rate limiting based on the configurations in rateLimits.ts.
- **logger.ts**: Provides a sophisticated logging system with different log levels, module-specific configurations, context tracking, and performance metrics.
- **timerManager.ts**: Manages application timers with tracking to prevent memory leaks, providing functions to create and clear timeouts/intervals safely.
- **eventService.ts**: Handles event-related operations such as creating, updating, and fetching events, as well as registration management.
- **userService.ts**: Manages user-related operations including profile updates, authentication, and preference settings.

### Contexts Directory
The `contexts` directory contains React Context providers for global state management:

- **AdminAuthContext.tsx**: Provides authentication state specifically for admin users.
- **AuthContext.tsx**: Manages authentication for regular users, including login/logout, token handling, and user data.
- **LoadingContextLegacy.tsx**: Compatibility layer for components still using the legacy loading system.
- **loading/**: A modular approach to loading state management:
  - **LoadingStageContext.tsx**: Manages application loading stages with controlled transitions.
  - **LoadingFlagsContext.tsx**: Handles loading flags (isStaticLoading, isDynamicLoading).
  - **LoadingProgressContext.tsx**: Tracks numerical progress for loading operations.
  - **LoadingErrorContext.tsx**: Manages loading-related error states.
  - **LoadingProvider.tsx**: Combines all specialized contexts into a unified provider.

## Architecture Insights

1. **Modular Loading System**: The application uses a modular approach to loading state management, allowing for precise control over different aspects of the loading process.

2. **Advanced API Handling**: The API utility includes sophisticated features for request management, ensuring optimal performance and user experience.

3. **Rate Limiting System**: Client-side rate limiting prevents excessive API calls, protecting both client and server from potential DDoS attacks and ensuring fair resource usage.

4. **Comprehensive Logging**: A robust logging system enables better debugging and monitoring of application behavior.

5. **Type Safety**: Extensive TypeScript interfaces ensure type safety throughout the application.

6. **Timer Management**: Careful tracking of timers prevents memory leaks in the long-running single-page application.

7. **Authentication Separation**: Separate context providers for regular and admin authentication allow for different authentication flows and access controls.

## Обновленные правила использования системы загрузки

### Правильное использование импортов типов

Для обеспечения типовой безопасности и избежания проблем с линтером необходимо правильно импортировать типы:

```typescript
// Для общего доступа к системе загрузки
import { useLoading } from '@/contexts/loading';

// Для использования легаси-контекста
import { useLoading } from '@/contexts/loading/LoadingContextLegacy';

// Импорт типов
import { LoadingStage } from '@/contexts/loading/types';
```

### Принципы организации компонентов

Для предотвращения проблем с зависимостями хуков компоненты следует организовывать в определенном порядке:

1. Импорты библиотек и контекстов
2. Настройка логгеров
3. Интерфейсы и типы компонента
4. Вспомогательные компоненты
5. Основной компонент с хуками и состояниями
6. Вспомогательные функции с хуками (в порядке зависимостей)
7. Эффекты инициализации и очистки
8. Рендеринг с обработкой состояний загрузки

### Пример структуры компонента

```typescript
import React, { useState, useRef, useCallback } from "react";
import { useLoading } from '@/contexts/loading/LoadingContextLegacy';
import { LoadingStage } from '@/contexts/loading/types';

const logger = createLogger('ComponentName');

interface ComponentProps { /* ... */ }

const Component = (props) => {
  const isMounted = useRef(true);
  const { setStage, currentStage } = useLoading();
  const [data, setData] = useState(null);
  
  const fetchData = useCallback(() => {
    // Базовая функция загрузки данных
  }, []);
  
  const handleAction = useCallback(() => {
    // Функция, использующая fetchData
    fetchData();
  }, [fetchData]);
  
  // Остальной код компонента
};
```

# Документация по структуре проекта

## Дерево директорий с описанием файлов

```
frontend/src/
├── types/                   # Определения типов для приложения
│   ├── api.ts               # Интерфейсы и типы связанные с API (ApiResponse, FetchOptionsType и т.д.)
│   ├── events.ts            # Интерфейсы для событий (EventData, TicketType, EventResponse и т.д.)
│   ├── index.ts             # Агрегация интерфейсов и типов для компонентов
│   └── user.ts              # Интерфейсы пользователя (UserResponse и т.д.)
│
├── config/                  # Конфигурационные файлы для приложения
│   └── rateLimits.ts        # Конфигурация лимитов API-запросов и утилитарные функции
│
├── utils/                   # Утилиты и сервисы
│   ├── api.ts               # Основной слой коммуникации с API (кеширование, очереди, интеграция с состоянием загрузки)
│   ├── logger.ts            # Централизованная система логирования с уровнями, конфигурацией модулей и отслеживанием производительности
│   ├── timerManager.ts      # Управление таймерами для предотвращения утечек памяти
│   ├── eventService.ts      # Операции связанные с событиями и взаимодействия с API
│   └── userService.ts       # Операции связанные с пользователями и взаимодействия с API
│
└── contexts/                # React Context провайдеры для глобального состояния
    ├── AdminAuthContext.tsx # Состояние аутентификации и функции для администраторов
    ├── AuthContext.tsx      # Состояние аутентификации для обычных пользователей (вход/выход, токены и т.д.)
    ├── LoadingContextLegacy.tsx # Слой совместимости для устаревшей системы загрузки
    ├── index.ts             # Экспорты всех провайдеров контекста и хуков
    └── loading/             # Модульная система управления состоянием загрузки
        ├── index.ts         # Экспорты контекстов и утилит загрузки
        ├── types.ts         # Определения типов для системы загрузки
        ├── LoadingStageContext.tsx    # Управление этапами загрузки приложения и переходами
        ├── LoadingFlagsContext.tsx    # Обработка флагов загрузки (isStaticLoading, isDynamicLoading)
        ├── LoadingProgressContext.tsx # Отслеживание численного прогресса загрузки
        ├── LoadingErrorContext.tsx    # Управление ошибками, связанными с загрузкой
        ├── LoadingProvider.tsx        # Объединенный провайдер для всех контекстов загрузки
        └── README.md                  # Документация по системе загрузки
```

## Ключевые компоненты и их ответственность

### Директория types
Директория `types` содержит интерфейсы TypeScript и определения типов, используемые во всем приложении:

- **api.ts**: Определяет основные интерфейсы, связанные с API, включая типы ответов, параметры запросов и отменяемые промисы.
- **events.ts**: Содержит интерфейсы для данных о событиях, типах билетов и обработки форм для создания/обновления событий.
- **user.ts**: Определяет интерфейсы, связанные с пользовательскими данными профиля.
- **index.ts**: Агрегирует интерфейсы для пропсов компонентов, управления состоянием и обработки форм во всем приложении.

### Директория config
Директория `config` содержит конфигурационные файлы, определяющие настройки всего приложения:

- **rateLimits.ts**: Определяет лимиты запросов для различных конечных точек API, категоризированных по типу (AUTH, PUBLIC, USER, ADMIN), включая лимиты, интервалы и описания для каждой точки. Также предоставляет утилитарные функции для работы с лимитами запросов.

### Директория utils
Директория `utils` содержит служебные модули с функциями, используемыми во всем приложении:

- **api.ts**: Реализует слой коммуникации с API с продвинутыми функциями, такими как кеширование запросов, дедупликация, управление этапами загрузки, очередность запросов и обработка ошибок. Также реализует ограничение частоты запросов на основе конфигураций в rateLimits.ts.
- **logger.ts**: Предоставляет сложную систему логирования с различными уровнями, конфигурацией для конкретных модулей, отслеживанием контекста и метриками производительности.
- **timerManager.ts**: Управляет таймерами приложения с отслеживанием для предотвращения утечек памяти, предоставляя функции для безопасного создания и очистки таймаутов/интервалов.
- **eventService.ts**: Обрабатывает операции, связанные с событиями, такие как создание, обновление и получение событий, а также управление регистрациями.
- **userService.ts**: Управляет операциями, связанными с пользователями, включая обновление профиля, аутентификацию и настройки предпочтений.

### Директория contexts
Директория `contexts` содержит React Context провайдеры для глобального управления состоянием:

- **AdminAuthContext.tsx**: Предоставляет состояние аутентификации специально для администраторов.
- **AuthContext.tsx**: Управляет аутентификацией для обычных пользователей, включая вход/выход, обработку токенов и данные пользователя.
- **LoadingContextLegacy.tsx**: Слой совместимости для компонентов, по-прежнему использующих устаревшую систему загрузки.
- **loading/**: Модульный подход к управлению состоянием загрузки:
  - **LoadingStageContext.tsx**: Управляет этапами загрузки приложения с контролируемыми переходами.
  - **LoadingFlagsContext.tsx**: Обрабатывает визуальные индикаторы загрузки и флаги состояния загрузки.
  - **LoadingProgressContext.tsx**: Отслеживает числовой прогресс для операций загрузки.
  - **LoadingErrorContext.tsx**: Управляет состояниями ошибок, связанных с загрузкой.
  - **LoadingProvider.tsx**: Объединяет все специализированные контексты в единый провайдер.

## Архитектурные особенности

1. **Модульная система загрузки**: Приложение использует модульный подход к управлению состоянием загрузки, позволяющий точно контролировать различные аспекты процесса загрузки.

2. **Продвинутая обработка API**: Утилита API включает сложные функции для управления запросами, обеспечивая оптимальную производительность и удобство использования.

3. **Система ограничения запросов**: Ограничение частоты запросов на стороне клиента предотвращает чрезмерное количество вызовов API, защищая как клиента, так и сервер от потенциальных DDoS-атак и обеспечивая справедливое использование ресурсов.

4. **Комплексное логирование**: Надежная система логирования обеспечивает лучшую отладку и мониторинг поведения приложения.

5. **Типовая безопасность**: Обширные интерфейсы TypeScript обеспечивают типовую безопасность во всем приложении.

6. **Управление таймерами**: Тщательное отслеживание таймеров предотвращает утечки памяти в долго работающем одностраничном приложении.

7. **Разделение аутентификации**: Отдельные провайдеры контекста для обычной и административной аутентификации позволяют использовать различные потоки аутентификации и контроль доступа.

# Обновленная структура проекта

## Ключевые изменения в системе контекстов

В рамках оптимизации типовой безопасности внесены уточнения по использованию типов в контекстах загрузки:

```
frontend/src/contexts/loading/
├── index.ts                  # Единая точка входа для экспорта всех контекстов и типов
├── types.ts                  # Централизованное хранилище всех типов системы загрузки
│   └── LoadingStage          # Перечисление стадий загрузки, импортируемое компонентами
├── LoadingStageContext.tsx   # Управление стадиями загрузки и переходами
├── LoadingFlagsContext.tsx   # Флаги состояния загрузки (static, dynamic)
├── LoadingErrorContext.tsx   # Обработка ошибок загрузки
├── LoadingProgressContext.tsx # Индикация прогресса загрузки
└── LoadingContextLegacy.tsx  # Слой совместимости с устаревшей системой
```

### Правильное использование импортов

Для обеспечения типовой безопасности и избежания проблем с зависимостями рекомендуется следующий подход к импортам:

```typescript
// Для общего доступа к системе загрузки
import { useLoading } from '@/contexts/loading';

// Для использования легаси-контекста
import { useLoading } from '@/contexts/loading/LoadingContextLegacy';

// Для доступа к конкретным контекстам
import { useLoadingError } from '@/contexts/loading/LoadingErrorContext';
import { useLoadingStage } from '@/contexts/loading/LoadingStageContext';

// Для импорта типов
import { LoadingStage } from '@/contexts/loading/types';
```

## Обновленные принципы организации компонентов

В соответствии с требованиями типовой безопасности и предотвращения проблем с хуками, компоненты следует организовывать следующим образом:

1. Импорты контекстов и хуков
2. Определения и настройка логгеров
3. Интерфейсы и типы компонента
4. Вспомогательные компоненты и функции 
5. Основной компонент с рефами и хуками
6. Вспомогательные функции, использующие хуки (в правильном порядке зависимостей)
7. Эффекты для инициализации, загрузки данных и очистки
8. Рендеринг с обработкой разных состояний загрузки

Данная структура обеспечивает предсказуемое поведение хуков и предотвращает ошибки ESLint, связанные с порядком объявлений.

### Пример структуры файла компонента с загрузкой данных

```typescript
// 1. Импорты
import React, { useState, useRef, useCallback, useEffect } from "react";
import { useLoading } from '@/contexts/loading/LoadingContextLegacy';
import { LoadingStage } from '@/contexts/loading/types';
import { useLoadingError } from '@/contexts/loading/LoadingErrorContext';
import { fetchData } from '@/utils/dataService';

// 2. Логгеры
const logger = createLogger('ComponentName');

// 3. Интерфейсы и типы
interface ComponentProps {
  // ...
}

// 4. Вспомогательные компоненты
const SkeletonLoader = () => {
  // ...
};

// 5. Основной компонент
const Component: React.FC<ComponentProps> = (props) => {
  // Рефы
  const isMounted = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Хуки контекстов
  const { setStage, currentStage } = useLoading();
  const { setError } = useLoadingError();
  
  // Состояния
  const [data, setData] = useState<Data | null>(null);
  
  // 6. Функция загрузки данных
  const fetchDataWithParams = useCallback(() => {
    // ...
  }, [/* зависимости */]);
  
  // 7. Эффекты
  useEffect(() => {
    // Инициализация
    
    return () => {
      // Очистка
    };
  }, [/* зависимости */]);
  
  // 8. Рендеринг с обработкой состояний
  if (currentStage === LoadingStage.ERROR) {
    // Показываем ошибку
  }
  
  return (
    // JSX компонента
  );
};

export default Component;
``` 