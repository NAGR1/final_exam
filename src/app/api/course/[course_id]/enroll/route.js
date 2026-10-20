
import { ObjectId } from "mongodb";
import { verifyJWT } from "@/lib/auth";
import { getClientPromise } from "@/lib/mongodb";
import { errorResponse, successResponse } from "@/lib/utils";
import corsHeaders from "@/lib/cors";

// Handle CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// POST: Student enrolls in a course
export async function POST(request, { params }) {
  const user = verifyJWT(request);

  // User must be logged in
  if (!user) {
    return errorResponse("Please log in", 401);
  }

  // Only Students can enroll
  if (user.role !== "Student") {
    return errorResponse(
      "Only Students can enroll in courses",
      403
    );
  }

  // Match teacher's original [course_id] folder
  const { course_id: id } = await params;

  // Validate course ID
  if (
    typeof id !== "string" ||
    !/^[0-9a-fA-F]{24}$/.test(id)
  ) {
    return errorResponse("Invalid course ID", 400);
  }

  try {
    const client = await getClientPromise();
    const db = client.db("online_course");

    const courses = db.collection("courses");
    const courseId = new ObjectId(id);

    // Check status, duplicate enrollment,
    // and available seats in one atomic update.
    const result = await courses.updateOne(
      {
        _id: courseId,
        status: "Open",

        // Prevent duplicate enrollment
        enrolledStudents: {
          $ne: user.id,
        },

        // Check available seats
        $expr: {
          $lt: [
            {
              $size: {
                $ifNull: ["$enrolledStudents", []],
              },
            },
            "$maxStudent",
          ],
        },
      },
      {
        $addToSet: {
          enrolledStudents: user.id,
        },
      }
    );

    // Enrollment successful
    if (result.modifiedCount === 1) {
      return successResponse(
        {
          message: "Enrollment successful",
        },
        200
      );
    }

    // Check why enrollment failed
    const course = await courses.findOne({
      _id: courseId,
    });

    // Course does not exist or is cancelled
    if (!course || course.status === "Cancel") {
      return errorResponse(
        "Course not available",
        404
      );
    }

    // Course is not Open
    if (course.status !== "Open") {
      return errorResponse(
        "This course is not open for enrollment",
        409
      );
    }

    const students = course.enrolledStudents || [];

    // Student already enrolled
    if (students.includes(user.id)) {
      return errorResponse(
        "You are already enrolled in this course",
        409
      );
    }

    // Course is full
    if (students.length >= course.maxStudent) {
      return errorResponse(
        "This course is full",
        409
      );
    }

    // Other enrollment failure
    return errorResponse(
      "Enrollment could not be completed",
      409
    );

  } catch (error) {
    console.error(
      "Enrollment failed:",
      error.message
    );

    return errorResponse(
      "Unable to enroll in course",
      500
    );
  }
}
