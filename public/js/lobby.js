// public/js/lobby.js - Gerencia Autenticação, Lobby, Torneios e Modais

window.initLobby = function (socket, UI) {
  let paymentCheckInterval = null;
  let tempRoomCode = null;

  // --- LÓGICA DE TOGGLE (ABRIR/FECHAR CRIAÇÃO DE SALA) ---
  const createRoomToggle = document.getElementById("btn-toggle-create-room");
  if (createRoomToggle) {
    createRoomToggle.addEventListener("click", () => {
      const section = document.getElementById("create-room-section");
      if (section) {
        if (
          section.classList.contains("hidden-animated") ||
          section.classList.contains("hidden")
        ) {
          section.classList.remove("hidden"); // Remove hidden padrão
          section.classList.remove("hidden-animated");
          section.classList.add("visible-animated");
        } else {
          section.classList.remove("visible-animated");
          section.classList.add("hidden-animated");
          // Pequeno timeout para display:none após animação (opcional, mas ajuda layout)
          setTimeout(() => {
            if (section.classList.contains("hidden-animated"))
              section.classList.add("hidden");
          }, 300);
        }
      }
    });
  }

  // --- AUTENTICAÇÃO ---
  const urlParams = new URLSearchParams(window.location.search);
  const refCode = urlParams.get("ref");
  const referralInput = document.getElementById("referral-code-input");

  if (refCode && referralInput) {
    try {
      // Tenta decodificar de Base64 para não expor o email na URL
      // Se falhar (link antigo ou inválido), usa o valor original
      referralInput.value = atob(refCode);
    } catch (e) {
      referralInput.value = refCode;
    }

    // Oculta o campo de input e o ícone associado (se estiver dentro de um .input-group)
    const inputGroup = referralInput.closest(".input-group");
    if (inputGroup) {
      inputGroup.style.display = "none";
    } else {
      referralInput.style.display = "none";
    }

    // Troca para a tela de cadastro automaticamente
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    if (loginForm) loginForm.style.display = "none";
    if (registerForm) registerForm.style.display = "block";
  }

  const showRegisterBtn = document.getElementById("show-register");
  if (showRegisterBtn) {
    showRegisterBtn.addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById("login-form").style.display = "none";
      document.getElementById("register-form").style.display = "block";
      document.getElementById("auth-message").textContent = "";
    });
  }

  const showLoginBtn = document.getElementById("show-login");
  if (showLoginBtn) {
    showLoginBtn.addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById("register-form").style.display = "none";
      document.getElementById("login-form").style.display = "block";
      document.getElementById("auth-message").textContent = "";
    });
  }

  const registerForm = document.getElementById("register-form");
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("register-email").value;
      const password = document.getElementById("register-password").value;
      const referralCode = document.getElementById(
        "referral-code-input"
      )?.value;

      try {
        const response = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, referralCode }),
        });
        const data = await response.json();
        const msg = document.getElementById("auth-message");
        msg.textContent = data.message;
        if (response.ok) {
          msg.style.color = "#2ecc71";
          setTimeout(() => {
            if (showLoginBtn) showLoginBtn.click();
          }, 2000);
        } else {
          msg.style.color = "#e74c3c";
        }
      } catch (error) {
        document.getElementById("auth-message").textContent =
          "Erro de conexão.";
      }
    });
  }

  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
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
          window.currentUser = data.user;
          localStorage.setItem("checkersUserEmail", window.currentUser.email);

          document.getElementById("auth-container").style.display = "none";
          document.getElementById("lobby-container").classList.remove("hidden");
          updateLobbyWelcome();
          updateTournamentStatus();
          socket.connect();
        } else {
          const msg = document.getElementById("auth-message");
          msg.textContent = data.message;
          msg.style.color = "#e74c3c";
        }
      } catch (error) {
        document.getElementById("auth-message").textContent =
          "Erro de conexão.";
      }
    });
  }

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("checkersUserEmail");
      localStorage.removeItem("checkersCurrentRoom");
      window.location.reload();
    });
  }

  // --- LÓGICA DO LOBBY (CRIAÇÃO E ENTRADA) ---
  if (UI.elements.timeControlSelect) {
    UI.elements.timeControlSelect.addEventListener("change", () => {
      UI.updateTimerOptions(UI.elements.timeControlSelect.value);
    });
    UI.updateTimerOptions("move");
  }

  const createRoomBtn = document.getElementById("create-room-btn");
  if (createRoomBtn) {
    createRoomBtn.addEventListener("click", () => {
      const betInput = document.getElementById("bet-amount-input"); // Usando ID direto para garantir
      const bet = parseInt(betInput.value, 10);
      const gameMode = document.getElementById("game-mode-select").value;
      const timeControl = document.getElementById("time-control-select").value;
      const timerSelect = document.getElementById("timer-select"); // Pegar o valor do select dinâmico
      const timerDuration = timerSelect ? timerSelect.value : 40;

      if (bet > 0 && window.currentUser) {
        socket.emit("createRoom", {
          bet,
          user: window.currentUser,
          gameMode,
          timerDuration,
          timeControl,
        });
        createRoomBtn.disabled = true;
        createRoomBtn.textContent = "Criando...";
      } else if (!window.currentUser) {
        alert("Erro de autenticação.");
      } else {
        alert("Aposta deve ser maior que zero.");
      }
    });
  }

  const cancelRoomBtn = document.getElementById("cancel-room-btn");
  if (cancelRoomBtn) {
    cancelRoomBtn.addEventListener("click", () => {
      const roomCode = document.getElementById("room-code-display").textContent;
      if (roomCode) socket.emit("cancelRoom", { roomCode });
    });
  }

  // Delegação de eventos para botões dinâmicos (Entrar/Assistir)
  document.getElementById("lobby-container").addEventListener("click", (e) => {
    if (e.target.classList.contains("join-room-btn")) {
      const roomCode = e.target.dataset.roomCode;
      if (roomCode && window.currentUser) {
        socket.emit("joinRoomRequest", { roomCode, user: window.currentUser });
      }
    }
    if (e.target.classList.contains("watch-game-btn")) {
      const roomCode = e.target.dataset.roomCode;
      if (roomCode) socket.emit("joinAsSpectator", { roomCode });
    }
  });

  const refreshLobbyBtn = document.getElementById("refresh-lobby-btn");
  if (refreshLobbyBtn) {
    refreshLobbyBtn.addEventListener("click", () => {
      if (window.currentUser) {
        socket.emit("enterLobby", window.currentUser);
        updateTournamentStatus();
        const originalText = refreshLobbyBtn.innerHTML;
        refreshLobbyBtn.innerHTML =
          '<i class="fa-solid fa-spinner fa-spin"></i>';
        refreshLobbyBtn.disabled = true;
        setTimeout(() => {
          refreshLobbyBtn.innerHTML = originalText;
          refreshLobbyBtn.disabled = false;
        }, 1000);
      }
    });
  }

  // --- PERFIL ---
  const openProfileBtn = document.getElementById("open-profile-btn");
  const closeProfileBtn = document.getElementById("close-profile-btn");
  const saveProfileBtn = document.getElementById("save-profile-btn");
  const profileOverlay = document.getElementById("profile-overlay");
  const avatarInput = document.getElementById("profile-avatar-input");
  const usernameInput = document.getElementById("profile-username-input");
  const profilePreview = document.getElementById("profile-preview-img");
  const profileMsg = document.getElementById("profile-message");

  if (openProfileBtn) {
    openProfileBtn.addEventListener("click", () => {
      if (!window.currentUser) return;
      profileOverlay.classList.remove("hidden");
      usernameInput.value = window.currentUser.username || "";
      avatarInput.value = window.currentUser.avatar || "";

      const defaultAvatar = `https://ui-avatars.com/api/?name=${
        window.currentUser.username || "User"
      }&background=random`;
      profilePreview.src = window.currentUser.avatar || defaultAvatar;
      profileMsg.textContent = "";
    });
  }

  if (closeProfileBtn) {
    closeProfileBtn.addEventListener("click", () =>
      profileOverlay.classList.add("hidden")
    );
  }

  if (saveProfileBtn) {
    saveProfileBtn.addEventListener("click", async () => {
      if (!window.currentUser) return;
      const newUsername = usernameInput.value.trim();
      const newAvatar = avatarInput.value.trim();

      saveProfileBtn.disabled = true;
      saveProfileBtn.textContent = "Salvando...";

      try {
        const res = await fetch("/api/user/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: window.currentUser.email,
            username: newUsername,
            avatar: newAvatar,
          }),
        });
        const data = await res.json();

        if (res.ok) {
          window.currentUser = data.user;
          updateLobbyWelcome();
          profileMsg.textContent = "Perfil atualizado!";
          profileMsg.style.color = "#2ecc71";
          setTimeout(() => profileOverlay.classList.add("hidden"), 1500);
        } else {
          profileMsg.textContent = data.message;
          profileMsg.style.color = "#e74c3c";
        }
      } catch (err) {
        profileMsg.textContent = "Erro de conexão.";
        profileMsg.style.color = "#e74c3c";
      } finally {
        saveProfileBtn.disabled = false;
        saveProfileBtn.textContent = "Salvar";
      }
    });
  }

  // --- FUNÇÕES DE INDICAÇÃO E HISTÓRICO (RESTAURADAS) ---

  // 1. Copiar Link
  const copyReferralBtn = document.getElementById("copy-referral-btn");
  if (copyReferralBtn) {
    copyReferralBtn.addEventListener("click", () => {
      if (!window.currentUser) return;
      // Codifica em Base64 para ocultar o email na URL
      const encodedRef = btoa(window.currentUser.email);
      const link = `${window.location.origin}/?ref=${encodeURIComponent(
        encodedRef
      )}`;

      // Tenta usar a API moderna primeiro
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard
          .writeText(link)
          .then(() => {
            const originalText = copyReferralBtn.innerHTML;
            copyReferralBtn.innerHTML =
              '<i class="fa-solid fa-check"></i> Copiado!';
            setTimeout(() => (copyReferralBtn.innerHTML = originalText), 2000);
          })
          .catch(() => {
            // Se falhar, usa o método antigo
            fallbackCopyTextToClipboard(link);
          });
      } else {
        fallbackCopyTextToClipboard(link);
      }
    });
  }

  function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed"; // Avoid scrolling to bottom
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand("copy");
      alert("Link copiado para a área de transferência!");
    } catch (err) {
      alert("Não foi possível copiar o link.");
    }
    document.body.removeChild(textArea);
  }

  // 2. Ver Indicações
  const viewRefBtn = document.getElementById("view-referrals-btn");
  if (viewRefBtn) {
    viewRefBtn.addEventListener("click", async () => {
      if (!window.currentUser) return;
      const list = document.getElementById("referrals-list");
      document.getElementById("referrals-overlay").classList.remove("hidden");
      list.innerHTML = '<p style="color:#ccc;">Carregando...</p>';

      try {
        const response = await fetch("/api/user/referrals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: window.currentUser.email }),
        });
        const referrals = await response.json();
        list.innerHTML = "";

        if (referrals.length === 0) {
          list.innerHTML = "<p>Você ainda não tem indicações.</p>";
        } else {
          // Cria uma lista bonita
          const ul = document.createElement("ul");
          ul.style.listStyle = "none";
          ul.style.padding = "0";

          referrals.forEach((ref) => {
            const li = document.createElement("li");
            li.style.background = "rgba(255,255,255,0.05)";
            li.style.marginBottom = "8px";
            li.style.padding = "10px";
            li.style.borderRadius = "8px";
            li.style.display = "flex";
            li.style.justifyContent = "space-between";
            li.style.alignItems = "center";

            let statusHtml = "";
            if (ref.hasDeposited) {
              const val = ref.firstDepositValue || 0;
              statusHtml =
                val >= 5
                  ? `<span style="color: #2ecc71; font-weight:bold; font-size:0.8rem;">+R$ 1,00 (Dep. R$${val})</span>`
                  : `<span style="color: #f39c12; font-size:0.8rem;">Dep. R$${val} (Sem bônus)</span>`;
            } else {
              statusHtml =
                '<span style="color: #95a5a6; font-size:0.8rem;">Pendente</span>';
            }

            li.innerHTML = `
                          <span style="font-weight:600; font-size:0.9rem;">${
                            ref.email.split("@")[0]
                          }...</span>
                          ${statusHtml}
                      `;
            ul.appendChild(li);
          });
          list.appendChild(ul);
        }
      } catch (e) {
        list.innerHTML = "<p style='color: #e74c3c;'>Erro ao carregar.</p>";
      }
    });
  }

  const closeRefBtn = document.getElementById("close-referrals-overlay-btn");
  if (closeRefBtn)
    closeRefBtn.addEventListener("click", () =>
      document.getElementById("referrals-overlay").classList.add("hidden")
    );

  // 3. Ver Histórico
  const viewHistoryBtn = document.getElementById("view-history-btn");
  if (viewHistoryBtn) {
    viewHistoryBtn.addEventListener("click", async () => {
      if (!window.currentUser) return;
      const list = document.getElementById("history-list");
      document.getElementById("history-overlay").classList.remove("hidden");
      list.innerHTML = '<p style="color:#ccc;">Carregando...</p>';

      try {
        const res = await fetch("/api/user/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: window.currentUser.email }),
        });
        const data = await res.json();
        list.innerHTML = "";

        if (data.length === 0) {
          list.innerHTML = "<p>Sem partidas recentes.</p>";
          return;
        }

        const ul = document.createElement("ul");
        ul.style.listStyle = "none";
        ul.style.padding = "0";

        data.forEach((m) => {
          const li = document.createElement("li");
          li.style.background = "rgba(255,255,255,0.05)";
          li.style.marginBottom = "8px";
          li.style.padding = "10px";
          li.style.borderRadius = "8px";
          li.style.fontSize = "0.9rem";

          let resultText = "Empate";
          let color = "#95a5a6";

          if (m.winner) {
            if (m.winner === window.currentUser.email) {
              resultText = "VITÓRIA";
              color = "#2ecc71";
            } else {
              resultText = "DERROTA";
              color = "#e74c3c";
            }
          }

          const opponent =
            m.player1 === window.currentUser.email ? m.player2 : m.player1;
          const date = new Date(m.createdAt).toLocaleDateString();

          li.innerHTML = `
                      <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                          <strong style="color:${color}">${resultText}</strong>
                          <span style="color:#aaa; font-size:0.8rem;">${date}</span>
                      </div>
                      <div style="display:flex; justify-content:space-between;">
                          <span>vs ${opponent.split("@")[0]}</span>
                          <span>Aposta: <strong>R$ ${m.bet.toFixed(
                            2
                          )}</strong></span>
                      </div>
                  `;
          ul.appendChild(li);
        });
        list.appendChild(ul);
      } catch (e) {
        list.innerHTML =
          "<p style='color: #e74c3c;'>Erro ao carregar histórico.</p>";
      }
    });
  }

  const closeHistBtn = document.getElementById("close-history-overlay-btn");
  if (closeHistBtn)
    closeHistBtn.addEventListener("click", () =>
      document.getElementById("history-overlay").classList.add("hidden")
    );

  // --- HELPERS GERAIS ---
  function updateLobbyWelcome() {
    const welcomeMsg = document.getElementById("lobby-welcome-message");
    const avatarImg = document.getElementById("lobby-avatar");

    if (welcomeMsg && window.currentUser) {
      const displayName =
        window.currentUser.username || window.currentUser.email.split("@")[0];
      welcomeMsg.innerHTML = `Olá, <strong>${displayName}</strong><br><small style="color:#f1c40f">R$ ${window.currentUser.saldo.toFixed(
        2
      )}</small>`;

      if (avatarImg) {
        if (
          window.currentUser.avatar &&
          window.currentUser.avatar.trim() !== ""
        ) {
          avatarImg.src = window.currentUser.avatar;
        } else {
          avatarImg.src = `https://ui-avatars.com/api/?name=${displayName}&background=random`;
        }
      }
    }
  }

  async function updateTournamentStatus() {
    try {
      let url = "/api/tournament/status";
      if (window.currentUser) url += `?email=${window.currentUser.email}`;
      const res = await fetch(url);
      const data = await res.json();

      const countEl = document.getElementById("trn-participants-count");
      const prizeEl = document.getElementById("trn-prize-pool");
      const joinBtn = document.getElementById("join-tournament-btn");
      const leaveBtn = document.getElementById("leave-tournament-btn");

      if (countEl) countEl.textContent = `Inscritos: ${data.participantsCount}`;
      if (prizeEl)
        prizeEl.textContent = `Prêmio: R$ ${data.prizePool.toFixed(2)}`;

      if (joinBtn && leaveBtn) {
        if (data.status === "open") {
          if (data.isRegistered) {
            joinBtn.classList.add("hidden");
            leaveBtn.classList.remove("hidden");
          } else {
            joinBtn.classList.remove("hidden");
            leaveBtn.classList.add("hidden");
            joinBtn.textContent = `Entrar (R$ ${data.entryFee.toFixed(2)})`;
            joinBtn.disabled = false;
          }
        } else {
          joinBtn.textContent = "Inscrições Fechadas";
          joinBtn.classList.remove("hidden");
          leaveBtn.classList.add("hidden");
          joinBtn.disabled = true;
        }
      }
    } catch (e) {
      console.error(e);
    }
  }
  window.updateTournamentStatus = updateTournamentStatus;

  // Lógica de Entrar/Sair Torneio
  const joinTournamentBtn = document.getElementById("join-tournament-btn");
  if (joinTournamentBtn) {
    joinTournamentBtn.addEventListener("click", async () => {
      if (!window.currentUser) return alert("Faça login.");
      try {
        const res = await fetch("/api/tournament/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: window.currentUser.email }),
        });
        const data = await res.json();
        if (res.ok) {
          window.currentUser.saldo = data.newSaldo;
          updateLobbyWelcome();
          updateTournamentStatus();
          alert("Inscrito com sucesso!");
        } else {
          alert(data.message);
        }
      } catch (e) {
        alert("Erro de conexão");
      }
    });
  }

  const leaveTournamentBtn = document.getElementById("leave-tournament-btn");
  if (leaveTournamentBtn) {
    leaveTournamentBtn.addEventListener("click", async () => {
      if (!window.currentUser) return;
      if (!confirm("Sair do torneio e receber reembolso?")) return;
      try {
        const res = await fetch("/api/tournament/leave", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: window.currentUser.email }),
        });
        const data = await res.json();
        if (res.ok) {
          window.currentUser.saldo = data.newSaldo;
          updateLobbyWelcome();
          updateTournamentStatus();
        } else {
          alert(data.message);
        }
      } catch (e) {
        alert("Erro ao sair");
      }
    });
  }

  // --- STARTUP CHECK ---
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
          window.currentUser = data.user;
          document.getElementById("auth-container").style.display = "none";
          document.getElementById("lobby-container").classList.remove("hidden");
          updateLobbyWelcome();
          updateTournamentStatus();
          socket.connect();
        } else {
          localStorage.removeItem("checkersUserEmail");
        }
      } catch (error) {
        console.log("Offline or error");
      }
    }
  }
  checkSession();

  // --- LISTENERS LOBBY SOCKET ---
  socket.on("roomCreated", (data) => {
    document.getElementById("room-code-display").textContent = data.roomCode;
    document.getElementById("waiting-area").classList.remove("hidden");

    // Esconde a área de criar e restaura o botão
    const section = document.getElementById("create-room-section");
    section.classList.remove("visible-animated");
    section.classList.add("hidden-animated");
    setTimeout(() => section.classList.add("hidden"), 300);

    const btn = document.getElementById("create-room-btn");
    btn.disabled = false;
    btn.textContent = "INICIAR SALA";
  });

  socket.on("roomCancelled", () => {
    document.getElementById("waiting-area").classList.add("hidden");
    document.getElementById("create-room-btn").disabled = false;
  });

  socket.on("updateLobby", (data) => {
    UI.renderOpenRooms(data.waiting);
    UI.renderActiveRooms(data.active);
  });

  socket.on("tournamentUpdate", (data) => {
    const countEl = document.getElementById("trn-participants-count");
    if (countEl) countEl.textContent = `Inscritos: ${data.participantsCount}`;
    const prizeEl = document.getElementById("trn-prize-pool");
    if (prizeEl)
      prizeEl.textContent = `Prêmio: R$ ${data.prizePool.toFixed(2)}`;
  });

  socket.on("joinError", (data) => {
    alert(data.message);
    document.getElementById("waiting-area").classList.add("hidden");
    document.getElementById("create-room-btn").disabled = false;
  });

  socket.on("confirmBet", (data) => {
    document.getElementById(
      "confirm-bet-amount"
    ).textContent = `R$ ${data.bet.toFixed(2)}`;
    tempRoomCode = data.roomCode;
    let modeText =
      data.gameMode === "tablita"
        ? "Tablita"
        : data.gameMode === "international"
        ? "Internacional 10x10"
        : "Clássico 8x8";
    document.getElementById("confirm-game-mode").textContent = modeText;
    document.getElementById("confirm-bet-overlay").classList.remove("hidden");
  });

  document.getElementById("accept-bet-btn").addEventListener("click", () => {
    if (tempRoomCode && window.currentUser) {
      window.isSpectator = false;
      socket.emit("acceptBet", {
        roomCode: tempRoomCode,
        user: window.currentUser,
      });
      document.getElementById("confirm-bet-overlay").classList.add("hidden");
    }
  });
  document.getElementById("decline-bet-btn").addEventListener("click", () => {
    document.getElementById("confirm-bet-overlay").classList.add("hidden");
    tempRoomCode = null;
  });

  socket.on("updateSaldo", (d) => {
    if (window.currentUser) {
      window.currentUser.saldo = d.newSaldo;
      updateLobbyWelcome();
    }
  });

  // Modal PIX Logics
  const addBalanceBtn = document.getElementById("add-balance-btn");
  if (addBalanceBtn)
    addBalanceBtn.addEventListener("click", () =>
      document.getElementById("pix-overlay").classList.remove("hidden")
    );

  document
    .getElementById("close-pix-overlay-btn")
    .addEventListener("click", () => {
      document.getElementById("pix-overlay").classList.add("hidden");
      document.getElementById("mp-loading").classList.add("hidden");
      document.getElementById("qr-code-container").classList.add("hidden");
      const payBtn = document.getElementById("pay-mercadopago-btn");
      if (payBtn) payBtn.disabled = false;
      if (paymentCheckInterval) {
        clearInterval(paymentCheckInterval);
        paymentCheckInterval = null;
      }
    });

  const payBtn = document.getElementById("pay-mercadopago-btn");
  if (payBtn) {
    payBtn.addEventListener("click", async () => {
      if (!window.currentUser) return;
      const amount = parseFloat(
        document.getElementById("deposit-amount").value
      );
      if (!amount || amount < 1) return alert("Mínimo R$ 1,00");

      payBtn.disabled = true;
      document.getElementById("mp-loading").classList.remove("hidden");

      try {
        const res = await fetch("/api/payment/create_preference", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount, email: window.currentUser.email }),
        });
        const data = await res.json();

        document.getElementById("mp-loading").classList.add("hidden");
        if (data.qr_code) {
          document
            .getElementById("qr-code-container")
            .classList.remove("hidden");
          document.getElementById(
            "qr-code-img"
          ).src = `data:image/png;base64,${data.qr_code_base64}`;
          document.getElementById("pix-copy-paste").value = data.qr_code;

          // Polling saldo
          const initialSaldo = window.currentUser.saldo;
          paymentCheckInterval = setInterval(async () => {
            try {
              const checkRes = await fetch("/api/user/re-authenticate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: window.currentUser.email }),
              });
              const checkData = await checkRes.json();
              if (checkData.user.saldo > initialSaldo) {
                window.currentUser.saldo = checkData.user.saldo;
                updateLobbyWelcome();
                alert("Pagamento Recebido!");
                clearInterval(paymentCheckInterval);
                document.getElementById("pix-overlay").classList.add("hidden");
              }
            } catch (e) {}
          }, 5000);
        }
      } catch (e) {
        alert("Erro ao gerar PIX");
        payBtn.disabled = false;
        document.getElementById("mp-loading").classList.add("hidden");
      }
    });
  }

  document.getElementById("copy-pix-code-btn").addEventListener("click", () => {
    const copyText = document.getElementById("pix-copy-paste");
    copyText.select();
    document.execCommand("copy");
    alert("Código copiado!");
  });

  // Modal SAQUE
  const withdrawBtn = document.getElementById("withdraw-btn");
  if (withdrawBtn)
    withdrawBtn.addEventListener("click", () =>
      document.getElementById("withdraw-overlay").classList.remove("hidden")
    );
  document
    .getElementById("close-withdraw-overlay-btn")
    .addEventListener("click", () =>
      document.getElementById("withdraw-overlay").classList.add("hidden")
    );

  document
    .getElementById("withdraw-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const pixKey = document.getElementById("withdraw-pix-key").value;
      const amount = parseFloat(
        document.getElementById("withdraw-amount").value
      );
      if (!pixKey || amount < 30) return alert("Valor inválido.");

      try {
        const res = await fetch("/api/withdraw", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: window.currentUser.email,
            amount,
            pixKey,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          alert("Solicitação enviada!");
          document.getElementById("withdraw-overlay").classList.add("hidden");
        } else {
          alert(data.message);
        }
      } catch (e) {
        alert("Erro de conexão");
      }
    });

  // Modais de Info e Afiliados
  const tutorialBtn = document.getElementById("tutorial-btn");
  if (tutorialBtn)
    tutorialBtn.addEventListener("click", () =>
      document
        .getElementById("general-tutorial-overlay")
        .classList.remove("hidden")
    );
  document
    .getElementById("close-tutorial-btn")
    .addEventListener("click", () =>
      document
        .getElementById("general-tutorial-overlay")
        .classList.add("hidden")
    );

  const trnInfoBtn = document.getElementById("tournament-info-btn");
  if (trnInfoBtn)
    trnInfoBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      document
        .getElementById("tournament-info-overlay")
        .classList.remove("hidden");
    });
  document
    .getElementById("close-tournament-info-btn")
    .addEventListener("click", () =>
      document.getElementById("tournament-info-overlay").classList.add("hidden")
    );
};
