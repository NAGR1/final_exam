import { ObjectId } from "mongodb";
import { verifyJWT } from "@/lib/auth";
import { getClientPromise } from "@/lib/mongodb";
import { errorResponse, successResponse } from "@/lib/utils";
import corsHeaders from "@/lib/cors";

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(request) {
  const decoded = verifyJWT(request);

  if (!decoded || !ObjectId.isValid(decoded.id)) {
    return errorResponse("Please log in", 401);
  }

  try {
    const client = await getClientPromise();
    const db = client.db("online_course");

    const user = await db.collection("users").findOne(
      { _id: new ObjectId(decoded.id) },
      { projection: { password: 0 } },
    );

    if (!user) {
      return errorResponse("User not found", 401);
    }

    return successResponse(
      {
        user: {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          role: user.role,
        },
      },
      200,
    );
  } catch (error) {
    console.error("User lookup failed:", error.message);
    return errorResponse("Unable to load user", 500);
  }
}