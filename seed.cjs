const { MongoClient } = require("mongodb");
const bcrypt = require("bcrypt");

const client = new MongoClient(process.env.MONGODB_URI);

async function seedUsers() {
  try {
    await client.connect();

    const db = client.db("online_course");
    const users = db.collection("users");
    const password = await bcrypt.hash("Course2026!", 10);

    for (const role of ["Teacher", "Student"]) {
      for (let i = 1; i <= 3; i++) {
        const username = role.toLowerCase() + i;
        const existing = await users.findOne({ username });

        if (existing) {
          console.log(username + " already exists — skipped");
          continue;
        }

        await users.insertOne({
          username,
          email: username + "@example.com",
          password,
          role,
        });

        console.log("Created " + username);
      }
    }

    console.log("Test accounts are ready.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

seedUsers();