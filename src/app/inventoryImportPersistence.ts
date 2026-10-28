export function persistImportedInventory<T extends { id: number }>(
  storage: Pick<Storage, "getItem" | "setItem">,
  storageKey: string,
  currentProducts: T[],
  importedProducts: T[]
): T[] {
  const existingIds = new Set(currentProducts.map((product) => product.id));
  const importedIds = new Set<number>();
  for (const product of importedProducts) {
    if (existingIds.has(product.id) || importedIds.has(product.id)) {
      throw new Error("Import contains a product ID that already exists. Nothing was saved.");
    }
    importedIds.add(product.id);
  }

  const nextProducts = [...currentProducts, ...importedProducts];
  const expected = JSON.stringify(nextProducts);
  let saved: string | null;
  try {
    storage.setItem(storageKey, expected);
    saved = storage.getItem(storageKey);
  } catch {
    throw new Error("Dukan Yantra could not save or verify the imported products in this account's local inventory.");
  }
  if (saved !== expected) throw new Error("Dukan Yantra could not confirm the inventory save.");
  return nextProducts;
}
