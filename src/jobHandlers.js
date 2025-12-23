// src/jobHandlers.js
// Centraliza handlers para jobs serializáveis.
const MatchHistory = require("../models/MatchHistory");

async function handleSaveMatchHistory(payload) {
  const history = new MatchHistory({
    player1: payload.player1,
    player2: payload.player2,
    winner: payload.winner || null,
    bet: payload.bet,
    gameMode: payload.gameMode,
    reason: payload.reason,
  });
  await history.save();
}

async function processJob(job) {
  if (!job || !job.type) return;
  try {
    switch (job.type) {
      case "saveMatchHistory":
        await handleSaveMatchHistory(job.payload);
        break;
      default:
        console.log("jobHandlers: no handler for type", job.type);
    }
  } catch (e) {
    console.error("jobHandlers: error processing job", job && job.type, e);
    throw e;
  }
}

module.exports = { processJob, handleSaveMatchHistory };
