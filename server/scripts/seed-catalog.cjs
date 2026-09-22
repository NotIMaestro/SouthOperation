// One-off/idempotent seed for the item catalog (item_types -> categories -> subcategories).
// Run with: DATABASE_URL=... node server/scripts/seed-catalog.cjs
// Safe to re-run: uses ON CONFLICT DO NOTHING on each table's unique name index.

const postgres = require("postgres");

const catalog = [
  {
    itemType: "ציוד מחשוב",
    categories: [
      { name: "מחשבים", subcategories: ["מחשב נייח", "מחשב נייד"] },
      { name: "מסכים", subcategories: ["מסך מחשב"] },
      { name: "ציוד היקפי", subcategories: ["מקלדת ועכבר", "מדפסת"] },
    ],
  },
  {
    itemType: "ציוד תקשוב",
    categories: [
      { name: "ציוד קשר", subcategories: ["מכשיר קשר"] },
      { name: "רשת ותקשורת", subcategories: ["נתב / מתג"] },
    ],
  },
  {
    itemType: "ריהוט משרדי",
    categories: [
      { name: "ריהוט", subcategories: ["שולחן עבודה", "כיסא משרדי", "ארון תיוק"] },
    ],
  },
  {
    itemType: "ציוד אישי",
    categories: [
      { name: "ציוד אישי", isSpecial: true, subcategories: ["תיק אישי", "ציוד מגן אישי"] },
    ],
  },
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const sql = postgres(databaseUrl, { max: 1 });

  try {
    for (const { itemType, categories } of catalog) {
      const [itemTypeRow] = await sql`
        insert into item_types (name) values (${itemType})
        on conflict (name) do update set name = excluded.name
        returning id
      `;
      for (const { name: categoryName, isSpecial = false, subcategories } of categories) {
        const [categoryRow] = await sql`
          insert into categories (item_type_id, name, is_special)
          values (${itemTypeRow.id}, ${categoryName}, ${isSpecial})
          on conflict (item_type_id, name) do update set name = excluded.name
          returning id
        `;
        for (const subcategoryName of subcategories) {
          await sql`
            insert into subcategories (category_id, name)
            values (${categoryRow.id}, ${subcategoryName})
            on conflict (category_id, name) do nothing
          `;
        }
      }
    }
    console.log("Catalog seeded.");
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
