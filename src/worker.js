// src/worker.js
// Background worker to process Bull jobs when REDIS_URL is configured.
// Connects to MongoDB to perform DB writes like saveMatchHistory.

require("dotenv").config();
const REDIS_URL = process.env.REDIS_URL;
const MONGO_URI = process.env.MONGO_URI;
const mongoose = require("mongoose");

async function ensureMongo() {
  if (!MONGO_URI) {
    console.warn("Worker: MONGO_URI not configured — DB ops will fail.");
    return;
  }
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Worker: connected to MongoDB");
  } catch (e) {
    console.error("Worker: failed to connect to MongoDB:", e);
    throw e;
  }
}

const { processJob } = require("./jobHandlers");

async function start() {
  await ensureMongo();

  if (!REDIS_URL) {
    console.log("No REDIS_URL configured — worker running in no-op mode.");
    console.log(
      "If you want background job processing, set REDIS_URL and restart worker."
    );
    return;
  }

  try {
    const Bull = require("bull");
    const queue = new Bull("damas-jobs", REDIS_URL);

    console.log("Worker connected to Bull queue (damas-jobs).");

    queue.process(async (job) => {
      try {
        const data = job && job.data;
        if (data && data.type) {
          await processJob(data);
        } else {
          // marker job
        }
      } catch (e) {
        console.error("Worker: error processing job", job.id, e);
        throw e;
      }
    });

    queue.on("failed", (job, err) => {
      console.error("Job failed:", job.id, err);
    });

    queue.on("completed", (job) => {
      // quiet by default
    });
  } catch (e) {
    console.error(
      "Failed to start Bull worker, falling back to no-op worker:",
      e
    );
  }
}

start().catch((e) => {
  console.error("Worker crashed:", e);
  process.exit(1);
});
