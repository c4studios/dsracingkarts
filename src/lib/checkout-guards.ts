export type CheckoutOrderItemForSquare = {
  product_id: string;
  variation_id: string;
  product_name: string;
  variation_name: string | null;
  sku: string | null;
  quantity: number;
  unit_price: number;
  square_variation_token?: string | null;
};

export function buildSquareOrderLineItems(items: CheckoutOrderItemForSquare[]) {
  return items.map((item) => ({
    name: item.product_name,
    variationName: item.variation_name !== "Regular" ? item.variation_name || undefined : undefined,
    quantity: String(item.quantity),
    note: item.sku ? `SKU: ${item.sku}` : undefined,
    catalogObjectId: item.square_variation_token || undefined,
    basePriceMoney: {
      amount: BigInt(Math.round(item.unit_price * 100)),
      currency: "AUD",
    },
    metadata: {
      product_id: item.product_id,
      variation_id: item.variation_id,
      sku: item.sku || "",
    },
  }));
}

/**
 * The exact column list of `public.order_items`. Verified against the live
 * PostgREST schema. Keep in sync if the table changes.
 */
export const ORDER_ITEM_COLUMNS = [
  "order_id",
  "product_id",
  "variation_id",
  "product_name",
  "variation_name",
  "sku",
  "quantity",
  "unit_price",
  "total_price",
] as const;

export type OrderItemRow = {
  order_id: string;
  product_id: string;
  variation_id: string;
  product_name: string;
  variation_name: string | null;
  sku: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
};

/**
 * Project cart lines onto the order_items table shape.
 *
 * Deliberately an explicit field-by-field projection rather than a spread.
 * The in-memory cart lines carry extra fields (square_variation_token) that
 * the Square order needs but the table has no column for; spreading them into
 * the insert made PostgREST reject the whole statement (42703), which broke
 * every checkout between 19 May and 24 Aug 2026 without a single type error.
 * Listing the columns makes that class of bug impossible.
 */
export function buildOrderItemRows(
  items: CheckoutOrderItemForSquare[],
  orderId: string
): OrderItemRow[] {
  return items.map((item) => ({
    order_id: orderId,
    product_id: item.product_id,
    variation_id: item.variation_id,
    product_name: item.product_name,
    variation_name: item.variation_name,
    sku: item.sku,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: (item as { total_price?: number }).total_price ?? item.unit_price * item.quantity,
  }));
}
