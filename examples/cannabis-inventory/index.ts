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
  {
    id: '7',
    name: 'THCa Bulk Flower - Premium',
    tier: 'TOP SHELF',
    category: 'Flower',
    weight: '1lb',
    price: 850.0,
    quantity: 12,
    thca: 28.5,
    strainType: 'Hybrid',
    status: 'In Stock',
  },
  {
    id: '8',
    name: 'THCa Bulk Flower - Mediums',
    tier: 'AA INDOOR',
    category: 'Flower',
    weight: '1lb',
    price: 650.0,
    quantity: 8,
    thca: 24.2,
    strainType: 'Hybrid',
    status: 'In Stock',
  },
];

// Tool for analyzing current inventory status
const analyzeInventoryTool = tool({
  name: 'analyze_inventory',
  description:
    'Analyze current inventory status across all tiers and categories',
  parameters: z.object({
    tier: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    minQuantity: z.number().nullable().optional(),
  }),
  execute: async (input) => {
    let filteredInventory = mockInventory;

    if (input.tier) {
      filteredInventory = filteredInventory.filter(
        (item) => item.tier === input.tier,
      );
    }

    if (input.category) {
      filteredInventory = filteredInventory.filter(
        (item) => item.category === input.category,
      );
    }

    if (input.minQuantity !== undefined) {
      filteredInventory = filteredInventory.filter(
        (item) => item.quantity >= input.minQuantity,
      );
    }

    const totalProducts = filteredInventory.length;
    const inStock = filteredInventory.filter(
      (item) => item.quantity > 0,
    ).length;
    const lowStock = filteredInventory.filter(
      (item) => item.quantity > 0 && item.quantity <= 10,
    ).length;
    const outOfStock = filteredInventory.filter(
      (item) => item.quantity === 0,
    ).length;

    const totalValue = filteredInventory.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    return {
      summary: {
        totalProducts,
        inStock,
        lowStock,
        outOfStock,
        totalValue: totalValue.toFixed(2),
      },
      items: filteredInventory,
      recommendations: [
        lowStock > 0 ? `Restock ${lowStock} low-stock items immediately` : null,
        outOfStock > 0 ? `Reorder ${outOfStock} out-of-stock products` : null,
        `Total inventory value: $${totalValue.toFixed(2)}`,
      ].filter(Boolean),
    };
  },
});

// Tool for pricing optimization
const optimizePricingTool = tool({
  name: 'optimize_pricing',
  description: 'Analyze and optimize pricing for products',
  parameters: z.object({
    productId: z.string(),
    currentPrice: z.number(),
    tier: z.string(),
    category: z.string(),
  }),
  execute: async (input) => {
    const product = mockInventory.find((item) => item.id === input.productId);

    if (!product) {
      return { error: 'Product not found' };
    }

    // Simple pricing analysis based on tier and THCA content
    let suggestedPrice = input.currentPrice;
    let rationale = '';

    if (input.tier === 'TOP SHELF' && product.thca > 25) {
      suggestedPrice = Math.max(suggestedPrice, 45);
      rationale =
        'Top Shelf products with high THCA (>25%) should maintain premium pricing';
    } else if (input.tier === 'AA INDOOR' && product.thca < 25) {
      suggestedPrice = Math.min(suggestedPrice, 35);
      rationale =
        'AA Indoor products with lower THCA should be competitively priced';
    }

    const priceDifference = (
      ((suggestedPrice - input.currentPrice) / input.currentPrice) *
      100
    ).toFixed(1);

    return {
      productName: product.name,
      currentPrice: input.currentPrice,
      suggestedPrice,
      priceChange: `${priceDifference}%`,
      rationale,
      tier: input.tier,
      thca: product.thca,
    };
  },
});

// Tool for generating customer menus
const generateMenuTool = tool({
  name: 'generate_menu',
  description: 'Generate formatted menus for different customer segments',
  parameters: z.object({
    customerType: z.enum(['retail', 'bulk', 'wholesale']),
    minPrice: z.number().nullable().optional(),
    tier: z.string().nullable().optional(),
  }),
  execute: async (input) => {
    let filteredProducts = mockInventory.filter((item) => item.quantity > 0);

    if (input.minPrice) {
      filteredProducts = filteredProducts.filter(
        (item) => item.price >= input.minPrice,
      );
    }

    if (input.tier) {
      filteredProducts = filteredProducts.filter(
        (item) => item.tier === input.tier,
      );
    }

    // Sort by tier hierarchy and price
    const tierOrder = [
      'TOP SHELF',
      'AAA INDOOR',
      'AA INDOOR',
      'CLASSIC RESERVE',
    ];
    filteredProducts.sort((a, b) => {
      const tierA = tierOrder.indexOf(a.tier);
      const tierB = tierOrder.indexOf(b.tier);
      if (tierA !== tierB) return tierA - tierB;
      return b.price - a.price;
    });

    const menuSections = {};
    filteredProducts.forEach((product) => {
      if (!menuSections[product.tier]) {
        menuSections[product.tier] = [];
      }
      menuSections[product.tier].push({
        name: product.name,
        weight: product.weight,
        price: product.price,
        thca: product.thca,
        strainType: product.strainType,
      });
    });

    return {
      customerType: input.customerType,
      generatedAt: new Date().toISOString(),
      sections: menuSections,
      totalProducts: filteredProducts.length,
    };
  },
});

// Tool for sales forecasting
const forecastSalesTool = tool({
  name: 'forecast_sales',
  description: 'Generate sales forecasts based on historical data and trends',
  parameters: z.object({
    productId: z.string().nullable().optional(),
    days: z.number().default(30),
    includeSeasonal: z.boolean().default(true),
  }),
  execute: async (input) => {
    const product = input.productId
      ? mockInventory.find((item) => item.id === input.productId)
      : null;

    // Mock forecasting logic
    const baseForecast = product ? product.quantity * 0.1 : 100; // 10% of current stock
    const seasonalMultiplier = input.includeSeasonal ? 1.2 : 1.0;
    const forecastedSales = Math.round(
      baseForecast * seasonalMultiplier * (input.days / 30),
    );

    const confidence = product
      ? Math.min(85, 50 + (product.quantity / 10) * 5)
      : 70;

    return {
      productName: product?.name || 'All Products',
      forecastPeriod: `${input.days} days`,
      forecastedUnits: forecastedSales,
      confidence: `${confidence}%`,
      assumptions: [
        'Based on current inventory levels',
        'Historical sales patterns',
        input.includeSeasonal
          ? 'Seasonal trends included'
          : 'Seasonal trends excluded',
        'Market conditions assumed stable',
      ],
      recommendations: [
        forecastedSales > 50
          ? 'Consider increasing inventory'
          : 'Monitor inventory closely',
        'Track actual sales vs forecast weekly',
      ],
    };
  },
});

// Main Gold Standard Cannabis Inventory Assistant Agent
const inventoryAgent = new Agent({
  name: 'Gold Standard Cannabis Inventory Assistant',
  instructions: `You are the Gold Standard Cannabis Inventory Assistant, an expert AI specialized in wholesale cannabis inventory management, distribution operations, and compliance.

Your primary capabilities include:
- Track and analyze cannabis product inventory across multiple tiers (CLASSIC RESERVE, TOP SHELF, AA INDOOR, AAA INDOOR, EXOTIC INDOOR)
- Monitor stock levels, suggest reorder points, and identify slow-moving inventory
- Manage product weights: 1g, 3.5g (eighths), 7g (quarters), 14g (half ounces), 28g (ounces), 1lb (pounds)
- Handle bulk breakdown calculations and weight conversions
- Track quality variations: Premium (no suffix), Mediums (MEDIUMS suffix), Smalls (SMALLS suffix)
- Analyze pricing across different customer tiers
- Calculate bulk pricing discounts (Distro 25lbs+, Master 50lbs+, Master 2 100+)
- Detect pricing outliers and suggest corrections
- Manage fractional pound pricing (1/4 lb, 1/2 lb conversions)
- Track COA (Certificate of Analysis) requirements
- Monitor THCA percentages (only display real data from metafields or COA documents)
- Ensure proper labeling and documentation
- Track strain types (Indica, Sativa, Hybrid)
- Analyze sales by weight+tier combinations (e.g., "3.5g - Top Shelf")
- Generate revenue forecasts using historical data
- Identify trending products and seasonal patterns
- Calculate inventory turnover rates
- Create formatted menus for different customer segments
- Apply proper filtering (bulk menus filter $30+ items)
- Format with tier headers and proper sorting
- Generate HTML and spreadsheet-ready outputs
- Generate SEO-optimized product descriptions
- Create compelling titles and keywords
- Suggest marketing strategies for different product categories
- Analyze product media requirements (images, videos, COAs)

Communication Style:
- Use simple, everyday language - avoid technical jargon
- Be concise but thorough in explanations
- Always use "flower" not "flour" for cannabis products
- Provide actionable recommendations with clear next steps
- Format responses with clear headers and bullet points

Key Business Rules:
1. Weight Standardization: Convert all pound variations to "Pound" (e.g., "lb" → "Pound")
2. Pricing Integrity: Never suggest prices below tier minimums
3. Data Accuracy: Only use real THCA percentages, never synthetic values
4. Product Status: Draft products only, never auto-publish
5. Menu Filtering: Customer menus show only in-stock items (quantity > 0)
6. Bulk Products: THCa Bulk (1lb) excludes fractional weights and products under $250

When analyzing inventory, use this format:
📊 INVENTORY ANALYSIS
━━━━━━━━━━━━━━━━━━
Current Status:
• Total SKUs: [number]
• Low Stock Items: [count]
• Overstocked Items: [count]

Key Insights:
• [Insight 1]
• [Insight 2]
• [Insight 3]

Recommended Actions:
1. [Action with expected outcome]
2. [Action with expected outcome]
3. [Action with expected outcome]

When providing pricing recommendations, use this format:
💰 PRICING OPTIMIZATION
━━━━━━━━━━━━━━━━━━
Current Pricing:
• Tier: [tier name]
• Current Price: $[amount]
• Market Position: [analysis]

Recommendations:
• Suggested Price: $[amount]
• Expected Impact: [percentage increase/decrease]
• Rationale: [explanation]`,
  tools: [
    analyzeInventoryTool,
    optimizePricingTool,
    generateMenuTool,
    forecastSalesTool,
  ],
});

async function main() {
  console.log('🤖 Gold Standard Cannabis Inventory Assistant');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // Example 1: Inventory Analysis
  console.log('📊 Example 1: Inventory Analysis');
  console.log('─────────────────────────────────────────');
  const inventoryResult = await run(
    inventoryAgent,
    'Give me a complete inventory analysis for all Top Shelf products',
  );
  console.log(inventoryResult.finalOutput);
  console.log('');

  // Example 2: Pricing Optimization
  console.log('💰 Example 2: Pricing Optimization');
  console.log('─────────────────────────────────────────');
  const pricingResult = await run(
    inventoryAgent,
    'Analyze pricing for Ice Cream Cake (ID: 1) - current price $45, Top Shelf tier, Flower category',
  );
  console.log(pricingResult.finalOutput);
  console.log('');

  // Example 3: Menu Generation
  console.log('📋 Example 3: Menu Generation');
  console.log('─────────────────────────────────────────');
  const menuResult = await run(
    inventoryAgent,
    'Generate a bulk buyer menu for products over $30',
  );
  console.log(menuResult.finalOutput);
  console.log('');

  // Example 4: Sales Forecasting
  console.log('📈 Example 4: Sales Forecasting');
  console.log('─────────────────────────────────────────');
  const forecastResult = await run(
    inventoryAgent,
    'Forecast sales for the next 30 days including seasonal trends',
  );
  console.log(forecastResult.finalOutput);
}

if (require.main === module) {
  main().catch(console.error);
}
