import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { z } from "zod";

import {
  findInvitedUserBySubject,
  requireActor,
  requireGlobalRole,
  requireGroupAccess,
  requireGroupManager,
} from "./lib/authorization";
import { errorResponse, HttpError, parseJson, requestIdFrom } from "./lib/errors";
import { requireInternalRequest } from "./lib/internal-auth";
import { createGroup, listVisibleGroups } from "./services/groups";
import {
  closePackingUnit,
  closeRoomPacking,
  listPackableItems,
  listPackingUnits,
  loadPackingUnitForGroup,
  loadRoomForGroup,
  createPackingUnit,
  pauseRoomPacking,
  setPackingUnitItems,
} from "./services/packing";
import { createReport, listReports } from "./services/reports";
import { createRoom, listRooms } from "./services/rooms";

type Variables = { requestId: string };

const app = new Hono<{ Variables: Variables }>();
const uuidSchema = z.uuid();
const resolveUserSchema = z.object({ subject: z.string().min(1).max(512) }).strict();
const createGroupSchema = z
  .object({
    groupCodeId: z.uuid(),
    name: z.string().trim().min(1).max(160),
    contactName: z.string().trim().min(1).max(160).optional(),
    contactPhone: z.string().trim().min(5).max(32).optional(),
  })
  .strict();
const createRoomSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(2000).optional(),
    locationId: z.uuid().optional(),
    managerName: z.string().trim().min(1).max(160).optional(),
  })
  .strict();
const createReportSchema = z
  .object({
    groupId: z.uuid(),
    roomId: z.uuid(),
    subcategoryId: z.uuid(),
    quantity: z.number().int().nonnegative().max(1_000_000),
    serialNumber: z.string().trim().min(1).max(160).optional(),
    notes: z.string().trim().max(4000).optional(),
    purpose: z.string().trim().max(2000).optional(),
    target: z.string().trim().max(2000).optional(),
    expiresAt: z.iso.datetime().transform((value) => new Date(value)).optional(),
  })
  .strict()
  .refine((input) => !input.serialNumber || input.quantity === 1, {
    message: "A serialized report must have quantity 1.",
    path: ["quantity"],
  });
const packingUnitTypeSchema = z.enum([
  "professional_carton",
  "personal_carton",
  "pallet",
  "dolav",
  "bulk",
]);
const createPackingUnitSchema = z
  .object({ unitType: packingUnitTypeSchema })
  .strict();
const setPackingUnitItemsSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            mappingReportId: z.uuid(),
            quantity: z.number().int().positive().max(1_000_000),
          })
          .strict(),
      )
      .min(1)
      .max(200),
  })
  .strict();
const closePackingUnitSchema = z
  .object({
    destinationBuilding: z.string().trim().min(1).max(160),
    destinationFloor: z.string().trim().min(1).max(60).optional(),
    destinationRoom: z.string().trim().min(1).max(160),
  })
  .strict();

app.use("*", secureHeaders());
app.use("*", async (context, next) => {
  const requestId = requestIdFrom(context.req.raw);
  context.set("requestId", requestId);
  context.header("X-Request-Id", requestId);
  context.header("Cache-Control", "no-store");
  await next();
});

app.onError((error, context) => errorResponse(error, context.get("requestId") ?? crypto.randomUUID()));

function requestId(context: { get(key: "requestId"): string }) {
  return context.get("requestId");
}

async function actorFrom(request: Request) {
  requireInternalRequest(request);
  return requireActor(request.headers.get("x-internal-user-id") ?? undefined);
}

app.get("/health", (context) =>
  context.json({ status: "ok", service: "south-operation-server", timestamp: new Date().toISOString() }),
);

app.post("/internal/auth/resolve", async (context) => {
  requireInternalRequest(context.req.raw);
  const { subject } = resolveUserSchema.parse(await parseJson(context.req.raw));
  const user = await findInvitedUserBySubject(subject);
  if (!user) throw new HttpError(404, "NOT_FOUND", "The requested resource was not found.");
  return context.json({ data: user, requestId: requestId(context) });
});

app.get("/v1/groups", async (context) => {
  const actor = await actorFrom(context.req.raw);
  return context.json({ data: await listVisibleGroups(actor), requestId: requestId(context) });
});

app.post("/v1/groups", async (context) => {
  const actor = await actorFrom(context.req.raw);
  requireGlobalRole(actor, ["admin"]);
  const input = createGroupSchema.parse(await parseJson(context.req.raw));
  const data = await createGroup(actor, input, requestId(context));
  return context.json({ data, requestId: requestId(context) }, 201);
});

app.get("/v1/groups/:groupId/rooms", async (context) => {
  const groupId = uuidSchema.parse(context.req.param("groupId"));
  const actor = await actorFrom(context.req.raw);
  await requireGroupAccess(actor, groupId);
  return context.json({ data: await listRooms(groupId), requestId: requestId(context) });
});

app.post("/v1/groups/:groupId/rooms", async (context) => {
  const groupId = uuidSchema.parse(context.req.param("groupId"));
  const actor = await actorFrom(context.req.raw);
  await requireGroupManager(actor, groupId);
  const input = createRoomSchema.parse(await parseJson(context.req.raw));
  const data = await createRoom(actor, groupId, input, requestId(context));
  return context.json({ data, requestId: requestId(context) }, 201);
});

app.get("/v1/mapping-reports", async (context) => {
  const groupIdValue = context.req.query("groupId");
  if (!groupIdValue) throw new HttpError(400, "MISSING_GROUP_ID", "groupId is required.");
  const groupId = uuidSchema.parse(groupIdValue);
  const actor = await actorFrom(context.req.raw);
  await requireGroupAccess(actor, groupId);
  return context.json({ data: await listReports(groupId), requestId: requestId(context) });
});

app.post("/v1/mapping-reports", async (context) => {
  const actor = await actorFrom(context.req.raw);
  const { groupId, ...input } = createReportSchema.parse(await parseJson(context.req.raw));
  await requireGroupAccess(actor, groupId);
  const data = await createReport(actor, groupId, input, requestId(context));
  return context.json({ data, requestId: requestId(context) }, 201);
});

app.get("/v1/rooms/:roomId", async (context) => {
  const roomId = uuidSchema.parse(context.req.param("roomId"));
  const actor = await actorFrom(context.req.raw);
  const room = await loadRoomForGroup(roomId);
  await requireGroupAccess(actor, room.groupId);
  return context.json({ data: room, requestId: requestId(context) });
});

app.get("/v1/rooms/:roomId/packing-units", async (context) => {
  const roomId = uuidSchema.parse(context.req.param("roomId"));
  const actor = await actorFrom(context.req.raw);
  const room = await loadRoomForGroup(roomId);
  await requireGroupAccess(actor, room.groupId);
  return context.json({ data: await listPackingUnits(room.groupId, roomId), requestId: requestId(context) });
});

app.post("/v1/rooms/:roomId/packing-units", async (context) => {
  const roomId = uuidSchema.parse(context.req.param("roomId"));
  const actor = await actorFrom(context.req.raw);
  const room = await loadRoomForGroup(roomId);
  await requireGroupAccess(actor, room.groupId);
  const input = createPackingUnitSchema.parse(await parseJson(context.req.raw));
  const data = await createPackingUnit(actor, roomId, input, requestId(context));
  return context.json({ data, requestId: requestId(context) }, 201);
});

app.post("/v1/packing-units/:packingUnitId/items", async (context) => {
  const packingUnitId = uuidSchema.parse(context.req.param("packingUnitId"));
  const actor = await actorFrom(context.req.raw);
  const unit = await loadPackingUnitForGroup(packingUnitId);
  await requireGroupAccess(actor, unit.groupId);
  const { items } = setPackingUnitItemsSchema.parse(await parseJson(context.req.raw));
  const data = await setPackingUnitItems(actor, packingUnitId, items, requestId(context));
  return context.json({ data, requestId: requestId(context) });
});

app.post("/v1/packing-units/:packingUnitId/close", async (context) => {
  const packingUnitId = uuidSchema.parse(context.req.param("packingUnitId"));
  const actor = await actorFrom(context.req.raw);
  const unit = await loadPackingUnitForGroup(packingUnitId);
  await requireGroupAccess(actor, unit.groupId);
  const input = closePackingUnitSchema.parse(await parseJson(context.req.raw));
  const data = await closePackingUnit(actor, packingUnitId, input, requestId(context));
  return context.json({ data, requestId: requestId(context) });
});

app.get("/v1/rooms/:roomId/packable-items", async (context) => {
  const roomId = uuidSchema.parse(context.req.param("roomId"));
  const actor = await actorFrom(context.req.raw);
  const room = await loadRoomForGroup(roomId);
  await requireGroupAccess(actor, room.groupId);
  return context.json({ data: await listPackableItems(room.groupId, roomId), requestId: requestId(context) });
});

app.post("/v1/rooms/:roomId/packing/close", async (context) => {
  const roomId = uuidSchema.parse(context.req.param("roomId"));
  const actor = await actorFrom(context.req.raw);
  const room = await loadRoomForGroup(roomId);
  await requireGroupAccess(actor, room.groupId);
  const data = await closeRoomPacking(actor, roomId, requestId(context));
  return context.json({ data, requestId: requestId(context) });
});

app.post("/v1/rooms/:roomId/packing/pause", async (context) => {
  const roomId = uuidSchema.parse(context.req.param("roomId"));
  const actor = await actorFrom(context.req.raw);
  const room = await loadRoomForGroup(roomId);
  await requireGroupAccess(actor, room.groupId);
  const data = await pauseRoomPacking(actor, roomId, requestId(context));
  return context.json({ data, requestId: requestId(context) });
});

app.notFound((context) =>
  context.json(
    { error: { code: "NOT_FOUND", message: "The requested resource was not found." }, requestId: requestId(context) },
    404,
  ),
);

export { app };
