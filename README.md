# South Operation (מעבר דרומה)

Documentation and planning for **South Operation** — the equipment relocation ("Move South")
initiative: evacuating and relocating tens of thousands of items of professional equipment,
lab gear, office contents, and personal equipment to a new base.

## Background

**Phase 1 — room content mapping** is complete. Field teams mapped the contents of every room
(what equipment is where) before the physical move began. The data model and API that back this
phase already exist and are documented in [`docs/`](docs/).

**Phase 2 — the physical evacuation chain** is the current challenge: packing, loading and
transport, receiving and unloading, and distribution into destination rooms at the new base,
end-to-end.

### The problem on the ground

- **Soldiers and packers in the field** deal with a slow, error-prone, manual process — endless
  manual item tagging, picking from long lists, and operating a system while carrying boxes,
  creating bottlenecks, truck delays, and loss of sensitive equipment.
- **The move commander and staff** need full command and control over a complex operation, but
  today it's hard to get a unified, reliable, real-time picture: which rooms are ready, where
  trucks are en route, and which items are missing or lost during unloading.
- **The army** needs an independent, fast, and secure operational system that guarantees
  functional continuity and zero equipment loss throughout the transport and relocation.

### The challenge

Characterize and build, from scratch, an innovative and smart system to manage the evacuation,
transport, and receiving chain for South Operation equipment. The system should make field
operations (packing, tagging, receiving, and distribution) fast, simple, and nearly frictionless,
while giving move management and commanders a live, accurate, insight-driven command view.

## Documentation

| Document | Description |
| --- | --- |
| [docs/SOUTH_OPERATION_ERD.md](docs/SOUTH_OPERATION_ERD.md) | Entity-relationship diagram and full schema reference for the existing `moving_south_operation` database (Phase 1: room mapping) — every table, key, and relationship, including where the code and database disagree. |
| [docs/SOUTH_OPERATION_API.md](docs/SOUTH_OPERATION_API.md) | Full reference for the existing South Operation API — every model and endpoint, roles, validation, and known quirks. |
| [docs/מעבר דרומה.docx](docs/מעבר%20דרומה.docx) | Original problem brief (Hebrew) for Phase 2 — the evacuation, transport, and receiving chain. |

## Existing data model (Phase 1)

The current schema is an equipment-mapping domain:

- **Groups** — units/sites, each identified by a numeric ID.
- **Rooms** — inside a group, each with a mapping status (`waiting` → `inProgress` → done).
- **Category → SubCategory** — a two-level equipment classification tree, optionally tagged with
  an **ItemType**.
- **MappingReport** — the record of what equipment (and how much of it) was found in a room.
- **UserGroup** — access control: which users may work on which groups.
- **GroupCodes** — pre-registration of who should get access to a group once it's created under
  a given code.

See [docs/SOUTH_OPERATION_ERD.md](docs/SOUTH_OPERATION_ERD.md) for the full table catalog and
[docs/SOUTH_OPERATION_API.md](docs/SOUTH_OPERATION_API.md) for every endpoint built on top of it.

## Status

This repository is at the planning stage for Phase 2. No application code has been added yet.
