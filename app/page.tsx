import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="card" style={{ background: "var(--navbar-bg)", color: "white" }}>
        <div className="mx-auto max-w-3xl space-y-5 py-8 text-center">
          <h1 className="text-4xl sm:text-5xl">Analyze any job or internship offer for scam risk</h1>
          <p className="mx-auto max-w-2xl text-base sm:text-lg" style={{ color: "var(--footer-text)" }}>
            Paste email text, recruiter details, offer letter content, or payment requests and get a clear, evidence-based risk breakdown.
          </p>
          <div className="pt-2">
            <Link href="/analyze" className="btn-secondary inline-flex items-center" style={{ background: "#fff", color: "var(--navbar-bg)", borderColor: "#fff" }}>
              Check an offer
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl">How it works</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <article className="card space-y-2">
            <p className="label">Step 1</p>
            <h3 className="text-lg">Share the evidence</h3>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Add company, recruiter, offer text, and payment demands you received.
            </p>
          </article>
          <article className="card space-y-2">
            <p className="label">Step 2</p>
            <h3 className="text-lg">Run verification checks</h3>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              OfferSafe matches known cases, behavioral signals, and public community reports.
            </p>
          </article>
          <article className="card space-y-2">
            <p className="label">Step 3</p>
            <h3 className="text-lg">Take safer action</h3>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Review your risk score and next steps before sharing documents or money.
            </p>
          </article>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/scam-cases" className="btn-secondary inline-flex items-center">
          Browse known scams
        </Link>
        <Link href="/report-a-scam" className="btn-secondary inline-flex items-center">
          Report a scam
        </Link>
      </div>
    </div>
  );
}