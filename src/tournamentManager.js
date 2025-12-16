const Tournament = require("../models/Tournament");
const User = require("../models/User");

// Configurações
const MIN_PLAYERS = 4;
const ENTRY_FEE = 2.0;
const TOURNAMENT_HOUR = 21;
const TOURNAMENT_MINUTE = 0;

let io; // Referência ao Socket.IO
let gameRooms; // Referência aos quartos de jogo (Injeção de Dependência)
let checkInterval;
let isProcessingStart = false;

// Recebe gameRooms na inicialização para evitar require circular
function initializeTournamentManager(ioInstance, gameRoomsInstance) {
  io = ioInstance;
  gameRooms = gameRoomsInstance;

  // Verifica o horário a cada 30 segundos
  checkInterval = setInterval(checkSchedule, 10 * 1000);
  console.log(
    `[Torneio] Gerenciador iniciado. Agendado para ${TOURNAMENT_HOUR}:${TOURNAMENT_MINUTE.toString().padStart(
      2,
      "0"
    )} BRT.`
  );

  recoverStuckTournaments();
}

async function getTodaysTournament() {
  let tournament = await Tournament.findOne({
    status: { $in: ["open", "active"] },
  }).sort({ createdAt: -1 });

  if (!tournament) {
    tournament = new Tournament({
      entryFee: ENTRY_FEE,
      status: "open",
      participants: [],
    });
    await tournament.save();
  }
  return tournament;
}

async function checkSchedule() {
  const now = new Date();
  const options = {
    timeZone: "America/Sao_Paulo",
    hour: "numeric",
    minute: "numeric",
  };
  const formatter = new Intl.DateTimeFormat("pt-BR", options);
  const parts = formatter.formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === "hour").value);
  const minute = parseInt(parts.find((p) => p.type === "minute").value);

  if (hour === TOURNAMENT_HOUR && minute === TOURNAMENT_MINUTE) {
    if (isProcessingStart) return;

    isProcessingStart = true;
    setTimeout(() => {
      isProcessingStart = false;
    }, 65000);

    const tournament = await getTodaysTournament();
    if (tournament.status === "open") {
      console.log("[Torneio] Horário atingido. Iniciando em 5 segundos...");
      setTimeout(() => {
        startTournament(tournament).catch((err) =>
          console.error("Erro ao iniciar torneio:", err)
        );
      }, 5000);
    }
  }
}

async function registerPlayer(email) {
  const tournament = await getTodaysTournament();

  if (tournament.status !== "open") {
    return {
      success: false,
      message: "Inscrições encerradas ou torneio em andamento.",
    };
  }
  if (tournament.participants.includes(email)) {
    return { success: false, message: "Você já está inscrito." };
  }

  const user = await User.findOne({ email });
  if (!user || user.saldo < tournament.entryFee) {
    return { success: false, message: "Saldo insuficiente para inscrição." };
  }

  user.saldo -= tournament.entryFee;
  await user.save();

  tournament.participants.push(email);
  tournament.prizePool += tournament.entryFee;
  await tournament.save();

  io.emit("tournamentUpdate", {
    participantsCount: tournament.participants.length,
    prizePool: tournament.prizePool,
  });

  return { success: true, message: "Inscrição realizada com sucesso!" };
}

async function unregisterPlayer(email) {
  const tournament = await getTodaysTournament();

  if (tournament.status !== "open") {
    return {
      success: false,
      message: "Não é possível sair agora (Torneio já iniciou ou fechou).",
    };
  }
  if (!tournament.participants.includes(email)) {
    return { success: false, message: "Você não está inscrito." };
  }

  tournament.participants = tournament.participants.filter((p) => p !== email);
  tournament.prizePool -= tournament.entryFee;
  if (tournament.prizePool < 0) tournament.prizePool = 0;
  await tournament.save();

  const user = await User.findOne({ email });
  if (user) {
    user.saldo += tournament.entryFee;
    await user.save();
  }

  io.emit("tournamentUpdate", {
    participantsCount: tournament.participants.length,
    prizePool: tournament.prizePool,
  });

  return { success: true, message: "Inscrição cancelada e valor reembolsado." };
}

async function cancelTournamentAndRefund(tournament, reason) {
  if (tournament.status === "cancelled") return;

  console.log(
    `[Torneio] Cancelando torneio ${tournament._id}. Motivo: ${reason}`
  );
  tournament.status = "cancelled";
  await tournament.save();

  for (const email of tournament.participants) {
    const updatedUser = await User.findOneAndUpdate(
      { email },
      { $inc: { saldo: tournament.entryFee } },
      { new: true }
    );
    if (updatedUser && io) {
      io.emit("balanceUpdate", {
        email: updatedUser.email,
        newSaldo: updatedUser.saldo,
      });
    }
  }

  // Limpa salas de jogo da memória usando a referência injetada
  if (tournament.matches && gameRooms) {
    tournament.matches.forEach((m) => {
      if (m.roomCode && gameRooms[m.roomCode]) delete gameRooms[m.roomCode];
    });
  }

  if (io) io.emit("tournamentCancelled", { message: reason });
}

async function startTournament(tournament) {
  console.log("[Torneio] Verificando presença...");

  const onlineEmails = new Set();
  const sockets = await io.fetchSockets();

  sockets.forEach((socket) => {
    if (socket.userData && socket.userData.email) {
      onlineEmails.add(socket.userData.email);
    }
  });

  console.log(
    "[Torneio] Jogadores Online Detectados:",
    Array.from(onlineEmails)
  );

  const originalParticipants = [...tournament.participants];
  const presentPlayers = [];
  const absentPlayers = [];

  originalParticipants.forEach((email) => {
    if (onlineEmails.has(email)) {
      presentPlayers.push(email);
    } else {
      absentPlayers.push(email);
    }
  });

  if (absentPlayers.length > 0) {
    console.log(
      `[Torneio] ${absentPlayers.length} jogadores ausentes. Eles perdem a inscrição (W.O.).`
    );
    tournament.participants = presentPlayers;
    await tournament.save();

    io.emit("tournamentUpdate", {
      participantsCount: tournament.participants.length,
      prizePool: tournament.prizePool,
    });
  }

  if (tournament.participants.length < MIN_PLAYERS) {
    console.log(
      `[Torneio] Cancelado: Apenas ${tournament.participants.length} jogadores online. Mínimo: ${MIN_PLAYERS}.`
    );
    tournament.status = "cancelled";
    await tournament.save();

    for (const email of originalParticipants) {
      const updatedUser = await User.findOneAndUpdate(
        { email },
        { $inc: { saldo: tournament.entryFee } },
        { new: true }
      );
      if (updatedUser) {
        io.emit("balanceUpdate", {
          email: updatedUser.email,
          newSaldo: updatedUser.saldo,
        });
      }
    }

    io.emit("tournamentCancelled", {
      message: `Torneio cancelado por falta de quórum (Mínimo ${MIN_PLAYERS} jogadores). Todos foram reembolsados.`,
    });
    return;
  }

  console.log(
    "[Torneio] Iniciando com " +
      tournament.participants.length +
      " jogadores presentes."
  );
  tournament.status = "active";

  const shuffled = tournament.participants.sort(() => 0.5 - Math.random());

  const matches = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    const p1 = shuffled[i];
    const p2 = shuffled[i + 1] || null;

    matches.push({
      matchId: `R1-M${matches.length + 1}`,
      round: 1,
      player1: p1,
      player2: p2,
      winner: p2 ? null : p1,
      status: p2 ? "pending" : "finished",
      roomCode: null,
    });
  }

  tournament.matches = matches;
  await tournament.save();

  io.emit("tournamentStarted", { bracket: matches });
  processRoundMatches(tournament);
}

async function processRoundMatches(tournament) {
  const pendingMatches = tournament.matches.filter(
    (m) => m.round === tournament.round && m.status === "pending"
  );

  for (const match of pendingMatches) {
    if (match.player1 && match.player2) {
      const roomCode = `TRN-${Math.random()
        .toString(36)
        .substring(2, 6)
        .toUpperCase()}`;
      match.roomCode = roomCode;
      match.status = "active";

      // Usa a referência injetada de gameRooms
      if (gameRooms) {
        gameRooms[roomCode] = {
          roomCode,
          bet: 0,
          gameMode: "classic",
          timeControl: "move",
          timerDuration: 7,
          players: [],
          isTournament: true,
          matchId: match.matchId,
          tournamentId: tournament._id,
          isGameConcluded: false,
          expectedPlayers: [match.player1, match.player2],
        };

        io.emit("tournamentMatchReady", {
          matchId: match.matchId,
          player1: match.player1,
          player2: match.player2,
          roomCode: roomCode,
        });

        setTimeout(async () => {
          const room = gameRooms[roomCode];
          if (room && !room.isGameConcluded && room.players.length < 2) {
            console.log(`[Torneio] Sala ${roomCode} expirou. Aplicando W.O.`);

            const p1 = match.player1;
            const p2 = match.player2;
            const joined = room.players.map((p) => p.user.email);

            let winner = null;
            if (joined.includes(p1) && !joined.includes(p2)) winner = p1;
            else if (joined.includes(p2) && !joined.includes(p1)) winner = p2;
            else winner = Math.random() < 0.5 ? p1 : p2;

            await handleTournamentGameEnd(winner, null, room);

            if (gameRooms[roomCode]) delete gameRooms[roomCode];
          }
        }, 60 * 1000);
      } else {
        console.error(
          "[Torneio] CRÍTICO: gameRooms não definido no processRoundMatches"
        );
      }
    }
  }
  await tournament.save();
}

async function handleTournamentGameEnd(winnerEmail, loserEmail, room) {
  if (!room.isTournament || !room.tournamentId) return;

  const tournament = await Tournament.findById(room.tournamentId);
  if (!tournament) return;

  const matchIndex = tournament.matches.findIndex(
    (m) => m.matchId === room.matchId
  );
  if (matchIndex === -1) return;

  if (!room.game) {
    tournament.matches[matchIndex].winner = winnerEmail;
    tournament.matches[matchIndex].status = "finished";
    await tournament.save();
    console.log(
      `[Torneio] Partida ${room.matchId} finalizada por W.O. Vencedor: ${winnerEmail}`
    );
    checkRoundCompletion(tournament);
    return;
  }

  if (!winnerEmail) {
    console.log(
      `[Torneio] Empate na partida ${room.matchId}. Iniciando desempate (Tablita 5s)...`
    );

    io.to(room.roomCode).emit("tournamentTieBreak", {
      winner: null,
      reason: "Empate! Iniciando revanche imediata: Tablita (5s).",
    });

    const newRoomCode = `TRN-TB-${Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase()}`;

    tournament.matches[matchIndex].roomCode = newRoomCode;
    await tournament.save();

    if (gameRooms) {
      gameRooms[newRoomCode] = {
        roomCode: newRoomCode,
        bet: 0,
        gameMode: "tablita",
        timeControl: "move",
        timerDuration: 5,
        players: [],
        isTournament: true,
        matchId: room.matchId,
        tournamentId: tournament._id,
        isGameConcluded: false,
        expectedPlayers: room.expectedPlayers,
      };

      io.emit("tournamentMatchReady", {
        matchId: room.matchId,
        player1: room.expectedPlayers[0],
        player2: room.expectedPlayers[1],
        roomCode: newRoomCode,
      });

      setTimeout(async () => {
        const r = gameRooms[newRoomCode];
        if (r && !r.isGameConcluded && r.players.length < 2) {
          console.log(
            `[Torneio] Sala de Desempate ${newRoomCode} expirou. Aplicando W.O.`
          );

          const p1 = r.expectedPlayers[0];
          const p2 = r.expectedPlayers[1];
          const joined = r.players.map((p) => p.user.email);

          let winner = null;
          if (joined.includes(p1) && !joined.includes(p2)) winner = p1;
          else if (joined.includes(p2) && !joined.includes(p1)) winner = p2;
          else winner = Math.random() < 0.5 ? p1 : p2;

          await handleTournamentGameEnd(winner, null, r);

          if (gameRooms[newRoomCode]) delete gameRooms[newRoomCode];
        }
      }, 60 * 1000);
    }
    return;
  }

  tournament.matches[matchIndex].winner = winnerEmail;
  tournament.matches[matchIndex].status = "finished";

  await tournament.save();
  console.log(
    `[Torneio] Partida ${room.matchId} finalizada. Vencedor: ${winnerEmail}`
  );

  // Lógica para assistir oponente (Se o próximo oponente estiver jogando)
  if (winnerEmail) {
    const currentRoundMatches = tournament.matches.filter(
      (m) => m.round === tournament.round
    );
    const myRelativeIndex = currentRoundMatches.findIndex(
      (m) => m.matchId === room.matchId
    );

    if (myRelativeIndex !== -1) {
      // Se índice par (0, 2...), oponente vem do próximo (1, 3...). Se ímpar, do anterior.
      const siblingIndex =
        myRelativeIndex % 2 === 0 ? myRelativeIndex + 1 : myRelativeIndex - 1;

      if (siblingIndex >= 0 && siblingIndex < currentRoundMatches.length) {
        const siblingMatch = currentRoundMatches[siblingIndex];
        if (siblingMatch.status === "active" && siblingMatch.roomCode) {
          const winnerPlayer = room.players.find(
            (p) => p.user.email === winnerEmail
          );
          if (winnerPlayer && io) {
            io.to(winnerPlayer.socketId).emit("tournamentSpectateOpponent", {
              roomCode: siblingMatch.roomCode,
            });
          }
        }
      }
    }
  }

  checkRoundCompletion(tournament);
}

async function checkRoundCompletion(tournament) {
  const currentRoundMatches = tournament.matches.filter(
    (m) => m.round === tournament.round
  );
  const allFinished = currentRoundMatches.every((m) => m.status === "finished");

  if (allFinished) {
    console.log(`[Torneio] Rodada ${tournament.round} finalizada.`);

    const winners = currentRoundMatches.map((m) => m.winner).filter((w) => w);

    if (winners.length === 1) {
      await distributePrizes(tournament, winners[0]);
    } else {
      tournament.round++;
      const nextMatches = [];

      for (let i = 0; i < winners.length; i += 2) {
        const p1 = winners[i];
        const p2 = winners[i + 1] || null;

        nextMatches.push({
          matchId: `R${tournament.round}-M${nextMatches.length + 1}`,
          round: tournament.round,
          player1: p1,
          player2: p2,
          winner: p2 ? null : p1,
          status: p2 ? "pending" : "finished",
          roomCode: null,
        });
      }

      tournament.matches.push(...nextMatches);
      await tournament.save();

      io.emit("tournamentRoundUpdate", {
        round: tournament.round,
        bracket: nextMatches,
      });
      processRoundMatches(tournament);
    }
  }
}

async function distributePrizes(tournament, championEmail) {
  const finalMatch = tournament.matches.find(
    (m) => m.round === tournament.round
  );
  const runnerUpEmail =
    finalMatch.player1 === championEmail
      ? finalMatch.player2
      : finalMatch.player1;

  tournament.winner = championEmail;
  tournament.runnerUp = runnerUpEmail;
  tournament.status = "completed";

  const totalPool = tournament.prizePool;
  const championPrize = totalPool * 0.7;
  const runnerUpPrize = totalPool * 0.3;

  if (championEmail) {
    const updatedChampion = await User.findOneAndUpdate(
      { email: championEmail },
      { $inc: { saldo: championPrize } },
      { new: true }
    );
    if (updatedChampion)
      io.emit("balanceUpdate", {
        email: championEmail,
        newSaldo: updatedChampion.saldo,
      });
  }
  if (runnerUpEmail) {
    const updatedRunnerUp = await User.findOneAndUpdate(
      { email: runnerUpEmail },
      { $inc: { saldo: runnerUpPrize } },
      { new: true }
    );
    if (updatedRunnerUp)
      io.emit("balanceUpdate", {
        email: runnerUpEmail,
        newSaldo: updatedRunnerUp.saldo,
      });
  }

  await tournament.save();

  io.emit("tournamentEnded", {
    winner: championEmail,
    runnerUp: runnerUpEmail,
    championPrize,
    runnerUpPrize,
  });

  console.log(
    `[Torneio] Finalizado. Campeão: ${championEmail} (+${championPrize}), Vice: ${runnerUpEmail} (+${runnerUpPrize})`
  );
}

async function recoverStuckTournaments() {
  try {
    const stuck = await Tournament.find({ status: "active" });
    if (stuck.length > 0) {
      console.log(
        `[Torneio] Encontrados ${stuck.length} torneios travados. Cancelando...`
      );
      for (const t of stuck) {
        await cancelTournamentAndRefund(
          t,
          "Torneio interrompido por reinício do servidor."
        );
      }
    }
  } catch (err) {
    console.error("Erro ao recuperar torneios:", err);
  }
}

module.exports = {
  initializeTournamentManager,
  registerPlayer,
  unregisterPlayer,
  handleTournamentGameEnd,
  getTodaysTournament,
};
