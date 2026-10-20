
import { verifyJWT } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/utils";
import corsHeaders from "@/lib/cors";

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(request) {
  const user = verifyJWT(request);

  if (!user) {
    return errorResponse("Please log in", 401);
  }

  return successResponse(
    {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    },
    200
  );
}
