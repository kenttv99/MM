import { useAuth } from "@/contexts/AuthContext";

const { isLoading, isAuthChecked } = useAuth();

console.log('[UserEventTickets] Initializing user tickets component...');

console.log('[UserEventTickets] Fetching tickets data...'); 