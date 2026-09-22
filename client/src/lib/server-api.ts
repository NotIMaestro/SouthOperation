import { z } from "zod";

const apiEnvSchema = z.object({
  SERVER_API_URL: z.url(),
  INTERNAL_API_SECRET: z.string().min(32),
});

const maxBodyBytes = 1_000_000;

function apiConfig() {
  return apiEnvSchema.parse({
    SERVER_API_URL: process.env.SERVER_API_URL,
    INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET,
  });
}

async function serverRequest(
  path: string,
  init: RequestInit = {},
  internalUserId?: string,
) {
  const config = apiConfig();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${config.INTERNAL_API_SECRET}`);
  headers.set("Accept", "application/json");
  if (internalUserId) headers.set("X-Internal-User-Id", internalUserId);

  return fetch(new URL(path, config.SERVER_API_URL), {
    ...init,
    cache: "no-store",
    headers,
    signal: AbortSignal.timeout(10_000),
  });
}

export type ServerResult<T> = { ok: true; data: T } | { ok: false; message: string };

async function serverGet<T>(
  path: string,
  internalUserId: string,
  schema: z.ZodType<T>,
): Promise<ServerResult<T>> {
  try {
    const response = await serverRequest(path, {}, internalUserId);
    if (!response.ok) {
      return { ok: false, message: `הבקשה נכשלה (קוד ${response.status}).` };
    }
    const payload = z.object({ data: schema }).parse(await response.json());
    return { ok: true, data: payload.data };
  } catch {
    return { ok: false, message: "לא ניתן להתחבר לשרת. נסו שוב מאוחר יותר." };
  }
}

const groupSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  groupCode: z.string(),
  createdAt: z.string(),
});

const roomStatusSchema = z.enum(["unstarted", "in_progress", "completed", "archived"]);
const roomPackingStatusSchema = z.enum(["not_started", "in_packing", "paused", "closed"]);
const packingUnitTypeSchema = z.enum([
  "professional_carton",
  "personal_carton",
  "pallet",
  "dolav",
  "bulk",
]);
const packingUnitStatusSchema = z.enum(["awaiting_packing", "packing_in_progress", "closed"]);

const roomSchema = z.object({
  id: z.uuid(),
  groupId: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  managerName: z.string().nullable(),
  status: roomStatusSchema,
  packingStatus: roomPackingStatusSchema,
});

const roomListItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  locationId: z.uuid().nullable(),
  status: roomStatusSchema,
  packingStatus: roomPackingStatusSchema,
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
});

const packingUnitSchema = z.object({
  id: z.uuid(),
  roomId: z.uuid(),
  unitType: packingUnitTypeSchema,
  status: packingUnitStatusSchema,
  unitNumber: z.string().nullable(),
  destinationBuilding: z.string().nullable(),
  destinationFloor: z.string().nullable(),
  destinationRoom: z.string().nullable(),
  createdAt: z.string(),
  closedAt: z.string().nullable(),
});

const packableItemSchema = z.object({
  mappingReportId: z.uuid(),
  quantity: z.number(),
  serialNumber: z.string().nullable(),
  subcategoryName: z.string(),
  categoryName: z.string().nullable(),
  itemTypeName: z.string().nullable(),
  packedQuantity: z.number(),
  remainingQuantity: z.number(),
});

export type Group = z.infer<typeof groupSchema>;
export type Room = z.infer<typeof roomSchema>;
export type RoomListItem = z.infer<typeof roomListItemSchema>;
export type PackingUnit = z.infer<typeof packingUnitSchema>;
export type PackableItem = z.infer<typeof packableItemSchema>;

export function listGroups(internalUserId: string) {
  return serverGet("/v1/groups", internalUserId, z.array(groupSchema));
}

export function getRoom(internalUserId: string, roomId: string) {
  return serverGet(`/v1/rooms/${encodeURIComponent(roomId)}`, internalUserId, roomSchema);
}

export function listRoomsForGroup(internalUserId: string, groupId: string) {
  return serverGet(
    `/v1/groups/${encodeURIComponent(groupId)}/rooms`,
    internalUserId,
    z.array(roomListItemSchema),
  );
}

export function listPackingUnitsForRoom(internalUserId: string, roomId: string) {
  return serverGet(
    `/v1/rooms/${encodeURIComponent(roomId)}/packing-units`,
    internalUserId,
    z.array(packingUnitSchema),
  );
}

export function listPackableItems(internalUserId: string, roomId: string) {
  return serverGet(
    `/v1/rooms/${encodeURIComponent(roomId)}/packable-items`,
    internalUserId,
    z.array(packableItemSchema),
  );
}

export async function resolveInvitedUser(subject: string) {
  const response = await serverRequest("/internal/auth/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject }),
  });

  if (!response.ok) return undefined;
  const payload = z.object({ data: z.object({ id: z.uuid() }) }).parse(await response.json());
  return payload.data;
}

function proxyError(status: number, code: string, message: string) {
  return Response.json(
    { error: { code, message }, requestId: crypto.randomUUID() },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function proxyServerRequest(
  request: Request,
  path: string,
  internalUserId?: string,
) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
    return proxyError(413, "PAYLOAD_TOO_LARGE", "The request body is too large.");
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : undefined;
  if (body && body.byteLength > maxBodyBytes) {
    return proxyError(413, "PAYLOAD_TOO_LARGE", "The request body is too large.");
  }

  try {
    const headers = new Headers();
    const contentType = request.headers.get("content-type");
    const requestId = request.headers.get("x-request-id");
    if (contentType) headers.set("Content-Type", contentType);
    if (requestId) headers.set("X-Request-Id", requestId);

    const response = await serverRequest(
      path,
      { method: request.method, headers, body },
      internalUserId,
    );
    const responseHeaders = new Headers({ "Cache-Control": "no-store" });
    for (const name of ["content-type", "x-request-id"]) {
      const value = response.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch {
    return proxyError(502, "UPSTREAM_UNAVAILABLE", "The server is temporarily unavailable.");
  }
}
