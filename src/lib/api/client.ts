export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      "Could not reach the backend API. Check that the ASP.NET Core service is running on port 5000.",
    );
  }

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(text || `Request failed with status ${response.status}.`, response.status);
  }

  return (await response.json()) as T;
}
