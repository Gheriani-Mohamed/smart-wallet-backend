const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding default categories...');

  const categories = [
    // Expense Categories
    { name: 'Food', iconName: 'restaurant', colorValue: '4284773515', type: 'expense', isCustom: false },
    { name: 'Transport', iconName: 'directions_car', colorValue: '4282339765', type: 'expense', isCustom: false },
    { name: 'Shopping', iconName: 'shopping_cart', colorValue: '4294198070', type: 'expense', isCustom: false },
    { name: 'Entertainment', iconName: 'movie', colorValue: '4293467747', type: 'expense', isCustom: false },
    { name: 'Bills', iconName: 'receipt', colorValue: '4294961979', type: 'expense', isCustom: false },
    { name: 'Health', iconName: 'local_hospital', colorValue: '4294923087', type: 'expense', isCustom: false },
    { name: 'Education', iconName: 'school', colorValue: '4280391411', type: 'expense', isCustom: false },
    { name: 'Other', iconName: 'more_horiz', colorValue: '4288585374', type: 'expense', isCustom: false },
    
    // Income Categories
    { name: 'Salary', iconName: 'account_balance', colorValue: '4283215696', type: 'income', isCustom: false },
    { name: 'Freelance', iconName: 'work', colorValue: '4285887861', type: 'income', isCustom: false },
    { name: 'Investment', iconName: 'trending_up', colorValue: '4283215696', type: 'income', isCustom: false },
    { name: 'Gift', iconName: 'card_giftcard', colorValue: '4294198070', type: 'income', isCustom: false },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: {},
      create: category,
    });
    console.log(`  ✅ ${category.name}`);
  }

  console.log('\n✅ Seeding completed! Created 12 default categories.');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });