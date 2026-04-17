import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");
  if (!query) return NextResponse.json({});

  try {
    const res = await fetch(
      `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=5&sort=relevance`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; OfferSafe/1.0)" },
      }
    );
    if (!res.ok) return NextResponse.json({});
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({});
  }
}