"use client";

import { useRef, useState } from "react";
import { useCart } from "@/hooks/useCart";
import { formatPrice } from "@/lib/utils";

export default function CheckoutPage() {
  const { cart, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const idempotencyKeyRef = useRef(crypto.randomUUID());
  const [customer, setCustomer] = useState({
    email: "",
    name: "",
    phone: "",
    subscribe: false,
    address: { line1: "", city: "", state: "NSW", postcode: "" },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cart.items.length === 0) return;

    setLoading(true);
    setError("");

    try {
      // Create a Square invoice, then send the customer to Square to pay it.
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: idempotencyKeyRef.current,
          cart: {
            items: cart.items,
            subtotal: cart.subtotal,
          },
          customer,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Payment failed");
        setLoading(false);
        return;
      }

      // Do NOT clear the cart before sending the customer to Square. Anyone who
      // hesitates on the invoice page, loses signal, or comes back later would
      // otherwise return to an empty cart, silently losing an order that can
      // take real effort to assemble from a catalogue this size. The
      // confirmation route clears it once payment is actually confirmed.
      if (data.invoice_url) {
        // Remember the order so the cart page can offer to resume payment
        // instead of the customer returning to a stale cart with no context.
        try {
          localStorage.setItem(
            "dsr-pending-order",
            JSON.stringify({
              order_number: data.order_number ?? null,
              invoice_url: data.invoice_url,
              at: Date.now(),
            })
          );
        } catch {
          // localStorage unavailable — non-fatal, the cart is still intact.
        }
        window.location.assign(data.invoice_url);
        return;
      }
      clearCart();
      window.location.assign(`/checkout/confirmation?order=${data.order_number}`);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setLoading(false);
    }
  }

  // Prices are GST-inclusive (Square's GST tax object is inclusion_type
  // INCLUSIVE), so the cart subtotal IS the total payable. GST is the 1/11th
  // already inside it, shown for transparency, never added on top.
  const total = cart.subtotal;
  const tax = Math.round((total / 11) * 100) / 100;

  if (cart.items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="font-heading text-3xl uppercase mb-4">Your Cart is Empty</h1>
        <a href="/shop" className="btn-primary inline-block">Continue Shopping</a>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="font-heading text-4xl uppercase tracking-wider mb-8">Checkout</h1>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Customer details */}
        <div className="space-y-6">
          <h2 className="font-heading text-xl uppercase tracking-wider">Your Details</h2>

          <div className="space-y-4">
            <label htmlFor="checkout-email" className="sr-only">Email address</label>
            <input
              id="checkout-email"
              type="email"
              required
              placeholder="Email address"
              autoComplete="email"
              value={customer.email}
              onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
              className="w-full bg-surface-700 border border-surface-600 rounded px-4 py-3 text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-red/50"
            />
            <label htmlFor="checkout-name" className="sr-only">Full name</label>
            <input
              id="checkout-name"
              type="text"
              required
              placeholder="Full name"
              autoComplete="name"
              value={customer.name}
              onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
              className="w-full bg-surface-700 border border-surface-600 rounded px-4 py-3 text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-red/50"
            />
            <label htmlFor="checkout-phone" className="sr-only">Phone number</label>
            <input
              id="checkout-phone"
              type="tel"
              required
              placeholder="Mobile number"
              autoComplete="tel"
              value={customer.phone}
              onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
              className="w-full bg-surface-700 border border-surface-600 rounded px-4 py-3 text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-red/50"
            />
          </div>

          <h2 className="font-heading text-xl uppercase tracking-wider">Shipping Address</h2>
          <div className="space-y-4">
            <label htmlFor="checkout-line1" className="sr-only">Street address</label>
            <input
              id="checkout-line1"
              type="text"
              required
              placeholder="Street address"
              autoComplete="street-address"
              value={customer.address.line1}
              onChange={(e) =>
                setCustomer({
                  ...customer,
                  address: { ...customer.address, line1: e.target.value },
                })
              }
              className="w-full bg-surface-700 border border-surface-600 rounded px-4 py-3 text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-red/50"
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label htmlFor="checkout-city" className="sr-only">City</label>
              <input
                id="checkout-city"
                type="text"
                required
                placeholder="City"
                autoComplete="address-level2"
                value={customer.address.city}
                onChange={(e) =>
                  setCustomer({
                    ...customer,
                    address: { ...customer.address, city: e.target.value },
                  })
                }
                className="bg-surface-700 border border-surface-600 rounded px-4 py-3 text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-red/50"
              />
              <label htmlFor="checkout-state" className="sr-only">State</label>
              <select
                id="checkout-state"
                value={customer.address.state}
                autoComplete="address-level1"
                onChange={(e) =>
                  setCustomer({
                    ...customer,
                    address: { ...customer.address, state: e.target.value },
                  })
                }
                className="bg-surface-700 border border-surface-600 rounded px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-red/50"
              >
                {["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"].map(
                  (s) => (
                    <option key={s} value={s}>{s}</option>
                  )
                )}
              </select>
              <label htmlFor="checkout-postcode" className="sr-only">Postcode</label>
              <input
                id="checkout-postcode"
                type="text"
                required
                placeholder="Postcode"
                autoComplete="postal-code"
                value={customer.address.postcode}
                onChange={(e) =>
                  setCustomer({
                    ...customer,
                    address: { ...customer.address, postcode: e.target.value },
                  })
                }
                className="bg-surface-700 border border-surface-600 rounded px-4 py-3 text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-red/50"
              />
            </div>
          </div>

          <label className="flex items-start gap-3 border border-surface-600 bg-surface-800 px-4 py-3 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={customer.subscribe}
              onChange={(e) => setCustomer({ ...customer, subscribe: e.target.checked })}
              className="mt-1 h-4 w-4 accent-brand-red"
            />
            <span>
              Subscribe me to DSR updates, specials, and racewear/newsletter emails.
            </span>
          </label>

          <div className="border border-brand-red/30 bg-brand-red/10 px-4 py-3 text-sm text-text-secondary leading-relaxed">
            A Square tax invoice will be created for this order. You&apos;ll be sent to
            Square&apos;s secure invoice page to pay by card.
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full text-lg"
          >
            {loading ? "Requesting invoice..." : `Request invoice — ${formatPrice(total)} + shipping`}
          </button>
        </div>

        {/* Order summary */}
        <div className="card p-6 h-fit lg:sticky lg:top-24">
          <h2 className="font-heading text-xl uppercase tracking-wider mb-4">Order Summary</h2>
          <div className="space-y-3 border-b border-surface-600 pb-4 mb-4">
            {cart.items.map((item) => (
              <div key={item.variation_id} className="flex justify-between text-sm">
                <span className="text-text-secondary">
                  {item.product_name}
                  {item.variation_name !== "Regular" && ` — ${item.variation_name}`}
                  <span className="text-text-muted"> × {item.quantity}</span>
                </span>
                <span>{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">Subtotal</span>
              <span>{formatPrice(cart.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Shipping</span>
              <span className="text-text-muted text-xs">Quoted separately</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Includes GST</span>
              <span>{formatPrice(tax)}</span>
            </div>
            <div className="flex justify-between font-heading text-lg pt-2 border-t border-surface-600">
              <span>Parts total</span>
              <span className="text-brand-red">{formatPrice(total)}</span>
            </div>
            <p className="text-text-muted text-[11px] leading-relaxed pt-1">
              Shipping is not included above and is quoted before you pay.
            </p>
          </div>

          <div className="mt-4 border border-surface-600 bg-surface-800/60 p-3">
            <p className="font-heading text-[10px] uppercase tracking-[0.15em] text-text-secondary mb-2">
              What happens next
            </p>
            <ol className="text-text-muted text-xs leading-relaxed space-y-1 list-decimal list-inside">
              <li>We quote shipping for your order and destination</li>
              <li>You approve the invoice</li>
              <li>You pay — nothing is charged before that</li>
            </ol>
            <p className="text-text-muted text-xs mt-3 pt-3 border-t border-surface-600">
              Questions? Call{" "}
              <a href="tel:+61492454854" className="text-brand-red hover:underline">
                0492 454 854
              </a>{" "}
              or read our{" "}
              <a href="/shipping-returns" className="text-brand-red hover:underline">
                shipping &amp; returns
              </a>
              . You&apos;ll get a confirmation email once your order is placed.
            </p>
          </div>
          <p className="text-text-muted text-xs mt-3">
            Shipping will be quoted based on order size and destination. We&apos;ll be in touch after your order.
          </p>
        </div>
      </form>
    </div>
  );
}
