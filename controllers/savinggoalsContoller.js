// controllers/savinggoalsController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Créer un nouvel objectif
const createGoal = async (req, res) => {
  try {
    // 1. Récupérer userId (du token ou du body en dev)
    const userId = req.userId || req.body.userId;
    const { title, targetAmount, endDate, walletId } = req.body;

    console.log('📝 createGoal - userId:', userId);
    console.log('📝 createGoal - body:', { title, targetAmount, endDate, walletId });

    if (!userId) {
      return res.status(400).json({ message: "userId requis" });
    }

    if (!title || !targetAmount || !endDate) {
      return res.status(400).json({ 
        message: "Titre, montant cible et date limite sont requis" 
      });
    }

    // 2. Vérifier/créer l'utilisateur
    let user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user && process.env.NODE_ENV === 'development') {
      console.log('👤 Création automatique de l\'utilisateur pour test');
      user = await prisma.user.create({
        data: {
          id: userId,
          email: `test-${userId}@example.com`,
          password: 'test123',
          name: 'Test User'
        }
      });
    }

    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // 3. Gérer walletId (null ou fourni)
    let wallet;
    
    if (walletId) {
      // Si walletId fourni, vérifier qu'il appartient à l'utilisateur
      wallet = await prisma.wallet.findFirst({
        where: {
          id: walletId,
          members: { some: { userId: userId } }
        }
      });
    } else {
      // Si walletId null, prendre le premier wallet de l'utilisateur
      wallet = await prisma.wallet.findFirst({
        where: {
          members: { some: { userId: userId } }
        }
      });
    }

    if (!wallet && process.env.NODE_ENV === 'development') {
      console.log('🔄 Création automatique d\'un wallet pour test');
      
      wallet = await prisma.wallet.create({
        data: {
          name: 'Wallet Test',
          type: 'personal',
          balance: 10000,
          currency: 'TND',
          members: {
            create: {
              userId: user.id
            }
          }
        }
      });
      console.log('✅ Wallet créé:', wallet);
    }

    if (!wallet) {
      return res.status(404).json({ 
        message: "Aucun wallet trouvé. Créez un wallet d'abord." 
      });
    }

    // 4. Créer l'objectif
    const goal = await prisma.savingGoal.create({
      data: {
        userId: userId,
        walletId: wallet.id,
        title: title,
        targetAmount: parseFloat(targetAmount),
        currentAmount: 0,
        startDate: new Date(),
        endDate: new Date(endDate),
        isCompleted: false
      }
    });

    console.log('✅ Objectif créé:', goal);

    res.status(201).json({
      success: true,
      message: "Objectif créé avec succès",
      goal: goal
    });

  } catch (error) {
    console.error("❌ Erreur création objectif:", error);
    res.status(500).json({ 
      message: "Erreur serveur", 
      error: error.message 
    });
  }
};

// Récupérer tous les objectifs
const getMyGoals = async (req, res) => {
  try {
    const userId = req.userId || req.query.userId;
    const { walletId } = req.query;

    console.log('📋 getMyGoals - userId:', userId);

    if (!userId) {
      return res.status(400).json({ message: "userId requis" });
    }

    const whereClause = {
      userId: userId,
      ...(walletId && { walletId: walletId })
    };

    const goals = await prisma.savingGoal.findMany({
      where: whereClause,
      include: {
        wallet: {
          select: {
            name: true,
            balance: true,
            currency: true
          }
        }
      },
      orderBy: [
        { isCompleted: 'asc' },
        { endDate: 'asc' }
      ]
    });

    console.log(`📊 ${goals.length} objectifs trouvés`);

    const goalsWithDetails = goals.map(goal => ({
      ...goal,
      progress: (goal.currentAmount / goal.targetAmount) * 100,
      remaining: goal.targetAmount - goal.currentAmount,
      daysLeft: Math.ceil((new Date(goal.endDate) - new Date()) / (1000 * 60 * 60 * 24)),
      isOverdue: new Date(goal.endDate) < new Date() && !goal.isCompleted
    }));

    res.json(goalsWithDetails);

  } catch (error) {
    console.error("❌ Erreur récupération:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// Contribuer à un objectif
const contributeToGoal = async (req, res) => {
  try {
    const userId = req.userId || req.body.userId;
    const { id } = req.params;
    const { amount } = req.body;

    console.log('💰 contributeToGoal - userId:', userId);
    console.log('💰 contributeToGoal - goalId:', id, 'amount:', amount);

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Montant invalide" });
    }

    const goal = await prisma.savingGoal.findUnique({
      where: { id: id },
      include: { wallet: true }
    });

    if (!goal) {
      return res.status(404).json({ message: "Objectif non trouvé" });
    }

    if (goal.userId !== userId) {
      return res.status(403).json({ message: "Non autorisé" });
    }

    if (goal.isCompleted) {
      return res.status(400).json({ message: "Objectif déjà atteint" });
    }

    if (goal.currentAmount + amount > goal.targetAmount) {
      return res.status(400).json({ 
        message: "Montant dépasse l'objectif",
        remaining: goal.targetAmount - goal.currentAmount
      });
    }

    if (goal.wallet.balance < amount) {
      return res.status(400).json({ 
        message: "Solde insuffisant",
        currentBalance: goal.wallet.balance
      });
    }

    // Chercher une catégorie valide
    let category = await prisma.category.findFirst({
      where: { name: 'Épargne' }
    });

    if (!category) {
      // Créer une catégorie par défaut
      category = await prisma.category.create({
        data: {
          name: 'Épargne',
          iconName: 'savings',
          colorValue: '4283215696',
          type: 'expense',
          isCustom: false
        }
      });
    }

    // Transaction Prisma
    const result = await prisma.$transaction([
      prisma.wallet.update({
        where: { id: goal.walletId },
        data: { balance: { decrement: amount } }
      }),
      prisma.savingGoal.update({
        where: { id: id },
        data: { 
          currentAmount: { increment: amount },
          isCompleted: goal.currentAmount + amount >= goal.targetAmount
        }
      }),
      prisma.transaction.create({
        data: {
          userId: userId,
          walletId: goal.walletId,
          categoryId: category.id,
          amount: -amount,
          type: "expense",
          description: `Épargne pour: ${goal.title}`,
          date: new Date()
        }
      })
    ]);

    res.json({
      success: true,
      message: "Contribution ajoutée avec succès",
      newBalance: result[0].balance,
      goal: result[1]
    });

  } catch (error) {
    console.error("❌ Erreur contribution:", error);
    res.status(500).json({ 
      message: "Erreur serveur", 
      error: error.message 
    });
  }
};

// Supprimer un objectif
const deleteGoal = async (req, res) => {
  try {
    const userId = req.userId || req.query.userId || req.body.userId;
    const { id } = req.params;

    console.log('🗑️ deleteGoal - userId:', userId, 'goalId:', id);

    const goal = await prisma.savingGoal.findFirst({
      where: {
        id: id,
        userId: userId
      }
    });

    if (!goal) {
      return res.status(404).json({ message: "Objectif non trouvé" });
    }

    await prisma.savingGoal.delete({
      where: { id: id }
    });

    res.json({ 
      success: true, 
      message: "Objectif supprimé avec succès" 
    });

  } catch (error) {
    console.error("❌ Erreur suppression:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

module.exports = {
  createGoal,
  getMyGoals,
  contributeToGoal,
  deleteGoal
};