// frontend/src/utils/api.ts
let activeRequests = 0;
const pendingRequests: { [key: string]: Promise<unknown> } = {};
const lastRequestTimes: { [key: string]: number } = {};
const DEBOUNCE_DELAY = 1000; // 1 секунда
const FETCH_TIMEOUT = 10000; // 10 секунд

const fetchWithTimeout = (url: string, options: RequestInit, timeout: number): Promise<Response> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Request timed out")), timeout);
    fetch(url, options)
      .then((response) => {
        clearTimeout(timer);
        resolve(response);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  setLoading?: (loading: boolean) => void // Добавлен опциональный параметр
): Promise<T> {
  const requestKey = `${endpoint}-${JSON.stringify(options)}`;
  const now = Date.now();

  if (lastRequestTimes[requestKey] && now - lastRequestTimes[requestKey] < DEBOUNCE_DELAY) {
    throw new Error(`Request to ${endpoint} is debounced. Try again later.`);
  }

  if (requestKey in pendingRequests) {
    return pendingRequests[requestKey] as Promise<T>;
  }

  const requestPromise: Promise<T> = (async () => {
    const url = endpoint.startsWith("http") ? endpoint : endpoint;
    const headers = new Headers(options.headers);
    const token = endpoint.includes("/admin")
      ? localStorage.getItem("admin_token")
      : localStorage.getItem("token");
    if (token) {
      headers.set("Authorization", token.startsWith("Bearer ") ? token : `Bearer ${token}`);
    }

    headers.set("Accept", "application/json");
    if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    activeRequests++;
    if (setLoading) setLoading(true);

    let response: Response;
    try {
      response = await fetchWithTimeout(url, { ...options, headers }, FETCH_TIMEOUT);
    } catch (error) {
      activeRequests--;
      if (activeRequests === 0 && setLoading) setLoading(false);
      throw error;
    }

    try {
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorText}`);
      }

      const newToken = response.headers.get("X-Refresh-Token");
      if (newToken) {
        if (url.includes("/admin")) {
          localStorage.setItem("admin_token", newToken);
        } else {
          localStorage.setItem("token", newToken);
        }
      }

      if (response.status === 204) return null as unknown as T;

      const data = await response.json();
      return data as T;
    } finally {
      activeRequests--;
      if (activeRequests === 0 && setLoading) setLoading(false);
      lastRequestTimes[requestKey] = Date.now();
    }
  })();

  pendingRequests[requestKey] = requestPromise;

  return requestPromise
    .then((result) => {
      delete pendingRequests[requestKey];
      return result;
    })
    .catch((err) => {
      delete pendingRequests[requestKey];
      throw err;
    });
}