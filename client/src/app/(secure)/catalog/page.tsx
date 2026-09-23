import { Library } from "lucide-react";

import { ActionButton } from "@/components/action-button";
import { EmptyState } from "@/components/empty-state";
import { CatalogAddForm } from "@/components/management/catalog-add-form";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/packing/status-badge";
import { getViewerAccess, listCatalogTree } from "@/lib/server-api";

export default async function CatalogPage() {
  const [treeResult, accessResult] = await Promise.all([listCatalogTree(), getViewerAccess()]);
  const isAdmin = accessResult.ok && accessResult.data.isAdmin;

  if (!treeResult.ok) {
    return (
      <main className="page-shell">
        <PageHeader title="קטלוג פריטים" description="סוגי ציוד, קטגוריות ותת־קטגוריות לדיווח" />
        <EmptyState icon={Library} title="שגיאה בטעינת הקטלוג" description={treeResult.message} />
      </main>
    );
  }

  const tree = treeResult.data;

  return (
    <main className="page-shell">
      <PageHeader
        title="קטלוג פריטים"
        description={isAdmin ? "סוגי ציוד, קטגוריות ותת־קטגוריות לדיווח · ניהול למנהלי מערכת" : "סוגי ציוד, קטגוריות ותת־קטגוריות לדיווח"}
      />
      <div className="stack">
        {isAdmin && <CatalogAddForm tree={tree} />}
        {tree.length === 0 ? (
          <EmptyState icon={Library} title="הקטלוג ריק" description="הוסיפו סוג פריט ראשון כדי להתחיל." />
        ) : (
          <div className="catalog-tree">
            {tree.map((itemType) => (
              <section className="panel" key={itemType.id}>
                <div className="panel-heading"><h2>{itemType.name}</h2></div>
                {itemType.categories.length === 0 && <p className="hint">אין קטגוריות עדיין.</p>}
                <ul>
                  {itemType.categories.map((category) => (
                    <li className="catalog-category" key={category.id}>
                      <span className="catalog-category-title">
                        {category.name}
                        {category.isSpecial && <StatusBadge label="מיוחדת" tone="warning" />}
                      </span>
                      <div className="catalog-sub-list">
                        {category.subcategories.length === 0 && <span className="hint">אין תת־קטגוריות.</span>}
                        {category.subcategories.map((subcategory) => (
                          <span className="catalog-chip" key={subcategory.id}>
                            {subcategory.name}
                            {isAdmin && (
                              <ActionButton
                                confirmLabel="להסיר?"
                                method="DELETE"
                                url={`/api/v1/catalog/subcategories/${subcategory.id}`}
                              >
                                ×
                              </ActionButton>
                            )}
                          </span>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
