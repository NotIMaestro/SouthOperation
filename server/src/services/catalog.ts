import { and, asc, eq, isNull } from "drizzle-orm";

import { getDb } from "../db";
import { auditEvents, categories, itemTypes, subcategories } from "../db/schema";
import type { Actor } from "../lib/authorization";
import { HttpError, isUniqueViolation } from "../lib/errors";

export type CreateCatalogEntryInput =
  | { kind: "item_type"; name: string }
  | { kind: "category"; itemTypeId: string; name: string; isSpecial?: boolean }
  | { kind: "subcategory"; categoryId: string; name: string };

/** Every live catalog level, including item types and categories that have no children yet. */
export async function listCatalogTree() {
  const db = getDb();
  const [itemTypeRows, categoryRows, subcategoryRows] = await Promise.all([
    db.select({ id: itemTypes.id, name: itemTypes.name }).from(itemTypes).where(isNull(itemTypes.archivedAt)).orderBy(asc(itemTypes.name)),
    db
      .select({ id: categories.id, itemTypeId: categories.itemTypeId, name: categories.name, isSpecial: categories.isSpecial })
      .from(categories)
      .where(isNull(categories.archivedAt))
      .orderBy(asc(categories.name)),
    db
      .select({ id: subcategories.id, categoryId: subcategories.categoryId, name: subcategories.name })
      .from(subcategories)
      .where(isNull(subcategories.archivedAt))
      .orderBy(asc(subcategories.name)),
  ]);

  return itemTypeRows.map((itemType) => ({
    ...itemType,
    categories: categoryRows
      .filter((category) => category.itemTypeId === itemType.id)
      .map((category) => ({
        ...category,
        subcategories: subcategoryRows.filter((subcategory) => subcategory.categoryId === category.id),
      })),
  }));
}

export async function createCatalogEntry(actor: Actor, input: CreateCatalogEntryInput, requestId: string) {
  const db = getDb();
  const id = crypto.randomUUID();
  const occurredAt = new Date();

  try {
    await db.transaction(async (transaction) => {
      if (input.kind === "item_type") {
        await transaction.insert(itemTypes).values({ id, name: input.name });
      } else if (input.kind === "category") {
        const [parent] = await transaction
          .select({ id: itemTypes.id })
          .from(itemTypes)
          .where(and(eq(itemTypes.id, input.itemTypeId), isNull(itemTypes.archivedAt)))
          .limit(1);
        if (!parent) throw new HttpError(400, "INVALID_REFERENCE", "A referenced record is not available.");
        await transaction
          .insert(categories)
          .values({ id, itemTypeId: input.itemTypeId, name: input.name, isSpecial: input.isSpecial ?? false });
      } else {
        const [parent] = await transaction
          .select({ id: categories.id })
          .from(categories)
          .where(and(eq(categories.id, input.categoryId), isNull(categories.archivedAt)))
          .limit(1);
        if (!parent) throw new HttpError(400, "INVALID_REFERENCE", "A referenced record is not available.");
        await transaction.insert(subcategories).values({ id, categoryId: input.categoryId, name: input.name });
      }

      await transaction.insert(auditEvents).values({
        actorUserId: actor.id,
        action: `catalog.${input.kind}_created`,
        entityType: input.kind,
        entityId: id,
        requestId,
        metadata: { name: input.name },
        occurredAt,
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new HttpError(409, "DUPLICATE_NAME", "כבר קיים פריט בשם זה באותה רמה בקטלוג.");
    }
    throw error;
  }

  return { id, ...input };
}

export async function archiveSubcategory(actor: Actor, subcategoryId: string, requestId: string) {
  const db = getDb();
  const occurredAt = new Date();

  await db.transaction(async (transaction) => {
    // Existing mapping reports keep pointing at the archived row; it just stops being offered.
    const archived = await transaction
      .update(subcategories)
      .set({ archivedAt: occurredAt })
      .where(and(eq(subcategories.id, subcategoryId), isNull(subcategories.archivedAt)))
      .returning({ id: subcategories.id });

    if (archived.length === 0) {
      throw new HttpError(404, "NOT_FOUND", "The requested resource was not found.");
    }

    await transaction.insert(auditEvents).values({
      actorUserId: actor.id,
      action: "catalog.subcategory_archived",
      entityType: "subcategory",
      entityId: subcategoryId,
      requestId,
      metadata: {},
      occurredAt,
    });
  });

  return { id: subcategoryId };
}
