export function validateCourse(body) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const { name, duration, topics, price, maxStudent, status } = body;

  if (
    typeof name !== "string" ||
    !name.trim() ||
    !Number.isInteger(duration) ||
    duration <= 0 ||
    !Array.isArray(topics) ||
    topics.length === 0 ||
    topics.some((topic) => typeof topic !== "string" || !topic.trim()) ||
    typeof price !== "number" ||
    !Number.isFinite(price) ||
    price < 0 ||
    !Number.isInteger(maxStudent) ||
    maxStudent <= 0 ||
    !["Open", "Close", "Cancel"].includes(status)
  ) {
    return null;
  }

  return {
    name: name.trim(),
    duration,
    topics: topics.map((topic) => topic.trim()),
    price,
    maxStudent,
    status,
  };
}