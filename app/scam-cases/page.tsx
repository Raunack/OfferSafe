"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ScamCase = {
  id: string;
  case_name: string;
  scam_type: string;
  severity: string;
  description: string;
};

function severityClass(severity: string): string {
  if (severity === "high") return "status-badge border" + " border-[#f5c6c2] bg-[var(--danger-bg)] text-[var(--danger)]";
  if (severity === "medium") return "status-badge border" + " border-[#f5e6a3] bg-[var(--warning-bg)] text-[var(--warning)]";
  return "status-badge border border-[#d1d5db] bg-[#f3f4f6] text-[#374151]";
}

export default function ScamCasesPage() {
  const [rows, setRows] = useState<ScamCase[]>([]);
  const [search, setSearch] = useState("");
  const [scamType, setScamType] = useState("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!base || !anon) throw new Error("Missing Supabase env vars");
        const res = await fetch(`${base}/rest/v1/scam_cases?status=eq.approved&select=id,case_name,scam_type,severity,description`, {
          headers: {
            apikey: anon,
            Authorization: `Bearer ${anon}`,
          },
          cache: "no-store",
        });
        if (!res.ok) throw new Error(await res.text());
        setRows((await res.json()) as ScamCase[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load scam cases");
      }
    }
    load();
  }, []);

  const scamTypes = useMemo(() => ["all", ...Array.from(new Set(rows.map((r) => r.scam_type))).sort()], [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const matchesType = scamType === "all" || r.scam_type === scamType;
      const matchesSearch = r.case_name.toLowerCase().includes(search.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [rows, scamType, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Known scam cases</h1>
          <p style={{ color: "var(--muted)" }}>Browse approved patterns currently in OfferSafe.</p>
        </div>
        <Link href="/report-a-scam" className="btn-primary inline-flex items-center">
          Report a scam
        </Link>
      </div>

      <div className="card grid gap-4 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="label">Search by company name</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input"
            placeholder="Type company/case name"
          />
        </label>
        <label className="space-y-1">
          <span className="label">Filter by scam type</span>
          <select
            value={scamType}
            onChange={(e) => setScamType(e.target.value)}
            className="select"
          >
            {scamTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <p className="card p-3 text-sm" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>{error}</p> : null}

      <div className="overflow-x-auto card p-0">
        <table className="min-w-full text-left text-sm">
          <thead style={{ background: "#f4f3ef", color: "var(--foreground)" }}>
            <tr>
              <th className="px-4 py-3 font-semibold">Case name</th>
              <th className="px-4 py-3 font-semibold">Scam type</th>
              <th className="px-4 py-3 font-semibold">Severity</th>
              <th className="px-4 py-3 font-semibold">Description</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} style={{ borderTop: "1px solid var(--card-border)" }}>
                <td className="px-4 py-3 font-medium">{row.case_name}</td>
                <td className="px-4 py-3">{row.scam_type}</td>
                <td className="px-4 py-3">
                  <span className={severityClass(row.severity)}>{row.severity}</span>
                </td>
                <td className="px-4 py-3" style={{ color: "var(--muted)" }}>{row.description}</td>
              </tr>
            ))}
            {!filtered.length ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center" style={{ color: "var(--muted)" }}>
                  No cases match your filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
