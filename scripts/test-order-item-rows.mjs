#!/usr/bin/env node
/**
 * Regression test for the 19 May - 24 Aug 2026 checkout outage.
 *
 * The checkout built order_items rows by spreading the in-memory cart line,
 * which carried `square_variation_token`. That is not a column on order_items,
 * so PostgREST rejected the entire insert (42703 / PGRST204) and every single
 * checkout failed. TypeScript could not catch it: the DB schema is not in the
 * type system. This test is the guard.
 */

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import ts from "typescript";

async function importTs(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const outputDir = new URL("../.tmp/test-modules/", import.meta.url);
  await mkdir(outputDir, { recursive: true });
  const outputFile = new URL(`${relativePath.replace(/[^a-z0-9]/gi, "_")}.mjs`, outputDir);
  await writeFile(outputFile, outputText);
  return import(outputFile.href);
}

const { buildOrderItemRows, ORDER_ITEM_COLUMNS } = await importTs(
  "../src/lib/checkout-guards.ts"
);

// The live column list of public.order_items, minus the generated `id`.
// Verified against the deployed PostgREST schema on 27 Aug 2026.
const LIVE_ORDER_ITEM_COLUMNS = [
  "order_id",
  "product_id",
  "variation_id",
  "product_name",
  "variation_name",
  "sku",
  "quantity",
  "unit_price",
  "total_price",
];

// 1. The declared column list must match the real table.
assert.deepEqual(
  [...ORDER_ITEM_COLUMNS].sort(),
  [...LIVE_ORDER_ITEM_COLUMNS].sort(),
  "ORDER_ITEM_COLUMNS has drifted from the live order_items table"
);

// 2. A cart line carrying extra fields must not leak them into the insert.
//    This is the exact shape that caused the outage.
const cartLines = [
  {
    product_id: "11111111-1111-1111-1111-111111111111",
    variation_id: "22222222-2222-2222-2222-222222222222",
    product_name: "Torini Homologated Power Pipe",
    variation_name: "Regular",
    sku: "ET.TC25060",
    quantity: 2,
    unit_price: 75,
    total_price: 150,
    // Needed by buildSquareOrderLineItems, fatal if it reaches the DB:
    square_variation_token: "SQUARE_VARIATION_TOKEN",
  },
];

const rows = buildOrderItemRows(cartLines, "33333333-3333-3333-3333-333333333333");

assert.equal(rows.length, 1);
for (const row of rows) {
  for (const key of Object.keys(row)) {
    assert.ok(
      LIVE_ORDER_ITEM_COLUMNS.includes(key),
      `order_items insert would include unknown column "${key}" - this fails at runtime, not compile time`
    );
  }
}

assert.ok(
  !("square_variation_token" in rows[0]),
  "square_variation_token leaked into the order_items insert"
);

// 3. Values are carried through correctly.
assert.equal(rows[0].order_id, "33333333-3333-3333-3333-333333333333");
assert.equal(rows[0].product_name, "Torini Homologated Power Pipe");
assert.equal(rows[0].quantity, 2);
assert.equal(rows[0].unit_price, 75);
assert.equal(rows[0].total_price, 150);

// 4. total_price falls back to unit_price * quantity when absent.
const derived = buildOrderItemRows(
  [{ ...cartLines[0], total_price: undefined }],
  "44444444-4444-4444-4444-444444444444"
);
assert.equal(derived[0].total_price, 150);

console.log("order item row tests passed");
