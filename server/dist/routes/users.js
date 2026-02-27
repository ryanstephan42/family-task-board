"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'family-secret-key-123';
// Register
router.post('/register', async (req, res) => {
    const { username, password, name } = req.body;
    try {
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                name,
            },
        });
        res.status(201).json({ message: 'User created' });
    }
    catch (error) {
        res.status(400).json({ error: 'Username already exists' });
    }
});
// Login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user)
        return res.status(400).json({ error: 'User not found' });
    const validPassword = await bcryptjs_1.default.compare(password, user.password);
    if (!validPassword)
        return res.status(400).json({ error: 'Invalid password' });
    const token = jsonwebtoken_1.default.sign({ id: user.id, username: user.username }, JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username, name: user.name } });
});
// Get all users (for assignment)
router.get('/', async (req, res) => {
    const users = await prisma.user.findMany({
        select: { id: true, name: true, username: true },
    });
    res.json(users);
});
exports.default = router;
