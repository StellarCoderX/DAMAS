const gameLogic = require("../public/js/gameLogic.js");

const board = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, "p"],
  [0, 0, 0, 0, "p", 0, "B", 0],
  [0, 0, 0, 0, 0, 0, 0, "p"],
  [0, 0, "b", 0, "b", 0, "b", 0],
  [0, 0, 0, 0, 0, 0, 0, "b"],
  [0, 0, 0, 0, 0, 0, "b", 0],
];

const game = {
  boardState: board,
  boardSize: 8,
  turnCapturedPieces: [],
  mustCaptureWith: null,
};

// localização da dama maiúscula B
const row = 3,
  col = 6;

const captures = gameLogic.getAllPossibleCapturesForPiece(row, col, game);

console.log("Found", captures.length, "capture sequences for B at", row, col);
console.log(JSON.stringify(captures, null, 2));

// Also list best captures for black player
const best = gameLogic.findBestCaptureMoves("b", game);
console.log("Best captures for b:", JSON.stringify(best, null, 2));

// Test isMoveValid for each landing found
captures.forEach((seq) => {
  for (let i = 1; i < seq.length; i++) {
    const from = seq[0];
    const to = seq[i];
    const mv = gameLogic.isMoveValid(from, to, "b", game, false);
    console.log(
      `isMoveValid from ${from.row},${from.col} to ${to.row},${to.col}:`,
      mv
    );
  }
});

// Also test a specific target the user likely clicked: last landing of longest sequence
if (best.length > 0) {
  best.forEach((seq) => {
    const last = seq[seq.length - 1];
    const mv = gameLogic.isMoveValid(seq[0], last, "b", game, false);
    console.log("Best seq last landing validity:", seq, mv);
  });
}

// Check all pieces for both players
["b", "p"].forEach((player) => {
  console.log("\nChecking captures for player", player);
  const allBest = gameLogic.findBestCaptureMoves(player, game);
  console.log(
    "best moves count:",
    allBest.length,
    JSON.stringify(allBest, null, 2)
  );
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece !== 0 && piece.toLowerCase() === player) {
        const seqs = gameLogic.getAllPossibleCapturesForPiece(r, c, game);
        if (seqs.length > 0) {
          console.log(
            `Piece at ${r},${c} has captures:`,
            JSON.stringify(seqs, null, 2)
          );
          // Test validity of landing on last square of each sequence
          seqs.forEach((seq) => {
            const last = seq[seq.length - 1];
            const mv = gameLogic.isMoveValid(seq[0], last, player, game, false);
            console.log(
              `isMoveValid for player ${player} from ${seq[0].row},${seq[0].col} to last ${last.row},${last.col}:`,
              mv
            );
            // also test all intermediate landings
            for (let i = 1; i < seq.length; i++) {
              const l = seq[i];
              const mvi = gameLogic.isMoveValid(seq[0], l, player, game, false);
              console.log(
                `  intermediate landing ${l.row},${l.col} validity:`,
                mvi
              );
            }
          });
        }
      }
    }
  }
});
