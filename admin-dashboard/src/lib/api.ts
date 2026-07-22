export class ApiError extends Error {
  statusCode: number;
  endpoint: string;
  payload?: any;
  validationErrors?: string[];
  responseBody?: any;

  constructor(
    message: string,
    statusCode: number,
    endpoint: string,
    payload?: any,
    validationErrors?: string[],
    responseBody?: any
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.endpoint = endpoint;
    this.payload = payload;
    this.validationErrors = validationErrors;
    this.responseBody = responseBody;
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenant_id') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (tenantId) {
    headers['x-tenant-id'] = tenantId;
  }

  let requestBodyPayload: any;
  if (options.body && typeof options.body === 'string') {
    try {
      requestBodyPayload = JSON.parse(options.body);
    } catch {
      requestBodyPayload = options.body;
    }
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      let errorMessage = `API Request Failed (${response.status}) on ${endpoint}`;
      let validationErrors: string[] | undefined;

      if (Array.isArray(errorData.message)) {
        validationErrors = errorData.message;
        errorMessage = errorData.message.join('\n');
      } else if (typeof errorData.message === 'string') {
        errorMessage = errorData.message;
      } else if (errorData.detail) {
        errorMessage = String(errorData.detail);
      } else if (errorData.error) {
        errorMessage = String(errorData.error);
      }

      console.error('[API Error Detail]:', {
        endpoint,
        status: response.status,
        message: errorMessage,
        validationErrors,
        requestBody: requestBodyPayload,
        responseBody: errorData,
      });

      throw new ApiError(
        errorMessage,
        response.status,
        endpoint,
        requestBodyPayload,
        validationErrors,
        errorData
      );
    }

    const data = await response.json().catch(() => ({}));
    return data as T;
  } catch (error: any) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error(`[Network / Fetch Error on ${endpoint}]:`, error);
    throw new ApiError(
      error.message || 'Network error, please check connection',
      0,
      endpoint,
      requestBodyPayload
    );
  }
}
