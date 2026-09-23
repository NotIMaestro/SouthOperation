/** The shape a server value takes after a JSON round trip. */
export type Serialized<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Serialized<U>[]
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T;

export type ApiCallResult<T = unknown> = { ok: true; data: T } | { ok: false; message: string };

const fallbackMessages: Record<string, string> = {
  INVALID_REQUEST: "יש למלא את כל שדות החובה בערכים תקינים.",
  FORBIDDEN: "אין לכם הרשאה לבצע פעולה זו.",
  NOT_FOUND: "הרשומה לא נמצאה או שאין לכם גישה אליה.",
  INVALID_STATE_TRANSITION: "לא ניתן לבצע את המעבר הזה בשלב הנוכחי.",
  INTERNAL_ERROR: "הפעולה נכשלה. נסו שוב.",
};

/** JSON fetch against our API; returns a Hebrew message on failure instead of throwing. */
export async function callApi<T = unknown>(
  url: string,
  { method = "POST", body }: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {},
): Promise<ApiCallResult<T>> {
  try {
    const response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const code: string | undefined = payload?.error?.code;
      const message: string | undefined = payload?.error?.message;
      // Server messages are Hebrew for domain errors and English for generic ones.
      const isHebrew = message && /[֐-׿]/.test(message);
      return { ok: false, message: (isHebrew ? message : code && fallbackMessages[code]) || "הפעולה נכשלה." };
    }
    return { ok: true, data: payload?.data as T };
  } catch {
    return { ok: false, message: "לא ניתן להתחבר לשרת." };
  }
}
