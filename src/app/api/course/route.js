
import { verifyJWT } from "@/lib/auth";
import { getClientPromise } from "@/lib/mongodb";
import { validateCourse } from "@/lib/course";
import { errorResponse, successResponse } from "@/lib/utils";
import corsHeaders from "@/lib/cors";

// Handle CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// GET: View Courses
export async function GET(request) {
  const user = verifyJWT(request);

  if (!user) {
    return errorResponse("Please log in", 401);
  }

  if (!["Teacher", "Student"].includes(user.role)) {
    return errorResponse("Access denied", 403);
  }

  try {
    const client = await getClientPromise();
    const db = client.db("online_course");

    const query = {};

    // Teachers see only their own courses
    if (user.role === "Teacher") {
      query.teacherId = user.id;
    }

    // Students cannot see cancelled courses
    if (user.role === "Student") {
      query.status = { $ne: "Cancel" };

      // Show courses student enrolled in
      const enrolled = request.nextUrl.searchParams.get(
        "enrolled"
      );

      if (enrolled === "true") {
        query.enrolledStudents = user.id;
      }
    }

    // Search by course name or teacher name
    const search = request.nextUrl.searchParams
      .get("search")
      ?.trim();

    if (search) {
      const escaped = search.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      query.$or = [
        {
          name: {
            $regex: escaped,
            $options: "i",
          },
        },
        {
          teacherName: {
            $regex: escaped,
            $options: "i",
          },
        },
      ];
    }

    // Get courses from MongoDB
    const courses = await db
      .collection("courses")
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    // Add enrolled student count
    const result = courses.map((course) => {
      const {
        enrolledStudents = [],
        ...details
      } = course;

      return {
        ...details,
        enrolledCount: enrolledStudents.length,
        isEnrolled: enrolledStudents.includes(user.id),
      };
    });

    return successResponse(
      { courses: result },
      200
    );

  } catch (error) {
    console.error(
      "Load courses failed:",
      error.message
    );

    return errorResponse(
      "Unable to load courses",
      500
    );
  }
}

// POST: Create New Course
export async function POST(request) {
  const user = verifyJWT(request);

  if (!user) {
    return errorResponse("Please log in", 401);
  }

  // Only teachers can create courses
  if (user.role !== "Teacher") {
    return errorResponse(
      "Only Teachers can create courses",
      403
    );
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  // Validate course information
  const courseData = validateCourse(body);

  if (!courseData) {
    return errorResponse(
      "Enter a name, positive whole-number duration and capacity, " +
      "at least one topic, a non-negative price, and a valid status",
      400
    );
  }

  try {
    const client = await getClientPromise();
    const db = client.db("online_course");

    // Course belongs to logged-in teacher
    const course = {
      ...courseData,
      teacherId: user.id,
      teacherName: user.username,
      enrolledStudents: [],
      createdAt: new Date(),
    };

    // Insert into MongoDB
    const result = await db
      .collection("courses")
      .insertOne(course);

    return successResponse(
      {
        message: "Course created successfully",
        course: {
          ...course,
          _id: result.insertedId,
        },
      },
      201
    );

  } catch (error) {
    console.error(
      "Create course failed:",
      error.message
    );

    return errorResponse(
      "Unable to create course",
      500
    );
  }
}
