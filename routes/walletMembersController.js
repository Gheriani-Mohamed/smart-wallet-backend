// controllers/walletMembersController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Add member to wallet
exports.addMember = async (req, res) => {
  try {
    const { walletId } = req.params;
    const { userEmail } = req.body;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: userEmail }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if wallet exists and is family type
    const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) return res.status(404).json({ error: "Wallet not found" });
    if (wallet.type !== 'family') return res.status(400).json({ error: "Only family wallets can have members" });

    // Prevent duplicate member
    const exists = await prisma.walletMember.findUnique({
      where: { userId_walletId: { userId: user.id, walletId } },
    });

    if (exists) return res.status(400).json({ error: "User already in wallet" });

    // Create WalletMember
    const member = await prisma.walletMember.create({
      data: {
        userId: user.id,
        walletId,
      },
      include: { user: true },
    });

    res.json(member);
  } catch (error) {
    console.error("Error adding member:", error);
    res.status(500).json({ error: error.message });
  }
};
exports.getMembers = async (req, res) => {
  try {
    const { walletId } = req.params;

    const wallet = await prisma.wallet.findUnique({
      where: { id: walletId },
      include: {
        members: { include: { user: true } } // include user info
      },
    });

    if (!wallet) return res.status(404).json({ error: "Wallet not found" });

    res.json(wallet.members);
  } catch (error) {
    console.error("Error fetching members:", error);
    res.status(500).json({ error: error.message });
  }
};

// Delete a member from a wallet
exports.removeMember = async (req, res) => {
  try {
    const { walletId, userId } = req.params;

    // Check if member exists
    const member = await prisma.walletMember.findUnique({
      where: { userId_walletId: { userId, walletId } },
    });

    if (!member) return res.status(404).json({ error: "Member not found" });

    await prisma.walletMember.delete({
      where: { userId_walletId: { userId, walletId } },
    });

    res.json({ message: "Member removed successfully" });
  } catch (error) {
    console.error("Error removing member:", error);
    res.status(500).json({ error: error.message });
  }
};
