"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SELECTED_GROUP_COOKIE } from "./selected-group-cookie-name";

/**
 * Stores the chosen group and sends the user to `target`. Running this as a Server Action (instead of
 * writing document.cookie and calling router.refresh) makes Next return the re-rendered layout and
 * page in the same round trip and drops every cached route, so no page keeps showing the old group.
 */
export async function selectGroup(groupId: string, target: string) {
  const store = await cookies();
  store.set(SELECTED_GROUP_COOKIE, groupId, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
  redirect(target.startsWith("/") ? target : "/dashboard");
}
