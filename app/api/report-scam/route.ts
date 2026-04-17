import { NextResponse } from "next/server";
import { createHash } from "crypto";

type PendingReport = {
  id: string;
  company_name: string | null;
  recruiter_email: string | null;
  website_url: string | null;
  report_count: number | null;
  reporter_fingerprint: string | null;
};

type ScamCase = {
  id: string;
  case_name: string;
  company_name_variants: string[] | null;
  email_patterns: string[] | null;
  domain_patterns: string[] | null;
};

type ReportPayload = {
  company_name?: string;
  recruiter_name?: string;
  recruiter_email?: string;
  recruiter_phone?: string;
  website_url?: string;
  linkedin_url?: string;
  cin?: string;
  role_offered?: string;
  how_contacted?: string;
  offer_text?: string;
  chat_text?: string;
  payment_text?: string;
  reporter_email?: string;
};

const MIN_REPORTS_FOR_AUTO_APPROVE = 3;
const FREE_EMAIL_DOMAINS = new Set(["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"]);
const PAYMENT_KEYWORDS = ["pay", "deposit", "fee", "registration", "kit", "amount", "transfer", "upi", "neft"];
const CIN_REGEX = /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/;

function lower(value: string): string {
  return value.trim().toLowerCase();
}

function extractDomain(urlOrDomain: string): string | null {
  const raw = urlOrDomain.trim();
  if (!raw) return null;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    return parsed.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    const fallback = raw.replace(/^www\./i, "").toLowerCase();
    return fallback.includes(".") ? fallback : null;
  }
}

function emailPattern(email: string): string[] {
  if (!email || !email.includes("@")) return [];
  const local = email.split("@")[0]?.toLowerCase().trim();
  return local ? [local] : [];
}

function extractEmailDomain(email: string): string | null {
  const idx = email.lastIndexOf("@");
  if (idx <= 0 || idx === email.length - 1) return null;
  return lower(email.slice(idx + 1));
}

function mergeUnique(existing: string[] | null, incoming: string[]): string[] {
  const out = new Set<string>((existing || []).map((v) => lower(v)));
  for (const value of incoming) {
    const normalized = lower(value);
    if (normalized) out.add(normalized);
  }
  return [...out];
}

async function supabaseRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

async function uploadProofFile(file: File, pathPrefix: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectPath = `${pathPrefix}/${Date.now()}-${safeName}`;
  try {
    const res = await fetch(`${url}/storage/v1/object/report-proofs/${objectPath}`, {
      method: "POST",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        "x-upsert": "false",
        "Content-Type": file.type || "application/octet-stream",
      },
      body: await file.arrayBuffer(),
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn('Report proof upload failed. Ensure storage bucket "report-proofs" exists and write policy is configured.');
      return null;
    }
    return `${url}/storage/v1/object/public/report-proofs/${objectPath}`;
  } catch {
    console.warn('Report proof upload failed. Ensure storage bucket "report-proofs" exists and write policy is configured.');
    return null;
  }
}

async function isWebsiteUnreachable(websiteUrl: string): Promise<boolean> {
  const domain = extractDomain(websiteUrl);
  if (!domain) return true;
  const withProtocol = /^https?:\/\//i.test(websiteUrl) ? websiteUrl : `https://${websiteUrl}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(withProtocol, { method: "GET", redirect: "follow", signal: controller.signal, cache: "no-store" });
    clearTimeout(timeout);
    return !res.ok || res.status === 404;
  } catch {
    return true;
  }
}

async function sendReporterConfirmation(req: Request, reporterEmail: string, reportId: string, status: string): Promise<void> {
  if (!reporterEmail) return;
  try {
    const origin = new URL(req.url).origin;
    await fetch(`${origin}/api/send-confirmation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reporterEmail, reportId, status }),
      cache: "no-store",
    });
  } catch {
    // Intentionally swallow errors.
  }
}

function fingerprintFromRequest(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") || "";
  const ip = xff.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const ua = req.headers.get("user-agent") || "unknown";
  return createHash("sha256").update(`${ip}|${ua}`).digest("hex");
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const body: ReportPayload = {
      company_name: String(form.get("company_name") || ""),
      recruiter_name: String(form.get("recruiter_name") || ""),
      recruiter_email: String(form.get("recruiter_email") || ""),
      recruiter_phone: String(form.get("recruiter_phone") || ""),
      website_url: String(form.get("website_url") || ""),
      linkedin_url: String(form.get("linkedin_url") || ""),
      cin: String(form.get("cin") || ""),
      role_offered: String(form.get("role_offered") || ""),
      how_contacted: String(form.get("how_contacted") || ""),
      offer_text: String(form.get("offer_text") || ""),
      chat_text: String(form.get("chat_text") || ""),
      payment_text: String(form.get("payment_text") || ""),
      reporter_email: String(form.get("reporter_email") || ""),
    };
    const payload = {
      company_name: body.company_name?.trim() || "",
      recruiter_name: body.recruiter_name?.trim() || "",
      recruiter_email: body.recruiter_email?.trim() || "",
      recruiter_phone: body.recruiter_phone?.trim() || "",
      website_url: body.website_url?.trim() || "",
      linkedin_url: body.linkedin_url?.trim() || "",
      cin: body.cin?.trim() || "",
      role_offered: body.role_offered?.trim() || "",
      how_contacted: body.how_contacted?.trim() || "",
      offer_text: body.offer_text?.trim() || "",
      chat_text: body.chat_text?.trim() || "",
      payment_text: body.payment_text?.trim() || "",
      reporter_email: body.reporter_email?.trim() || "",
    };

    if (!payload.company_name) {
      return NextResponse.json({ error: "Company name is required" }, { status: 400 });
    }
    const company = lower(payload.company_name);
    const fingerprint = fingerprintFromRequest(req);

    const existing = await supabaseRequest<PendingReport[]>(
      `pending_reports?company_name=ilike.${encodeURIComponent(payload.company_name)}&select=id,company_name,recruiter_email,website_url,report_count,reporter_fingerprint`,
    );

    const sameCompanyReports = existing.filter((row) => lower(row.company_name || "") === company);
    const distinctReporters = new Set<string>(
      sameCompanyReports.map((row) => row.reporter_fingerprint || "").filter(Boolean),
    );
    distinctReporters.add(fingerprint);
    const nextCount = distinctReporters.size;
    const verifiedSignals: string[] = [];

    const emailDomain = extractEmailDomain(payload.recruiter_email);
    if (emailDomain && FREE_EMAIL_DOMAINS.has(emailDomain)) {
      verifiedSignals.push("free_email_domain");
    }
    if (payload.website_url && (await isWebsiteUnreachable(payload.website_url))) {
      verifiedSignals.push("website_unreachable");
    }
    if (payload.cin && !CIN_REGEX.test(payload.cin.toUpperCase())) {
      verifiedSignals.push("invalid_cin_format");
    }

    const approvedCases = await supabaseRequest<ScamCase[]>(
      "scam_cases?status=eq.approved&select=id,case_name,company_name_variants,email_patterns,domain_patterns",
    );
    const matchingScamCase =
      approvedCases.find((c) =>
        (c.company_name_variants || []).some((variant) => {
          const vv = lower(variant || "");
          return vv && (vv.includes(company) || company.includes(vv));
        }),
      ) || null;

    if (nextCount >= 2 || matchingScamCase) {
      verifiedSignals.push(`corroborated_by_${nextCount}_reports`);
    }

    const paymentCorpus = lower(`${payload.offer_text} ${payload.payment_text}`);
    const paymentHits = PAYMENT_KEYWORDS.filter((keyword) => paymentCorpus.includes(keyword));
    if (paymentHits.length >= 2) {
      verifiedSignals.push("payment_demand_detected");
    }

    const uploads = form
      .getAll("proof_files")
      .filter((item): item is File => item instanceof File && item.size > 0)
      .slice(0, 5);
    const proofUrls = (
      await Promise.all(uploads.map((file) => uploadProofFile(file, `${Date.now()}-${fingerprint.slice(0, 10)}`)))
    ).filter((url): url is string => Boolean(url));

    const signalCount = verifiedSignals.length;
    const confidence = signalCount >= 3 ? "high" : signalCount >= 1 ? "medium" : "low";
    const autoVerifiedBySignals = signalCount >= 3;
    const autoApproveByCorroboration = nextCount >= MIN_REPORTS_FOR_AUTO_APPROVE;
    const shouldAutoApprove = autoVerifiedBySignals || autoApproveByCorroboration;
    const status = shouldAutoApprove ? "auto_verified" : signalCount >= 1 ? "pending_review" : "low_confidence";

    const inserted = await supabaseRequest<Array<{ id: string }>>("pending_reports?select=id", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        ...payload,
        website: payload.website_url,
        what_happened: payload.chat_text || payload.offer_text || payload.payment_text,
        evidence_text: payload.payment_text || payload.offer_text,
        source: payload.how_contacted,
        status,
        report_count: nextCount,
        reporter_fingerprint: fingerprint,
        proof_urls: proofUrls,
        auto_verified: shouldAutoApprove,
        verified_signals: verifiedSignals,
        verification_result: {
          signals: verifiedSignals,
          auto_verified: shouldAutoApprove,
          confidence,
        },
      }),
    });

    const insertedId = inserted[0]?.id;
    if (!insertedId) {
      throw new Error("Failed to create pending report.");
    }

    if (sameCompanyReports.length > 0) {
      await supabaseRequest<void>(
        `pending_reports?company_name=ilike.${encodeURIComponent(payload.company_name)}&status=neq.auto_verified`,
        {
          method: "PATCH",
          body: JSON.stringify({ report_count: nextCount }),
        },
      );
    }

    if (!shouldAutoApprove) {
      await sendReporterConfirmation(req, payload.reporter_email, insertedId, status);
      return NextResponse.json({ id: insertedId, auto_verified: false, report_count: nextCount, signal_count: signalCount, status }, { status: 200 });
    }

    const domain = extractDomain(payload.website_url);
    const incomingEmailPatterns = emailPattern(payload.recruiter_email);
    const companyVariant = lower(payload.company_name);

    if (matchingScamCase) {
      await supabaseRequest<void>(`scam_cases?id=eq.${matchingScamCase.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          email_patterns: mergeUnique(matchingScamCase.email_patterns, incomingEmailPatterns),
          domain_patterns: mergeUnique(matchingScamCase.domain_patterns, domain ? [domain] : []),
        }),
      });
    } else {
      await supabaseRequest<void>("scam_cases", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          case_name: payload.company_name,
          company_name_variants: [companyVariant],
          email_patterns: incomingEmailPatterns,
          domain_patterns: domain ? [domain] : [],
          phone_patterns: [],
          scam_type: "user_reported",
          description: payload.chat_text || payload.offer_text || payload.payment_text || "Auto-verified report.",
          source_note: `Auto-verified with ${signalCount} signals and ${nextCount} corroborating reports`,
          severity: "medium",
          status: "approved",
        }),
      });
    }

    await supabaseRequest<void>(
      `pending_reports?company_name=ilike.${encodeURIComponent(payload.company_name)}&status=neq.auto_verified`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "auto_verified", auto_verified: true, report_count: nextCount }),
      },
    );

    await sendReporterConfirmation(req, payload.reporter_email, insertedId, "auto_verified");
    return NextResponse.json({ id: insertedId, auto_verified: true, report_count: nextCount, signal_count: signalCount, status: "auto_verified" }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
