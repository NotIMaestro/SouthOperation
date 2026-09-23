// Demo data for every app table, themed as Bamba / Bisli snack distribution (deliberately neutral
// content): users, groups + memberships, locations, rooms in every mapping / packing state, mapped
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
  { n: 1, name: "נועה ברק", email: "noa.barak", role: "admin" },
  { n: 2, name: "אבי כהן", email: "avi.cohen", role: "manager" },
  { n: 3, name: "מיכל לוי", email: "michal.levi", role: "manager" },
  { n: 4, name: "יוסי מזרחי", email: "yossi.mizrahi", role: "commander" },
  { n: 5, name: "שירה אזולאי", email: "shira.azulay", role: "commander" },
  { n: 6, name: "דניאל פרץ", email: "daniel.peretz", role: "operator" },
  { n: 7, name: "רותם ביטון", email: "rotem.biton", role: "operator" },
  { n: 8, name: "עומר חדד", email: "omer.hadad", role: "operator" },
  { n: 9, name: "תמר גולן", email: "tamar.golan", role: "operator", inactive: true },
];
const userId = (n) => uid("user", n);
const userName = (n) => users.find((user) => user.n === n).name;

const groupCodes = [
  { n: 1, code: "BMB-01", description: "קו במבה" },
  { n: 2, code: "BSL-01", description: "קו ביסלי" },
  { n: 3, code: "DST-01", description: "הפצה – במבה וביסלי" },
];

const groups = [
  { n: 1, code: 1, name: "מפעל במבה – קו ייצור", contact: 2, phone: "050-1234567", sourceCity: "קריית גת", sourceUnit: "מפעל במבה" },
  { n: 2, code: 2, name: "מפעל ביסלי – קו ייצור", contact: 3, phone: "052-7654321", sourceCity: "שדרות", sourceUnit: "מפעל ביסלי" },
  { n: 3, code: 3, name: "מרכז הפצה – במבה וביסלי", contact: 5, phone: "054-5550123", sourceCity: "אשדוד", sourceUnit: "מרכז הפצה" },
];
const groupId = (n) => uid("group", n);

const memberships = [
  [1, DEV_USER_ID, "manager"], [1, 2, "manager"], [1, 4, "commander"], [1, 6, "operator"], [1, 7, "operator"],
  [2, 3, "manager"], [2, 5, "commander"], [2, 8, "operator"], [2, 7, "operator"],
  [3, 3, "manager"], [3, 4, "commander"], [3, 5, "commander"], [3, 6, "operator"],
];

const locations = [
  { n: 1, name: "מפעל במבה – אולם ייצור" },
  { n: 2, name: "מפעל במבה – מחסן תוצרת" },
  { n: 3, name: "מפעל ביסלי – אולם ייצור" },
  { n: 4, name: "מרכז הפצה – אשדוד" },
  { n: 5, name: "סניף הפצה – באר שבע" },
];

const catalogAdditions = [
  { itemType: "חטיפי במבה", category: "במבה", subcategories: ["במבה קלאסית 80 גרם", "במבה נוגט", "במבה מתוקה", "במבה מגה פק"] },
  { itemType: "חטיפי ביסלי", category: "ביסלי", subcategories: ["ביסלי גריל", "ביסלי בצל", "ביסלי פלאפל", "ביסלי ברביקיו", "ביסלי פיצה"] },
  { itemType: "חומרי אריזה", category: "אריזה", subcategories: ["קרטון מאסטר", "ניילון נצמד", "משטח עץ"] },
  { itemType: "ציוד מפעל", category: "ציוד תפעול", subcategories: ["מלגזה חשמלית", "עגלת משטחים", "מאזני רצפה", "מדפסת מדבקות"] },
];

// Item keys are "itemType/category/subcategory"; all come from catalogAdditions above.
const K = {
  bamba: "חטיפי במבה/במבה/במבה קלאסית 80 גרם",
  nougat: "חטיפי במבה/במבה/במבה נוגט",
  sweet: "חטיפי במבה/במבה/במבה מתוקה",
  mega: "חטיפי במבה/במבה/במבה מגה פק",
  grill: "חטיפי ביסלי/ביסלי/ביסלי גריל",
  onion: "חטיפי ביסלי/ביסלי/ביסלי בצל",
  falafel: "חטיפי ביסלי/ביסלי/ביסלי פלאפל",
  bbq: "חטיפי ביסלי/ביסלי/ביסלי ברביקיו",
  pizza: "חטיפי ביסלי/ביסלי/ביסלי פיצה",
  carton: "חומרי אריזה/אריזה/קרטון מאסטר",
  wrap: "חומרי אריזה/אריזה/ניילון נצמד",
  pallet: "חומרי אריזה/אריזה/משטח עץ",
  forklift: "ציוד מפעל/ציוד תפעול/מלגזה חשמלית",
  cart: "ציוד מפעל/ציוד תפעול/עגלת משטחים",
  scale: "ציוד מפעל/ציוד תפעול/מאזני רצפה",
  labeler: "ציוד מפעל/ציוד תפעול/מדפסת מדבקות",
};

const dest = (building, floor, room) => ({ building, floor, room });

/*
 * Rooms. `status` is the mapping state; `packing` only matters once mapped.
 * items:  [catalogKey, quantity, serial?]           (a serial forces quantity 1)
 * units:  { type, items: [[itemIndex, qty]], close?: dest, transport? }  — closed when `close` is set
 * Days are "days ago": started → completed → units opened/closed.
 */
const rooms = [
  // --- Group 1: Bamba plant — every packing state -----------------------------------------------
  {
    n: 1, group: 1, location: 1, name: "קו אריזה במבה 1", manager: "יוסי מזרחי",
    description: "שקיות 80 גרם ומגה פק", status: "completed", packing: "closed",
    started: 12, completed: 9,
    items: [[K.bamba, 240], [K.mega, 60], [K.forklift, 1, "FL-0412"], [K.scale, 1, "SC-1107"], [K.carton, 40], [K.wrap, 12]],
    units: [
      { type: "pallet", opened: 6, items: [[0, 240]], close: dest("מרכז הפצה", "0", "רציף 3"), transport: "a" },
      { type: "pallet", opened: 6, items: [[1, 60], [4, 40]], close: dest("מרכז הפצה", "0", "רציף 3"), transport: "a" },
      { type: "dolav", opened: 5, items: [[5, 12]], close: dest("מרכז הפצה", "0", "רציף 3"), transport: "a" },
    ],
  },
  {
    n: 2, group: 1, location: 2, name: "מחסן במבה נוגט", manager: "אבי כהן",
    description: "מדפים 1–12", status: "completed", packing: "in_packing",
    started: 11, completed: 8,
    items: [[K.nougat, 180], [K.sweet, 90], [K.labeler, 1, "LB-88213"], [K.pallet, 8], [K.carton, 30], [K.cart, 2]],
    units: [
      { type: "pallet", opened: 4, items: [[0, 120]], close: dest("סניף באר שבע", "0", "מחסן 2"), transport: "b" },
      { type: "personal_carton", opened: 4, items: [], close: dest("סניף באר שבע", "0", "משרד"), transport: "b" },
      { type: "pallet", opened: 3, items: [[1, 90], [4, 30]], close: dest("סניף באר שבע", "0", "מחסן 2") },
      { type: "professional_carton", opened: 1, items: [[0, 40]] },
      { type: "dolav", opened: 0, items: [] },
    ],
  },
  {
    n: 3, group: 1, location: 2, name: "מחסן במבה מתוקה", manager: "אבי כהן",
    status: "completed", packing: "not_started", started: 9, completed: 6,
    items: [[K.sweet, 150], [K.bamba, 80], [K.pallet, 4], [K.wrap, 6]],
    units: [],
  },
  {
    n: 4, group: 1, location: 1, name: "חדר בקרת איכות", manager: "יוסי מזרחי",
    description: "דוגמיות מכל אצווה", status: "in_progress", started: 3,
    items: [[K.bamba, 24], [K.nougat, 24], [K.scale, 1, "SC-2210"]],
    units: [],
  },
  { n: 5, group: 1, location: 2, name: "מחסן קרטונים ריקים", status: "unstarted", items: [], units: [] },

  // --- Group 2: Bisli plant --------------------------------------------------------------------
  {
    n: 6, group: 2, location: 3, name: "מחסן ביסלי גריל", manager: "שירה אזולאי",
    description: "תוצרת מוכנה למשלוח", status: "completed", packing: "paused", started: 10, completed: 7,
    items: [[K.grill, 300], [K.bbq, 120], [K.carton, 50], [K.pallet, 6], [K.forklift, 1, "FL-5520"]],
    units: [
      { type: "pallet", opened: 4, items: [[0, 300]], close: dest("מרכז הפצה", "0", "רציף 1"), transport: "d" },
      { type: "pallet", opened: 3, items: [[1, 120], [2, 50]], close: dest("מרכז הפצה", "0", "רציף 1"), transport: "d" },
      { type: "bulk", opened: 2, items: [[3, 6]], close: dest("מרכז הפצה", "1", "מחסן משטחים") },
    ],
  },
  {
    n: 7, group: 2, location: 3, name: "מחסן ביסלי בצל ופלאפל", manager: "מיכל לוי",
    status: "completed", packing: "in_packing", started: 8, completed: 5,
    items: [[K.onion, 200], [K.falafel, 160], [K.pizza, 80], [K.labeler, 1, "LB-90021"], [K.cart, 3]],
    units: [
      { type: "pallet", opened: 2, items: [[0, 200], [3, 1]], close: dest("סניף באר שבע", "0", "מחסן 1") },
      { type: "professional_carton", opened: 1, items: [[1, 100]] },
    ],
  },
  {
    n: 8, group: 2, location: 3, name: "קו אריזה ביסלי 2", status: "in_progress", started: 2,
    items: [[K.pizza, 140], [K.bbq, 90]], units: [],
  },
  { n: 9, group: 2, location: 3, name: "מחסן תבלינים", description: "תערובות טעמים", status: "unstarted", items: [], units: [] },

  // --- Group 3: distribution center ------------------------------------------------------------
  {
    n: 10, group: 3, location: 4, name: "רציף טעינה A", manager: "שירה אזולאי",
    status: "completed", packing: "in_packing", started: 7, completed: 4,
    items: [[K.bamba, 400], [K.grill, 250], [K.forklift, 1, "FL-7731"], [K.pallet, 20], [K.wrap, 10]],
    units: [
      { type: "pallet", opened: 2, items: [[0, 400], [4, 10]], close: dest("סניף באר שבע", "0", "רציף קבלה"), transport: "f" },
      { type: "personal_carton", opened: 1, items: [], close: dest("סניף באר שבע", "0", "משרד") },
      { type: "pallet", opened: 0, items: [] },
    ],
  },
  {
    n: 11, group: 3, location: 4, name: "מחסן החזרות", manager: "יוסי מזרחי",
    status: "in_progress", started: 1, items: [[K.bamba, 35], [K.onion, 20], [K.mega, 12]], units: [],
  },
  { n: 12, group: 3, location: 4, name: "משרד סדרן", status: "unstarted", items: [], units: [] },
];

// Transports, keyed by the letters the units above point at.
const transports = [
  { key: "a", group: 1, status: "arrived", creator: 4, created: 4, transit: 3, arrived: 2, vehicle: ["משאית", "71-402-33"], scheduled: 3,
    sourceBuilding: "אולם ייצור", sourceRoom: "קו אריזה 1", destCity: "אשדוד", destUnit: "מרכז הפצה", destBuilding: "מרכז הפצה", destRoom: "רציף 3",
    summary: "משטחי במבה קלאסית ומגה פק" },
  { key: "b", group: 1, status: "transit", creator: 4, created: 2, transit: 0.2, vehicle: ["משאית קירור", "38-119-72"], scheduled: 0.3,
    sourceBuilding: "מחסן תוצרת", sourceRoom: "מחסן נוגט", destCity: "באר שבע", destUnit: "סניף הפצה", destBuilding: "סניף באר שבע", destRoom: "מחסן 2",
    summary: "במבה נוגט לסניף הדרום" },
  { key: "c", group: 1, status: "waiting", creator: 2, created: 0.5, scheduled: -1,
    sourceBuilding: "מחסן תוצרת", sourceRoom: "מחסן במבה מתוקה", destCity: "באר שבע", destUnit: "סניף הפצה", destBuilding: "סניף באר שבע", destRoom: "מחסן 1",
    summary: "במבה מתוקה – הזמנה שבועית", packageCount: 3 },
  { key: "d", group: 2, status: "transit", creator: 5, created: 2, transit: 1, vehicle: ["משאית", "82-555-10"], scheduled: 1,
    sourceBuilding: "אולם ייצור", sourceRoom: "מחסן גריל", destCity: "אשדוד", destUnit: "מרכז הפצה", destBuilding: "מרכז הפצה", destRoom: "רציף 1",
    summary: "ביסלי גריל וברביקיו" },
  { key: "e", group: 2, status: "waiting", creator: 5, created: 0.3, scheduled: -2,
    sourceBuilding: "אולם ייצור", sourceRoom: "מחסן בצל ופלאפל", destCity: "באר שבע", destUnit: "סניף הפצה", destBuilding: "סניף באר שבע", destRoom: "מחסן 1",
    summary: "ביסלי בצל, פלאפל ופיצה", packageCount: 2 },
  { key: "f", group: 3, status: "waiting", creator: 5, created: 1, scheduled: -0.5,
    sourceBuilding: "מרכז הפצה", sourceRoom: "רציף A", destCity: "באר שבע", destUnit: "סניף הפצה", destBuilding: "סניף באר שבע", destRoom: "רציף קבלה",
    summary: "משלוח מעורב במבה וביסלי לסופרמרקטים" },
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
      email: `${user.email}@snacks.demo`,
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
        serial_number: serial ? `DEMO-${serial}` : null,
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
        list.push({ id, gid, packer, closedAt });
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
      created_at: createdAt,
      updated_at: arrivedAt ?? transitAt ?? createdAt,
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
  });

  await tx`insert into transports ${tx(transportRows)}`;
  for (const units of unitsByTransport.values()) {
    for (const unit of units) {
      await tx`update packing_units set transport_id = ${unit.transportId} where id = ${unit.id}`;
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
