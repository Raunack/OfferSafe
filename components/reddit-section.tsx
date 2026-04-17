"use client";

import { useEffect, useState } from "react";

type RedditPost = {
  id: string;
  title: string;
  subreddit: string;
  score: number;
  permalink: string;
  url: string;
  selftext?: string;
};

type RedditComment = {
  id: string;
  author: string;
  body: string;
  score: number;
};

const SCAM_KEYWORDS = [
  "paid", "fee", "scam", "fake", "fraud", "money", "kit",
  "deposit", "cheated", "ghosted", "never joined", "warning",
  "avoid", "don't join", "do not join", "reported", "police",
];

function truncateComment(text: string): string {
  if (text.length <= 150) return text;
  return `${text.slice(0, 150)}...`;
}

async function fetchRedditPosts(companyName: string): Promise<RedditPost[]> {
  const queries = [
    `${companyName} scam`,
    `${companyName} job fraud`,
  ];

  const allPosts = new Map<string, RedditPost>();

  for (const query of queries) {
    try {
      const res = await fetch(
        `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=5&sort=relevance`,
        { headers: { "Accept": "application/json" } }
      );
      if (!res.ok) continue;
      const data = await res.json() as {
        data?: { children?: Array<{ data?: unknown }> };
      };
      const children = data.data?.children ?? [];
      for (const child of children) {
        const d = child.data as Record<string, unknown> | undefined;
        if (!d || typeof d.id !== "string") continue;
        if (!allPosts.has(d.id)) {
          allPosts.set(d.id, {
            id: d.id as string,
            title: (d.title as string) ?? "",
            subreddit: (d.subreddit as string) ?? "",
            score: (d.score as number) ?? 0,
            permalink: (d.permalink as string) ?? "",
            url: (d.url as string) ?? "",
            selftext: (d.selftext as string) ?? "",
          });
        }
      }
    } catch {
      // silently skip failed query
    }
  }

  return [...allPosts.values()].sort((a, b) => b.score - a.score);
}

async function fetchPostComments(post: RedditPost): Promise<RedditComment[]> {
  try {
    const res = await fetch(
      `https://www.reddit.com/r/${encodeURIComponent(post.subreddit)}/comments/${encodeURIComponent(post.id)}.json?sort=top&limit=10`,
      { headers: { "Accept": "application/json" } }
    );
    if (!res.ok) return [];
    const payload = await res.json() as Array<{
      data?: { children?: Array<{ data?: unknown }> };
    }>;
    const commentListing = payload?.[1]?.data?.children ?? [];
    const comments: RedditComment[] = [];
    for (const child of commentListing) {
      const d = child.data as Record<string, unknown> | undefined;
      if (!d || typeof d.id !== "string" || d.body === "[deleted]") continue;
      comments.push({
        id: d.id as string,
        author: (d.author as string) ?? "unknown",
        body: (d.body as string) ?? "",
        score: (d.score as number) ?? 0,
      });
    }
    return comments.slice(0, 10);
  } catch {
    return [];
  }
}

export function RedditSection({ companyName }: { companyName: string }) {
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [comments, setComments] = useState<Record<string, RedditComment[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyName) { setLoading(false); return; }

    let cancelled = false;

    (async () => {
      setLoading(true);
      const fetchedPosts = await fetchRedditPosts(companyName);
      if (cancelled) return;
      setPosts(fetchedPosts);
      setLoading(false);

      // Fetch comments for top 3 posts
      const topPosts = fetchedPosts.slice(0, 3);
      for (const post of topPosts) {
        if (cancelled) break;
        const postComments = await fetchPostComments(post);
        if (!cancelled) {
          setComments((prev) => ({ ...prev, [post.id]: postComments }));
        }
        await new Promise((r) => setTimeout(r, 300));
      }
    })();

    return () => { cancelled = true; };
  }, [companyName]);

  return (
    <section className="card space-y-3">
      <h2 className="text-xl font-semibold">Community reports found</h2>

      {loading ? (
        <p className="text-sm text-slate-500">Searching Reddit for community reports…</p>
      ) : posts.length === 0 ? (
        <p className="text-sm text-slate-600">No relevant Reddit community posts found for this company.</p>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const relevantComments = (comments[post.id] ?? [])
              .filter((c) =>
                SCAM_KEYWORDS.some((kw) => c.body.toLowerCase().includes(kw))
              )
              .sort((a, b) => b.score - a.score)
              .slice(0, 2);

            return (
              <article key={post.id} className="rounded-lg border border-slate-200 p-4">
                <a
                  href={`https://www.reddit.com${post.permalink}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold hover:underline"
                  style={{ color: "var(--accent)" }}
                >
                  {post.title}
                </a>
                <p className="mt-1 text-xs text-slate-600">
                  r/{post.subreddit} | Upvotes: {post.score}
                </p>

                {relevantComments.length > 0 && (
                  <div className="mt-3 space-y-2 rounded bg-slate-50 p-3">
                    <p className="label" style={{ color: "var(--muted)" }}>
                      Top community responses:
                    </p>
                    {relevantComments.map((comment) => (
                      <div
                        key={comment.id}
                        className="rounded border p-2"
                        style={{ borderColor: "var(--card-border)", background: "#fff" }}
                      >
                        <p className="text-xs">{truncateComment(comment.body)}</p>
                        <p className="mt-1 text-[11px]" style={{ color: "var(--muted)" }}>
                          u/{comment.author} | Upvotes: {comment.score}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
