import { cookies } from "next/headers";

import { SELECTED_GROUP_COOKIE } from "./selected-group-cookie-name";

export { SELECTED_GROUP_COOKIE };

export async function getSelectedGroupIdFromCookie(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SELECTED_GROUP_COOKIE)?.value || undefined;
}
