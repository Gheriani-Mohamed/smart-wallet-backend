const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get all alerts for a user
exports.getUserAlerts = async (req, res) => {
  try {
    const { userId } = req.params;

    const alerts = await prisma.alert.findMany({
      where: { userId },
      include: {
        budget: {
          include: {
            wallet: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get unread alerts
exports.getUnreadAlerts = async (req, res) => {
  try {
    const { userId } = req.params;

    const alerts = await prisma.alert.findMany({
      where: {
        userId,
        isRead: false,
      },
      include: {
        budget: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get unread alert count
exports.getUnreadCount = async (req, res) => {
  try {
    const { userId } = req.params;

    const count = await prisma.alert.count({
      where: {
        userId,
        isRead: false,
      },
    });

    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Mark alert as read
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const alert = await prisma.alert.update({
      where: { id },
      data: { isRead: true },
    });

    res.json(alert);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Mark all alerts as read
exports.markAllAsRead = async (req, res) => {
  try {
    const { userId } = req.params;

    await prisma.alert.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    res.json({ message: 'All alerts marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete alert
exports.deleteAlert = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.alert.delete({
      where: { id },
    });

    res.json({ message: 'Alert deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Clear all read alerts
exports.clearReadAlerts = async (req, res) => {
  try {
    const { userId } = req.params;

    await prisma.alert.deleteMany({
      where: {
        userId,
        isRead: true,
      },
    });

    res.json({ message: 'Read alerts cleared' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};