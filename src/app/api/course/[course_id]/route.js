
import { ObjectId } from "mongodb";
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

// GET: View Course Details
export async function GET(request, { params }) {
  const user = verifyJWT(request);

  if (!user) {
    return errorResponse("Please log in", 401);
  }

  if (!["Teacher", "Student"].includes(user.role)) {
    return errorResponse("Access denied", 403);
  }

  // Match teacher's original [course_id] folder
  const { course_id: id } = await params;

  if (!ObjectId.isValid(id)) {
    return errorResponse("Invalid course ID", 400);
  }

  try {
    const client = await getClientPromise();
    const db = client.db("online_course");

    const course = await db.collection("courses").findOne({
      _id: new ObjectId(id),
    });

    if (!course) {
      return errorResponse("Course not found", 404);
    }

    // Teachers can view only their own courses
    if (
      user.role === "Teacher" &&
      course.teacherId !== user.id
    ) {
      return errorResponse("Access denied", 403);
    }

    // Students cannot view cancelled courses
    if (
      user.role === "Student" &&
      course.status === "Cancel"
    ) {
      return errorResponse("Course not available", 404);
    }

    const enrolledStudents = course.enrolledStudents || [];

    const result = {
      ...course,
      enrolledCount: enrolledStudents.length,
      isEnrolled: enrolledStudents.includes(user.id),
    };

    // Do not expose the raw enrollment ID list
    delete result.enrolledStudents;

    // Teachers can see students enrolled in their courses
    if (user.role === "Teacher") {
      const studentIds = enrolledStudents
        .filter((studentId) => ObjectId.isValid(studentId))
        .map((studentId) => new ObjectId(studentId));

      const students = await db
        .collection("users")
        .find({
          _id: { $in: studentIds },
          role: "Student",
        })
        .project({
          username: 1,
          email: 1,
        })
        .toArray();

      result.students = students;
    }

    return successResponse(
      { course: result },
      200
    );

  } catch (error) {
    console.error(
      "Course details error:",
      error.message
    );

    return errorResponse(
      "Unable to load course",
      500
    );
  }
}

// PUT: Update Course
export async function PUT(request, { params }) {
  const user = verifyJWT(request);

  if (!user) {
    return errorResponse("Please log in", 401);
  }

  // Only Teachers can update courses
  if (user.role !== "Teacher") {
    return errorResponse(
      "Only Teachers can update courses",
      403
    );
  }

  // Match [course_id] folder
  const { course_id: id } = await params;

  if (!ObjectId.isValid(id)) {
    return errorResponse("Invalid course ID", 400);
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  // Validate the course information
  const courseData = validateCourse(body);

  if (!courseData) {
    return errorResponse(
      "Invalid course information",
      400
    );
  }

  try {
    const client = await getClientPromise();
    const db = client.db("online_course");

    const courses = db.collection("courses");

    // Find only a course owned by this Teacher
    const course = await courses.findOne({
      _id: new ObjectId(id),
      teacherId: user.id,
    });

    if (!course) {
      return errorResponse(
        "Course not found or access denied",
        404
      );
    }

    const count = (course.enrolledStudents || []).length;

    // Cannot reduce capacity below current enrollment
    if (courseData.maxStudent < count) {
      return errorResponse(
        "Maximum students cannot be less than current enrollment",
        400
      );
    }

    // Update course with capacity protection
    const result = await courses.updateOne(
      {
        _id: new ObjectId(id),
        teacherId: user.id,
        $expr: {
          $lte: [
            {
              $size: {
                $ifNull: ["$enrolledStudents", []],
              },
            },
            courseData.maxStudent,
          ],
        },
      },
      {
        $set: {
          ...courseData,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return errorResponse(
        "Course changed or enrollment exceeds the new capacity",
        409
      );
    }

    return successResponse(
      {
        message: "Course updated successfully",
      },
      200
    );

  } catch (error) {
    console.error(
      "Update course error:",
      error.message
    );

    return errorResponse(
      "Unable to update course",
      500
    );
  }
}

// DELETE: Delete Course
export async function DELETE(request, { params }) {
  const user = verifyJWT(request);

  if (!user) {
    return errorResponse("Please log in", 401);
  }

  // Only Teachers can delete courses
  if (user.role !== "Teacher") {
    return errorResponse(
      "Only Teachers can delete courses",
      403
    );
  }

  // Match [course_id] folder
  const { course_id: id } = await params;

  if (!ObjectId.isValid(id)) {
    return errorResponse("Invalid course ID", 400);
  }

  try {
    const client = await getClientPromise();
    const db = client.db("online_course");

    const courses = db.collection("courses");

    // Find only the Teacher's own course
    const course = await courses.findOne({
      _id: new ObjectId(id),
      teacherId: user.id,
    });

    if (!course) {
      return errorResponse(
        "Course not found or access denied",
        404
      );
    }

    // Cannot delete courses with enrolled students
    if ((course.enrolledStudents || []).length > 0) {
      return errorResponse(
        "Cannot delete a course with enrolled students",
        400
      );
    }

    // Delete only if enrollment is still empty
    const result = await courses.deleteOne({
      _id: new ObjectId(id),
      teacherId: user.id,
      $expr: {
        $eq: [
          {
            $size: {
              $ifNull: ["$enrolledStudents", []],
            },
          },
          0,
        ],
      },
    });

    if (result.deletedCount === 0) {
      return errorResponse(
        "Course was not deleted. Check enrollment.",
        409
      );
    }

    return successResponse(
      {
        message: "Course deleted successfully",
      },
      200
    );

  } catch (error) {
    console.error(
      "Delete course error:",
      error.message
    );

    return errorResponse(
      "Unable to delete course",
      500
    );
  }
}
