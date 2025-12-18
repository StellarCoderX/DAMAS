const mongoose = require("mongoose");

const MatchHistorySchema = new mongoose.Schema({
  player1: { type: String, required: true }, // Email do jogador 1
  player2: { type: String, required: true }, // Email do jogador 2
  winner: { type: String, default: null }, // Email do vencedor ou null (empate)
  bet: { type: Number, required: true }, // Valor da aposta
  gameMode: { type: String, required: true }, // 'classic', 'tablita', 'international'
  reason: { type: String }, // Motivo do fim de jogo (xeque, tempo, desistência)
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("MatchHistory", MatchHistorySchema);
