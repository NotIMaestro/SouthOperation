export function getRemembered(key: string): string {
  try {
    return window.localStorage.getItem(`southop:${key}`) ?? "";
  } catch {
    return "";
  }
}

export function setRemembered(key: string, value: string): void {
  try {
    window.localStorage.setItem(`southop:${key}`, value);
  } catch {
    // ignore (private browsing, storage disabled, etc.)
  }
}
