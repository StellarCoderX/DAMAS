const gameLogic = require("../public/js/gameLogic");

function inspect(board, currentPlayer) {
  const game = {
    boardState: board,
    boardSize: 8,
    currentPlayer,
    turnCapturedPieces: [],
  };
  console.log("Board:");
  console.log(
    board.map((r) => r.map((c) => (c === 0 ? "." : c)).join(" ")).join("\n")
  );
  const best = gameLogic.findBestCaptureMoves(currentPlayer, game);
  console.log("\nfindBestCaptureMoves result (length=" + best.length + "):");
  best.forEach((seq, i) => console.log(i, JSON.stringify(seq)));

  console.log("\nAll captures per piece:");
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] !== 0 && board[r][c].toLowerCase() === currentPlayer) {
        const caps = gameLogic.getAllPossibleCapturesForPiece(r, c, game);
        if (caps.length > 0)
          console.log(`piece ${r},${c}: `, JSON.stringify(caps));
      }
    }
  }
}

const board1 = [
  [0, "p", 0, "p", 0, "p", 0, "p"],
  ["p", 0, "p", 0, 0, 0, "p", 0],
  [0, "p", 0, 0, 0, 0, 0, "p"],
  [0, 0, "p", 0, "p", 0, "p", 0],
  [0, "b", 0, 0, 0, 0, 0, "b"],
  ["b", 0, 0, 0, "b", 0, "b", 0],
  [0, "b", 0, "b", 0, 0, 0, "b"],
  ["b", 0, "b", 0, "b", 0, "b", 0],
];

console.log("=== Inspect board1, white (b) to move ===");
inspect(board1, "b");

console.log(
  "\n=== Inspect board2 (after your second state), white (b) to move ==="
);
const board2 = [
  [0, "p", 0, "p", 0, "p", 0, "p"],
  ["p", 0, "p", 0, 0, 0, "p", 0],
  [0, "p", 0, 0, 0, "b", 0, "p"],
  [0, 0, "p", 0, "p", 0, "p", 0],
  [0, "b", 0, 0, 0, 0, 0, 0],
  ["b", 0, 0, 0, "b", 0, "b", 0],
  [0, "b", 0, "b", 0, 0, 0, "b"],
  ["b", 0, "b", 0, "b", 0, "b", 0],
];
inspect(board2, "b");
