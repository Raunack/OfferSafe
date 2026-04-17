import Link from "next/link";

type SearchParams = {
  id?: string;
  signals?: string;
  auto_verified?: string;
  status?: string;
};

export default function ReportSubmittedPage({ searchParams }: { searchParams: SearchParams }) {
  const reportId = searchParams.id || "Unavailable";
  const signals = Number(searchParams.signals || 0);
  const autoVerified = searchParams.auto_verified === "1";
  const status = searchParams.status || "pending_review";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="card space-y-4">
        <p className="label" style={{ color: "var(--safe)" }}>Submission received</p>
        <h1 className="text-3xl">Thank you for helping protect students</h1>
        <p>
          Report reference ID: <span className="font-semibold">{reportId}</span>
        </p>
        <p className="text-sm" style={{ color: "var(--muted)" }}>We automatically detected {signals} suspicious signal{signals === 1 ? "" : "s"} in your report.</p>
        {autoVerified ? (
          <p className="card p-3 text-sm font-medium" style={{ background: "var(--safe-bg)", color: "var(--safe)" }}>
            Your report has been automatically verified and added to our database.
          </p>
        ) : status === "pending_review" ? (
          <p className="card p-3 text-sm font-medium" style={{ background: "var(--warning-bg)", color: "var(--warning)" }}>
            Your report is under review. We&apos;ll verify it against other reports.
          </p>
        ) : (
          <p className="card p-3 text-sm font-medium" style={{ background: "#f3f4f6", color: "#374151" }}>
            Your report is saved with low confidence and will be manually reviewed.
          </p>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/analyze" className="btn-primary inline-flex items-center">
          Check another offer
        </Link>
        <Link href="/report-a-scam" className="btn-secondary inline-flex items-center">
          Report another scam
        </Link>
      </div>
    </div>
  );
}
