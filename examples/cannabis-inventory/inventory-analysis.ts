import { z } from 'zod';
import { Agent, run, tool } from '@openai/agents';

// Mock inventory data - in a real implementation, this would come from Shopify API
const mockInventory = [
  {
    id: '1',
    name: 'Ice Cream Cake',
    tier: 'TOP SHELF',
    category: 'Flower',
    weight: '3.5g',
    price: 45.0,
    quantity: 88,
    thca: 28.5,
    strainType: 'Hybrid',
    status: 'In Stock',
  },
  {
    id: '2',
    name: 'Gelato Cake',
    tier: 'TOP SHELF',
    category: 'Flower',
    weight: '3.5g',
    price: 42.0,
    quantity: 62,
    thca: 26.8,
    strainType: 'Hybrid',
    status: 'In Stock',
  },
  {
    id: '3',
    name: 'Purple Punch',
    tier: 'TOP SHELF',
    category: 'Flower',
    weight: '3.5g',
    price: 40.0,
    quantity: 45,
    thca: 25.2,
    strainType: 'Indica',
    status: 'In Stock',
  },
  {
    id: '4',
    name: 'White Runtz',
    tier: 'AA INDOOR',
    category: 'Flower',
    weight: '3.5g',
    price: 35.0,
    quantity: 2,
    thca: 22.1,
    strainType: 'Hybrid',
    status: 'Low Stock',
  },
  {
    id: '5',
    name: 'Mimosa',
    tier: 'AA INDOOR',
    category: 'Flower',
    weight: '3.5g',
    price: 32.0,
    quantity: 0,
    thca: 23.5,
    strainType: 'Sativa',
    status: 'Out of Stock',
  },
  {
    id: '6',
    name: 'London Jelly',
    tier: 'CLASSIC RESERVE',
    category: 'Flower',
    weight: '3.5g',
    price: 28.0,
    quantity: 15,
    thca: 21.8,
    strainType: 'Hybrid',
    status: 'In Stock',
  },
];

// Tool for detailed inventory analysis
const detailedInventoryAnalysisTool = tool({
  name: 'detailed_inventory_analysis',
  description:
    'Perform detailed analysis of inventory including stock levels, turnover rates, and recommendations',
  parameters: z.object({
    tier: z.string().optional(),
    includeOutOfStock: z.boolean().default(false),
    calculateTurnover: z.boolean().default(true),
  }),
  execute: async (input: any) => {
    let filteredInventory = input.includeOutOfStock
      ? mockInventory
      : mockInventory.filter((item) => item.quantity > 0);

    if (input.tier) {
      filteredInventory = filteredInventory.filter(
        (item) => item.tier === input.tier,
      );
    }

    // Calculate inventory metrics
    const totalValue = filteredInventory.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const averagePrice =
      filteredInventory.length > 0 ? totalValue / filteredInventory.length : 0;

    // Mock turnover calculation (in real implementation, this would use sales data)
    const turnoverRates = filteredInventory.map((item) => ({
      ...item,
      turnoverRate:
        item.quantity > 0 ? (Math.random() * 2 + 0.5).toFixed(2) : '0.00', // Mock data
    }));

    // Identify issues
    const lowStockItems = filteredInventory.filter(
      (item) => item.quantity > 0 && item.quantity <= 10,
    );
    const highValueItems = filteredInventory.filter(
      (item) => item.price * item.quantity > 1000,
    );
    const slowMovingItems = turnoverRates.filter(
      (item) => parseFloat(item.turnoverRate) < 0.8,
    );

    return {
      summary: {
        totalProducts: filteredInventory.length,
        totalValue: totalValue.toFixed(2),
        averagePrice: averagePrice.toFixed(2),
        lowStockCount: lowStockItems.length,
        highValueCount: highValueItems.length,
      },
      alerts: [
        lowStockItems.length > 0
          ? `${lowStockItems.length} items are low stock (≤10 units)`
          : null,
        slowMovingItems.length > 0
          ? `${slowMovingItems.length} items have slow turnover (<0.8)`
          : null,
        `Total inventory value: $${totalValue.toFixed(2)}`,
      ].filter(Boolean),
      topPerformers: turnoverRates
        .sort((a, b) => parseFloat(b.turnoverRate) - parseFloat(a.turnoverRate))
        .slice(0, 3),
      recommendations: [
        'Restock low-stock items within 24 hours',
        'Consider promotional pricing for slow-moving inventory',
        'Monitor high-value items for security',
        'Review pricing strategy for underperforming products',
      ],
    };
  },
});

// Tool for weight conversion calculations
const weightConversionTool = tool({
  name: 'weight_conversion',
  description: 'Convert between different cannabis weight measurements',
  parameters: z.object({
    fromWeight: z.number(),
    fromUnit: z.enum(['g', 'oz', 'lb', 'kg']),
    toUnit: z.enum(['g', 'oz', 'lb', 'kg']),
    bulkPricing: z.boolean().default(false),
  }),
  execute: async (input: any) => {
    // Conversion factors to grams
    const toGrams: Record<string, number> = {
      g: 1,
      oz: 28.3495,
      lb: 453.592,
      kg: 1000,
    };

    // Convert to grams first
    const grams = input.fromWeight * toGrams[input.fromUnit];

    // Convert to target unit
    const result = grams / toGrams[input.toUnit];

    // Bulk pricing tiers
    let bulkDiscount = 0;
    if (input.bulkPricing && input.toUnit === 'lb') {
      if (result >= 100)
        bulkDiscount = 15; // Master 2 tier
      else if (result >= 50)
        bulkDiscount = 10; // Master tier
      else if (result >= 25) bulkDiscount = 5; // Distro tier
    }

    return {
      original: `${input.fromWeight} ${input.fromUnit}`,
      converted: `${result.toFixed(2)} ${input.toUnit}`,
      bulkDiscount: bulkDiscount > 0 ? `${bulkDiscount}%` : 'None',
      breakdown: {
        eighths: Math.floor(result / 3.5),
        quarters: Math.floor(result / 7),
        halfOunces: Math.floor(result / 14),
        ounces: Math.floor(result / 28),
        remaining: (result % 28).toFixed(2),
      },
    };
  },
});

// Inventory Analysis Agent
const inventoryAnalysisAgent = new Agent({
  name: 'Inventory Analysis Specialist',
  instructions: `You are an expert inventory analyst specializing in cannabis products. Your role is to:

1. Analyze inventory levels across all tiers and categories
2. Identify stock issues (low stock, out of stock, overstock)
3. Calculate inventory turnover rates and holding costs
4. Provide actionable recommendations for inventory optimization
5. Track product performance by tier and category
6. Monitor seasonal trends and demand patterns

Always provide:
- Clear inventory status summaries
- Specific recommendations with timelines
- Financial impact analysis where relevant
- Alternative solutions when applicable

Use the detailed inventory analysis format and be specific about quantities, values, and timeframes.`,
  tools: [detailedInventoryAnalysisTool, weightConversionTool],
});

async function main() {
  console.log('📊 Gold Standard Cannabis - Inventory Analysis');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // Example: Comprehensive inventory analysis
  const analysisResult = await run(
    inventoryAnalysisAgent,
    'Perform a comprehensive inventory analysis for all tiers, including turnover calculations and specific recommendations for restocking',
  );
  console.log(analysisResult.finalOutput);
  console.log('');

  // Example: Weight conversion for bulk orders
  const conversionResult = await run(
    inventoryAnalysisAgent,
    'Convert 25 pounds of flower to grams and show breakdown by common sale units (eighths, quarters, half ounces, ounces) with bulk pricing discount',
  );
  console.log(conversionResult.finalOutput);
}

if (require.main === module) {
  main().catch(console.error);
}
