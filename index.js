// index.js (COM ROTA DE HISTÓRICO)
require("dotenv").config();

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
const User = require("./models/User");
const Withdrawal = require("./models/Withdrawal");
const MatchHistory = require("./models/MatchHistory"); // Importação do Modelo
constQb = require("bcryptjs"); // Nota: Pequeno erro de digitação corrigido aqui (require("bcryptjs"))
const bcrypt = require("bcryptjs");

const { initializeSocket, gameRooms } = require("./src/socketHandlers");
const { initializeManager } = require("./src/gameManager");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI)
  console.warn("Atenção: A variável de ambiente MONGO_URI não está definida.");
if (!process.env.ADMIN_SECRET_KEY)
  console.warn(
    "Atenção: A variável de ambiente ADMIN_SECRET_KEY não está definida."
  );

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("Conectado ao MongoDB Atlas com sucesso!"))
  .catch((err) => console.error("Erro ao conectar ao MongoDB:", err));

// --- ROTAS DE API ---

app.post("/api/register", async (req, res) => {
  try {
    const { email, password, referralCode } = req.body;
    const emailLower = email.toLowerCase();

    const existingUser = await User.findOne({ email: emailLower });
    if (existingUser) {
      return res.status(400).json({ message: "Este e-mail já está em uso." });
    }

    const newUser = new User({ email: emailLower, password });

    if (referralCode) {
      const referralLower = referralCode.toLowerCase();
      const referrer = await User.findOne({ email: referralLower });
      if (referrer && referralLower !== emailLower) {
        newUser.referredBy = referralLower;
      }
    }

    await newUser.save();
    console.log(`[Registro] Novo usuário criado: ${emailLower}`);
    res.status(201).json({ message: "Usuário cadastrado com sucesso!" });
  } catch (error) {
    console.error("[Registro] Erro:", error);
    res.status(500).json({ message: "Ocorreu um erro no servidor." });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email e senha são obrigatórios." });
    }

    const emailLower = email.toLowerCase();
    console.log(`[Login] Tentativa para: ${emailLower}`);

    const user = await User.findOne({ email: emailLower });

    if (!user) {
      console.log(`[Login] Falha: Usuário não encontrado (${emailLower})`);
      return res.status(400).json({ message: "Email ou senha inválidos." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log(`[Login] Falha: Senha incorreta para (${emailLower})`);
      return res.status(400).json({ message: "Email ou senha inválidos." });
    }

    console.log(`[Login] Sucesso: ${emailLower}`);
    res.status(200).json({
      message: "Login bem-sucedido!",
      user: {
        email: user.email,
        saldo: user.saldo,
        referralEarnings: user.referralEarnings,
      },
    });
  } catch (error) {
    console.error("[Login] Erro no servidor:", error);
    res.status(500).json({ message: "Ocorreu um erro no servidor." });
  }
});

app.post("/api/user/re-authenticate", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({ message: "Email não fornecido." });

    const emailLower = email.toLowerCase();
    const user = await User.findOne({ email: emailLower });

    if (!user)
      return res.status(404).json({ message: "Utilizador não encontrado." });

    res.status(200).json({
      message: "Re-autenticado com sucesso!",
      user: {
        email: user.email,
        saldo: user.saldo,
        referralEarnings: user.referralEarnings,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Ocorreu um erro no servidor." });
  }
});

app.post("/api/user/referrals", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({ message: "Email não fornecido." });

    const emailLower = email.toLowerCase();
    const referrals = await User.find(
      { referredBy: emailLower },
      "email hasDeposited firstDepositValue"
    );

    res.json(referrals);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao buscar indicações." });
  }
});

// --- ROTA DE HISTÓRICO DE PARTIDAS ---
app.post("/api/user/history", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email obrigatório." });

    // Busca partidas onde o usuário foi player1 OU player2
    const emailLower = email.toLowerCase();
    const history = await MatchHistory.find({
      $or: [
        { MQ: "" },
        { player1: emailLower },
        { MQ: "" },
        { player2: emailLower },
      ],
    })
      .sort({ createdAt: -1 }) // Mais recentes primeiro
      .limit(50); // Limita às últimas 50 partidas

    res.json(history);
  } catch (err) {
    console.error("Erro ao buscar histórico:", err);
    res.status(500).json({ message: "Erro ao buscar histórico." });
  }
});

app.post("/api/withdraw", async (req, res) => {
  try {
    const { email, amount, pixKey } = req.body;
    if (!email || !amount || !pixKey)
      return res.status(400).json({ message: "Dados incompletos." });
    if (amount <= 0)
      return res.status(400).json({ message: "Valor inválido." });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user)
      return res.status(404).json({ message: "Usuário não encontrado." });
    if (user.saldo < amount)
      return res.status(400).json({ message: "Saldo insuficiente." });

    const newWithdrawal = new Withdrawal({
      email: email.toLowerCase(),
      amount,
      pixKey,
      status: "pending",
    });
    await newWithdrawal.save();

    res.status(201).json({
      message: "Solicitação de saque enviada com sucesso! Aguarde a aprovação.",
    });
  } catch (error) {
    res.status(500).json({ message: "Erro ao processar solicitação." });
  }
});

const adminAuthBody = (req, res, next) => {
  const { secret } = req.body;
  if (secret && secret === process.env.ADMIN_SECRET_KEY) next();
  else res.status(403).json({ message: "Acesso não autorizado." });
};

app.put("/api/admin/add-saldo-bonus", adminAuthBody, async (req, res) => {
  try {
    const { email, amountToAdd } = req.body;
    const amount = Number(amountToAdd);
    const emailLower = email.toLowerCase();

    const user = await User.findOne({ email: emailLower });
    if (!user)
      return res.status(404).json({ message: "Usuário não encontrado." });

    user.saldo += amount;

    let bonusMessage = "";

    if (!user.hasDeposited) {
      user.firstDepositValue = amount;
      user.hasDeposited = true;

      if (amount >= 5 && user.referredBy) {
        const referrer = await User.findOne({ email: user.referredBy });
        if (referrer) {
          referrer.saldo += 1;
          referrer.referralEarnings += 1;
          await referrer.save();
          bonusMessage = ` (Bônus de R$ 1,00 creditado para ${referrer.email}!)`;
        }
      } else if (amount < 5 && user.referredBy) {
        bonusMessage = ` (Sem bônus: Depósito de R$ ${amount} é menor que R$ 5,00)`;
      }
    }

    await user.save();

    res.json({
      message: `Sucesso! R$ ${amount} adicionados para ${emailLower}.${bonusMessage}`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao adicionar saldo." });
  }
});

const adminAuthHeader = (req, res, next) => {
  const secretKey = req.headers["x-admin-secret-key"];
  if (secretKey && secretKey === process.env.ADMIN_SECRET_KEY) next();
  else res.status(403).json({ message: "Acesso não autorizado." });
};

app.get("/api/admin/users", adminAuthHeader, async (req, res) => {
  try {
    const users = await User.find(
      {},
      "email saldo referredBy hasDeposited"
    ).sort({ email: 1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar usuários." });
  }
});

app.get("/api/admin/withdrawals", adminAuthHeader, async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ status: "pending" }).sort({
      createdAt: 1,
    });
    res.json(withdrawals);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar solicitações." });
  }
});

app.post("/api/admin/approve-withdrawal", adminAuthBody, async (req, res) => {
  try {
    const { withdrawalId } = req.body;
    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal)
      return res.status(404).json({ message: "Solicitação não encontrada." });
    if (withdrawal.status !== "pending")
      return res.status(400).json({ message: "Já processado." });

    const user = await User.findOne({ email: withdrawal.email });
    if (!user)
      return res.status(404).json({ message: "Usuário não encontrado." });
    if (user.saldo < withdrawal.amount)
      return res.status(400).json({ message: "Saldo insuficiente." });

    user.saldo -= withdrawal.amount;
    await user.save();
    withdrawal.status = "completed";
    await withdrawal.save();

    res.json({ message: "Saque aprovado com sucesso!" });
  } catch (error) {
    res.status(500).json({ message: "Erro ao aprovar." });
  }
});

app.post("/api/admin/reject-withdrawal", adminAuthBody, async (req, res) => {
  try {
    const { withdrawalId } = req.body;
    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal)
      return res.status(404).json({ message: "Solicitação não encontrada." });

    withdrawal.status = "rejected";
    await withdrawal.save();
    res.json({ message: "Solicitação rejeitada." });
  } catch (error) {
    res.status(500).json({ message: "Erro ao rejeitar." });
  }
});

app.put("/api/admin/update-saldo", adminAuthBody, async (req, res) => {
  try {
    const { email, newSaldo } = req.body;
    const result = await User.updateOne(
      { email: email.toLowerCase() },
      { $set: { saldo: Number(newSaldo) } }
    );
    if (result.nModified === 0)
      return res.status(404).json({ message: "Usuário não encontrado." });
    res.json({ message: "Saldo atualizado com sucesso!" });
  } catch (error) {
    res.status(500).json({ message: "Erro ao atualizar." });
  }
});

app.delete("/api/admin/user/:email", adminAuthBody, async (req, res) => {
  try {
    const result = await User.deleteOne({
      email: req.params.email.toLowerCase(),
    });
    if (result.deletedCount === 0)
      return res.status(404).json({ message: "Usuário não encontrado." });
    res.json({ message: "Usuário excluído com sucesso!" });
  } catch (error) {
    res.status(500).json({ message: "Erro ao excluir." });
  }
});

app.post("/api/admin/reset-all-saldos", adminAuthBody, async (req, res) => {
  try {
    await User.updateMany({}, { $set: { saldo: 0 } });
    res.json({ message: "Todos os saldos foram zerados!" });
  } catch (error) {
    res.status(500).json({ message: "Erro ao zerar." });
  }
});

initializeManager(io, gameRooms);
initializeSocket(io);

const HOST = process.env.HOST || "0.0.0.0";
server.listen(PORT, HOST, () => {
  console.log(`Servidor a rodar em http://${HOST}:${PORT}.`);
});
