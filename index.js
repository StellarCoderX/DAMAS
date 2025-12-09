// index.js (VERSÃO COM ROTAS DE ADMIN)
require("dotenv").config();

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
const User = require("./models/User");
const bcrypt = require("bcryptjs");

const { initializeSocket, gameRooms } = require("./src/socketHandlers");
const { initializeManager } = require("./src/gameManager");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// --- ADICIONADO: Verificação de variáveis de ambiente ---
if (!MONGO_URI) {
  console.warn("Atenção: A variável de ambiente MONGO_URI não está definida.");
  console.warn(
    "O aplicativo pode falhar ao tentar conectar ao banco de dados."
  );
  console.warn(
    "Se estiver a implantar no Fly.io, use 'fly secrets set MONGO_URI=...'"
  );
}
if (!process.env.ADMIN_SECRET_KEY) {
  console.warn(
    "Atenção: A variável de ambiente ADMIN_SECRET_KEY não está definida."
  );
  console.warn("O painel de admin não será acessível.");
}
// --- FIM DA VERIFICAÇÃO ---

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("Conectado ao MongoDB Atlas com sucesso!"))
  .catch((err) => console.error("Erro ao conectar ao MongoDB:", err));

// --- ROTAS DE API PADRÃO ---
app.post("/api/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Este e-mail já está em uso." });
    }
    const newUser = new User({ email, password });
    await newUser.save();
    res.status(201).json({ message: "Usuário cadastrado com sucesso!" });
  } catch (error) {
    res.status(500).json({ message: "Ocorreu um erro no servidor." });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Email ou senha inválidos." });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Email ou senha inválidos." });
    }
    res.status(200).json({
      message: "Login bem-sucedido!",
      user: { email: user.email, saldo: user.saldo },
    });
  } catch (error) {
    res.status(500).json({ message: "Ocorreu um erro no servidor." });
  }
});

app.post("/api/user/re-authenticate", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email não fornecido." });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "Utilizador não encontrado." });
    }
    res.status(200).json({
      message: "Re-autenticado com sucesso!",
      user: { email: user.email, saldo: user.saldo },
    });
  } catch (error) {
    res.status(500).json({ message: "Ocorreu um erro no servidor." });
  }
});

// --- ROTAS DA API DE ADMINISTRAÇÃO ---

// Middleware para verificar a chave secreta no header
const adminAuthHeader = (req, res, next) => {
  const secretKey = req.headers["x-admin-secret-key"];
  if (secretKey && secretKey === process.env.ADMIN_SECRET_KEY) {
    next();
  } else {
    res.status(403).json({ message: "Acesso não autorizado." });
  }
};

// Middleware para verificar a chave secreta no body
const adminAuthBody = (req, res, next) => {
  const { secret } = req.body;
  if (secret && secret === process.env.ADMIN_SECRET_KEY) {
    next();
  } else {
    res.status(403).json({ message: "Acesso não autorizado." });
  }
};

// Rota para buscar todos os usuários (protegida por header)
app.get("/api/admin/users", adminAuthHeader, async (req, res) => {
  try {
    const users = await User.find({}, "email saldo").sort({ email: 1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar usuários no servidor." });
  }
});

// Rota para atualizar o saldo de um usuário (protegida por body)
app.put("/api/admin/update-saldo", adminAuthBody, async (req, res) => {
  try {
    const { email, newSaldo } = req.body;
    if (!email || newSaldo === undefined) {
      return res
        .status(400)
        .json({ message: "Email ou novo saldo não fornecido." });
    }
    const result = await User.updateOne(
      { email: email },
      { $set: { saldo: Number(newSaldo) } }
    );
    if (result.nModified === 0) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }
    res.json({ message: "Saldo atualizado com sucesso!" });
  } catch (error) {
    res.status(500).json({ message: "Erro ao atualizar saldo no servidor." });
  }
});

// Rota para deletar um usuário (protegida por body)
app.delete("/api/admin/user/:email", adminAuthBody, async (req, res) => {
  try {
    const result = await User.deleteOne({ email: req.params.email });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }
    res.json({ message: "Usuário excluído com sucesso!" });
  } catch (error) {
    res.status(500).json({ message: "Erro ao excluir usuário no servidor." });
  }
});

// Rota para zerar o saldo de todos os usuários (protegida por body)
app.post("/api/admin/reset-all-saldos", adminAuthBody, async (req, res) => {
  try {
    await User.updateMany({}, { $set: { saldo: 0 } });
    res.json({ message: "Todos os saldos foram zerados com sucesso!" });
  } catch (error) {
    res.status(500).json({ message: "Erro ao zerar saldos no servidor." });
  }
});

// --- INICIALIZAÇÃO DOS MÓDULOS DO JOGO ---
initializeManager(io, gameRooms);
initializeSocket(io);

// --- INICIA O SERVIDOR ---
// --- MODIFICADO: Adicionado '0.0.0.0' para garantir a ligação correta no container ---
const HOST = process.env.HOST || "0.0.0.0";

server.listen(PORT, HOST, () => {
  console.log(`Servidor a rodar em http://${HOST}:${PORT}.`);
});
