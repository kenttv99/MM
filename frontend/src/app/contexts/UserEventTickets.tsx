const { authLoading, isAuthChecked } = useAuth();

console.log('[UserEventTickets] Fetching tickets data...');

console.log('[UserEventTickets] Fetch operation completed or errored:', { response: response ? 'received' : 'none', error }); 