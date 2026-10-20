import { NextResponse } from "next/server";
import corsHeaders from "@/lib/cors";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST() {
  const response = NextResponse.json(
    { message: "Logged out successfully" },
    { status: 200, headers: corsHeaders }
  );
  response.cookies.set("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
