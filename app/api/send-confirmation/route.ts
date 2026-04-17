import { NextResponse } from "next/server";

type Payload = {
  reporterEmail?: string;
  reportId?: string;
  status?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Payload;
    const reporterEmail = (body.reporterEmail || "").trim();
    const reportId = (body.reportId || "").trim();
    const status = (body.status || "pending_review").trim();
    if (!reporterEmail || !reportId) {
      return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
    }

    const bodyText = [
      "Thank you for submitting a scam report to OfferSafe.",
      "",
      `Report reference ID: ${reportId}`,
      `Current verification status: ${status}`,
      "",
      "Your report will be reviewed and auto-verified against known patterns and corroborating reports.",
      "If verified, it helps protect other students and job-seekers from similar scams.",
      "",
      "We do not share your personal details publicly.",
      "",
      "Team OfferSafe",
    ].join("\n");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: "OfferSafe <onboarding@resend.dev>",
        to: [reporterEmail],
        subject: "OfferSafe — We received your scam report",
        text: bodyText,
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
  }
}
