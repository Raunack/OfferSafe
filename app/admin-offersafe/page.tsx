"use client";

import { useEffect, useMemo, useState } from "react";

type PendingReport = {
  id: string;
  submitted_at: string;
  company_name: string | null;
  recruiter_email: string | null;
  website: string | null;
  cin: string | null;
  what_happened: string | null;
  evidence_text: string | null;
  source: string | null;
  source_url: string | null;
  report_count: number | null;
  status: string;
};

function domainFromWebsite(website: string | null): string | null {
  if (!website) return null;
  try {
    const withProto = /^https?:\/\//i.test(website) ? website : `https://${website}`;
    return new URL(withProto).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

function emailPattern(email: string | null): string[] {
  if (!email || !email.includes("@")) return [];
  const local = email.split("@")[0]?.toLowerCase();
  if (!local) return [];
  return [local];
}

export default function AdminOfferSafePage() {
  const [rows, setRows] = useState<PendingReport[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  async function load() {
    try {
      if (!base || !anon) throw new Error("Missing Supabase env vars");
      const res = await fetch(`${base}/rest/v1/pending_reports?select=*&order=submitted_at.desc`, {
        headers: { apikey: anon, Authorization: `Bearer ${anon}` },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await res.text());
      setRows((await res.json()) as PendingReport[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reports");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(
    () => ({
      pending: rows.filter((r) => r.status === "pending" || r.status === "pending_review" || r.status === "low_confidence").length,
      approved: rows.filter((r) => r.status === "approved").length,
      rejected: rows.filter((r) => r.status === "rejected").length,
    }),
    [rows],
  );

  async function approve(report: PendingReport) {
    if (!base || !anon) return;
    setBusyId(report.id);
    setError(null);
    try {
      const websiteDomain = domainFromWebsite(report.website);
      const company = (report.company_name || "Unknown company").trim();
      const payload = {
        case_name: company,
        company_name_variants: [company.toLowerCase()],
        email_patterns: emailPattern(report.recruiter_email),
        domain_patterns: websiteDomain ? [websiteDomain] : [],
        phone_patterns: [],
        scam_type: "user_reported",
        description: report.what_happened || report.evidence_text || "User submitted scam report",
        source_note: `${report.source || "Other"}${report.source_url ? ` - ${report.source_url}` : ""}`,
        severity: "medium",
        status: "approved",
      };

      const insertRes = await fetch(`${base}/rest/v1/scam_cases`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anon,
          Authorization: `Bearer ${anon}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify(payload),
      });
      if (!insertRes.ok) throw new Error(await insertRes.text());

      const updateRes = await fetch(`${base}/rest/v1/pending_reports?id=eq.${report.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: anon,
          Authorization: `Bearer ${anon}`,
        },
        body: JSON.stringify({ status: "approved" }),
      });
      if (!updateRes.ok) throw new Error(await updateRes.text());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(reportId: string) {
    if (!base || !anon) return;
    setBusyId(reportId);
    setError(null);
    try {
      const updateRes = await fetch(`${base}/rest/v1/pending_reports?id=eq.${reportId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: anon,
          Authorization: `Bearer ${anon}`,
        },
        body: JSON.stringify({ status: "rejected" }),
      });
      if (!updateRes.ok) throw new Error(await updateRes.text());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl">OfferSafe Admin</h1>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card">
          <p className="label">Pending</p>
          <p className="text-2xl font-bold">{counts.pending}</p>
        </div>
        <div className="card">
          <p className="label">Approved</p>
          <p className="text-2xl font-bold">{counts.approved}</p>
        </div>
        <div className="card">
          <p className="label">Rejected</p>
          <p className="text-2xl font-bold">{counts.rejected}</p>
        </div>
      </div>

      {error ? <p className="card p-3 text-sm" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>{error}</p> : null}

      <div className="space-y-3">
        {rows.map((report) => (
          <article key={report.id} className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{report.company_name || "Unknown company"}</h2>
              <span className="status-badge border border-[#d1d5db] bg-[#f3f4f6] text-[#374151]">{report.status}</span>
            </div>
            <p className="text-sm" style={{ color: "var(--muted)" }}>{report.what_happened || "No details provided."}</p>
            <div className="text-xs" style={{ color: "var(--muted)" }}>
              {report.recruiter_email || "No email"} | {report.website || "No website"} | {report.source || "Unknown source"}
            </div>
            <div className="text-xs font-medium" style={{ color: "var(--muted)" }}>Report count: {report.report_count ?? 1}</div>
            {report.status === "pending" || report.status === "pending_review" || report.status === "low_confidence" ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyId === report.id}
                  onClick={() => approve(report)}
                  className="btn-primary disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busyId === report.id}
                  onClick={() => reject(report.id)}
                  className="btn-danger disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
