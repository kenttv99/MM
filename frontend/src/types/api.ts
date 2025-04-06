/**
 * Тип для ответов API, который может быть либо данными, либо объектом с информацией об отмене запроса,
 * либо объектом с информацией об ошибке
 */
export type ApiResponse<T> = T | { aborted: boolean; reason?: string } | { error: string; status: number }; 