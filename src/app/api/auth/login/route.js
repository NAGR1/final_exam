
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { getClientPromise } from "@/lib/mongodb";
import { errorResponse, successResponse } from "@/lib/utils";
import corsHeaders from "@/lib/cors";

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { username, password } = body ?? {};

  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    !username.trim() ||
    !password
  ) {
    return errorResponse(
      "Username and password are required",
      400
    );
  }

  try {
    const client = await getClientPromise();
    const db = client.db("online_course");

    const user = await db.collection("users").findOne({
      username: username.trim(),
    });

    if (
      !user ||
      !(await bcrypt.compare(password, user.password))
    ) {
      return errorResponse(
        "Invalid username or password",
        401
      );
    }

    const userData = {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(
      userData,
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
        algorithm: "HS256",
      }
    );

    const response = successResponse(
      {
        message: "Login successful",
        user: userData,
      },
      200
    );

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite:
        process.env.NODE_ENV === "production"
          ? "none"
          : "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (error) {
    console.error("Login failed:", error.message);

    return errorResponse(
      "Unable to log in. Please try again.",
      500
    );
  }
}
