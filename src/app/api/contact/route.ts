import { NextRequest, NextResponse } from "next/server";
import { buildContactEmailPayload } from "@/lib/contact-email";
import { sendEmail } from "@/lib/email";

// Simple in-memory rate limiter (per IP, 3 submissions per 15 minutes)
const rateMap = new Map<string, number[]>();
const RATE_LIMIT = 3;
const RATE_WINDOW = 15 * 60 * 1000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (rateMap.get(ip) || []).filter((t) => now - t < RATE_WINDOW);
  if (timestamps.length >= RATE_LIMIT) return true;
  timestamps.push(now);
  rateMap.set(ip, timestamps);
  return false;
}

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await req.json();

    // Bot checks. Return 200 so bots get no signal that they were caught,
    // while the message is silently dropped.
    const honeypot = String(body.website || "").trim();
    const elapsedMs = Number(body.elapsedMs);
    const submittedTooFast = Number.isFinite(elapsedMs) && elapsedMs >= 0 && elapsedMs < 2000;
    if (honeypot || submittedTooFast) {
      console.warn("[contact] dropped likely bot submission", {
        honeypot: Boolean(honeypot),
        submittedTooFast,
      });
      return NextResponse.json({ ok: true });
    }

    const name = String(body.name || "").trim().slice(0, 200);
    const email = String(body.email || "").trim().slice(0, 320);
    const subject = String(body.subject || "").trim().slice(0, 200);
    const message = String(body.message || "").trim().slice(0, 5000);

    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: "All fields are required." },
        { status: 400 }
      );
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email address." },
        { status: 400 }
      );
    }

    await sendEmail(buildContactEmailPayload({ name, email, subject, message }));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "Failed to send message. Please try again later." },
      { status: 500 }
    );
  }
}
