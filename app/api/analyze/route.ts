import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";

type SignalSeverity = "critical" | "high" | "medium" | "low";

type SignalKey =
  | "known_scam_match"
  | "email_free_provider"
  | "email_domain_mismatch"
  | "cin_invalid_format"
  | "gmail_as_official"
  | "payment_requested"
  | "reimbursement_trap"
  | "paid_training_placement"
  | "domain_age_new"
  | "unrealistic_stipend"
  | "urgency_language"
  | "no_company_web_presence"
  | "domain_missing"
  | "no_interview_mentioned"
  | "whatsapp_only_recruitment"
  | "cin_missing"
  | "poor_formatting"
  | "vague_role"
  | "reddit_mentions"
  | "reddit_comment_scam_score";

type TriggeredSignal = {
  key: SignalKey;
  weight: number;
  severity: SignalSeverity;
  reason: string;
};

type ScamCase = {
  id: string;
  case_name: string;
  company_name_variants: string[] | null;
  email_patterns: string[] | null;
  domain_patterns: string[] | null;
  phone_patterns: string[] | null;
  scam_type: string;
  description: string;
  source_note: string | null;
  severity: string;
  status: string;
};

type RedditMention = {
  id: string;
  title: string;
  subreddit: string;
  score: number;
  permalink: string;
  url: string;
  created_utc: number;
};

type RedditComment = {
  id: string;
  author: string;
  body: string;
  score: number;
  created_utc: number;
};

type RedditMentionsPayload = {
  posts: RedditMention[];
  comments: Record<string, RedditComment[]>;
};

type AnalyzePayload = {
  companyName?: string;
  recruiterName?: string;
  recruiterEmail?: string;
  phone?: string;
  website?: string;
  cin?: string;
  offerText?: string;
  paymentText?: string;
  extractedText?: string;
  linkedinUrl?: string;
  jobTitle?: string;
  roleDescription?: string;
};

type ExtractedEntities = {
  companyName: string | null;
  recruiterName: string | null;
  emailDomain: string | null;
  phone: string | null;
  websiteDomain: string | null;
  cin: string | null;
  dates: string[];
  stipendAmount: number | null;
  paymentDemands: string[];
};

const SIGNALS: Record<SignalKey, { weight: number; severity: SignalSeverity }> = {
  known_scam_match: { weight: 45, severity: "critical" },
  email_free_provider: { weight: 25, severity: "high" },
  email_domain_mismatch: { weight: 20, severity: "high" },
  cin_invalid_format: { weight: 20, severity: "high" },
  gmail_as_official: { weight: 20, severity: "high" },
  payment_requested: { weight: 35, severity: "high" },
  reimbursement_trap: { weight: 30, severity: "high" },
  paid_training_placement: { weight: 30, severity: "high" },
  domain_age_new: { weight: 15, severity: "medium" },
  unrealistic_stipend: { weight: 15, severity: "medium" },
  urgency_language: { weight: 15, severity: "medium" },
  no_company_web_presence: { weight: 15, severity: "medium" },
  domain_missing: { weight: 10, severity: "medium" },
  no_interview_mentioned: { weight: 10, severity: "medium" },
  whatsapp_only_recruitment: { weight: 10, severity: "medium" },
  cin_missing: { weight: 5, severity: "low" },
  poor_formatting: { weight: 5, severity: "low" },
  vague_role: { weight: 5, severity: "low" },
  reddit_mentions: { weight: 20, severity: "high" },
  reddit_comment_scam_score: { weight: 10, severity: "high" },
};

const REDDIT_SUBREDDITS = ["india", "indianworkplace", "cscareerquestions"];
const REDDIT_COMMENT_KEYWORDS = [
  "paid",
  "fee",
  "scam",
  "fake",
  "fraud",
  "money",
  "kit",
  "deposit",
  "cheated",
  "ghosted",
  "never joined",
  "warning",
  "avoid",
  "don't join",
  "do not join",
  "reported",
  "police",
];

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "rediffmail.com",
  "ymail.com",
]);

const PAYMENT_KEYWORDS = [
  "pay",
  "fee",
  "deposit",
  "purchase",
  "kit",
  "software",
  "reimburse",
  "refundable",
  "advance",
  "security deposit",
  "registration fee",
  "training fee",
];

const URGENCY_KEYWORDS = [
  "urgent",
  "last date",
  "limited seats",
  "act now",
  "immediately",
  "offer expires",
  "today only",
];

const INTERVIEW_KEYWORDS = [
  "interview",
  "test",
  "assessment",
  "shortlisting",
  "selection",
];

const PAID_TRAINING_KEYWORDS = [
  "guaranteed placement",
  "pay for training",
  "certification fee before joining",
  "placement after course",
];

const CIN_REGEX = /^[A-Z]\d{5}[A-Z]{2}\d{4}[A-Z]\d{6}$/;

function toText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function lower(value: string): string {
  return value.trim().toLowerCase();
}

function containsAny(text: string, keywords: string[]): boolean {
  const t = lower(text);
  return keywords.some((k) => t.includes(lower(k)));
}

function extractEmailDomain(email: string): string | null {
  const value = lower(email);
  const at = value.lastIndexOf("@");
  if (at <= 0 || at === value.length - 1) return null;
  return value.slice(at + 1);
}

function extractDomain(urlOrDomain: string): string | null {
  const raw = toText(urlOrDomain);
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

function extractDates(text: string): string[] {
  const out = new Set<string>();
  const dateRegexes = [
    /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g,
    /\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b/g,
    /\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4}\b/gi,
  ];
  for (const re of dateRegexes) {
    for (const match of text.matchAll(re)) {
      if (match[0]) out.add(match[0]);
    }
  }
  return [...out];
}

function extractStipendAmount(text: string): number | null {
  const matches = [
    ...text.matchAll(/\b(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d+)?)\b/gi),
    ...text.matchAll(/\b([\d,]+(?:\.\d+)?)\s*(?:rs\.?|inr|₹)\b/gi),
  ];
  const values = matches
    .map((m) => Number((m[1] || "").replace(/,/g, "")))
    .filter((n) => Number.isFinite(n));
  if (values.length === 0) return null;
  return Math.max(...values);
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[0]);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function fallbackEntityExtraction(input: AnalyzePayload, fullText: string): ExtractedEntities {
  const emailDomain = extractEmailDomain(input.recruiterEmail || "");
  const websiteDomain = extractDomain(input.website || "");
  const paymentDemands = PAYMENT_KEYWORDS.filter((k) => lower(fullText).includes(lower(k)));
  return {
    companyName: input.companyName || null,
    recruiterName: input.recruiterName || null,
    emailDomain,
    phone: input.phone || null,
    websiteDomain,
    cin: input.cin || null,
    dates: extractDates(fullText),
    stipendAmount: extractStipendAmount(fullText),
    paymentDemands,
  };
}

function normalizeExtractedEntities(parsed: Record<string, unknown>, fallback: ExtractedEntities): ExtractedEntities {
  return {
    companyName: toText(parsed.companyName) || fallback.companyName,
    recruiterName: toText(parsed.recruiterName) || fallback.recruiterName,
    emailDomain: toText(parsed.emailDomain) || fallback.emailDomain,
    phone: toText(parsed.phone) || fallback.phone,
    websiteDomain: toText(parsed.websiteDomain) || fallback.websiteDomain,
    cin: toText(parsed.cin) || fallback.cin,
    dates: Array.isArray(parsed.dates) ? parsed.dates.map((x) => String(x)) : fallback.dates,
    stipendAmount:
      typeof parsed.stipendAmount === "number"
        ? parsed.stipendAmount
        : typeof parsed.stipendAmount === "string" && parsed.stipendAmount.trim()
          ? Number(parsed.stipendAmount.replace(/,/g, ""))
          : fallback.stipendAmount,
    paymentDemands: Array.isArray(parsed.paymentDemands)
      ? parsed.paymentDemands.map((x) => String(x))
      : fallback.paymentDemands,
  };
}

async function extractEntitiesWithGemini(input: AnalyzePayload, fullSubmittedText: string): Promise<ExtractedEntities> {
  const fallback = fallbackEntityExtraction(input, fullSubmittedText);
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallback;

  try {
    const prompt =
      'Extract the following entities from this job/internship offer text. Return ONLY valid JSON with these keys: companyName, recruiterName, emailDomain, phone, websiteDomain, cin, dates, stipendAmount, paymentDemands. If a field is not found return null.';
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(`${prompt}\n\n${fullSubmittedText}`);
    const text = result.response.text();
    const parsed = parseJsonObject(text);
    if (!parsed) return fallback;
    return normalizeExtractedEntities(parsed, fallback);
  } catch {
    return fallback;
  }
}

function confidenceFromFilledFields(input: AnalyzePayload): "Low" | "Medium" | "High" {
  const fields = [
    input.companyName,
    input.cin,
    input.recruiterEmail,
    input.phone,
    input.website,
    input.linkedinUrl,
    input.offerText,
    input.paymentText,
    input.extractedText,
  ];
  const filled = fields.filter((f) => toText(f).length > 0).length;
  if (filled <= 1) return "Low";
  if (filled <= 3) return "Medium";
  return "High";
}

function verdictFromScore(score: number): "LOW RISK" | "CAUTION" | "SUSPICIOUS" | "HIGH-RISK SCAM" {
  if (score <= 20) return "LOW RISK";
  if (score <= 40) return "CAUTION";
  if (score <= 65) return "SUSPICIOUS";
  return "HIGH-RISK SCAM";
}

function parseGroqJson(raw: string): {
  signalExplanations: Record<string, string>;
  nextSteps: string[];
} {
  const fallback = {
    signalExplanations: {} as Record<string, string>,
    nextSteps: [
      "Verify the company domain and recruiter contact on official sources.",
      "Do not pay any fee, deposit, or purchase amount before a verified offer.",
      "Request a formal interview process and official offer documents.",
    ],
  };

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return {
        signalExplanations:
          parsed.signalExplanations && typeof parsed.signalExplanations === "object"
            ? parsed.signalExplanations
            : fallback.signalExplanations,
        nextSteps: Array.isArray(parsed.nextSteps)
          ? parsed.nextSteps.map((x: unknown) => String(x)).slice(0, 5)
          : fallback.nextSteps,
      };
    }
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return parseGroqJson(match[0]);
      } catch {
        return fallback;
      }
    }
  }
  return fallback;
}

function normalizeRedditMention(item: unknown): RedditMention | null {
  if (!item || typeof item !== "object") return null;
  const data = item as Record<string, unknown>;
  const id = typeof data.id === "string" ? data.id : "";
  const title = typeof data.title === "string" ? data.title : "";
  const subreddit = typeof data.subreddit === "string" ? data.subreddit : "";
  const score = typeof data.score === "number" ? data.score : Number(data.score || 0);
  const permalink = typeof data.permalink === "string" ? data.permalink : "";
  const url = typeof data.url === "string" ? data.url : "";
  const created = typeof data.created_utc === "number" ? data.created_utc : Number(data.created_utc || 0);
  if (!id || !title || !subreddit || !permalink) return null;
  return {
    id,
    title,
    subreddit,
    score: Number.isFinite(score) ? score : 0,
    permalink,
    url,
    created_utc: Number.isFinite(created) ? created : 0,
  };
}

function normalizeRedditComment(item: unknown): RedditComment | null {
  if (!item || typeof item !== "object") return null;
  const data = item as Record<string, unknown>;
  const id = typeof data.id === "string" ? data.id : "";
  const author = typeof data.author === "string" ? data.author : "";
  const body = typeof data.body === "string" ? data.body : "";
  const score = typeof data.score === "number" ? data.score : Number(data.score || 0);
  const created = typeof data.created_utc === "number" ? data.created_utc : Number(data.created_utc || 0);
  if (!id || !author || !body.trim()) return null;
  return {
    id,
    author,
    body: body.trim(),
    score: Number.isFinite(score) ? score : 0,
    created_utc: Number.isFinite(created) ? created : 0,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function commentHasScamKeyword(body: string): boolean {
  return containsAny(body, REDDIT_COMMENT_KEYWORDS);
}

function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const value of values) {
    const v = toText(value);
    if (!v) continue;
    const key = lower(v);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(v);
    }
  }

  return out;
}

function simplifyCompanyName(name: string): string[] {
  const raw = toText(name);
  if (!raw) return [];

  const cleaned = raw
    .replace(
      /\b(private limited|pvt\.?\s*ltd\.?|limited|ltd\.?|llp|inc\.?|technologies|technology|solutions|fintech)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();

  const parts = cleaned.split(" ").filter(Boolean);

  const variants = [
    raw,
    cleaned,
    parts.slice(0, 1).join(" "),
    parts.slice(0, 2).join(" "),
  ];

  return uniqueNonEmpty(variants);
}

async function fetchRedditSearch(query: string): Promise<RedditMention[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://offer-safe.vercel.app";
  const endpoint = `${baseUrl}/api/reddit?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(endpoint, {
      cache: "no-store",
    });

    if (!res.ok) return [];

    const payload = (await res.json()) as {
      data?: { children?: Array<{ data?: unknown }> };
    };

    const children = payload.data?.children || [];
    const mentions: RedditMention[] = [];

    for (const child of children) {
      const normalized = normalizeRedditMention(child.data);
      if (normalized) mentions.push(normalized);
    }

    return mentions;
  } catch {
    return [];
  }
}

async function fetchRedditSearchWithRetry(query: string, retries = 1): Promise<RedditMention[]> {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const result = await fetchRedditSearch(query);
    if (result.length > 0) return result;
    if (attempt < retries) {
      await delay(700 * attempt);
    }
  }
  return [];
}

function buildRedditQueries(companyNames: string[]): string[] {
  const queries: string[] = [];
  for (const company of companyNames.slice(0, 2)) {
    queries.push(
      `${company} scam`,
      `${company} job fraud`,
    );
  }
  return uniqueNonEmpty(queries);
}

async function fetchRedditMentions(companyNames: string[]): Promise<RedditMention[]> {
  const queries = buildRedditQueries(companyNames);
  if (queries.length === 0) return [];

  const settled = await Promise.all(queries.map((q) => fetchRedditSearchWithRetry(q)));
  const merged = new Map<string, RedditMention>();

  for (const items of settled) {
    for (const item of items) {
      if (!merged.has(item.id)) {
        merged.set(item.id, item);
      }
    }
  }

  return [...merged.values()].sort((a, b) => b.score - a.score);
}

async function fetchPostComments(post: RedditMention): Promise<RedditComment[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://offer-safe.vercel.app";
  const endpoint = `${baseUrl}/api/reddit?q=${encodeURIComponent(post.title)}&type=comments&id=${encodeURIComponent(post.id)}&subreddit=${encodeURIComponent(post.subreddit)}`;
  try {
    const res = await fetch(endpoint, {
      cache: "no-store",
    });

    if (!res.ok) return [];

    const payload = (await res.json()) as Array<{
      data?: { children?: Array<{ data?: unknown }> };
    }>;

    const commentListing = payload?.[1]?.data?.children || [];
    const comments: RedditComment[] = [];

    for (const child of commentListing) {
      const normalized = normalizeRedditComment(child.data);
      if (normalized) comments.push(normalized);
    }

    return comments.slice(0, 10);
  } catch {
    return [];
  }
}

async function fetchRedditMentionsWithComments(companyNames: string[]): Promise<RedditMentionsPayload> {
  const posts = await fetchRedditMentions(companyNames);
  const comments: Record<string, RedditComment[]> = {};
  const topPosts = [...posts].slice(0, 5);

  for (let i = 0; i < topPosts.length; i += 1) {
    const post = topPosts[i];
    comments[post.id] = await fetchPostComments(post);
    if (i < topPosts.length - 1) {
      await delay(500);
    }
  }

  return { posts, comments };
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
    const message = await res.text();
    throw new Error(`Supabase request failed (${res.status}): ${message}`);
  }

  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

async function callGroqForExplanations(
  triggeredSignals: TriggeredSignal[],
): Promise<{ signalExplanations: Record<string, string>; nextSteps: string[] }> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey || triggeredSignals.length === 0) {
    return {
      signalExplanations: Object.fromEntries(
        triggeredSignals.map((s) => [s.key, `${s.key.replace(/_/g, " ")} was triggered based on the submitted details.`]),
      ),
      nextSteps: [
        "Cross-check the recruiter identity using official company channels.",
        "Avoid making any payment before independent verification.",
        "Keep records of all communication and offer documents.",
      ],
    };
  }

  try {
    const signalList = triggeredSignals.map((s) => `${s.key} (${s.severity})`).join(", ");
    const prompt = `You are a fraud risk analyst. Given these triggered scam signals for a job/internship offer in India: ${signalList}. Generate a 1-2 sentence plain-English explanation for each signal describing what it means in the context of a job scam. Then generate a 3-5 item checklist of what the user should verify next. Do not make legal claims. Do not say whether the company is definitely real or fake. Be direct and practical. Return JSON: { signalExplanations: { signalKey: explanation }, nextSteps: [string] }`;

    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: "llama3-8b-8192",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices[0]?.message?.content ?? "";
    return parseGroqJson(content);
  } catch {
    return {
      signalExplanations: Object.fromEntries(
        triggeredSignals.map((s) => [s.key, `${s.key.replace(/_/g, " ")} was triggered based on the submitted details.`]),
      ),
      nextSteps: [
        "Verify the company website and recruiter email from official listings.",
        "Do not transfer money, buy kits, or pay fees for hiring.",
        "Ask for a formal interview process and official onboarding workflow.",
      ],
    };
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AnalyzePayload;

    const input: AnalyzePayload = {
      companyName: toText(body.companyName),
      recruiterName: toText(body.recruiterName),
      recruiterEmail: toText(body.recruiterEmail),
      phone: toText(body.phone),
      website: toText(body.website),
      cin: toText(body.cin),
      offerText: toText(body.offerText),
      paymentText: toText(body.paymentText),
      extractedText: toText(body.extractedText),
      linkedinUrl: toText(body.linkedinUrl),
      jobTitle: toText(body.jobTitle),
      roleDescription: toText(body.roleDescription),
    };

    const fullText = [input.offerText, input.paymentText, input.extractedText].filter(Boolean).join("\n");

    const fullSubmittedText = [
      `Company Name: ${input.companyName || ""}`,
      `Recruiter Name: ${input.recruiterName || ""}`,
      `Recruiter Email: ${input.recruiterEmail || ""}`,
      `Phone: ${input.phone || ""}`,
      `Website: ${input.website || ""}`,
      `CIN: ${input.cin || ""}`,
      `LinkedIn URL: ${input.linkedinUrl || ""}`,
      `Job Title: ${input.jobTitle || ""}`,
      `Role Description: ${input.roleDescription || ""}`,
      `Offer Text: ${input.offerText || ""}`,
      `Payment Text: ${input.paymentText || ""}`,
      `Extracted Text: ${input.extractedText || ""}`,
    ].join("\n");

    const extractedEntities = await extractEntitiesWithGemini(input, fullSubmittedText);
    const emailDomain = extractedEntities.emailDomain || extractEmailDomain(input.recruiterEmail || "");
    const websiteDomain = extractedEntities.websiteDomain || extractDomain(input.website || "");

    const scamCases = await supabaseRequest<ScamCase[]>("scam_cases?status=eq.approved&select=*");

    let matchedCase: ScamCase | null = null;
    const companyInput = lower(extractedEntities.companyName || input.companyName || "");

    for (const c of scamCases) {
      const companyHit = (c.company_name_variants || []).some((v) => {
        const vv = lower(v || "");
        return vv.length > 0 && companyInput.length > 0 && (companyInput.includes(vv) || vv.includes(companyInput));
      });

      const emailHit = (c.email_patterns || []).some(
        (p) => p && input.recruiterEmail && lower(input.recruiterEmail).includes(lower(p)),
      );

      const domainHit = (c.domain_patterns || []).some((p) => {
        if (!p || !websiteDomain) return false;
        const candidate = lower(p);
        return websiteDomain === candidate || websiteDomain.endsWith(`.${candidate}`);
      });

      if (companyHit || emailHit || domainHit) {
        matchedCase = c;
        break;
      }
    }

    const redditCompanyNames = uniqueNonEmpty([
      extractedEntities.companyName,
      input.companyName,
      matchedCase?.case_name,
      ...(matchedCase?.company_name_variants || []),
      ...simplifyCompanyName(extractedEntities.companyName || input.companyName || ""),
    ]);

    const redditMentionsData = await fetchRedditMentionsWithComments(redditCompanyNames);
    const strongRedditMentions = redditMentionsData.posts.filter((item) => item.score >= 1);
    const scamKeywordCommentCount = Object.values(redditMentionsData.comments)
      .flat()
      .filter((comment) => commentHasScamKeyword(comment.body)).length;

    const triggered: TriggeredSignal[] = [];

    const addSignal = (key: SignalKey, reason: string) => {
      const exists = triggered.some((s) => s.key === key);
      if (!exists) {
        triggered.push({
          key,
          weight: SIGNALS[key].weight,
          severity: SIGNALS[key].severity,
          reason,
        });
      }
    };

    const addCustomSignal = (key: SignalKey, reason: string, weight: number, severity: SignalSeverity) => {
      const exists = triggered.some((s) => s.key === key);
      if (!exists) {
        triggered.push({
          key,
          weight,
          severity,
          reason,
        });
      }
    };

    if (matchedCase) {
      addSignal("known_scam_match", `Matched known scam case: ${matchedCase.case_name}`);
    }

    if (emailDomain && FREE_EMAIL_DOMAINS.has(emailDomain)) {
      addSignal("email_free_provider", `Recruiter email uses free provider (${emailDomain}).`);
    }

    if (emailDomain && websiteDomain && emailDomain !== websiteDomain && !emailDomain.endsWith(`.${websiteDomain}`)) {
      addSignal("email_domain_mismatch", "Recruiter email domain does not match submitted website domain.");
    }

    const cinValue = extractedEntities.cin || input.cin || "";

    if (cinValue) {
      if (!CIN_REGEX.test(cinValue)) {
        addSignal("cin_invalid_format", "CIN provided but format is invalid.");
      }
    } else {
      addSignal("cin_missing", "No CIN provided.");
    }

    const registeredClaim =
      Boolean(cinValue) || /(registered|pvt ltd|private limited|llp|inc)/i.test(`${input.companyName} ${fullText}`);

    if (registeredClaim && emailDomain && (emailDomain === "gmail.com" || emailDomain === "yahoo.com")) {
      addSignal("gmail_as_official", "Registered company claim with gmail/yahoo official contact.");
    }

    if (containsAny(fullText, PAYMENT_KEYWORDS)) {
      addSignal("payment_requested", "Payment/fee/deposit language found in submitted text.");
    }

    const reimbursementTrap =
      /(reimburse after joining|will be reimbursed)/i.test(fullText) && /(purchase|buy)/i.test(fullText);

    if (reimbursementTrap) {
      addSignal("reimbursement_trap", "Contains reimbursement-after-joining plus purchase/buy language.");
    }

    if (containsAny(fullText, PAID_TRAINING_KEYWORDS)) {
      addSignal("paid_training_placement", "Contains paid training/guaranteed placement language.");
    }

    if (!websiteDomain) {
      addSignal("domain_missing", "No website URL provided.");
    }
    // domain_age_new removed — it fired for every site and inflated all scores
    

    const stipend = extractedEntities.stipendAmount;
    const isInternship = /(intern|internship)/i.test(`${input.jobTitle} ${fullText}`);
    const isFresher = /(fresher|entry level|graduate)/i.test(`${input.jobTitle} ${fullText}`);

    if (stipend !== null) {
      if ((isInternship && stipend > 80000) || (isFresher && stipend > 200000)) {
        addSignal("unrealistic_stipend", "Stipend appears unrealistically high for role category.");
      }
    }

    if (containsAny(fullText, URGENCY_KEYWORDS)) {
      addSignal("urgency_language", "Urgency phrases detected in offer text.");
    }

    if (!input.website && !input.linkedinUrl) {
      addSignal("no_company_web_presence", "No website and no LinkedIn profile provided.");
    }

    const offerTextWordCount = fullText.trim().split(/\s+/).filter(Boolean).length;
    if (offerTextWordCount > 50 && !containsAny(fullText, INTERVIEW_KEYWORDS)) {
    addSignal("no_interview_mentioned", "No interview/test/assessment mentions in submitted text.");

    }

    if (/whatsapp/i.test(`${input.phone} ${fullText}`)) {
      addSignal("whatsapp_only_recruitment", "WhatsApp appears to be primary/only recruitment channel.");
    }

    if (fullText && fullText.trim().split(/\s+/).filter(Boolean).length > 80) {
      const checks = [
        /(company address|address:)/i.test(fullText),
        /(registration number|cin|incorporation no)/i.test(fullText),
        /\b(date|dated)\b/i.test(fullText),
        /(authorized signatory|authorised signatory|hr manager|signatory)/i.test(fullText),
        /(letterhead|official letterhead|www\.)/i.test(fullText),
      ];
      const missingCount = checks.filter((ok) => !ok).length;
      if (missingCount >= 3) {
        addSignal("poor_formatting", "Offer text is missing multiple expected formal offer details.");
      }
    }

    const titleWordCount = (input.jobTitle || "").split(/\s+/).filter(Boolean).length;
    const roleWordCount = (input.roleDescription || "").split(/\s+/).filter(Boolean).length;

    if (titleWordCount > 0 && titleWordCount < 3 && roleWordCount > 0 && roleWordCount < 30)  {
      addSignal("vague_role", "Job title and role details are too vague.");
    }

    if (strongRedditMentions.length >= 2) {
      addSignal(
        "reddit_mentions",
        `${strongRedditMentions.length} Reddit posts mention scam or hiring concerns related to this company.`,
      );
    }

    if (scamKeywordCommentCount >= 2) {
      addCustomSignal(
        "reddit_comment_scam_score",
        `${scamKeywordCommentCount} Reddit comments include scam-related warnings from the community.`,
        10,
        "high",
      );
    } else if (scamKeywordCommentCount >= 1) {
      addCustomSignal(
        "reddit_comment_scam_score",
        `${scamKeywordCommentCount} Reddit comments include scam-related warning language.`,
        5,
        "medium",
      );
    }

    const rawScore = triggered.reduce((sum, s) => sum + s.weight, 0);
    const riskScore = Math.min(rawScore, 100);
    const verdict = verdictFromScore(riskScore);
    const confidence = confidenceFromFilledFields(input);

    const llmOutput = await callGroqForExplanations(triggered);

    const insertPayload = {
      inputs_json: input,
      extracted_entities_json: {
        company_name: extractedEntities.companyName,
        recruiter_name: extractedEntities.recruiterName,
        email_domain: emailDomain,
        phone: extractedEntities.phone,
        website_domain: websiteDomain,
        cin: cinValue || null,
        dates: extractedEntities.dates,
        stipend_amount: extractedEntities.stipendAmount,
        payment_demands: extractedEntities.paymentDemands,
      },
      signals_json: triggered,
      matched_case_id: matchedCase?.id ?? null,
      risk_score: riskScore,
      verdict: verdict,
      confidence: confidence,
      explanation_json: {
        signalExplanations: llmOutput.signalExplanations,
        nextSteps: llmOutput.nextSteps,
      },
      reddit_mentions_json: redditMentionsData,
    };

    const inserted = await supabaseRequest<{ id: string }[]>("cases?select=id", {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify(insertPayload),
    });

    const id = inserted?.[0]?.id;

    if (!id) {
      throw new Error("Failed to persist case id.");
    }

    return NextResponse.json({ id }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}