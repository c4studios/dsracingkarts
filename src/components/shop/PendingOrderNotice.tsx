"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { useCart } from "@/hooks/useCart";

type PendingOrder = {
  order_number: string | null;
  invoice_url: string;
  at: number;
};

const KEY = "dsr-pending-order";
// Square invoices do not live forever, and a month-old marker is noise rather
// than help. Past this the notice stops showing and the marker is cleared.
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Checkout no longer empties the cart when it sends the customer to Square,
 * because anyone who hesitated there used to come back to nothing. The trade is
 * that a paid order can leave a stale cart behind, so this explains the state
 * and offers both exits: resume payment, or start fresh.
 */
export function PendingOrderNotice() {
  const { clearCart } = useCart();
  const [pending, setPending] = useState<PendingOrder | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PendingOrder;
      if (!parsed?.invoice_url) return;
      if (Date.now() - (parsed.at ?? 0) > MAX_AGE_MS) {
        localStorage.removeItem(KEY);
        return;
      }
      setPending(parsed);
    } catch {
      // Unreadable or unavailable storage — show nothing.
    }
  }, []);

  function dismiss() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // Non-fatal.
    }
    setPending(null);
  }

  if (!pending) return null;

  return (
    <div className="mb-6 border border-racing-red/30 bg-racing-red/5 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="text-racing-red shrink-0 mt-0.5" />
        <div className="flex-1">
          <h2 className="font-heading text-sm uppercase tracking-[0.1em] text-white mb-1">
            {pending.order_number
              ? `Order ${pending.order_number} is awaiting payment`
              : "You have an order awaiting payment"}
          </h2>
          <p className="text-white/60 text-xs leading-relaxed mb-3">
            We kept your cart in case you want to change something. If you have
            already paid, you can safely clear it.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={pending.invoice_url}
              className="inline-flex items-center gap-1.5 bg-racing-red text-white font-heading text-xs uppercase tracking-[0.12em] px-4 py-2 hover:bg-racing-red/90 transition-colors"
            >
              Continue payment
              <ExternalLink size={13} />
            </a>
            <button
              type="button"
              onClick={() => {
                clearCart();
                dismiss();
              }}
              className="font-heading text-xs uppercase tracking-[0.12em] px-4 py-2 border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-colors"
            >
              Already paid — clear cart
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="font-heading text-xs uppercase tracking-[0.12em] px-3 py-2 text-white/40 hover:text-white/70 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
