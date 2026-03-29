const BASE = "https://iosoccer.com:44380/api";
const HEADERS = {
  "Content-Type": "application/json",
  "Origin": "https://www.iosoccer.com",
  "Referer": "https://www.iosoccer.com/",
};

export async function GET(request: Request) {
  const path = new URL(request.url).searchParams.get("path");
  const res = await fetch(`${BASE}${path}`, { headers: HEADERS });
  const data = await res.json();
  return Response.json(data);
}

export async function POST(request: Request) {
  const path = new URL(request.url).searchParams.get("path");
  const body = await request.json();
  const res = await fetch(`${BASE}${path}`, {
    method: "POST", headers: HEADERS, body: JSON.stringify(body)
  });
  const data = await res.json();
  return Response.json(data);
}