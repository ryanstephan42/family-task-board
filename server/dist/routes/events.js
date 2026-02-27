"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("../auth");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
// Get events
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const events = await prisma.event.findMany({
            include: {
                creator: { select: { name: true } },
            },
            orderBy: { startTime: 'asc' },
        });
        res.json(events);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});
// Create event
router.post('/', auth_1.authenticateToken, async (req, res) => {
    const { title, description, startTime, endTime, location, isRepeating, repeatFrequency, color } = req.body;
    const userId = req.user?.id;
    if (!userId)
        return res.sendStatus(401);
    try {
        const event = await prisma.event.create({
            data: {
                title,
                description,
                startTime: new Date(startTime),
                endTime: endTime ? new Date(endTime) : null,
                location,
                isRepeating: !!isRepeating,
                repeatFrequency: isRepeating ? repeatFrequency : null,
                color: color || '#0ea5e9',
                creatorId: userId,
            },
        });
        res.status(201).json(event);
    }
    catch (error) {
        console.error(error);
        res.status(400).json({ error: 'Failed to create event' });
    }
});
// Delete event
router.delete('/:id', auth_1.authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.event.delete({ where: { id: id } });
        res.json({ message: 'Event deleted' });
    }
    catch (error) {
        res.status(400).json({ error: 'Failed to delete event' });
    }
});
exports.default = router;
