import 'dotenv/config';
import { PrismaClient, EmployeeRole } from '@prisma/client';

const prisma = new PrismaClient();

const employees: Array<{ employeeNo: string; name: string; role: EmployeeRole; station?: string }> = [
  { employeeNo: 'MGR-001', name: 'Meenakshi Sundaram', role: 'MANAGER' },
  { employeeNo: 'SRV-001', name: 'Kavitha', role: 'SERVER' },
  { employeeNo: 'SRV-002', name: 'Muthuvel', role: 'SERVER' },
  { employeeNo: 'SRV-003', name: 'Thenmozhi', role: 'SERVER' },
  { employeeNo: 'SRV-004', name: 'Arunachalam', role: 'SERVER' },
  { employeeNo: 'SRV-005', name: 'Valli', role: 'SERVER' },
  { employeeNo: 'COOK-001', name: 'Selvam', role: 'COOK', station: 'Tiffin' },
  { employeeNo: 'COOK-002', name: 'Rani', role: 'COOK', station: 'Tiffin' },
  { employeeNo: 'COOK-003', name: 'Murugan', role: 'COOK', station: 'Non-Vegetarian' },
  { employeeNo: 'COOK-004', name: 'Jeyalakshmi', role: 'COOK', station: 'Beverage' },
  { employeeNo: 'DWS-001', name: 'Pandi', role: 'DISHWASHER' },
  { employeeNo: 'DWS-002', name: 'Chitra', role: 'DISHWASHER' },
];

const tables = ['T01', 'T02', 'T03', 'T04', 'T05'];
const vesselInventory = [
  { name: 'Stainless-steel tumbler', cleanQty: 60, lowStockAt: 15 },
  { name: 'Stainless-steel plate', cleanQty: 50, lowStockAt: 12 },
  { name: 'Banana leaf', cleanQty: 60, lowStockAt: 15 },
  { name: 'Serving bowl', cleanQty: 30, lowStockAt: 8 },
  { name: 'Serving spoon', cleanQty: 30, lowStockAt: 8 },
  { name: 'Cooking vessel', cleanQty: 12, lowStockAt: 3 },
];
const ingredientInventory = [
  { name: 'Idli rice', unit: 'kg', lowStockAt: 1, initial: 8 },
  { name: 'Urad dal', unit: 'kg', lowStockAt: 0.5, initial: 3 },
  { name: 'Salt', unit: 'kg', lowStockAt: 0.1, initial: 1 },
  { name: 'Dosa batter', unit: 'kg', lowStockAt: 1, initial: 6 },
  { name: 'Cooking oil', unit: 'L', lowStockAt: 0.5, initial: 3 },
  { name: 'Coffee decoction', unit: 'L', lowStockAt: 0.25, initial: 2 },
  { name: 'Milk', unit: 'L', lowStockAt: 1, initial: 6 },
];
const categories = [
  ['Breakfast', 1],
  ['Meals', 2],
  ['Non-Vegetarian', 3],
  ['Evening & Dinner', 4],
  ['Beverages & Desserts', 5],
] as const;

// Prices and preparation times are configurable sample values, not verified restaurant data.
const dishes = [
  { id: 'seed-menu-idli', category: 'Breakfast', tamilName: 'இட்லி', englishName: 'Idli', description: 'Steamed fermented rice and lentil cakes.', pricePaise: 3000, vegetarian: true, station: 'Tiffin', prepSeconds: 240 },
  { id: 'seed-menu-mini-idli-sambar', category: 'Breakfast', tamilName: 'சாம்பார் மினி இட்லி', englishName: 'Mini idli with sambar', description: 'Mini steamed idlis served in warm sambar.', pricePaise: 5500, vegetarian: true, station: 'Tiffin', prepSeconds: 300 },
  { id: 'seed-menu-ven-pongal', category: 'Breakfast', tamilName: 'வெண் பொங்கல்', englishName: 'Ven pongal', description: 'Rice and moong dal cooked with pepper, cumin and ghee.', pricePaise: 5500, vegetarian: true, station: 'Tiffin', prepSeconds: 300, allergens: 'Dairy' },
  { id: 'seed-menu-ghee-pongal', category: 'Breakfast', tamilName: 'நெய் பொங்கல்', englishName: 'Ghee pongal', description: 'Ven pongal finished with aromatic ghee.', pricePaise: 6500, vegetarian: true, station: 'Tiffin', prepSeconds: 300, allergens: 'Dairy' },
  { id: 'seed-menu-medu-vadai', category: 'Breakfast', tamilName: 'மெது வடை', englishName: 'Medu vadai', description: 'Crisp fried urad dal fritters.', pricePaise: 3500, vegetarian: true, station: 'Tiffin', prepSeconds: 360 },
  { id: 'seed-menu-poori-masala', category: 'Breakfast', tamilName: 'பூரி மசாலா', englishName: 'Poori with potato masala', description: 'Puffed pooris served with spiced potato masala.', pricePaise: 7000, vegetarian: true, station: 'Tiffin', prepSeconds: 420, allergens: 'Gluten' },
  { id: 'seed-menu-kal-dosa', category: 'Breakfast', tamilName: 'கல் தோசை', englishName: 'Kal dosa', description: 'Soft, thick fermented rice and lentil dosa.', pricePaise: 5500, vegetarian: true, station: 'Tiffin', prepSeconds: 360 },
  { id: 'seed-menu-podi-dosa', category: 'Breakfast', tamilName: 'பொடி தோசை', englishName: 'Podi dosa', description: 'Crisp dosa dusted with spiced lentil podi.', pricePaise: 6500, vegetarian: true, station: 'Tiffin', prepSeconds: 420 },
  { id: 'seed-menu-masala-dosa', category: 'Breakfast', tamilName: 'மசாலா தோசை', englishName: 'Masala dosa', description: 'Crisp dosa filled with potato masala.', pricePaise: 8000, vegetarian: true, station: 'Tiffin', prepSeconds: 480 },
  { id: 'seed-menu-onion-uthappam', category: 'Breakfast', tamilName: 'வெங்காய ஊத்தப்பம்', englishName: 'Onion uthappam', description: 'Soft rice and lentil pancake topped with onion.', pricePaise: 7000, vegetarian: true, station: 'Tiffin', prepSeconds: 420 },
  { id: 'seed-menu-idiyappam', category: 'Breakfast', tamilName: 'இடியாப்பம்', englishName: 'Idiyappam', description: 'Steamed rice noodle nests served with accompaniments.', pricePaise: 6000, vegetarian: true, station: 'Tiffin', prepSeconds: 360 },
  { id: 'seed-menu-appam-coconut-milk', category: 'Breakfast', tamilName: 'தேங்காய் பாலுடன் ஆப்பம்', englishName: 'Appam with coconut milk', description: 'Lacy fermented rice appam with sweet coconut milk.', pricePaise: 7500, vegetarian: true, station: 'Tiffin', prepSeconds: 420, allergens: 'Coconut' },

  { id: 'seed-menu-traditional-meals', category: 'Meals', tamilName: 'பாரம்பரிய தென்னிந்திய சாப்பாடு', englishName: 'Traditional South Indian meals', description: 'Rice with a rotating selection of South Indian accompaniments.', pricePaise: 18000, vegetarian: true, station: 'Meals', prepSeconds: 480 },
  { id: 'seed-menu-banana-leaf-meals', category: 'Meals', tamilName: 'வாழை இலையில் சாப்பாடு', englishName: 'Banana leaf meals', description: 'Traditional vegetarian meal served on a banana leaf.', pricePaise: 22000, vegetarian: true, station: 'Meals', prepSeconds: 540 },
  { id: 'seed-menu-sambar-rice', category: 'Meals', tamilName: 'சாம்பார் சாதம்', englishName: 'Sambar rice', description: 'Rice simmered with lentils, vegetables and sambar spices.', pricePaise: 9000, vegetarian: true, station: 'Meals', prepSeconds: 300 },
  { id: 'seed-menu-lemon-rice', category: 'Meals', tamilName: 'எலுமிச்சை சாதம்', englishName: 'Lemon rice', description: 'Tempered rice with lemon, turmeric and roasted peanuts.', pricePaise: 8000, vegetarian: true, station: 'Meals', prepSeconds: 240, allergens: 'Peanuts' },
  { id: 'seed-menu-curd-rice', category: 'Meals', tamilName: 'தயிர் சாதம்', englishName: 'Curd rice', description: 'Creamy rice and yogurt with a gentle tempering.', pricePaise: 7500, vegetarian: true, station: 'Meals', prepSeconds: 240, allergens: 'Dairy' },
  { id: 'seed-menu-tamarind-rice', category: 'Meals', tamilName: 'புளியோதரை', englishName: 'Tamarind rice', description: 'Rice mixed with tangy tamarind and roasted spices.', pricePaise: 8500, vegetarian: true, station: 'Meals', prepSeconds: 240 },
  { id: 'seed-menu-tomato-rice', category: 'Meals', tamilName: 'தக்காளி சாதம்', englishName: 'Tomato rice', description: 'Rice cooked with tomato, herbs and South Indian spices.', pricePaise: 8500, vegetarian: true, station: 'Meals', prepSeconds: 300 },
  { id: 'seed-menu-paruppu-sadam', category: 'Meals', tamilName: 'பருப்பு சாதம்', englishName: 'Paruppu sadam', description: 'Rice with lentils, ghee and a simple seasoning.', pricePaise: 9000, vegetarian: true, station: 'Meals', prepSeconds: 300, allergens: 'Dairy' },

  { id: 'seed-menu-chettinad-chicken-curry', category: 'Non-Vegetarian', tamilName: 'செட்டிநாடு கோழி குழம்பு', englishName: 'Chettinad chicken curry', description: 'Chicken curry with a bold roasted spice blend.', pricePaise: 24000, vegetarian: false, station: 'Non-Vegetarian', prepSeconds: 900 },
  { id: 'seed-menu-chicken-65', category: 'Non-Vegetarian', tamilName: 'சிக்கன் 65', englishName: 'Chicken 65', description: 'Spiced, crisp-fried chicken bites.', pricePaise: 22000, vegetarian: false, station: 'Non-Vegetarian', prepSeconds: 720 },
  { id: 'seed-menu-pepper-chicken', category: 'Non-Vegetarian', tamilName: 'மிளகு கோழி', englishName: 'Pepper chicken', description: 'Chicken tossed with freshly ground black pepper and spices.', pricePaise: 26000, vegetarian: false, station: 'Non-Vegetarian', prepSeconds: 840 },
  { id: 'seed-menu-mutton-chukka', category: 'Non-Vegetarian', tamilName: 'மட்டன் சுக்கா', englishName: 'Mutton chukka', description: 'Slow-cooked mutton finished dry with roasted spices.', pricePaise: 32000, vegetarian: false, station: 'Non-Vegetarian', prepSeconds: 1080 },
  { id: 'seed-menu-mutton-kola', category: 'Non-Vegetarian', tamilName: 'மட்டன் கோலா உருண்டை', englishName: 'Mutton kola urundai', description: 'Spiced minced mutton balls, fried until browned.', pricePaise: 28000, vegetarian: false, station: 'Non-Vegetarian', prepSeconds: 780 },
  { id: 'seed-menu-kari-dosa', category: 'Non-Vegetarian', tamilName: 'மதுரை கறி தோசை', englishName: 'Madurai-style kari dosa', description: 'Layered dosa topped with spiced minced meat and egg.', pricePaise: 26000, vegetarian: false, station: 'Non-Vegetarian', prepSeconds: 720, allergens: 'Egg, Gluten' },
  { id: 'seed-menu-fish-fry', category: 'Non-Vegetarian', tamilName: 'மீன் வறுவல்', englishName: 'Fish fry', description: 'Fish marinated with spices and pan-fried.', pricePaise: 24000, vegetarian: false, station: 'Non-Vegetarian', prepSeconds: 600, allergens: 'Fish' },
  { id: 'seed-menu-fish-curry', category: 'Non-Vegetarian', tamilName: 'மீன் குழம்பு', englishName: 'Fish curry', description: 'Fish simmered in a tangy tamarind-based curry.', pricePaise: 26000, vegetarian: false, station: 'Non-Vegetarian', prepSeconds: 900, allergens: 'Fish' },
  { id: 'seed-menu-nattu-kozhi', category: 'Non-Vegetarian', tamilName: 'நாட்டுக்கோழி குழம்பு', englishName: 'Nattu kozhi curry', description: 'Country chicken curry with a robust spice base.', pricePaise: 30000, vegetarian: false, station: 'Non-Vegetarian', prepSeconds: 1080 },

  { id: 'seed-menu-parotta-salna', category: 'Evening & Dinner', tamilName: 'பரோட்டா சால்னா', englishName: 'Parotta with salna', description: 'Flaky layered parotta with spiced salna.', pricePaise: 9000, vegetarian: true, station: 'Tiffin', prepSeconds: 420, allergens: 'Gluten' },
  { id: 'seed-menu-kothu-parotta', category: 'Evening & Dinner', tamilName: 'கொத்து பரோட்டா', englishName: 'Kothu parotta', description: 'Chopped parotta tossed with vegetables, egg and salna.', pricePaise: 15000, vegetarian: false, station: 'Tiffin', prepSeconds: 600, allergens: 'Egg, Gluten' },
  { id: 'seed-menu-kal-dosa-kurma', category: 'Evening & Dinner', tamilName: 'குருமாவுடன் கல் தோசை', englishName: 'Kal dosa with kurma', description: 'Soft kal dosa served with vegetable kurma.', pricePaise: 10000, vegetarian: true, station: 'Tiffin', prepSeconds: 420, allergens: 'Coconut' },
  { id: 'seed-menu-chapati-kurma', category: 'Evening & Dinner', tamilName: 'சப்பாத்தி காய்கறி குருமா', englishName: 'Chapati with vegetable kurma', description: 'Whole-wheat chapatis with vegetable kurma.', pricePaise: 10000, vegetarian: true, station: 'Tiffin', prepSeconds: 480, allergens: 'Gluten, Coconut' },
  { id: 'seed-menu-egg-dosa', category: 'Evening & Dinner', tamilName: 'முட்டை தோசை', englishName: 'Egg dosa', description: 'Dosa topped with egg and a light spice mix.', pricePaise: 9000, vegetarian: false, station: 'Tiffin', prepSeconds: 420, allergens: 'Egg' },
  { id: 'seed-menu-chicken-kothu', category: 'Evening & Dinner', tamilName: 'சிக்கன் கொத்து பரோட்டா', englishName: 'Chicken kothu parotta', description: 'Chopped parotta tossed with chicken, egg and salna.', pricePaise: 19000, vegetarian: false, station: 'Non-Vegetarian', prepSeconds: 660, allergens: 'Egg, Gluten' },

  { id: 'seed-menu-filter-coffee', category: 'Beverages & Desserts', tamilName: 'ஃபில்டர் காபி', englishName: 'Filter coffee', description: 'South Indian filter coffee served with milk.', pricePaise: 3500, vegetarian: true, station: 'Beverage', prepSeconds: 120, allergens: 'Dairy' },
  { id: 'seed-menu-sukku-coffee', category: 'Beverages & Desserts', tamilName: 'சுக்கு காபி', englishName: 'Sukku coffee', description: 'Warming dry ginger and spice infusion.', pricePaise: 3000, vegetarian: true, station: 'Beverage', prepSeconds: 180 },
  { id: 'seed-menu-jigarthanda', category: 'Beverages & Desserts', tamilName: 'ஜிகர்தண்டா', englishName: 'Jigarthanda', description: 'Chilled Madurai-style milk drink with a cooling, creamy topping.', pricePaise: 9000, vegetarian: true, station: 'Beverage', prepSeconds: 180, allergens: 'Dairy' },
  { id: 'seed-menu-rose-milk', category: 'Beverages & Desserts', tamilName: 'ரோஸ் மில்க்', englishName: 'Rose milk', description: 'Chilled milk flavored with rose syrup.', pricePaise: 6000, vegetarian: true, station: 'Beverage', prepSeconds: 90, allergens: 'Dairy' },
  { id: 'seed-menu-badam-milk', category: 'Beverages & Desserts', tamilName: 'பாதாம் பால்', englishName: 'Badam milk', description: 'Milk flavored with almond and cardamom.', pricePaise: 8000, vegetarian: true, station: 'Beverage', prepSeconds: 180, allergens: 'Dairy, Tree nuts' },
  { id: 'seed-menu-payasam', category: 'Beverages & Desserts', tamilName: 'பாயாசம்', englishName: 'Payasam', description: 'Traditional sweet pudding with milk, grains and cardamom.', pricePaise: 7000, vegetarian: true, station: 'Beverage', prepSeconds: 180, allergens: 'Dairy' },
  { id: 'seed-menu-kesari', category: 'Beverages & Desserts', tamilName: 'கேசரி', englishName: 'Kesari', description: 'Semolina sweet with ghee, cardamom and a touch of saffron.', pricePaise: 6500, vegetarian: true, station: 'Beverage', prepSeconds: 180, allergens: 'Dairy, Gluten' },
] as const;

async function main() {
  await Promise.all(employees.map((employee) => prisma.employee.upsert({
    where: { employeeNo: employee.employeeNo },
    update: employee,
    create: employee,
  })));

  await Promise.all(tables.map((tableNo) => prisma.diningTable.upsert({
    where: { tableNo },
    update: {},
    create: { tableNo, capacity: 4 },
  })));

  await prisma.simulationSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  await Promise.all(vesselInventory.map((vessel) => prisma.vesselType.upsert({
    where: { name: vessel.name },
    update: {},
    create: vessel,
  })));

  const categoryRows = await Promise.all(categories.map(([name, sortOrder]) => prisma.menuCategory.upsert({
    where: { name },
    update: { sortOrder },
    create: { name, sortOrder },
  })));
  const categoryIds = new Map(categoryRows.map((category) => [category.name, category.id]));

  await Promise.all(dishes.map(({ id, category, ...data }) => {
    const categoryId = categoryIds.get(category);
    if (!categoryId) throw new Error(`Seed category is missing: ${category}`);
    return prisma.menuItem.upsert({
      where: { id },
      update: { ...data, categoryId },
      create: { id, ...data, categoryId },
    });
  }));

  const ingredientRows = await Promise.all(ingredientInventory.map(async (item) => {
    const ingredient = await prisma.ingredient.upsert({
      where: { name: item.name },
      update: { unit: item.unit, lowStockAt: item.lowStockAt },
      create: { name: item.name, unit: item.unit, lowStockAt: item.lowStockAt },
    });
    await prisma.ingredientStock.upsert({
      where: { ingredientId: ingredient.id },
      update: {},
      create: { ingredientId: ingredient.id, quantity: item.initial, updatedAt: new Date() },
    });
    return ingredient;
  }));
  const ingredientIds = new Map(ingredientRows.map((item) => [item.name, item.id]));
  const sampleRecipes = [
    { menuItemId: 'seed-menu-idli', yieldQty: 4, ingredients: [['Idli rice', 0.3], ['Urad dal', 0.075], ['Salt', 0.004]] },
    { menuItemId: 'seed-menu-masala-dosa', yieldQty: 1, ingredients: [['Dosa batter', 0.18], ['Cooking oil', 0.01], ['Salt', 0.002]] },
    { menuItemId: 'seed-menu-filter-coffee', yieldQty: 1, ingredients: [['Coffee decoction', 0.018], ['Milk', 0.08]] },
  ] as const;
  for (const sample of sampleRecipes) {
    const recipe = await prisma.recipe.upsert({
      where: { menuItemId: sample.menuItemId },
      update: { yieldQty: sample.yieldQty },
      create: { menuItemId: sample.menuItemId, yieldQty: sample.yieldQty },
    });
    for (const [name, quantity] of sample.ingredients) {
      const ingredientId = ingredientIds.get(name);
      if (!ingredientId) throw new Error(`Seed ingredient is missing: ${name}`);
      await prisma.recipeIngredient.upsert({
        where: { recipeId_ingredientId: { recipeId: recipe.id, ingredientId } },
        update: { quantity },
        create: { recipeId: recipe.id, ingredientId, quantity },
      });
    }
  }

  console.log(`Seeded ${employees.length} employees, ${tables.length} tables, ${dishes.length} menu items and ${sampleRecipes.length} sample recipes.`);
}

main()
  .catch((error: unknown) => {
    console.error('Database seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
