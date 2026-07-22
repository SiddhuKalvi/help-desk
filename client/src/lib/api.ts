import axios from "axios";
import { Sentry } from "./sentry.ts";

export const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3001";

export const apiClient = axios.create({
  baseURL: SERVER_URL,
  withCredentials: true,
});

export async function apiFetch<T>(
  path: string,
  init?: { method?: string; body?: unknown; params?: Record<string, string | undefined> },
): Promise<T> {
  try {
    const res = await apiClient.request<T>({
      url: path,
      method: init?.method ?? "GET",
      data: init?.body,
      params: init?.params,
    });
    return res.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const message = err.response?.data?.error ?? `Request failed: ${err.response?.status ?? ""}`;
      Sentry.captureException(err, {
        extra: { url: err.config?.url, status: err.response?.status, responseBody: err.response?.data },
      });
      throw new Error(message);
    }
    Sentry.captureException(err);
    throw err;
  }
}
