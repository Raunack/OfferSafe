import { notFound } from "next/navigation";
import { RedditSection } from "@/components/reddit-section";
import Link from "next/link";
import { DownloadReportButton } from "@/components/download-report-button";
import { supabaseGet } from "@/lib/supabase-rest";

type CaseRow = {
  id: string;
  inputs_json: Record<string, unknown> | null;
  extracted_entities_json: Record<string, unknown> | null;
  signals_json: Array<{ key: string; severity: string; weight: number; reason?: string }> | null;
  matched_case_id: string | null;
  risk_score: number;
  verdict: string;
  confidence: string;
  explanation_json: {
    signalExplanations?: Record<string, string>;
    nextSteps?: string[];
  } | null;
  reddit_mentions_json:
    | {
        posts?: Array<{
          id: string;
          title: string;
          subreddit: string;
          score: number;
          permalink: string;
          url: string;
        }>;
        comments?: Record<
          string,
          Array<{
            id: string;
            author: string;
            body: string;
            score: number;
          }>
        >;
      }
    | Array<{
        id: string;
        title: string;
        subreddit: string;
        score: number;
        permalink: string;
        url: string;
      }>
    | null;
};

type ScamCaseRow = {
  id: string;
  case_name: string;
  scam_type: string;
  description: string;
  severity: string;
  company_name_variants: string[] | null;
  email_patterns: string[] | null;
  domain_patterns: string[] | null;
};

function verdictBadgeStyle(verdict: string): Record<string, string> {
  switch (verdict) {
    case "LOW RISK":
      return { background: "var(--safe-bg)", borderLeft: "4px solid var(--safe)", color: "var(--safe)" };
    case "CAUTION":
      return { background: "var(--warning-bg)", borderLeft: "4px solid #b8860b", color: "var(--warning)" };
    case "SUSPICIOUS":
      return { background: "var(--warning-bg)", borderLeft: "4px solid #b8860b", color: "var(--warning)" };
    case "HIGH-RISK SCAM":
      return { background: "var(--danger-bg)", borderLeft: "4px solid var(--danger)", color: "var(--danger)" };
    default:
      return { background: "#f3f4f6", borderLeft: "4px solid #d1d5db", color: "#374151" };
  }
}

function severityBadgeClass(severity: string): string {
  if (severity === "critical") return "status-badge border border-[#f5c6c2] bg-[var(--danger-bg)] text-[var(--danger)]";
  if (severity === "high") return "status-badge border border-[#f5e6a3] bg-[var(--warning-bg)] text-[var(--warning)]";
  if (severity === "medium") return "status-badge border border-[#c7d2fe] bg-[#eef2ff] text-[#3730a3]";
  return "status-badge border border-[#d1d5db] bg-[#f3f4f6] text-[#374151]";
}

export default async function ResultPage({ params }: { params: { id: string } }) {
  const rows = await supabaseGet<CaseRow[]>(`cases?id=eq.${params.id}&select=*`);
  const row = rows[0];
  if (!row) notFound();

  const matched =
    row.matched_case_id
      ? await supabaseGet<ScamCaseRow[]>(
          `scam_cases?id=eq.${row.matched_case_id}&select=id,case_name,scam_type,description,severity,company_name_variants,email_patterns,domain_patterns`,
        )
      : [];

  const matchedCase = matched[0];
  const signals = row.signals_json ?? [];
  const explanations = row.explanation_json?.signalExplanations ?? {};
  const nextSteps = row.explanation_json?.nextSteps ?? [];
  const score = row.risk_score ?? 0;
  const redditRaw = row.reddit_mentions_json;
  const redditMentions = Array.isArray(redditRaw) ? redditRaw : redditRaw?.posts ?? [];
  const redditCommentsByPost = Array.isArray(redditRaw) ? {} : redditRaw?.comments ?? {};

  function truncateComment(text: string): string {
    if (text.length <= 150) return text;
    return `${text.slice(0, 150)}...`;
  }

  const inputEntries = Object.entries(row.inputs_json ?? {}).filter(([, value]) => String(value ?? "").trim().length > 0);
  const missingFields = [
    "companyName",
    "cin",
    "recruiterEmail",
    "phone",
    "website",
    "linkedinUrl",
    "offerText",
    "paymentText",
    "extractedText",
  ].filter((key) => !(row.inputs_json && String(row.inputs_json[key] ?? "").trim()));

  return (
    <div className="space-y-6">
      <style media="print">{`
        nav, header, footer, .print-hide { display: none !important; }
        a { pointer-events: none !important; color: inherit !important; text-decoration: none !important; }
        body { background: white !important; }
        .card { break-inside: avoid; border: 1px solid #cbd5e1 !important; box-shadow: none !important; }
      `}</style>

      <section className="card space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-full rounded px-3 py-2 text-sm font-semibold" style={verdictBadgeStyle(row.verdict)}>
            {row.verdict}
          </span>
          <span className="status-badge border border-[#d1d5db] bg-[#f3f4f6] text-[#374151]">Confidence: {row.confidence}</span>
        </div>

        <div className="card p-4" style={{ background: row.verdict === "HIGH-RISK SCAM" ? "var(--danger-bg)" : row.verdict === "LOW RISK" ? "var(--safe-bg)" : "var(--warning-bg)", borderLeft: row.verdict === "HIGH-RISK SCAM" ? "4px solid var(--danger)" : row.verdict === "LOW RISK" ? "4px solid var(--safe)" : "4px solid #b8860b" }}>
          <p className="mb-2 text-sm font-semibold" style={{ color: row.verdict === "HIGH-RISK SCAM" ? "var(--danger)" : row.verdict === "LOW RISK" ? "var(--safe)" : "var(--warning)" }}>
            Risk score: {score}/100
          </p>
          <div className="h-3 w-full overflow-hidden rounded bg-slate-200">
            <div
              className="h-3 rounded"
              style={{ background: row.verdict === "HIGH-RISK SCAM" ? "var(--danger)" : row.verdict === "LOW RISK" ? "var(--safe)" : "#b8860b", width: `${Math.max(0, Math.min(score, 100))}%` }}
            />
          </div>
        </div>

        {matchedCase ? (
          <div className="card p-4 text-sm font-medium" style={{ borderLeft: "4px solid var(--danger)", background: "var(--danger-bg)", color: "var(--danger)" }}>
            Known scam pattern matched: {matchedCase.case_name}
          </div>
        ) : null}
      </section>

      <div className="print-hide">
        <Link
          href="/analyze"
          className="btn-secondary inline-flex items-center"
        >
          Check another offer →
        </Link>
      </div>

      <section className="card space-y-3">
        <h2 className="text-xl font-semibold">Red flags detected</h2>
        {signals.length === 0 ? (
          <p className="text-sm text-slate-600">No scam signals were triggered.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {signals.map((signal) => (
              <article key={signal.key} className="rounded-lg border border-slate-200 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{signal.key.replaceAll("_", " ")}</h3>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${severityBadgeClass(signal.severity)}`}>
                    {signal.severity}
                  </span>
                </div>
                <p className="text-sm text-slate-600">{explanations[signal.key] ?? "Explanation unavailable."}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <RedditSection companyName={String(row.inputs_json?.companyName ?? "")} />

      {matchedCase ? (
        <section className="card space-y-3">
          <h2 className="text-xl font-semibold">Known scam match details</h2>
          <p className="text-sm text-slate-700">
            <strong>{matchedCase.case_name}</strong> ({matchedCase.scam_type}, {matchedCase.severity})
          </p>
          <p className="text-sm text-slate-600">{matchedCase.description}</p>

          {matchedCase.company_name_variants?.length ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Also known as</p>
              <div className="flex flex-wrap gap-2">
                {matchedCase.company_name_variants.map((item) => (
                  <span key={item} className="status-badge border border-[#d1d5db] bg-[#f3f4f6] text-[#374151]">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {matchedCase.email_patterns?.length ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Suspicious email patterns</p>
              <div className="flex flex-wrap gap-2">
                {matchedCase.email_patterns.map((item) => (
                  <span key={item} className="status-badge border border-[#d1d5db] bg-[#f3f4f6] text-[#374151]">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {matchedCase.domain_patterns?.length ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Known fake domains</p>
              <div className="flex flex-wrap gap-2">
                {matchedCase.domain_patterns.map((item) => (
                  <span key={item} className="status-badge border border-[#d1d5db] bg-[#f3f4f6] text-[#374151]">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="card space-y-2">
        <h2 className="text-xl font-semibold">Evidence used</h2>
        {inputEntries.length === 0 ? (
          <p className="text-sm text-slate-600">No submission fields were provided.</p>
        ) : (
          <ul className="space-y-1 text-sm text-slate-700">
            {inputEntries.map(([key, value]) => (
              <li key={key}>
                <strong>{key}:</strong> {String(value)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-2">
        <h2 className="text-xl font-semibold">Unresolved gaps</h2>
        <p className="text-sm text-slate-600">{missingFields.length ? missingFields.join(", ") : "No major input gaps."}</p>
      </section>

      <section className="card space-y-2">
        <h2 className="text-xl font-semibold">What to do next</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          {nextSteps.length ? nextSteps.map((step) => <li key={step}>{step}</li>) : <li>Verify company identity from official channels.</li>}
        </ul>
      </section>

      <section className="card p-4 text-sm" style={{ background: "#f4f3ef" }}>
        This is a risk assessment, not legal advice. Always verify independently before making any decisions.
      </section>

      <div className="print-hide flex flex-wrap items-center gap-3">
        <DownloadReportButton />
        <Link
          href="/analyze"
          className="btn-secondary inline-flex items-center"
        >
          Check another offer →
        </Link>
      </div>
    </div>
  );
}
