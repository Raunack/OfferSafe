import { NextResponse } from "next/server";

type ContactPayload = {
  name?: string;
  email?: string;
  message?: string;
};

async function supabaseInsertContact(name: string, email: string, message: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Missing Supabase env vars.");
  const res = await fetch(`${url}/rest/v1/contact_submissions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ name, email, message }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ContactPayload;
    const name = (body.name || "").trim();
    const email = (body.email || "").trim();
    const message = (body.message || "").trim();
    if (!name || !email || !message) {
      return NextResponse.json({ error: "Name, email, and message are required." }, { status: 400 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: "OfferSafe <onboarding@resend.dev>",
          to: ["offersafe.india@gmail.com"],
          subject: "OfferSafe contact form submission",
          text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
        }),
        cache: "no-store",
      });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    await supabaseInsertContact(name, email, message);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
