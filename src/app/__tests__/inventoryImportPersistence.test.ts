import { describe, expect, it } from "vitest";
import { persistImportedInventory } from "../inventoryImportPersistence";

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: (key) => { values.delete(key); },
    clear: () => { values.clear(); },
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
}

describe("inventory import persistence", () => {
  it("writes to the account-scoped key and verifies the complete saved record set", () => {
    const storage = createMemoryStorage();
    const existing = [{ id: 1, name: "Existing", stock: 2 }];
    const imported = [{ id: 2, name: "New item", stock: 5 }];

    const saved = persistImportedInventory(storage, "account_A_products", existing, imported);

    expect(JSON.parse(storage.getItem("account_A_products") || "null")).toEqual(saved);
    expect(storage.getItem("account_B_products")).toBeNull();
    expect(existing).toEqual([{ id: 1, name: "Existing", stock: 2 }]);
  });

  it("does not alter storage when the import is cancelled before confirmation", () => {
    const storage = createMemoryStorage();
    storage.setItem("account_A_products", JSON.stringify([{ id: 1, name: "Existing", stock: 2 }]));
    const before = storage.getItem("account_A_products");

    expect(storage.getItem("account_A_products")).toBe(before);
  });

  it("rejects repeated product IDs before writing inventory a second time", () => {
    const storage = createMemoryStorage();
    const existing = [{ id: 2, name: "Imported once", stock: 5 }];

    expect(() => persistImportedInventory(storage, "account_A_products", existing, existing))
      .toThrow("product ID that already exists");
    expect(storage.getItem("account_A_products")).toBeNull();
  });

  it("reports failed writes instead of presenting a success result", () => {
    const storage = createMemoryStorage();
    storage.setItem = () => { throw new Error("quota exceeded"); };

    expect(() => persistImportedInventory(storage, "account_A_products", [], [{ id: 1 }]))
      .toThrow("could not save or verify");
  });
});
