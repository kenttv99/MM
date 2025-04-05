import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/utils/api';
import { EventData } from '@/types/events';

interface EventsResponse {
  data: EventData[];
  total: number;
}

interface EventsFilters {
  startDate: string;
  endDate: string;
}

const formatDateForAPI = (dateString: string): string => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    return date.toISOString().split("T")[0];
  } catch {
    return "";
  }
};

export const useEventsData = (page: number, filters: EventsFilters) => {
  return useQuery<EventsResponse>({
    queryKey: ['events', page, filters.startDate, filters.endDate],
    queryFn: async () => {
      const response = await apiFetch<EventData[] | EventsResponse>(
        `/v1/public/events?page=${page}&limit=6&start_date=${formatDateForAPI(filters.startDate)}&end_date=${formatDateForAPI(filters.endDate)}`,
        {
          cache: page === 1 ? "no-store" : "default"
        }
      );

      if ('aborted' in response) {
        throw new Error(response.reason || "Request was aborted");
      }

      // Handle both response formats - array or object with data property
      if (Array.isArray(response)) {
        return {
          data: response,
          total: response.length
        };
      }

      return response as EventsResponse;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    retry: 1,
  });
}; 