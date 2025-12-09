document.addEventListener("DOMContentLoaded", () => {
  // --- Elementos do DOM ---
  const mainContainer = document.getElementById("main-container");
  const resignBtn = document.getElementById("resign-btn");
  const drawBtn = document.getElementById("draw-btn");
  const spectatorLeaveBtn = document.getElementById("spectator-leave-btn");
  const authContainer = document.getElementById("auth-container");
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const authMessage = document.getElementById("auth-message");
  const showRegisterLink = document.getElementById("show-register");
  const showLoginLink = document.getElementById("show-login");
  const lobbyContainer = document.getElementById("lobby-container");
  const lobbyWelcomeMessage = document.getElementById("lobby-welcome-message");
  const createRoomBtn = document.getElementById("create-room-btn");
  const waitingArea = document.getElementById("waiting-area");
  const roomCodeDisplay = document.getElementById("room-code-display");
  const lobbyErrorMessage = document.getElementById("lobby-error-message");
  const betAmountInput = document.getElementById("bet-amount-input");
  const gameModeSelect = document.getElementById("game-mode-select");
  const timeControlSelect = document.getElementById("time-control-select");
  const timerSelectionContainer = document.getElementById(
    "timer-selection-container"
  );
  const timerSelect = document.getElementById("timer-select");
  const cancelRoomBtn = document.getElementById("cancel-room-btn");
  const openRoomsList = document.getElementById("open-rooms-list");
  const activeRoomsList = document.getElementById("active-rooms-list");
  const gameContainer = document.getElementById("game-container");
  const gameStatus = document.getElementById("game-status");
  const boardElement = document.getElementById("board");
  const turnDisplay = document.getElementById("turn");
  const timerDisplay = document.getElementById("timer");
  const spectatorIndicator = document.getElementById("spectator-indicator");
  const overlay = document.getElementById("game-over-overlay");
  const winnerScreen = document.getElementById("winner-screen");
  const loserScreen = document.getElementById("loser-screen");
  const drawScreen = document.getElementById("draw-screen");
  const spectatorEndScreen = document.getElementById("spectator-end-screen");
  const spectatorEndMessage = document.getElementById("spectator-end-message");
  const drawReason = document.getElementById("draw-reason");
  const connectionLostOverlay = document.getElementById(
    "connection-lost-overlay"
  );
  const connectionLostMessage = document.getElementById(
    "connection-lost-message"
  );
  const confirmBetOverlay = document.getElementById("confirm-bet-overlay");
  const confirmBetAmount = document.getElementById("confirm-bet-amount");
  const confirmGameMode = document.getElementById("confirm-game-mode");
  const acceptBetBtn = document.getElementById("accept-bet-btn");
  const declineBetBtn = document.getElementById("decline-bet-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const moveSound = document.getElementById("move-sound");
  const captureSound = document.getElementById("capture-sound");
  const nextGameOverlay = document.getElementById("next-game-overlay");
  const matchScoreDisplay = document.getElementById("match-score-display");
  const nextGameTimer = document.getElementById("next-game-timer");
  const drawRequestOverlay = document.getElementById("draw-request-overlay");
  const acceptDrawBtn = document.getElementById("accept-draw-btn");
  const declineDrawBtn = document.getElementById("decline-draw-btn");
  const addBalanceBtn = document.getElementById("add-balance-btn");
  const withdrawBtn = document.getElementById("withdraw-btn");
  const pixOverlay = document.getElementById("pix-overlay");
  const withdrawOverlay = document.getElementById("withdraw-overlay");
  const withdrawForm = document.getElementById("withdraw-form");
  const withdrawMessage = document.getElementById("withdraw-message");
  const closeWithdrawOverlayBtn = document.getElementById(
    "close-withdraw-overlay-btn"
  );
  const closePixOverlayBtn = document.getElementById("close-pix-overlay-btn");
  const copyPixKeyBtn = document.getElementById("copy-pix-key-btn");
  const referralCodeInput = document.getElementById("referral-code-input");
  const copyReferralBtn = document.getElementById("copy-referral-btn");
  const viewReferralsBtn = document.getElementById("view-referrals-btn");
  const referralsOverlay = document.getElementById("referrals-overlay");
  const closeReferralsOverlayBtn = document.getElementById(
    "close-referrals-overlay-btn"
  );
  const referralsList = document.getElementById("referrals-list");

  // Só inicializa o socket se não estiver na página de admin (opcional, mas boa prática)
  // Como o admin usa outro script, aqui assumimos que é a página de jogo.
  const socket = io({ autoConnect: false });

  let currentUser = null;
  let myColor = null;
  let currentRoom = null;
  let boardState = [];
  let selectedPiece = null;
  let currentBoardSize = 8;
  let tempRoomCode = null;
  let nextGameInterval = null;
  let isGameOver = false;
  let drawCooldownInterval = null;
  let isSpectator = false;

  // --- LÓGICA DE URL E INDICAÇÃO ---
  const urlParams = new URLSearchParams(window.location.search);
  const refCode = urlParams.get("ref");

  if (refCode && referralCodeInput) {
    referralCodeInput.value = refCode;
    if (loginForm && registerForm) {
      loginForm.style.display = "none";
      registerForm.style.display = "block";
    }
  }

  // --- LISTENERS DE LOGIN/REGISTRO (IMPORTANTE: Verificação de existência) ---

  if (showRegisterLink) {
    showRegisterLink.addEventListener("click", (e) => {
      e.preventDefault();
      if (loginForm) loginForm.style.display = "none";
      if (registerForm) registerForm.style.display = "block";
      if (authMessage) authMessage.textContent = "";
    });
  }

  if (showLoginLink) {
    showLoginLink.addEventListener("click", (e) => {
      e.preventDefault();
      if (registerForm) registerForm.style.display = "none";
      if (loginForm) loginForm.style.display = "block";
      if (authMessage) authMessage.textContent = "";
    });
  }

  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault(); // IMPEDE O RECARREGAMENTO DA PÁGINA
      const email = document.getElementById("register-email").value;
      const password = document.getElementById("register-password").value;
      const referralCode = document.getElementById("referral-code-input")
        ? document.getElementById("referral-code-input").value
        : "";

      try {
        const response = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, referralCode }),
        });
        const data = await response.json();
        if (authMessage) authMessage.textContent = data.message;

        if (response.ok) {
          if (authMessage) authMessage.style.color = "green";
          setTimeout(() => {
            if (showLoginLink) showLoginLink.click();
          }, 2000);
        } else {
          if (authMessage) authMessage.style.color = "red";
        }
      } catch (error) {
        if (authMessage) {
          authMessage.textContent = "Erro ao conectar ao servidor.";
          authMessage.style.color = "red";
        }
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault(); // IMPEDE O RECARREGAMENTO DA PÁGINA - CRUCIAL
      const email = document.getElementById("login-email").value;
      const password = document.getElementById("login-password").value;

      try {
        const response = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await response.json();

        if (response.ok) {
          currentUser = data.user;
          localStorage.setItem("checkersUserEmail", currentUser.email);
          if (mainContainer) mainContainer.classList.add("hidden");
          if (authContainer) authContainer.classList.add("hidden"); // Garante que o auth suma
          if (lobbyContainer) lobbyContainer.classList.remove("hidden");
          if (lobbyWelcomeMessage)
            lobbyWelcomeMessage.textContent = `Bem-vindo, ${
              currentUser.email
            }! Saldo: R$ ${currentUser.saldo.toFixed(2)}`;
          socket.connect();
        } else {
          if (authMessage) {
            authMessage.textContent = data.message;
            authMessage.style.color = "red";
          }
        }
      } catch (error) {
        if (authMessage) {
          authMessage.textContent = "Erro ao conectar ao servidor.";
          authMessage.style.color = "red";
        }
      }
    });
  }

  // --- LÓGICA DO BOTÃO DE COPIAR LINK ---
  if (copyReferralBtn) {
    copyReferralBtn.addEventListener("click", () => {
      if (!currentUser) return;
      const link = `${window.location.origin}/?ref=${currentUser.email}`;

      const tempInput = document.createElement("input");
      document.body.appendChild(tempInput);
      tempInput.value = link;
      tempInput.select();
      try {
        document.execCommand("copy");
        const originalText = copyReferralBtn.textContent;
        copyReferralBtn.textContent = "Copiado!";
        setTimeout(() => {
          copyReferralBtn.textContent = originalText;
        }, 2000);
      } catch (err) {
        alert("Erro ao copiar. Seu link é: " + link);
      }
      document.body.removeChild(tempInput);
    });
  }

  // --- LÓGICA: VER INDICAÇÕES ---
  if (viewReferralsBtn) {
    viewReferralsBtn.addEventListener("click", async () => {
      if (!currentUser) return;
      referralsOverlay.classList.remove("hidden");
      referralsList.innerHTML = "<p>Carregando...</p>";

      try {
        const response = await fetch("/api/user/referrals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: currentUser.email }),
        });
        const referrals = await response.json();

        referralsList.innerHTML = "";
        if (referrals.length === 0) {
          referralsList.innerHTML = "<p>Você ainda não tem indicações.</p>";
        } else {
          const table = document.createElement("table");
          table.style.width = "100%";
          table.style.fontSize = "0.9em";
          table.style.borderCollapse = "collapse";

          table.innerHTML = `
                    <tr style="border-bottom: 1px solid #aaa;">
                        <th style="text-align: left; padding: 5px;">Usuário</th>
                        <th style="text-align: center; padding: 5px;">Status</th>
                    </tr>
                  `;

          referrals.forEach((ref) => {
            const tr = document.createElement("tr");
            let statusHtml = "";

            if (ref.hasDeposited) {
              const val = ref.firstDepositValue || 0;
              if (val >= 5) {
                statusHtml = `<span style="color: #2ecc71;">Dep. R$ ${val.toFixed(
                  2
                )} (Ganhou)</span>`;
              } else {
                statusHtml = `<span style="color: #f39c12;">Dep. R$ ${val.toFixed(
                  2
                )} (Sem bônus)</span>`;
              }
            } else {
              statusHtml = '<span style="color: #95a5a6;">Pendente ⏳</span>';
            }

            tr.innerHTML = `
                        <td style="padding: 5px;">${ref.email}</td>
                        <td style="text-align: center; padding: 5px;">${statusHtml}</td>
                      `;
            table.appendChild(tr);
          });
          referralsList.appendChild(table);
        }
      } catch (error) {
        referralsList.innerHTML =
          "<p style='color: red;'>Erro ao carregar dados.</p>";
      }
    });
  }

  if (closeReferralsOverlayBtn) {
    closeReferralsOverlayBtn.addEventListener("click", () => {
      referralsOverlay.classList.add("hidden");
    });
  }

  function updateTimerOptions() {
    if (!timerSelect || !timeControlSelect) return; // Segurança
    timerSelect.innerHTML = "";
    const controlType = timeControlSelect.value;

    if (controlType === "move") {
      const options = [
        { val: 5, label: "5 segundos" },
        { val: 10, label: "10 segundos" },
        { val: 30, label: "30 segundos" },
        { val: 40, label: "40 segundos" },
        { val: 60, label: "1 minuto" },
        { val: 90, label: "1 min e 30 seg" },
      ];
      options.forEach((opt) => {
        const option = document.createElement("option");
        option.value = opt.val;
        option.textContent = opt.label;
        if (opt.val === 40) option.selected = true;
        timerSelect.appendChild(option);
      });
    } else {
      const options = [
        { val: 40, label: "40 segundos" },
        { val: 60, label: "1 minuto" },
        { val: 180, label: "3 minutos" },
        { val: 300, label: "5 minutos" },
      ];
      options.forEach((opt) => {
        const option = document.createElement("option");
        option.value = opt.val;
        option.textContent = opt.label;
        if (opt.val === 60) option.selected = true;
        timerSelect.appendChild(option);
      });
    }
  }

  if (timeControlSelect) {
    updateTimerOptions();
    timeControlSelect.addEventListener("change", updateTimerOptions);
  }

  function resetLobbyUI() {
    if (waitingArea) waitingArea.classList.add("hidden");
    if (createRoomBtn) createRoomBtn.disabled = false;
    if (betAmountInput) betAmountInput.disabled = false;
    if (gameModeSelect) gameModeSelect.disabled = false;
    if (timeControlSelect) timeControlSelect.disabled = false;
    if (timerSelectionContainer) timerSelectionContainer.style.display = "flex";
  }

  function returnToLobby() {
    isGameOver = false;
    isSpectator = false;
    if (gameContainer) gameContainer.classList.add("hidden");
    if (overlay) overlay.classList.add("hidden");
    if (winnerScreen) winnerScreen.classList.add("hidden");
    if (loserScreen) loserScreen.classList.add("hidden");
    if (drawScreen) drawScreen.classList.add("hidden");
    if (spectatorEndScreen) spectatorEndScreen.classList.add("hidden");
    if (nextGameOverlay) nextGameOverlay.classList.add("hidden");
    if (drawRequestOverlay) drawRequestOverlay.classList.add("hidden");
    if (connectionLostOverlay) connectionLostOverlay.classList.add("hidden");

    if (spectatorIndicator) spectatorIndicator.classList.add("hidden");
    if (spectatorLeaveBtn) spectatorLeaveBtn.classList.add("hidden");
    if (resignBtn) resignBtn.classList.remove("hidden");
    if (drawBtn) drawBtn.classList.remove("hidden");

    if (lobbyContainer) lobbyContainer.classList.remove("hidden");
    if (boardElement) {
      boardElement.classList.remove("board-flipped");
      boardElement.innerHTML = "";
    }
    currentRoom = null;
    myColor = null;
    currentBoardSize = 8;
    localStorage.removeItem("checkersCurrentRoom");
    resetLobbyUI();

    if (drawCooldownInterval) clearInterval(drawCooldownInterval);
    drawCooldownInterval = null;
    if (drawBtn) {
      drawBtn.disabled = false;
      drawBtn.textContent = "Empate";
    }
    if (currentUser) {
      socket.emit("enterLobby");
      if (lobbyWelcomeMessage)
        lobbyWelcomeMessage.textContent = `Bem-vindo, ${
          currentUser.email
        }! Saldo: R$ ${currentUser.saldo.toFixed(2)}`;
    }
  }

  function renderOpenRooms(rooms) {
    if (!openRoomsList) return;
    openRoomsList.innerHTML = "";
    if (!rooms || rooms.length === 0) {
      openRoomsList.innerHTML =
        "<p>Nenhuma sala aberta no momento. Crie uma!</p>";
      return;
    }

    const list = document.createElement("ul");
    list.className = "room-card-list";

    rooms.forEach((room) => {
      const card = document.createElement("li");
      card.className = "room-card";
      const creatorName = room.creatorEmail.split("@")[0];

      const gameModeNames = {
        classic: "Clássico 8x8",
        tablita: "Tablita 8x8",
        international: "Internacional 10x10",
      };
      const gameModeText = gameModeNames[room.gameMode] || "Clássico 8x8";

      let timeText = `${room.timerDuration}s`;
      if (room.timeControl === "match") {
        const mins = Math.floor(room.timerDuration / 60);
        const secs = room.timerDuration % 60;
        timeText =
          mins > 0 ? `${mins}m${secs > 0 ? " " + secs + "s" : ""}` : `${secs}s`;
        timeText += " (Total)";
      } else {
        timeText += " (Jogada)";
      }

      card.innerHTML = `
            <div class="room-card-info">
                <p><strong>Criador:</strong> ${creatorName}</p>
                <p><strong>Aposta:</strong> R$ ${room.bet.toFixed(2)}</p>
                <p><strong>Modo:</strong> ${gameModeText}</p>
                <p><strong>Tempo:</strong> ${timeText}</p>
            </div>
            <div class="room-card-action">
                <button class="join-room-btn" data-room-code="${
                  room.roomCode
                }">Entrar</button>
            </div>
        `;
      list.appendChild(card);
    });

    openRoomsList.appendChild(list);
  }

  function renderActiveRooms(rooms) {
    if (!activeRoomsList) return;
    activeRoomsList.innerHTML = "";
    if (!rooms || rooms.length === 0) {
      activeRoomsList.innerHTML = "<p>Nenhum jogo em andamento.</p>";
      return;
    }

    const list = document.createElement("ul");
    list.className = "room-card-list";

    rooms.forEach((room) => {
      const card = document.createElement("li");
      card.className = "room-card";
      card.style.borderLeft = "4px solid #f39c12";

      const p1Name = room.player1Email.split("@")[0];
      const p2Name = room.player2Email.split("@")[0];

      const gameModeNames = {
        classic: "Clássico 8x8",
        tablita: "Tablita 8x8",
        international: "Internacional 10x10",
      };
      const gameModeText = gameModeNames[room.gameMode] || "Clássico 8x8";

      card.innerHTML = `
            <div class="room-card-info">
                <p><strong>Jogadores:</strong> ${p1Name} vs ${p2Name}</p>
                <p><strong>Aposta:</strong> R$ ${room.bet.toFixed(2)}</p>
                <p><strong>Modo:</strong> ${gameModeText}</p>
            </div>
            <div class="room-card-action">
                <button class="watch-game-btn" data-room-code="${
                  room.roomCode
                }" style="background-color: #f39c12;">Assistir</button>
            </div>
        `;
      list.appendChild(card);
    });

    activeRoomsList.appendChild(list);
  }

  function resetEndGameUI() {
    document.querySelectorAll(".revanche-status").forEach((el) => {
      el.textContent = "";
      el.style.color = "white";
    });
    document
      .querySelectorAll(".revanche-btn, .exit-lobby-btn")
      .forEach((btn) => {
        btn.disabled = false;
      });
  }

  async function checkSession() {
    const savedEmail = localStorage.getItem("checkersUserEmail");
    if (savedEmail) {
      try {
        const response = await fetch("/api/user/re-authenticate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: savedEmail }),
        });
        const data = await response.json();
        if (response.ok) {
          currentUser = data.user;
          if (mainContainer) mainContainer.classList.add("hidden");
          if (lobbyContainer) lobbyContainer.classList.remove("hidden");
          if (lobbyWelcomeMessage)
            lobbyWelcomeMessage.textContent = `Bem-vindo, ${
              currentUser.email
            }! Saldo: R$ ${currentUser.saldo.toFixed(2)}`;
          socket.connect();
        } else {
          localStorage.removeItem("checkersUserEmail");
          localStorage.removeItem("checkersCurrentRoom");
          socket.connect();
        }
      } catch (error) {
        console.error("Falha ao re-autenticar:", error);
        socket.connect();
      }
    } else {
      socket.connect();
    }
  }

  if (withdrawBtn) {
    withdrawBtn.addEventListener("click", () => {
      withdrawOverlay.classList.remove("hidden");
      withdrawMessage.textContent = "";
    });
  }

  if (closeWithdrawOverlayBtn) {
    closeWithdrawOverlayBtn.addEventListener("click", () => {
      withdrawOverlay.classList.add("hidden");
    });
  }

  if (withdrawForm) {
    withdrawForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const pixKey = document.getElementById("withdraw-pix-key").value;
      const amount = document.getElementById("withdraw-amount").value;

      if (!pixKey || !amount) return;

      try {
        const response = await fetch("/api/withdraw", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: currentUser.email,
            amount: parseFloat(amount),
            pixKey,
          }),
        });

        const data = await response.json();
        withdrawMessage.textContent = data.message;

        if (response.ok) {
          withdrawMessage.style.color = "green";
          document.getElementById("withdraw-pix-key").value = "";
          document.getElementById("withdraw-amount").value = "";
        } else {
          withdrawMessage.style.color = "red";
        }
      } catch (error) {
        withdrawMessage.textContent = "Erro ao enviar solicitação.";
        withdrawMessage.style.color = "red";
      }
    });
  }

  if (createRoomBtn) {
    createRoomBtn.addEventListener("click", () => {
      if (
        !betAmountInput ||
        !gameModeSelect ||
        !timerSelect ||
        !timerSelectionContainer ||
        !lobbyErrorMessage
      ) {
        console.error(
          "ERRO: Elementos da UI para criar sala não foram encontrados!"
        );
        return;
      }

      const bet = parseInt(betAmountInput.value, 10);
      const gameMode = gameModeSelect.value;
      const timerDuration = timerSelect.value;
      const timeControl = timeControlSelect.value;

      const roomData = {
        bet,
        user: currentUser,
        gameMode,
        timerDuration,
        timeControl,
      };

      if (bet > 0 && currentUser) {
        socket.emit("createRoom", roomData);
        lobbyErrorMessage.textContent = "";
        createRoomBtn.disabled = true;
        betAmountInput.disabled = true;
        gameModeSelect.disabled = true;
        timeControlSelect.disabled = true;
        timerSelectionContainer.style.display = "none";
      } else if (!currentUser) {
        lobbyErrorMessage.textContent =
          "Erro de autenticação. Tente fazer o login novamente.";
      } else {
        lobbyErrorMessage.textContent = "A aposta deve ser maior que zero.";
      }
    });
  }

  if (cancelRoomBtn) {
    cancelRoomBtn.addEventListener("click", () => {
      const roomCode = roomCodeDisplay.textContent;
      if (roomCode) {
        socket.emit("cancelRoom", { roomCode });
      }
    });
  }

  if (lobbyContainer) {
    lobbyContainer.addEventListener("click", (e) => {
      if (e.target.classList.contains("join-room-btn")) {
        const roomCode = e.target.dataset.roomCode;
        if (roomCode && currentUser) {
          socket.emit("joinRoomRequest", { roomCode, user: currentUser });
          if (lobbyErrorMessage) lobbyErrorMessage.textContent = "";
        }
      }
      if (e.target.classList.contains("watch-game-btn")) {
        const roomCode = e.target.dataset.roomCode;
        if (roomCode) {
          socket.emit("joinAsSpectator", { roomCode });
        }
      }
    });
  }

  if (addBalanceBtn) {
    addBalanceBtn.addEventListener("click", () => {
      pixOverlay.classList.remove("hidden");
    });
  }

  if (closePixOverlayBtn) {
    closePixOverlayBtn.addEventListener("click", () => {
      pixOverlay.classList.add("hidden");
    });
  }

  if (copyPixKeyBtn) {
    copyPixKeyBtn.addEventListener("click", () => {
      const pixKey = document.getElementById("pix-key").textContent;
      const tempInput = document.createElement("input");
      document.body.appendChild(tempInput);
      tempInput.value = pixKey;
      tempInput.select();
      try {
        document.execCommand("copy");
        copyPixKeyBtn.textContent = "Copiado!";
        setTimeout(() => {
          copyPixKeyBtn.textContent = "Copiar Chave";
        }, 2000);
      } catch (err) {
        alert("Não foi possível copiar a chave. Por favor, copie manually.");
      }
      document.body.removeChild(tempInput);
    });
  }

  if (acceptBetBtn) {
    acceptBetBtn.addEventListener("click", () => {
      if (tempRoomCode && currentUser) {
        socket.emit("acceptBet", { roomCode: tempRoomCode, user: currentUser });
        confirmBetOverlay.classList.add("hidden");
      }
    });
  }

  if (declineBetBtn) {
    declineBetBtn.addEventListener("click", () => {
      confirmBetOverlay.classList.add("hidden");
      tempRoomCode = null;
    });
  }

  if (resignBtn) {
    resignBtn.addEventListener("click", () => {
      if (
        currentRoom &&
        !isSpectator &&
        confirm("Tem a certeza que deseja desistir da partida?")
      ) {
        socket.emit("playerResign");
      }
    });
  }

  if (drawBtn) {
    drawBtn.addEventListener("click", () => {
      if (currentRoom && !isSpectator) {
        drawBtn.disabled = true;
        socket.emit("requestDraw", { roomCode: currentRoom });
      }
    });
  }

  if (spectatorLeaveBtn) {
    spectatorLeaveBtn.addEventListener("click", () => {
      socket.emit("leaveEndGameScreen", { roomCode: currentRoom });
      returnToLobby();
    });
  }

  if (acceptDrawBtn) {
    acceptDrawBtn.addEventListener("click", () => {
      if (currentRoom) {
        socket.emit("acceptDraw", { roomCode: currentRoom });
        drawRequestOverlay.classList.add("hidden");
      }
    });
  }

  if (declineDrawBtn) {
    declineDrawBtn.addEventListener("click", () => {
      if (currentRoom) {
        socket.emit("declineDraw", { roomCode: currentRoom });
        drawRequestOverlay.classList.add("hidden");
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("checkersUserEmail");
      localStorage.removeItem("checkersCurrentRoom");
      window.location.reload();
    });
  }

  document.body.addEventListener("click", (e) => {
    if (e.target.classList.contains("revanche-btn")) {
      if (currentRoom && !isSpectator) {
        socket.emit("requestRevanche", { roomCode: currentRoom });
        document.querySelectorAll(".revanche-status").forEach((el) => {
          el.textContent = "Pedido de revanche enviado... A aguardar oponente!";
        });
        document
          .querySelectorAll(".revanche-btn, .exit-lobby-btn")
          .forEach((btn) => {
            btn.disabled = true;
          });
      }
    }
    if (e.target.classList.contains("exit-lobby-btn")) {
      if (currentRoom) {
        socket.emit("leaveEndGameScreen", { roomCode: currentRoom });
      }
      returnToLobby();
    }
  });

  // --- FUNÇÕES DE TABULEIRO E JOGO ---
  function createBoard() {
    if (!boardElement) return;
    boardElement.innerHTML = "";
    const boardSize = currentBoardSize || 8;
    let squareSizeCSS;

    if (boardSize === 10) {
      squareSizeCSS = "min(50px, 8.5vw)";
      if (window.innerWidth <= 768) {
        squareSizeCSS = "min(36px, 9vw)";
      }
    } else {
      squareSizeCSS = "min(60px, 10vw)";
      if (window.innerWidth <= 768) {
        squareSizeCSS = "min(45px, 11vw)";
      }
    }

    boardElement.style.gridTemplateColumns = `repeat(${boardSize}, ${squareSizeCSS})`;
    boardElement.style.gridTemplateRows = `repeat(${boardSize}, ${squareSizeCSS})`;

    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        const square = document.createElement("div");
        square.classList.add(
          "square",
          (row + col) % 2 === 1 ? "dark" : "light"
        );
        square.dataset.row = row;
        square.dataset.col = col;
        boardElement.appendChild(square);
      }
    }
    boardElement.addEventListener("click", handleBoardClick);
  }

  function renderPieces() {
    document.querySelectorAll(".piece").forEach((p) => p.remove());
    const boardSize = currentBoardSize || 8;

    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        const pieceType = boardState[row][col];
        if (pieceType !== 0) {
          const piece = document.createElement("div");
          piece.classList.add("piece");
          const isBlack = pieceType.toLowerCase() === "p";
          piece.classList.add(isBlack ? "black-piece" : "white-piece");
          const isKing = pieceType === "P" || pieceType === "B";
          if (isKing) {
            piece.classList.add("king");
          }
          const square = document.querySelector(
            `.square[data-row='${row}'][data-col='${col}']`
          );
          if (square) {
            square.appendChild(piece);
          }
        }
      }
    }
  }

  function handleBoardClick(e) {
    if (isSpectator) return;

    if (!myColor) return;
    const square = e.target.closest(".square");
    if (!square) return;

    const row = parseInt(square.dataset.row);
    const col = parseInt(square.dataset.col);
    const clickedPieceElement = e.target.closest(".piece");

    if (selectedPiece) {
      if (square.classList.contains("valid-move-highlight")) {
        socket.emit("playerMove", {
          from: { row: selectedPiece.row, col: selectedPiece.col },
          to: { row, col },
          room: currentRoom,
        });
        unselectPiece();
        return;
      }
      if (selectedPiece.row === row && selectedPiece.col === col) {
        unselectPiece();
        return;
      }
      if (clickedPieceElement) {
        const pieceColor = clickedPieceElement.classList.contains("white-piece")
          ? "b"
          : "p";
        if (pieceColor === myColor) {
          selectPiece(clickedPieceElement, row, col);
          return;
        }
      }
      return;
    }

    if (clickedPieceElement) {
      const pieceColor = clickedPieceElement.classList.contains("white-piece")
        ? "b"
        : "p";

      if (pieceColor === myColor) {
        const mandatoryPieces = document.querySelectorAll(".mandatory-capture");
        if (mandatoryPieces.length > 0) {
          if (clickedPieceElement.classList.contains("mandatory-capture")) {
            selectPiece(clickedPieceElement, row, col);
          }
        } else {
          selectPiece(clickedPieceElement, row, col);
        }
      }
    }
  }

  function selectPiece(pieceElement, row, col) {
    unselectPiece();
    selectedPiece = { element: pieceElement, row, col };
    socket.emit("getValidMoves", { row, col, roomCode: currentRoom });
  }

  function unselectPiece() {
    document.querySelectorAll(".valid-move-highlight").forEach((square) => {
      square.classList.remove("valid-move-highlight");
    });
    if (selectedPiece) {
      selectedPiece.element.classList.remove("selected");
      selectedPiece = null;
    }
  }

  function updateGame(gameState) {
    const oldPieceCount = boardState.flat().filter((p) => p !== 0).length;
    const newPieceCount = gameState.boardState
      .flat()
      .filter((p) => p !== 0).length;

    if (newPieceCount > 0 && oldPieceCount > 0) {
      if (newPieceCount < oldPieceCount) {
        captureSound.currentTime = 0;
        captureSound.play();
      } else {
        moveSound.currentTime = 0;
        moveSound.play();
      }
    }

    boardState = gameState.boardState;
    renderPieces();
    if (turnDisplay)
      turnDisplay.textContent =
        gameState.currentPlayer === "b" ? "Brancas" : "Pretas";
  }

  function highlightMandatoryPieces(piecesToHighlight) {
    document
      .querySelectorAll(".mandatory-capture")
      .forEach((p) => p.classList.remove("mandatory-capture"));
    if (piecesToHighlight && piecesToHighlight.length > 0) {
      piecesToHighlight.forEach((pos) => {
        const square = document.querySelector(
          `.square[data-row='${pos.row}'][data-col='${pos.col}']`
        );
        if (square && square.firstChild) {
          square.firstChild.classList.add("mandatory-capture");
        }
      });
    }
  }

  function formatTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec < 10 ? "0" : ""}${sec}`;
  }

  // --- SOCKET.IO EVENT HANDLERS ---

  socket.on("connect", () => {
    console.log("Conectado ao servidor com o ID:", socket.id);
    if (currentUser) {
      socket.emit("enterLobby");
    }
    const savedRoom = localStorage.getItem("checkersCurrentRoom");
    if (currentUser && savedRoom) {
      currentRoom = savedRoom;
      socket.emit("rejoinActiveGame", {
        roomCode: currentRoom,
        user: currentUser,
      });
      if (mainContainer) mainContainer.classList.add("hidden");
      if (lobbyContainer) lobbyContainer.classList.add("hidden");
      if (gameContainer) gameContainer.classList.remove("hidden");
    }
  });

  socket.on("roomCreated", (data) => {
    if (roomCodeDisplay) roomCodeDisplay.textContent = data.roomCode;
    if (waitingArea) waitingArea.classList.remove("hidden");
  });

  socket.on("roomCancelled", () => {
    resetLobbyUI();
  });

  socket.on("updateLobby", (data) => {
    renderOpenRooms(data.waiting);
    renderActiveRooms(data.active);
  });

  socket.on("joinError", (data) => {
    if (lobbyErrorMessage) lobbyErrorMessage.textContent = data.message;
    resetLobbyUI();
  });

  socket.on("confirmBet", (data) => {
    if (confirmBetAmount) confirmBetAmount.textContent = data.bet;
    tempRoomCode = data.roomCode;

    let timeMsg = "";
    if (data.timeControl === "match") {
      timeMsg = " (Tempo por Partida)";
    } else {
      timeMsg = " (Tempo por Jogada)";
    }

    if (confirmGameMode) {
      if (data.gameMode === "tablita") {
        confirmGameMode.textContent =
          "Modo Tablita (ida e volta)" + timeMsg + ".";
      } else if (data.gameMode === "international") {
        confirmGameMode.textContent =
          "Modo Internacional (10x10)" + timeMsg + ".";
      } else {
        confirmGameMode.textContent = "Modo Clássico (8x8)" + timeMsg + ".";
      }
    }
    if (confirmBetOverlay) confirmBetOverlay.classList.remove("hidden");
  });

  socket.on("spectatorJoined", (data) => {
    isSpectator = true;
    currentRoom = data.gameState.roomCode;

    if (lobbyContainer) lobbyContainer.classList.add("hidden");
    if (gameContainer) gameContainer.classList.remove("hidden");

    if (spectatorIndicator) spectatorIndicator.classList.remove("hidden");
    if (resignBtn) resignBtn.classList.add("hidden");
    if (drawBtn) drawBtn.classList.add("hidden");
    if (spectatorLeaveBtn) spectatorLeaveBtn.classList.remove("hidden");

    currentBoardSize = data.gameState.boardSize;
    createBoard();

    updateGame(data.gameState);
    highlightMandatoryPieces(data.gameState.mandatoryPieces);

    if (data.timeControl === "match") {
      const turnColor =
        data.gameState.currentPlayer === "b" ? "Brancas" : "Pretas";
      let timeToShow = 0;
      if (turnColor === "Brancas") timeToShow = data.whiteTime;
      else timeToShow = data.blackTime;
      if (timerDisplay) timerDisplay.textContent = formatTime(timeToShow);
    } else {
      if (timerDisplay) timerDisplay.textContent = (data.timeLeft || 0) + "s";
    }
  });

  socket.on("gameStart", (gameState) => {
    if (isSpectator) return;

    isGameOver = false;
    if (overlay) overlay.classList.add("hidden");
    if (winnerScreen) winnerScreen.classList.add("hidden");
    if (loserScreen) loserScreen.classList.add("hidden");
    if (drawScreen) drawScreen.classList.add("hidden");
    if (nextGameOverlay) nextGameOverlay.classList.add("hidden");
    if (drawRequestOverlay) drawRequestOverlay.classList.add("hidden");

    if (drawCooldownInterval) clearInterval(drawCooldownInterval);
    drawCooldownInterval = null;
    if (drawBtn) {
      drawBtn.disabled = false;
      drawBtn.textContent = "Empate";
    }
    if (nextGameInterval) clearInterval(nextGameInterval);

    if (lobbyContainer) lobbyContainer.classList.add("hidden");
    if (gameContainer) gameContainer.classList.remove("hidden");

    currentBoardSize = gameState.boardSize;
    createBoard();

    currentRoom = gameState.roomCode;
    localStorage.setItem("checkersCurrentRoom", currentRoom);
    myColor = socket.id === gameState.players.white ? "b" : "p";

    let statusText = `Você joga com as ${
      myColor === "b" ? "Brancas" : "Pretas"
    }.`;
    if (gameState.openingName) {
      statusText += `<br><span style="font-size: 0.9em; color: #f39c12;">Sorteio: ${gameState.openingName}</span>`;
    }
    if (gameStatus) gameStatus.innerHTML = statusText;

    if (boardElement) {
      boardElement.classList.remove("board-flipped");
      if (myColor === "p") {
        boardElement.classList.add("board-flipped");
      }
    }
    updateGame(gameState);
    highlightMandatoryPieces(gameState.mandatoryPieces);
  });

  socket.on("timerUpdate", (data) => {
    if (!timerDisplay) return;
    if (data.timeLeft !== undefined) {
      timerDisplay.textContent = data.timeLeft + "s";
    } else if (data.whiteTime !== undefined && data.blackTime !== undefined) {
      const turnColor = turnDisplay ? turnDisplay.textContent : "";
      let timeToShow = 0;
      if (turnColor === "Brancas") timeToShow = data.whiteTime;
      else timeToShow = data.blackTime;
      timerDisplay.textContent = formatTime(timeToShow);
    }
  });

  socket.on("timerPaused", (data) => {
    if (!timerDisplay) return;
    if (data.timeLeft !== undefined) {
      timerDisplay.textContent = `${data.timeLeft}s (Pausado)`;
    } else {
      timerDisplay.textContent = "Pausado";
    }
  });

  socket.on("gameStateUpdate", (gameState) => {
    updateGame(gameState);
    highlightMandatoryPieces(gameState.mandatoryPieces);
  });

  socket.on("invalidMove", (data) => {
    console.warn("Movimento Inválido:", data.message);
  });

  socket.on("opponentConnectionLost", (data) => {
    if (isSpectator) return;
    if (connectionLostMessage)
      connectionLostMessage.textContent = `Conexão do oponente lenta, aguarde ${data.waitTime} segundos para a conexão restabelecer...`;
    if (connectionLostOverlay) connectionLostOverlay.classList.remove("hidden");
  });

  socket.on("gameResumed", (data) => {
    if (isSpectator) return;

    if (connectionLostOverlay) connectionLostOverlay.classList.add("hidden");

    currentBoardSize = data.gameState.boardSize;
    createBoard();

    updateGame(data.gameState);

    if (timerDisplay) {
      if (data.timeLeft !== undefined) {
        timerDisplay.textContent = data.timeLeft + "s";
      } else if (data.whiteTime !== undefined) {
        timerDisplay.textContent = "A sincronizar...";
      }
    }

    myColor = socket.id === data.gameState.players.white ? "b" : "p";
    if (boardElement) {
      boardElement.classList.remove("board-flipped");
      if (myColor === "p") {
        boardElement.classList.add("board-flipped");
      }
    }
  });

  socket.on("opponentDisconnected", (data) => {
    if (isSpectator) return;
    returnToLobby();
  });

  socket.on("gameOver", (data) => {
    if (isGameOver) return;
    isGameOver = true;
    if (connectionLostOverlay) connectionLostOverlay.classList.add("hidden");
    if (drawCooldownInterval) clearInterval(drawCooldownInterval);
    if (drawBtn) drawBtn.disabled = true;
    resetEndGameUI();
    if (overlay) overlay.classList.remove("hidden");

    if (isSpectator) {
      if (spectatorEndScreen) spectatorEndScreen.classList.remove("hidden");
      const winnerText = data.winner === "b" ? "Brancas" : "Pretas";
      if (spectatorEndMessage)
        spectatorEndMessage.textContent = `O jogador das ${winnerText} venceu! Motivo: ${data.reason}`;
    } else {
      if (data.winner === myColor) {
        if (winnerScreen) winnerScreen.classList.remove("hidden");
      } else {
        if (loserScreen) loserScreen.classList.remove("hidden");
      }
    }
  });

  socket.on("gameDraw", (data) => {
    if (isGameOver) return;
    isGameOver = true;
    if (connectionLostOverlay) connectionLostOverlay.classList.add("hidden");
    if (drawCooldownInterval) clearInterval(drawCooldownInterval);
    if (drawBtn) drawBtn.disabled = true;
    if (drawReason) drawReason.textContent = data.reason;
    resetEndGameUI();
    if (overlay) overlay.classList.remove("hidden");

    if (isSpectator) {
      if (spectatorEndScreen) spectatorEndScreen.classList.remove("hidden");
      if (spectatorEndMessage)
        spectatorEndMessage.textContent = `O jogo terminou em empate. Motivo: ${data.reason}`;
    } else {
      if (drawScreen) drawScreen.classList.remove("hidden");
    }
  });

  socket.on("showValidMoves", (moves) => {
    if (isSpectator) return;
    if (!Array.isArray(moves)) {
      console.error("ERRO: O dado recebido não é um array!", moves);
      return;
    }
    moves.forEach((move) => {
      const square = document.querySelector(
        `.square[data-row='${move.row}'][data-col='${move.col}']`
      );
      if (square) {
        square.classList.add("valid-move-highlight");
      }
    });
  });

  socket.on("nextGameStarting", (data) => {
    const titleElement = document.getElementById("next-game-title");
    if (titleElement && data.title) {
      titleElement.textContent = data.title;
    }
    if (matchScoreDisplay)
      matchScoreDisplay.textContent = `Placar: ${data.score[0]} - ${data.score[1]}`;
    if (nextGameOverlay) nextGameOverlay.classList.remove("hidden");
    let countdown = 10;
    if (nextGameTimer) nextGameTimer.textContent = countdown;
    if (nextGameInterval) clearInterval(nextGameInterval);
    nextGameInterval = setInterval(() => {
      countdown--;
      if (nextGameTimer) nextGameTimer.textContent = countdown;
      if (countdown <= 0) {
        clearInterval(nextGameInterval);
      }
    }, 1000);
  });

  socket.on("updateSaldo", (data) => {
    if (currentUser) {
      currentUser.saldo = data.newSaldo;
    }
  });

  socket.on("drawRequestSent", () => {
    if (drawBtn) {
      drawBtn.disabled = true;
      drawBtn.textContent = "Pedido Enviado";
    }
  });

  socket.on("drawRequested", () => {
    if (isSpectator) return;
    if (drawRequestOverlay) drawRequestOverlay.classList.remove("hidden");
  });

  socket.on("drawDeclined", () => {
    const originalStatusHTML = gameStatus ? gameStatus.innerHTML : "";
    if (gameStatus)
      gameStatus.innerHTML = "O oponente recusou o pedido de empate.";
    setTimeout(() => {
      if (
        gameStatus &&
        gameStatus.innerHTML === "O oponente recusou o pedido de empate."
      ) {
        gameStatus.innerHTML = originalStatusHTML;
      }
    }, 3000);

    if (drawBtn) {
      drawBtn.disabled = true;
      let countdown = 30;
      drawBtn.textContent = `Empate (${countdown}s)`;

      if (drawCooldownInterval) clearInterval(drawCooldownInterval);
      drawCooldownInterval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
          drawBtn.textContent = `Empate (${countdown}s)`;
        } else {
          clearInterval(drawCooldownInterval);
          drawCooldownInterval = null;
          if (!isGameOver) {
            drawBtn.disabled = false;
            drawBtn.textContent = "Empate";
          }
        }
      }, 1000);
    }
  });

  socket.on("drawOfferCancelled", () => {
    if (drawRequestOverlay) drawRequestOverlay.classList.add("hidden");
  });

  socket.on("revancheDeclined", (data) => {
    document.querySelectorAll(".revanche-status").forEach((el) => {
      el.textContent = data.message || "O seu oponente não aceitou a revanche.";
      el.style.color = "#e74c3c";
    });

    document
      .querySelectorAll(".revanche-btn, .exit-lobby-btn")
      .forEach((btn) => (btn.disabled = true));

    setTimeout(() => {
      if (overlay && !overlay.classList.contains("hidden")) {
        returnToLobby();
      }
    }, 3000);
  });

  socket.on("gameNotFound", () => {
    alert(
      "A partida anterior não foi encontrada. O tempo para reconexão pode ter expirado. A voltar para o lobby..."
    );
    returnToLobby();
  });

  checkSession();
});
