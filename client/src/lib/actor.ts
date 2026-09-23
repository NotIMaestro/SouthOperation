import { requireActor, type Actor } from "@south-operation/server/authorization";
import { auth } from "@/auth";

export async function getActor(): Promise<Actor> {
  const session = await auth();
  return requireActor(session?.user?.id);
}
