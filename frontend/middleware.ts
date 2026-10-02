import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths without auth
  if (
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/login") ||
    pathname.startsWith('/Fireflow.svg') ||
    pathname.startsWith("/_next")  // Next.js internals
  ) {
    return NextResponse.next();
  }

  // Validate session with backend
  try {
    const token = request.cookies.get("token")?.value;
    // console.log("Token from cookie:", token);

    if (!token || token === undefined) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5100";
    console.log("Middleware trying to fetch from:", apiUrl);
    const res = await fetch(`${apiUrl}/api`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 401) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();

  } catch (error) {
    console.error("Error validating session:", error);
    return NextResponse.redirect(new URL("/login", request.url));
  }
  
}