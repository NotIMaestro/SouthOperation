"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";

import { callApi } from "@/lib/api-client";
import type { CatalogItemType } from "@/lib/server-api";

type Kind = "item_type" | "category" | "subcategory";

const kindLabels: Record<Kind, string> = {
  item_type: "סוג פריט",
  category: "קטגוריה",
  subcategory: "תת־קטגוריה",
};

export function CatalogAddForm({ tree }: { tree: CatalogItemType[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("subcategory");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = tree.flatMap((itemType) =>
    itemType.categories.map((category) => ({ id: category.id, label: `${itemType.name} / ${category.name}` })),
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("name") ?? "").trim();
    const parentId = String(formData.get("parentId") ?? "");
    const body =
      kind === "item_type"
        ? { kind, name }
        : kind === "category"
          ? { kind, name, itemTypeId: parentId, isSpecial: formData.get("isSpecial") === "on" }
          : { kind, name, categoryId: parentId };

    setPending(true);
    setError(null);
    const result = await callApi("/api/v1/catalog", { body });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    form.reset();
    router.refresh();
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <h2>הוספה לקטלוג</h2>
      <p className="hint">פריטים חדשים זמינים מיד בדיווח פריטים באריזה.</p>
      <div className="inline-form">
        <div className="field">
          <label htmlFor="catalog-kind">מה מוסיפים</label>
          <select id="catalog-kind" onChange={(event) => setKind(event.target.value as Kind)} value={kind}>
            {(Object.keys(kindLabels) as Kind[]).map((key) => <option key={key} value={key}>{kindLabels[key]}</option>)}
          </select>
        </div>
        {kind === "category" && (
          <div className="field">
            <label htmlFor="catalog-parent">תחת סוג פריט</label>
            <select defaultValue="" id="catalog-parent" key="item-type-parent" name="parentId" required>
              <option disabled value="">בחירה</option>
              {tree.map((itemType) => <option key={itemType.id} value={itemType.id}>{itemType.name}</option>)}
            </select>
          </div>
        )}
        {kind === "subcategory" && (
          <div className="field">
            <label htmlFor="catalog-parent">תחת קטגוריה</label>
            <select defaultValue="" id="catalog-parent" key="category-parent" name="parentId" required>
              <option disabled value="">בחירה</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="catalog-name">שם</label>
          <input id="catalog-name" maxLength={160} name="name" placeholder={`שם ${kindLabels[kind]}`} required />
        </div>
        {kind === "category" && (
          <label className="field" style={{ minWidth: "auto", flex: "0 0 auto" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <input name="isSpecial" type="checkbox" /> קטגוריה מיוחדת
            </span>
          </label>
        )}
        <button className="button primary" disabled={pending} type="submit">
          <Plus aria-hidden="true" /> {pending ? "מוסיף..." : "הוספה"}
        </button>
      </div>
      {error && <p className="inline-error" style={{ marginTop: "0.6rem" }}>{error}</p>}
    </form>
  );
}
