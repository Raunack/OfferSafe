"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChangeEvent } from "react";

type AnalyzeForm = {
  companyName: string;
  cin: string;
  recruiterEmail: string;
  recruiterName: string;
  offerText: string;
  phone: string;
  website: string;
  linkedinUrl: string;
  paymentText: string;
  extractedText: string;
  jobTitle: string;
  roleDescription: string;
};

const initialState: AnalyzeForm = {
  companyName: "",
  cin: "",
  recruiterEmail: "",
  recruiterName: "",
  offerText: "",
  phone: "",
  website: "",
  linkedinUrl: "",
  paymentText: "",
  extractedText: "",
  jobTitle: "",
  roleDescription: "",
};

export default function AnalyzePage() {
  const router = useRouter();
  const [form, setForm] = useState<AnalyzeForm>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) throw new Error(data.error || "Failed to analyze offer");
      router.push(`/result/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setSubmitting(false);
    }
  }

  function bind<K extends keyof AnalyzeForm>(key: K) {
    return {
      value: form[key],
      onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm((prev) => ({ ...prev, [key]: e.target.value })),
    };
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl">Analyze an offer</h1>
      <p style={{ color: "var(--muted)" }}>All fields are optional. Add whatever evidence you have.</p>

      <form onSubmit={onSubmit} className="space-y-6">
        <section className="card space-y-4">
          <p className="label">Company Details</p>
          <div className="grid gap-4">
            <label className="space-y-2">
              <span className="label">Company name</span>
              <input className="input" {...bind("companyName")} />
            </label>
            <label className="space-y-2">
              <span className="label">CIN</span>
              <input className="input" {...bind("cin")} />
              <p className="text-xs" style={{ color: "var(--muted)" }}>Hint: 21-character MCA format</p>
            </label>
          </div>
        </section>

        <section className="card space-y-4">
          <p className="label">Recruiter Context</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="label">Recruiter email</span>
              <input className="input" {...bind("recruiterEmail")} />
            </label>
            <label className="space-y-2">
              <span className="label">Phone number</span>
              <input className="input" {...bind("phone")} />
            </label>
          </div>
          <label className="space-y-2">
            <span className="label">Recruiter name</span>
            <input className="input" {...bind("recruiterName")} />
          </label>
          <label className="space-y-2">
            <span className="label">Full offer/email text</span>
            <textarea className="textarea h-36" {...bind("offerText")} />
          </label>
        </section>

        <section className="card space-y-4">
          <p className="label">Public Presence</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="label">Company website URL</span>
              <input className="input" {...bind("website")} />
            </label>
            <label className="space-y-2">
              <span className="label">LinkedIn URL</span>
              <input className="input" {...bind("linkedinUrl")} />
            </label>
          </div>
        </section>

        <section className="card space-y-4">
          <p className="label">Payment & Offer Text</p>
          <label className="space-y-2">
            <span className="label">Payment request text</span>
            <textarea className="textarea h-28" {...bind("paymentText")} />
          </label>
          <label className="space-y-2">
            <span className="label">Paste text from offer letter PDF/image</span>
            <textarea className="textarea h-36" {...bind("extractedText")} />
          </label>
        </section>

        <section className="card space-y-4">
          <p className="label">Role Context</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="label">Job title</span>
              <input className="input" {...bind("jobTitle")} />
            </label>
            <label className="space-y-2">
              <span className="label">Role description</span>
              <textarea className="textarea h-24" {...bind("roleDescription")} />
            </label>
          </div>
        </section>

        {error ? <p className="card text-sm" style={{ color: "var(--danger)", background: "var(--danger-bg)" }}>{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full"
        >
          {submitting ? "Analyzing..." : "Analyze offer"}
        </button>
      </form>
    </div>
  );
}