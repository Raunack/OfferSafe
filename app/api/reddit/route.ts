import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");
  const type = searchParams.get("type");
  const id = searchParams.get("id");
  const subreddit = searchParams.get("subreddit");

  if (!query) return NextResponse.json({});

  try {
    let url = "";
    if (type === "comments" && id && subreddit) {
      url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/comments/${encodeURIComponent(id)}.json?sort=top&limit=10`;
    } else {
      url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=5&sort=relevance`;
    }
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; OfferSafe/1.0)" },
    });
    if (!res.ok) return NextResponse.json({});
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({});
  }
}