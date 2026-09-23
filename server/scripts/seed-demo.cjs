// Demo data for every app table, using plain numbered names (groups 1–3, buildings A1/A2/…,
// rooms 101/201/…, catalog 1.1.1/…): users, groups + memberships, locations, rooms in every mapping / packing state, mapped
// items, packing units (open and closed), transports in every status, and the matching audit trail
// + export outbox rows.
// Run with: pnpm db:seed-demo   (reads DATABASE_URL from the root .env.local)
//
// Re-runnable: every demo row has a fixed id (prefix d3e40000-), and the script first removes the
// previous demo rows — plus anything created inside the demo groups since — before inserting again.
// audit_events is append-only (trigger); only while removing demo rows is that trigger switched off,
// inside the same transaction.
// Non-demo data (e.g. the local dev group) is left untouched. Catalog entries are upserted by name.
// DRY_RUN=1 runs everything inside the transaction and then rolls it back.

const postgres = require("postgres");

const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";

const kinds = {
  user: "a001",
  groupCode: "a002",
  group: "a003",
  location: "a004",
  room: "a005",
  report: "a006",
  unit: "a007",
  item: "a008",
  transport: "a009",
};
const uid = (kind, n) => `d3e40000-${kinds[kind]}-4000-8000-${n.toString(16).padStart(12, "0")}`;
const demoIdPattern = (kind) => `d3e40000-${kinds[kind]}-%`;

const now = Date.now();
/** A timestamp `days` ago, nudged by `hours` so events in one day stay ordered. */
const at = (days, hours = 0) => new Date(now - days * 86_400_000 + hours * 3_600_000);

// ---------------------------------------------------------------------------------------------
// Static demo content
// ---------------------------------------------------------------------------------------------

const users = [
  { n: 1, name: "משתמש 1", email: "user1", role: "admin" },
  { n: 2, name: "משתמש 2", email: "user2", role: "manager" },
  { n: 3, name: "משתמש 3", email: "user3", role: "manager" },
  { n: 4, name: "משתמש 4", email: "user4", role: "commander" },
  { n: 5, name: "משתמש 5", email: "user5", role: "commander" },
  { n: 6, name: "משתמש 6", email: "user6", role: "operator" },
  { n: 7, name: "משתמש 7", email: "user7", role: "operator" },
  { n: 8, name: "משתמש 8", email: "user8", role: "operator" },
  { n: 9, name: "משתמש 9", email: "user9", role: "operator", inactive: true },
];
const userId = (n) => uid("user", n);
const userName = (n) => users.find((user) => user.n === n).name;

const groupCodes = [
  { n: 1, code: "G-1", description: "קבוצה 1" },
  { n: 2, code: "G-2", description: "קבוצה 2" },
  { n: 3, code: "G-3", description: "קבוצה 3" },
];

const groups = [
  { n: 1, code: 1, name: "1", contact: 2, phone: "050-0000001", sourceCity: "1", sourceUnit: "1" },
  { n: 2, code: 2, name: "2", contact: 3, phone: "050-0000002", sourceCity: "2", sourceUnit: "2" },
  { n: 3, code: 3, name: "3", contact: 5, phone: "050-0000003", sourceCity: "3", sourceUnit: "3" },
];
const groupId = (n) => uid("group", n);

const memberships = [
  [1, DEV_USER_ID, "manager"], [1, 2, "manager"], [1, 4, "commander"], [1, 6, "operator"], [1, 7, "operator"],
  [2, 3, "manager"], [2, 5, "commander"], [2, 8, "operator"], [2, 7, "operator"],
  [3, 3, "manager"], [3, 4, "commander"], [3, 5, "commander"], [3, 6, "operator"],
];

// Locations are buildings.
const locations = [
  { n: 1, name: "A1" },
  { n: 2, name: "A2" },
  { n: 3, name: "B1" },
  { n: 4, name: "C1" },
  { n: 5, name: "C2" },
];

const catalogAdditions = [
  { itemType: "1", category: "1.1", subcategories: ["1.1.1", "1.1.2", "1.1.3", "1.1.4"] },
  { itemType: "2", category: "2.1", subcategories: ["2.1.1", "2.1.2", "2.1.3", "2.1.4", "2.1.5"] },
  { itemType: "3", category: "3.1", subcategories: ["3.1.1", "3.1.2", "3.1.3"] },
  { itemType: "4", category: "4.1", subcategories: ["4.1.1", "4.1.2", "4.1.3", "4.1.4"] },
];

// Catalog entries added by earlier versions of this script; removed when nothing references them.
const legacyCatalog = [
  { itemType: "חטיפי במבה", category: "במבה" },
  { itemType: "חטיפי ביסלי", category: "ביסלי" },
  { itemType: "חומרי אריזה", category: "אריזה" },
  { itemType: "ציוד מפעל", category: "ציוד תפעול" },
];

// Item keys are "itemType/category/subcategory"; all come from catalogAdditions above.
const K = {
  a1: "1/1.1/1.1.1",
  a2: "1/1.1/1.1.2",
  a3: "1/1.1/1.1.3",
  a4: "1/1.1/1.1.4",
  b1: "2/2.1/2.1.1",
  b2: "2/2.1/2.1.2",
  b3: "2/2.1/2.1.3",
  b4: "2/2.1/2.1.4",
  b5: "2/2.1/2.1.5",
  c1: "3/3.1/3.1.1",
  c2: "3/3.1/3.1.2",
  c3: "3/3.1/3.1.3",
  d1: "4/4.1/4.1.1",
  d2: "4/4.1/4.1.2",
  d3: "4/4.1/4.1.3",
  d4: "4/4.1/4.1.4",
};

const dest = (building, floor, room) => ({ building, floor, room });

/*
 * Rooms. `status` is the mapping state; `packing` only matters once mapped.
 * items:  [catalogKey, quantity, serial?]           (a serial forces quantity 1)
 * units:  { type, items: [[itemIndex, qty]], close?: dest, transport?, collected?, collector? }  — closed when `close` is set;
 *         `collected` (days ago) marks a unit picked up by user `collector` after its transport was received
 * Days are "days ago": started → completed → units opened/closed.
 */
const rooms = [
  // --- Group 1 — every packing state -----------------------------------------------------------
  {
    n: 1, group: 1, location: 1, name: "101", manager: userName(4),
    status: "completed", packing: "closed",
    started: 12, completed: 9,
    items: [[K.a1, 240], [K.a4, 60], [K.d1, 1, "0001"], [K.d3, 1, "0002"], [K.c1, 40], [K.c2, 12]],
    units: [
      { type: "pallet", opened: 6, items: [[0, 240]], close: dest("C1", "0", "003"), transport: "a", collected: 1, collector: 6 },
      { type: "pallet", opened: 6, items: [[1, 60], [4, 40]], close: dest("C1", "0", "003"), transport: "a" },
      { type: "dolav", opened: 5, items: [[5, 12]], close: dest("C1", "0", "003"), transport: "a" },
    ],
  },
  {
    n: 2, group: 1, location: 2, name: "201", manager: userName(2),
    status: "completed", packing: "in_packing",
    started: 11, completed: 8,
    items: [[K.a2, 180], [K.a3, 90], [K.d4, 1, "0003"], [K.c3, 8], [K.c1, 30], [K.d2, 2]],
    units: [
      { type: "pallet", opened: 4, items: [[0, 120]], close: dest("C2", "0", "002"), transport: "b" },
      { type: "personal_carton", opened: 4, items: [], close: dest("C2", "0", "001"), transport: "b" },
      { type: "pallet", opened: 3, items: [[1, 90], [4, 30]], close: dest("C2", "0", "002"), transport: "g" },
      { type: "professional_carton", opened: 1, items: [[0, 40]] },
      { type: "dolav", opened: 0, items: [] },
    ],
  },
  {
    n: 3, group: 1, location: 2, name: "202", manager: userName(2),
    status: "completed", packing: "not_started", started: 9, completed: 6,
    items: [[K.a3, 150], [K.a1, 80], [K.c3, 4], [K.c2, 6]],
    units: [],
  },
  {
    n: 4, group: 1, location: 1, name: "102", manager: userName(4),
    status: "in_progress", started: 3,
    items: [[K.a1, 24], [K.a2, 24], [K.d3, 1, "0004"]],
    units: [],
  },
  { n: 5, group: 1, location: 2, name: "203", status: "unstarted", items: [], units: [] },

  // --- Group 2 ---------------------------------------------------------------------------------
  {
    n: 6, group: 2, location: 3, name: "301", manager: userName(5),
    status: "completed", packing: "paused", started: 10, completed: 7,
    items: [[K.b1, 300], [K.b4, 120], [K.c1, 50], [K.c3, 6], [K.d1, 1, "0005"]],
    units: [
      { type: "pallet", opened: 4, items: [[0, 300]], close: dest("C1", "0", "001"), transport: "d" },
      { type: "pallet", opened: 3, items: [[1, 120], [2, 50]], close: dest("C1", "0", "001"), transport: "d" },
      { type: "bulk", opened: 2, items: [[3, 6]], close: dest("C1", "1", "101") },
    ],
  },
  {
    n: 7, group: 2, location: 3, name: "302", manager: userName(3),
    status: "completed", packing: "in_packing", started: 8, completed: 5,
    items: [[K.b2, 200], [K.b3, 160], [K.b5, 80], [K.d4, 1, "0006"], [K.d2, 3]],
    units: [
      { type: "pallet", opened: 2, items: [[0, 200], [3, 1]], close: dest("C2", "0", "001") },
      { type: "professional_carton", opened: 1, items: [[1, 100]] },
    ],
  },
  {
    n: 8, group: 2, location: 3, name: "303", status: "in_progress", started: 2,
    items: [[K.b5, 140], [K.b4, 90]], units: [],
  },
  { n: 9, group: 2, location: 3, name: "304", status: "unstarted", items: [], units: [] },

  // --- Group 3 ---------------------------------------------------------------------------------
  {
    n: 10, group: 3, location: 4, name: "401", manager: userName(5),
    status: "completed", packing: "in_packing", started: 7, completed: 4,
    items: [[K.a1, 400], [K.b1, 250], [K.d1, 1, "0007"], [K.c3, 20], [K.c2, 10]],
    units: [
      { type: "pallet", opened: 2, items: [[0, 400], [4, 10]], close: dest("C2", "0", "004"), transport: "f" },
      { type: "personal_carton", opened: 1, items: [], close: dest("C2", "0", "001") },
      { type: "pallet", opened: 0, items: [] },
    ],
  },
  {
    n: 11, group: 3, location: 4, name: "402", manager: userName(4),
    status: "in_progress", started: 1, items: [[K.a1, 35], [K.b2, 20], [K.a4, 12]], units: [],
  },
  { n: 12, group: 3, location: 4, name: "403", status: "unstarted", items: [], units: [] },
];

// Transports, keyed by the letters the units above point at. `received` (days ago) confirms receipt by user `receiver`.
const transports = [
  { key: "a", group: 1, status: "arrived", creator: 4, created: 4, transit: 3, arrived: 2, received: 1.5, receiver: 2, vehicle: ["משאית", "10-000-01"], scheduled: 3,
    sourceBuilding: "A1", sourceRoom: "101", destCity: "4", destUnit: "4", destBuilding: "C1", destRoom: "003",
    summary: "3 חבילות" },
  { key: "b", group: 1, status: "transit", creator: 4, created: 2, transit: 0.2, vehicle: ["משאית", "10-000-02"], scheduled: 0.3,
    sourceBuilding: "A2", sourceRoom: "201", destCity: "5", destUnit: "5", destBuilding: "C2", destRoom: "002",
    summary: "2 חבילות" },
  { key: "c", group: 1, status: "waiting", creator: 2, created: 0.5, scheduled: -1,
    sourceBuilding: "A2", sourceRoom: "202", destCity: "5", destUnit: "5", destBuilding: "C2", destRoom: "001",
    summary: "3 חבילות", packageCount: 3 },
  { key: "d", group: 2, status: "arrived", creator: 5, created: 2, transit: 1, arrived: 0.4, vehicle: ["משאית", "10-000-03"], scheduled: 1,
    sourceBuilding: "B1", sourceRoom: "301", destCity: "4", destUnit: "4", destBuilding: "C1", destRoom: "001",
    summary: "2 חבילות" },
  { key: "e", group: 2, status: "waiting", creator: 5, created: 0.3, scheduled: -2,
    sourceBuilding: "B1", sourceRoom: "302", destCity: "5", destUnit: "5", destBuilding: "C2", destRoom: "001",
    summary: "2 חבילות", packageCount: 2 },
  { key: "f", group: 3, status: "waiting", creator: 5, created: 1, scheduled: -0.5,
    sourceBuilding: "C1", sourceRoom: "401", destCity: "5", destUnit: "5", destBuilding: "C2", destRoom: "004",
    summary: "1 חבילה" },
  { key: "g", group: 1, status: "arrived", creator: 4, created: 3, transit: 1.5, arrived: 0.5, vehicle: ["טנדר", "10-000-04"], scheduled: 1.5,
    sourceBuilding: "A2", sourceRoom: "201", destCity: "5", destUnit: "5", destBuilding: "C2", destRoom: "002",
    summary: "1 חבילה" },
];

// ---------------------------------------------------------------------------------------------

class DryRunRollback extends Error {}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const sql = postgres(databaseUrl, { max: 1, prepare: false });

  try {
    await sql.begin(async (tx) => {
      await removePreviousDemo(tx);
      const subcategoryIds = await upsertCatalog(tx);
      await insertDemo(tx, subcategoryIds);
      if (process.env.DRY_RUN) throw new DryRunRollback();
    });
    console.log("Demo data seeded.");
  } catch (error) {
    if (!(error instanceof DryRunRollback)) throw error;
    console.log("Dry run OK — rolled back.");
  } finally {
    await sql.end();
  }
}

async function removePreviousDemo(tx) {
  const demoGroups = tx`select id from groups where id::text like ${demoIdPattern("group")}`;
  const demoRooms = tx`select id from rooms where group_id in (${demoGroups})`;
  const demoUsers = tx`select id from users where id::text like ${demoIdPattern("user")}`;

  await tx`delete from packing_unit_items where packing_unit_id in (select id from packing_units where room_id in (${demoRooms}))`;
  await tx`delete from packing_units where room_id in (${demoRooms})`;
  await tx`delete from mapping_reports where room_id in (${demoRooms})`;
  await tx`delete from transports where group_id in (${demoGroups})`;
  await tx`delete from rooms where group_id in (${demoGroups})`;
  await tx`delete from memberships where group_id in (${demoGroups}) or user_id in (${demoUsers})`;
  await tx`alter table audit_events disable trigger audit_events_append_only`;
  await tx`delete from audit_events where group_id in (${demoGroups}) or actor_user_id in (${demoUsers})`;
  await tx`alter table audit_events enable trigger audit_events_append_only`;
  await tx`delete from export_outbox where group_id in (${demoGroups})`;
  await tx`delete from groups where id in (${demoGroups})`;
  await tx`delete from group_codes where id::text like ${demoIdPattern("groupCode")}`;
  await tx`update rooms set location_id = null where location_id::text like ${demoIdPattern("location")}`;
  await tx`delete from locations where id::text like ${demoIdPattern("location")}`;
  await tx`delete from users where id::text like ${demoIdPattern("user")}`;

  for (const { itemType, category } of legacyCatalog) {
    const legacyCategory = tx`
      select c.id from categories c join item_types t on t.id = c.item_type_id
      where t.name = ${itemType} and c.name = ${category}
    `;
    await tx`
      delete from subcategories s where s.category_id in (${legacyCategory})
      and not exists (select 1 from mapping_reports r where r.subcategory_id = s.id)
    `;
    await tx`delete from categories c where c.id in (${legacyCategory}) and not exists (select 1 from subcategories s where s.category_id = c.id)`;
    await tx`delete from item_types t where t.name = ${itemType} and not exists (select 1 from categories c where c.item_type_id = t.id)`;
  }
}

async function upsertCatalog(tx) {
  for (const { itemType, category, subcategories } of catalogAdditions) {
    const [itemTypeRow] = await tx`
      insert into item_types (name) values (${itemType})
      on conflict (name) do update set name = excluded.name
      returning id
    `;
    const [categoryRow] = await tx`
      insert into categories (item_type_id, name) values (${itemTypeRow.id}, ${category})
      on conflict (item_type_id, name) do update set name = excluded.name
      returning id
    `;
    for (const name of subcategories) {
      await tx`
        insert into subcategories (category_id, name) values (${categoryRow.id}, ${name})
        on conflict (category_id, name) do nothing
      `;
    }
  }

  const rows = await tx`
    select s.id, t.name as item_type, c.name as category, s.name as subcategory
    from subcategories s
    join categories c on c.id = s.category_id
    join item_types t on t.id = c.item_type_id
  `;
  const ids = new Map(rows.map((row) => [`${row.item_type}/${row.category}/${row.subcategory}`, row.id]));
  for (const key of Object.values(K)) {
    if (!ids.has(key)) throw new Error(`Catalog entry missing: ${key} (check catalogAdditions)`);
  }
  return ids;
}

async function insertDemo(tx, subcategoryIds) {
  const audit = [];
  const outbox = [];
  let requestSeq = 0;
  const log = (action, entityType, entityId, group, actor, occurredAt, metadata = {}) => {
    audit.push({
      actor_user_id: actor,
      action,
      entity_type: entityType,
      entity_id: entityId,
      group_id: group,
      request_id: `seed-demo-${++requestSeq}`,
      metadata,
      occurred_at: occurredAt,
    });
  };
  const exportEvent = (eventType, entityType, entityId, group, occurredAt, payload) => {
    // Older events have been exported; the last day is still pending; one failed export for realism.
    const ageDays = (now - occurredAt.getTime()) / 86_400_000;
    const failed = outbox.length === 7;
    const status = failed ? "failed" : ageDays > 1 ? "completed" : "pending";
    outbox.push({
      event_type: eventType,
      entity_type: entityType,
      entity_id: entityId,
      group_id: group,
      payload: { ...payload, occurredAt },
      status,
      attempts: failed ? 3 : status === "completed" ? 1 : 0,
      available_at: occurredAt,
      created_at: occurredAt,
      processed_at: status === "completed" ? new Date(occurredAt.getTime() + 60_000) : null,
    });
  };

  // Users --------------------------------------------------------------------------------------
  await tx`insert into users ${tx(
    users.map((user) => ({
      id: userId(user.n),
      external_subject: `demo-${user.email}`,
      email: `${user.email}@demo.test`,
      display_name: user.name,
      role: user.role,
      is_active: !user.inactive,
      created_at: at(15),
      updated_at: at(15),
    })),
  )}`;

  // Group codes, groups, memberships -----------------------------------------------------------
  await tx`insert into group_codes ${tx(
    groupCodes.map((code) => ({ id: uid("groupCode", code.n), code: code.code, description: code.description, created_at: at(15) })),
  )}`;

  await tx`insert into groups ${tx(
    groups.map((group) => ({
      id: groupId(group.n),
      group_code_id: uid("groupCode", group.code),
      name: group.name,
      contact_name: userName(group.contact),
      contact_phone: group.phone,
      created_by: DEV_USER_ID,
      created_at: at(14),
      updated_at: at(14),
    })),
  )}`;
  for (const group of groups) {
    log("group.created", "group", groupId(group.n), groupId(group.n), DEV_USER_ID, at(14), { groupCodeId: uid("groupCode", group.code) });
    exportEvent("group.created", "group", groupId(group.n), groupId(group.n), at(14), { groupId: groupId(group.n) });
  }

  await tx`insert into memberships ${tx(
    memberships.map(([group, user, role], index) => ({
      user_id: typeof user === "string" ? user : userId(user),
      group_id: groupId(group),
      role,
      assigned_by: DEV_USER_ID,
      assigned_at: at(14, 1 + index * 0.1),
    })),
  )}`;
  memberships.forEach(([group, user, role], index) => {
    const id = typeof user === "string" ? user : userId(user);
    log("membership.assigned", "membership", id, groupId(group), DEV_USER_ID, at(14, 1 + index * 0.1), { role });
  });

  // Locations ----------------------------------------------------------------------------------
  await tx`insert into locations ${tx(locations.map((location) => ({ id: uid("location", location.n), name: location.name, created_at: at(15) })))}`;

  // Rooms, mapped items, packing units ---------------------------------------------------------
  const [{ value: unitCounter }] = await tx`
    select greatest(
      coalesce((select value from sequence_counters where key = 'packing_unit_number'), 0),
      coalesce((select max(unit_number::int) from packing_units where unit_number ~ '^[0-9]+$'), 0)
    ) as value
  `;
  let nextUnitNumber = Number(unitCounter);

  const roomRows = [];
  const reportRows = [];
  const unitRows = [];
  const itemRows = [];
  const unitsByTransport = new Map();
  let reportSeq = 0;
  let unitSeq = 0;
  let itemSeq = 0;

  for (const room of rooms) {
    const roomId = uid("room", room.n);
    const gid = groupId(room.group);
    const manager = memberships.find(([g, , role]) => g === room.group && role === "manager")[1];
    const commander = memberships.find(([g, , role]) => g === room.group && role === "commander")[1];
    const operators = memberships.filter(([g, , role]) => g === room.group && role === "operator").map(([, user]) => userId(user));
    const managerId = typeof manager === "string" ? manager : userId(manager);
    const commanderId = userId(commander);
    const startedAt = room.started === undefined ? null : at(room.started);
    const completedAt = room.completed === undefined ? null : at(room.completed);

    roomRows.push({
      id: roomId,
      group_id: gid,
      location_id: uid("location", room.location),
      name: room.name,
      description: room.description ?? null,
      manager_name: room.manager ?? null,
      status: room.status,
      packing_status: room.status === "completed" ? room.packing : "not_started",
      started_at: startedAt,
      completed_at: completedAt,
      created_at: at(13, room.n * 0.2),
      updated_at: completedAt ?? startedAt ?? at(13, room.n * 0.2),
    });
    log("room.created", "room", roomId, gid, managerId, at(13, room.n * 0.2));
    exportEvent("room.created", "room", roomId, gid, at(13, room.n * 0.2), { roomId, groupId: gid });
    if (startedAt) {
      log("room.status_updated", "room", roomId, gid, commanderId, startedAt, { from: "unstarted", to: "in_progress" });
    }
    if (completedAt) {
      log("room.status_updated", "room", roomId, gid, commanderId, completedAt, { from: "in_progress", to: "completed" });
      exportEvent("room.status_updated", "room", roomId, gid, completedAt, { roomId, from: "in_progress", to: "completed" });
    }

    // Items are reported between mapping start and completion (or now, while still mapping).
    const reportIds = room.items.map(([key, quantity, serial], index) => {
      const id = uid("report", ++reportSeq);
      const span = (room.completed ?? 0) - room.started;
      const reportedAt = at(room.started + (span * (index + 1)) / (room.items.length + 1));
      const reporter = operators[index % operators.length];
      if (serial && quantity !== 1) throw new Error(`Serialized item must have quantity 1: ${serial}`);
      reportRows.push({
        id,
        room_id: roomId,
        subcategory_id: subcategoryIds.get(key),
        status: "approved",
        quantity,
        serial_number: serial ? `SN-${serial}` : null,
        reported_by: reporter,
        submitted_at: reportedAt,
        reviewed_by: reporter,
        reviewed_at: reportedAt,
        created_at: reportedAt,
        updated_at: reportedAt,
      });
      log("mapping_report.created", "mapping_report", id, gid, reporter, reportedAt, { roomId, quantity });
      exportEvent("mapping_report.created", "mapping_report", id, gid, reportedAt, { reportId: id, groupId: gid, roomId });
      return { id, quantity };
    });

    const packedByReport = new Map();
    for (const unit of room.units) {
      const id = uid("unit", ++unitSeq);
      const openedAt = at(unit.opened);
      const packer = operators[unitSeq % operators.length];
      const closedAt = unit.close ? at(Math.max(unit.opened - 0.4, 0.05)) : null;
      const status = unit.close ? "closed" : unit.items.length > 0 ? "packing_in_progress" : "awaiting_packing";
      if (unit.type !== "personal_carton" && unit.close && unit.items.length === 0) {
        throw new Error(`Closed ${unit.type} in ${room.name} needs items`);
      }
      const unitNumber = unit.close ? String(++nextUnitNumber).padStart(5, "0") : null;

      unitRows.push({
        id,
        room_id: roomId,
        unit_type: unit.type,
        status,
        unit_number: unitNumber,
        destination_building: unit.close?.building ?? null,
        destination_floor: unit.close?.floor ?? null,
        destination_room: unit.close?.room ?? null,
        transport_id: null,
        created_by: packer,
        closed_at: closedAt,
        created_at: openedAt,
        updated_at: closedAt ?? openedAt,
      });
      log("packing_unit.created", "packing_unit", id, gid, packer, openedAt, { roomId, unitType: unit.type });
      exportEvent("packing_unit.created", "packing_unit", id, gid, openedAt, { packingUnitId: id, roomId, unitType: unit.type });

      for (const [reportIndex, quantity] of unit.items) {
        const report = reportIds[reportIndex];
        const packed = (packedByReport.get(report.id) ?? 0) + quantity;
        if (packed > report.quantity) throw new Error(`Over-packed item ${reportIndex} in ${room.name}`);
        packedByReport.set(report.id, packed);
        itemRows.push({
          id: uid("item", ++itemSeq),
          packing_unit_id: id,
          mapping_report_id: report.id,
          quantity,
          created_at: at(unit.opened, 0.2),
          updated_at: at(unit.opened, 0.2),
        });
      }
      if (unit.items.length > 0) {
        log("packing_unit.items_set", "packing_unit", id, gid, packer, at(unit.opened, 0.2), { itemCount: unit.items.length });
      }
      if (closedAt) {
        log("packing_unit.closed", "packing_unit", id, gid, packer, closedAt, { unitNumber, roomId });
        exportEvent("packing_unit.closed", "packing_unit", id, gid, closedAt, { packingUnitId: id, unitNumber, roomId });
      }
      if (unit.transport) {
        if (!unit.close) throw new Error("Only closed units can be assigned to a transport");
        const list = unitsByTransport.get(unit.transport) ?? [];
        list.push({ id, gid, packer, closedAt, collected: unit.collected, collector: unit.collector });
        unitsByTransport.set(unit.transport, list);
      }
    }

    if (room.status === "completed" && (room.packing === "closed" || room.packing === "paused")) {
      const lastClose = room.units.reduce((latest, unit) => Math.min(latest, unit.opened - 0.4), room.completed);
      log(`room_packing.${room.packing}`, "room", roomId, gid, commanderId, at(Math.max(lastClose - 0.2, 0.02)));
    }
  }

  await tx`insert into rooms ${tx(roomRows)}`;
  await tx`insert into mapping_reports ${tx(reportRows)}`;
  await tx`insert into packing_units ${tx(unitRows)}`;
  await tx`insert into packing_unit_items ${tx(itemRows)}`;

  // Transports ---------------------------------------------------------------------------------
  const [{ value: transportCounter }] = await tx`
    select greatest(
      coalesce((select value from sequence_counters where key = 'transport_number'), 0),
      coalesce((select max(substring(transport_number from 4)::int) from transports where transport_number ~ '^TR-[0-9]+$'), 0)
    ) as value
  `;
  let nextTransportNumber = Number(transportCounter);

  const transportRows = [];
  transports.forEach((transport, index) => {
    const id = uid("transport", index + 1);
    const group = groups.find((g) => g.n === transport.group);
    const gid = groupId(transport.group);
    const creatorId = userId(transport.creator);
    const transportNumber = `TR-${String(++nextTransportNumber).padStart(3, "0")}`;
    const units = unitsByTransport.get(transport.key) ?? [];
    const createdAt = at(transport.created);
    const transitAt = transport.transit === undefined ? null : at(transport.transit);
    const arrivedAt = transport.arrived === undefined ? null : at(transport.arrived);
    const receivedAt = transport.received === undefined ? null : at(transport.received);
    const receiverId = transport.receiver === undefined ? null : userId(transport.receiver);
    if (receivedAt && !arrivedAt) throw new Error(`Transport ${transport.key} is received before it arrived`);

    transportRows.push({
      id,
      group_id: gid,
      transport_number: transportNumber,
      status: transport.status,
      created_by_user_id: creatorId,
      created_by_name: userName(transport.creator),
      source_city: group.sourceCity,
      source_unit: group.sourceUnit,
      source_building: transport.sourceBuilding,
      source_room: transport.sourceRoom,
      destination_city: transport.destCity,
      destination_unit: transport.destUnit,
      destination_building: transport.destBuilding,
      destination_room: transport.destRoom,
      package_count: transport.packageCount ?? Math.max(units.length, 1),
      package_summary: transport.summary,
      vehicle_type: transport.vehicle?.[0] ?? null,
      vehicle_number: transport.vehicle?.[1] ?? null,
      scheduled_at: at(transport.scheduled),
      transit_at: transitAt,
      arrived_at: arrivedAt,
      received_at: receivedAt,
      received_by_user_id: receiverId,
      created_at: createdAt,
      updated_at: receivedAt ?? arrivedAt ?? transitAt ?? createdAt,
    });
    log("transport.created", "transport", id, gid, creatorId, createdAt, { transportNumber });
    exportEvent("transport.created", "transport", id, gid, createdAt, { transportId: id, transportNumber });
    for (const unit of units) {
      unit.transportId = id;
      const assignedAt = new Date(Math.max(createdAt.getTime(), unit.closedAt.getTime()) + 1_800_000);
      log("packing_unit.assigned_transport", "packing_unit", unit.id, gid, unit.packer, assignedAt, { transportId: id });
    }
    if (transitAt) log("transport.status_updated", "transport", id, gid, creatorId, transitAt, { from: "waiting", to: "transit" });
    if (arrivedAt) log("transport.status_updated", "transport", id, gid, creatorId, arrivedAt, { from: "transit", to: "arrived" });
    if (receivedAt) log("transport.receipt_confirmed", "transport", id, gid, receiverId, receivedAt, { transportNumber });
    for (const unit of units.filter((entry) => entry.collected !== undefined)) {
      if (!receivedAt) throw new Error(`A unit of transport ${transport.key} is collected before the transport was received`);
      unit.collectedAt = at(unit.collected);
      unit.collectorId = userId(unit.collector);
      log("packing_unit.picked_up", "packing_unit", unit.id, gid, unit.collectorId, unit.collectedAt, {});
    }
  });

  await tx`insert into transports ${tx(transportRows)}`;
  for (const units of unitsByTransport.values()) {
    for (const unit of units) {
      await tx`update packing_units set transport_id = ${unit.transportId}, collected_at = ${unit.collectedAt ?? null}, collected_by_user_id = ${unit.collectorId ?? null} where id = ${unit.id}`;
    }
  }

  // Counters, audit trail, outbox -------------------------------------------------------------
  await tx`
    insert into sequence_counters (key, value) values
      ('packing_unit_number', ${nextUnitNumber}),
      ('transport_number', ${nextTransportNumber})
    on conflict (key) do update set value = greatest(sequence_counters.value, excluded.value)
  `;
  await tx`insert into audit_events ${tx(audit)}`;
  await tx`insert into export_outbox ${tx(outbox)}`;

  console.log(
    `users ${users.length}, groups ${groups.length}, memberships ${memberships.length}, locations ${locations.length}, ` +
      `rooms ${roomRows.length}, mapped items ${reportRows.length}, packing units ${unitRows.length}, ` +
      `unit lines ${itemRows.length}, transports ${transportRows.length}, audit events ${audit.length}, outbox ${outbox.length}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
