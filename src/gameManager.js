// src/gameManager.js (VERSÃO COM SUPORTE A DOIS TIPOS DE TEMPO)
const User = require("../models/User");
const { findBestCaptureMoves } = require("./gameLogic");

let io;
let gameRooms;

function initializeManager(ioInstance, roomsInstance) {
  io = ioInstance;
  gameRooms = roomsInstance;
}

function startTimer(roomCode) {
  const room = gameRooms[roomCode];
  if (!room) return;
  if (room.timerInterval) clearInterval(room.timerInterval);

  // Lógica difere baseada no tipo de controle de tempo
  if (room.timeControl === "match") {
    // --- MODO POR PARTIDA (BLITZ) ---
    // Não reseta o timeLeft, usa os bancos de tempo whiteTime e blackTime
    // Identifica quem está a jogar
    const currentPlayerColor = room.game.currentPlayer; // 'b' ou 'p'

    room.timerInterval = setInterval(() => {
      if (!gameRooms[roomCode]) {
        clearInterval(room.timerInterval);
        return;
      }

      let timeOver = false;

      if (currentPlayerColor === "b") {
        room.whiteTime--;
        if (room.whiteTime <= 0) timeOver = true;
      } else {
        room.blackTime--;
        if (room.blackTime <= 0) timeOver = true;
      }

      // Envia atualização para os clientes
      // Enviamos ambos os tempos para que o cliente possa exibir o correto
      io.to(roomCode).emit("timerUpdate", {
        whiteTime: room.whiteTime,
        blackTime: room.blackTime,
      });

      if (timeOver) {
        clearInterval(room.timerInterval);
        const loserColor = currentPlayerColor;
        const winnerColor = loserColor === "b" ? "p" : "b";
        processEndOfGame(winnerColor, loserColor, room, "Tempo esgotado!");
      }
    }, 1000);
  } else {
    // --- MODO POR JOGADA (PADRÃO) ---
    // Reseta o tempo a cada chamada (feito no resetTimer, mas garantimos aqui o inicio)
    // Se não foi resetado externamente, usamos o timeLeft atual

    io.to(roomCode).emit("timerUpdate", { timeLeft: room.timeLeft });

    room.timerInterval = setInterval(() => {
      if (!gameRooms[roomCode]) {
        clearInterval(room.timerInterval);
        return;
      }
      room.timeLeft--;
      io.to(roomCode).emit("timerUpdate", { timeLeft: room.timeLeft });
      if (room.timeLeft <= 0) {
        clearInterval(room.timerInterval);
        const loserColor = room.game.currentPlayer;
        const winnerColor = loserColor === "b" ? "p" : "b";
        processEndOfGame(winnerColor, loserColor, room, "Tempo esgotado!");
      }
    }, 1000);
  }
}

function resetTimer(roomCode) {
  const room = gameRooms[roomCode];
  if (room) {
    clearInterval(room.timerInterval);

    if (room.timeControl === "match") {
      // No modo partida, NÃO resetamos o valor do tempo.
      // Apenas chamamos startTimer novamente, que vai pegar o currentPlayer
      // (que deve ter mudado antes de chamar esta função) e decrementar o banco dele.
      startTimer(roomCode);
    } else {
      // Modo por jogada: Reseta para o valor máximo
      room.timeLeft = room.timerDuration;
      io.to(roomCode).emit("timerUpdate", { timeLeft: room.timeLeft });
      startTimer(roomCode);
    }
  }
}

async function processEndOfGame(winnerColor, loserColor, room, reason) {
  if (!room || room.isGameConcluded) {
    return;
  }
  room.isGameConcluded = true;
  if (room.timerInterval) clearInterval(room.timerInterval);
  room.drawOfferBy = null;
  io.to(room.roomCode).emit("drawOfferCancelled");

  if (!room.isTablita) {
    if (!winnerColor) {
      try {
        await User.findOneAndUpdate(
          { email: room.players[0].user.email },
          { $inc: { saldo: room.bet } }
        );
        await User.findOneAndUpdate(
          { email: room.players[1].user.email },
          { $inc: { saldo: room.bet } }
        );
        io.to(room.roomCode).emit("gameDraw", { reason });
      } catch (err) {
        console.error("Erro ao processar empate clássico:", err);
      }
    } else {
      const winnerSocketId =
        room.game.players[winnerColor === "b" ? "white" : "black"];
      const winnerData = room.players.find(
        (p) => p.socketId === winnerSocketId
      );
      if (winnerData) {
        try {
          const prize = room.bet * 2;
          const updatedWinner = await User.findOneAndUpdate(
            { email: winnerData.user.email },
            { $inc: { saldo: prize } },
            { new: true }
          );
          io.to(room.roomCode).emit("gameOver", {
            winner: winnerColor,
            reason,
          });
          const winnerSocket = io.sockets.sockets.get(winnerData.socketId);
          if (winnerSocket && updatedWinner) {
            winnerSocket.emit("updateSaldo", { newSaldo: updatedWinner.saldo });
          }
        } catch (err) {
          console.error("Erro ao pagar prêmio clássico:", err);
        }
      }
    }
    room.cleanupTimeout = setTimeout(() => {
      if (gameRooms[room.roomCode]) delete gameRooms[room.roomCode];
    }, 60000);
    return;
  }

  // --- LÓGICA DO MODO TABLITA ---
  if (winnerColor) {
    const winnerSocketId =
      room.game.players[winnerColor === "b" ? "white" : "black"];
    const winnerData = room.players.find((p) => p.socketId === winnerSocketId);
    if (winnerData) {
      room.match.score[winnerData.user.email]++;
    }
  }

  const p1Email = room.match.player1.email;
  const p2Email = room.match.player2.email;
  const p1Score = room.match.score[p1Email];
  const p2Score = room.match.score[p2Email];

  const matchOver =
    room.match.currentGame === 2 || p1Score === 2 || p2Score === 2;

  if (matchOver) {
    let finalWinnerData;
    if (p1Score > p2Score) finalWinnerData = room.match.player1;
    else if (p2Score > p1Score) finalWinnerData = room.match.player2;

    if (finalWinnerData) {
      try {
        const prize = room.bet * 2;
        const updatedWinner = await User.findOneAndUpdate(
          { email: finalWinnerData.email },
          { $inc: { saldo: prize } },
          { new: true }
        );
        const winnerColorFinal =
          room.game.users.white === finalWinnerData.email ? "b" : "p";
        io.to(room.roomCode).emit("gameOver", {
          winner: winnerColorFinal,
          reason: `Fim da partida! Placar: ${p1Score} a ${p2Score}`,
        });
        const winnerSocket = io.sockets.sockets.get(finalWinnerData.socketId);
        if (winnerSocket && updatedWinner) {
          winnerSocket.emit("updateSaldo", { newSaldo: updatedWinner.saldo });
        }
      } catch (err) {
        console.error("Erro ao pagar prêmio Tablita:", err);
      }
    } else {
      try {
        await User.findOneAndUpdate(
          { email: p1Email },
          { $inc: { saldo: room.bet } }
        );
        await User.findOneAndUpdate(
          { email: p2Email },
          { $inc: { saldo: room.bet } }
        );
        io.to(room.roomCode).emit("gameDraw", {
          reason: `Partida empatada! Placar final: ${p1Score} a ${p2Score}`,
        });
      } catch (err) {
        console.error("Erro ao devolver aposta em empate Tablita:", err);
      }
    }
    room.cleanupTimeout = setTimeout(() => {
      if (gameRooms[room.roomCode]) delete gameRooms[room.roomCode];
    }, 60000);
  } else {
    room.match.currentGame++;
    const scoreArray = [p1Score, p2Score];
    const nextGameTitle = `Fim da 1ª Partida!`;
    io.to(room.roomCode).emit("nextGameStarting", {
      score: scoreArray,
      title: nextGameTitle,
    });
    setTimeout(() => startNextTablitaGame(room), 10000);
  }
}

function startNextTablitaGame(room) {
  if (!gameRooms[room.roomCode]) return;
  if (room.cleanupTimeout) clearTimeout(room.cleanupTimeout);
  room.isGameConcluded = false;

  const previousWhiteUserEmail = room.game.users.white;
  const playerWhoWasWhite =
    room.match.player1.email === previousWhiteUserEmail
      ? room.match.player1
      : room.match.player2;
  const playerWhoWasBlack =
    room.match.player1.email !== previousWhiteUserEmail
      ? room.match.player1
      : room.match.player2;

  room.game = {
    players: {
      white: playerWhoWasBlack.socketId,
      black: playerWhoWasWhite.socketId,
    },
    users: { white: playerWhoWasBlack.email, black: playerWhoWasWhite.email },
    boardState: JSON.parse(JSON.stringify(room.match.openingBoard)),
    boardSize: 8,
    currentPlayer: "b",
    isFirstMove: true,
    movesSinceCapture: 0,
    damaMovesWithoutCaptureOrPawnMove: 0,
    openingName: room.match.opening.name,
    mustCaptureWith: null, // Reset
  };

  const bestCaptures = findBestCaptureMoves(room.game.currentPlayer, room.game);
  const mandatoryPieces = bestCaptures.map((seq) => seq[0]);

  const gameState = { ...room.game, roomCode: room.roomCode, mandatoryPieces };

  // Reseta os timers para o novo jogo da match
  if (room.timeControl === "match") {
    room.whiteTime = room.timerDuration;
    room.blackTime = room.timerDuration;
  } else {
    room.timeLeft = room.timerDuration;
  }

  io.to(room.roomCode).emit("gameStart", gameState);
  startTimer(room.roomCode);
}

module.exports = {
  initializeManager,
  startTimer,
  resetTimer,
  processEndOfGame,
};
