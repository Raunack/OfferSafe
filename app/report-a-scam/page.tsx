"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ReportForm = {
  company_name: string;
  recruiter_name: string;
  recruiter_email: string;
  recruiter_phone: string;
  website_url: string;
  linkedin_url: string;
  cin: string;
  role_offered: string;
  how_contacted: string;
  offer_text: string;
  chat_text: string;
  payment_text: string;
  reporter_email: string;
  truthful_confirmation: boolean;
};

const initial: ReportForm = {
  company_name: "",
  recruiter_name: "",
  recruiter_email: "",
  recruiter_phone: "",
  website_url: "",
  linkedin_url: "",
  cin: "",
  role_offered: "",
  how_contacted: "Email",
  offer_text: "",
  chat_text: "",
  payment_text: "",
  reporter_email: "",
  truthful_confirmation: false,
};

const CONTACT_METHODS = ["Email", "WhatsApp", "LinkedIn", "Internshala", "Naukri", "Other"];
const MAX_FILES = 5;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export default function ReportScamPage() {
  const router = useRouter();
  const [form, setForm] = useState<ReportForm>(initial);
  const [step, setStep] = useState(1);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof ReportForm>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateBool<K extends keyof ReportForm>(key: K, value: boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onFileChange(selected: FileList | null) {
    if (!selected) return;
    const picked = Array.from(selected);
    if (picked.length > MAX_FILES) {
      setError(`You can upload up to ${MAX_FILES} files.`);
      return;
    }
    const validTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
    for (const file of picked) {
      if (!validTypes.has(file.type)) {
        setError("Only PDF, JPG, and PNG files are allowed.");
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError("Each file must be 5MB or smaller.");
        return;
      }
    }
    setError(null);
    setFiles(picked);
  }

  const progressPercent = useMemo(() => (step / 3) * 100, [step]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (!form.company_name.trim()) throw new Error("Company name is required");
      if (!form.truthful_confirmation) throw new Error("Please confirm the truthfulness statement before submitting.");

      const payload = new FormData();
      for (const [key, value] of Object.entries(form)) {
        if (key === "truthful_confirmation") {
          payload.append(key, String(Boolean(value)));
        } else {
          payload.append(key, String(value ?? ""));
        }
      }
      for (const file of files) {
        payload.append("proof_files", file);
      }

      const res = await fetch("/api/report-scam", {
        method: "POST",
        body: payload,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { id: string; signal_count: number; auto_verified: boolean; status: string };

      setForm(initial);
      setFiles([]);
      setMessage(
        data.auto_verified
          ? "Report submitted and auto-verified successfully."
          : "Report submitted successfully. Thank you for helping the community.",
      );
      router.push(
        `/report-submitted?id=${encodeURIComponent(data.id)}&signals=${data.signal_count}&auto_verified=${data.auto_verified ? "1" : "0"}&status=${encodeURIComponent(data.status)}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl">Report a scam</h1>
      <p style={{ color: "var(--muted)" }}>Submit details and proof to help auto-verify suspicious recruiters and companies.</p>

      <div className="card space-y-2">
        <div className="flex items-center justify-between text-sm" style={{ color: "var(--muted)" }}>
          <span>
            Step {step} of 3
          </span>
          <span>{Math.round(progressPercent)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded bg-slate-200">
          <div className="h-2 rounded bg-[var(--accent)] transition-all duration-300" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {step === 1 ? (
          <div className="card grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 sm:col-span-2">
              <span className="label">Company name (required)</span>
              <input className="input" value={form.company_name} onChange={(e) => update("company_name", e.target.value)} required />
            </label>
            <label className="space-y-1">
              <span className="label">Recruiter name</span>
              <input className="input" value={form.recruiter_name} onChange={(e) => update("recruiter_name", e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="label">Recruiter email</span>
              <input className="input" value={form.recruiter_email} onChange={(e) => update("recruiter_email", e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="label">Recruiter phone</span>
              <input className="input" value={form.recruiter_phone} onChange={(e) => update("recruiter_phone", e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="label">Company website URL</span>
              <input className="input" value={form.website_url} onChange={(e) => update("website_url", e.target.value)} />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="label">LinkedIn URL (recruiter/company)</span>
              <input className="input" value={form.linkedin_url} onChange={(e) => update("linkedin_url", e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="label">CIN</span>
              <input className="input" value={form.cin} onChange={(e) => update("cin", e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="label">Job/internship role offered</span>
              <input className="input" value={form.role_offered} onChange={(e) => update("role_offered", e.target.value)} />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="label">How they contacted you</span>
              <select className="select" value={form.how_contacted} onChange={(e) => update("how_contacted", e.target.value)}>
                {CONTACT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="card grid gap-4">
            <label className="space-y-1">
              <span className="label">Offer letter text</span>
              <textarea className="textarea h-36" value={form.offer_text} onChange={(e) => update("offer_text", e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="label">Chat/conversation text</span>
              <textarea className="textarea h-36" value={form.chat_text} onChange={(e) => update("chat_text", e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="label">Payment request details</span>
              <textarea className="textarea h-32" value={form.payment_text} onChange={(e) => update("payment_text", e.target.value)} />
            </label>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="card grid gap-4">
            <label className="space-y-1">
              <span className="label">Upload proof (offer letter, chat screenshot, payment screenshot)</span>
              <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => onFileChange(e.target.files)} className="input" />
              <p className="text-xs" style={{ color: "var(--muted)" }}>Up to 5 files, max 5MB each. Optional.</p>
              {files.length ? <p className="text-xs" style={{ color: "var(--muted)" }}>{files.length} file(s) selected.</p> : null}
            </label>
            <label className="space-y-1">
              <span className="label">Reporter email (optional)</span>
              <input className="input" value={form.reporter_email} onChange={(e) => update("reporter_email", e.target.value)} />
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.truthful_confirmation}
                onChange={(e) => updateBool("truthful_confirmation", e.target.checked)}
                className="mt-1"
                required
              />
              <span>I confirm this report is truthful to the best of my knowledge.</span>
            </label>
          </div>
        ) : null}

        {error ? <p className="card p-3 text-sm" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>{error}</p> : null}
        {message ? <p className="card p-3 text-sm" style={{ background: "var(--safe-bg)", color: "var(--safe)" }}>{message}</p> : null}

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setStep((prev) => Math.max(1, prev - 1))}
            disabled={step === 1 || loading}
            className="btn-secondary disabled:opacity-50"
          >
            Back
          </button>
          {step < 3 ? (
            <button
              type="button"
              onClick={() => {
                if (step === 1 && !form.company_name.trim()) {
                  setError("Company name is required to continue.");
                  return;
                }
                setError(null);
                setStep((prev) => Math.min(3, prev + 1));
              }}
              disabled={loading}
              className="btn-primary disabled:opacity-60"
            >
              Next
            </button>
          ) : (
            <button type="submit" disabled={loading} className="btn-primary disabled:opacity-60">
              {loading ? "Submitting..." : "Submit report"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
