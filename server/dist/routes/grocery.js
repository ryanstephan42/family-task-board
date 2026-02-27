"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("../auth");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
// Get all grocery items
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const items = await prisma.groceryItem.findMany({
            orderBy: { createdAt: 'desc' },
        });
        res.json(items);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch grocery items' });
    }
});
// Create grocery items (bulk supported)
router.post('/', auth_1.authenticateToken, async (req, res) => {
    const { items } = req.body; // Array of { name, quantity, details, category }
    if (!items || !Array.isArray(items)) {
        return res.status(400).json({ error: 'Items array is required' });
    }
    try {
        const createdItems = await Promise.all(items.map(async (item) => {
            return prisma.groceryItem.create({
                data: {
                    name: item.name,
                    quantity: item.quantity || null,
                    details: item.details || null,
                    category: item.category || null,
                },
            });
        }));
        res.status(201).json(createdItems);
    }
    catch (error) {
        console.error(error);
        res.status(400).json({ error: 'Failed to create grocery items' });
    }
});
// Update grocery item
router.put('/:id', auth_1.authenticateToken, async (req, res) => {
    const id = req.params.id;
    const { name, quantity, details, category, completed } = req.body;
    try {
        const item = await prisma.groceryItem.update({
            where: { id },
            data: {
                name,
                quantity,
                details,
                category,
                completed,
            },
        });
        // If a category was provided, update the preference
        if (name && category) {
            await prisma.itemCategoryPreference.upsert({
                where: { itemName: name.toLowerCase().trim() },
                update: { category },
                create: { itemName: name.toLowerCase().trim(), category },
            });
        }
        res.json(item);
    }
    catch (error) {
        res.status(400).json({ error: 'Failed to update grocery item' });
    }
});
// Delete grocery item
router.delete('/:id', auth_1.authenticateToken, async (req, res) => {
    const id = req.params.id;
    try {
        await prisma.groceryItem.delete({ where: { id } });
        res.json({ message: 'Grocery item deleted' });
    }
    catch (error) {
        res.status(400).json({ error: 'Failed to delete grocery item' });
    }
});
// Get category preferences
router.get('/preferences', auth_1.authenticateToken, async (req, res) => {
    try {
        const preferences = await prisma.itemCategoryPreference.findMany();
        res.json(preferences);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch preferences' });
    }
});
exports.default = router;
