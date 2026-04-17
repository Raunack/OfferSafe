"use client";

import { FormEvent, useState } from "react";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to submit");
      setStatus("Thanks for reaching out. We received your message.");
      setName("");
      setEmail("");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl">Get in touch</h1>
      <p style={{ color: "var(--muted)" }}>
        Found a scam we missed? Have feedback? We&apos;d love to hear from you.
      </p>
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Contact: offersafe.india@gmail.com
      </p>

      <form onSubmit={onSubmit} className="card space-y-4">
        <label className="space-y-1">
          <span className="label">Name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="space-y-1">
          <span className="label">Email</span>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="space-y-1">
          <span className="label">Message</span>
          <textarea className="textarea h-36" value={message} onChange={(e) => setMessage(e.target.value)} required />
        </label>

        {error ? <p className="card p-3 text-sm" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>{error}</p> : null}
        {status ? <p className="card p-3 text-sm" style={{ background: "var(--safe-bg)", color: "var(--safe)" }}>{status}</p> : null}

        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? "Sending..." : "Submit"}
        </button>
      </form>
    </div>
  );
}
