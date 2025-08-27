import { z } from 'zod';
import { Agent, run, tool } from '@openai/agents';

// Mock inventory data for menu generation
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

// Tool for generating customer menus
const generateCustomerMenuTool = tool({
  name: 'generate_customer_menu',
  description:
    'Generate formatted menus for different customer segments with proper filtering',
  parameters: z.object({
    customerType: z.enum(['retail', 'bulk', 'wholesale', 'distributor']),
    minPrice: z.number().optional(),
    maxPrice: z.number().optional(),
    includeOutOfStock: z.boolean().default(false),
    format: z.enum(['text', 'html', 'markdown']).default('text'),
  }),
  execute: async (input: any) => {
    let filteredProducts = input.includeOutOfStock
      ? mockInventory
      : mockInventory.filter((product: any) => product.quantity > 0);

    // Apply price filtering based on customer type
    if (input.customerType === 'bulk' || input.customerType === 'wholesale') {
      filteredProducts = filteredProducts.filter(
        (product: any) => product.price >= 30,
      );
    }

    if (input.minPrice) {
      filteredProducts = filteredProducts.filter(
        (product: any) => product.price >= input.minPrice,
      );
    }

    if (input.maxPrice) {
      filteredProducts = filteredProducts.filter(
        (product: any) => product.price <= input.maxPrice,
      );
    }

    // Sort by tier hierarchy and price
    const tierOrder: Record<string, number> = {
      'TOP SHELF': 1,
      'AAA INDOOR': 2,
      'AA INDOOR': 3,
      'CLASSIC RESERVE': 4,
    };

    filteredProducts.sort((a: any, b: any) => {
      const tierA = tierOrder[a.tier] || 999;
      const tierB = tierOrder[b.tier] || 999;
      if (tierA !== tierB) return tierA - tierB;
      return b.price - a.price;
    });

    // Group by tier
    const menuSections: Record<string, any[]> = {};
    filteredProducts.forEach((product: any) => {
      if (!menuSections[product.tier]) {
        menuSections[product.tier] = [];
      }
      menuSections[product.tier].push({
        name: product.name,
        weight: product.weight,
        price: product.price,
        thca: product.thca,
        strainType: product.strainType,
        quantity: product.quantity,
      });
    });

    // Generate formatted output
    let output = '';
    if (input.format === 'html') {
      output = generateHTMLMenu(menuSections, input.customerType);
    } else if (input.format === 'markdown') {
      output = generateMarkdownMenu(menuSections, input.customerType);
    } else {
      output = generateTextMenu(menuSections, input.customerType);
    }

    return {
      customerType: input.customerType,
      totalProducts: filteredProducts.length,
      menuSections,
      formattedMenu: output,
      generatedAt: new Date().toISOString(),
    };
  },
});

// Tool for SEO-optimized product descriptions
const generateSEODescriptionTool = tool({
  name: 'generate_seo_description',
  description:
    'Generate SEO-optimized product descriptions with keywords and marketing copy',
  parameters: z.object({
    productName: z.string(),
    tier: z.string(),
    thca: z.number(),
    strainType: z.string(),
    weight: z.string(),
    targetAudience: z.enum(['retail', 'bulk', 'wholesale']).default('retail'),
  }),
  execute: async (input: any) => {
    const baseKeywords = [
      'cannabis flower',
      'THCa flower',
      input.strainType.toLowerCase(),
      input.tier.toLowerCase().replace(' ', '-'),
      input.weight,
      'premium cannabis',
    ];

    const seoTitle = `${input.productName} ${input.tier} ${input.strainType} Flower ${input.weight} - ${input.thca}% THCa`;

    const description = `Premium ${input.productName} ${input.tier} ${input.strainType} flower featuring ${input.thca}% THCa content. Grown using sustainable indoor methods, this ${input.weight} package offers exceptional quality and potency. Perfect for ${input.targetAudience === 'retail' ? 'personal use' : 'commercial distribution'}.`;

    const keywords = [
      ...baseKeywords,
      input.productName.toLowerCase().replace(' ', '-'),
    ];

    return {
      productName: input.productName,
      seoTitle,
      metaDescription: description,
      keywords: keywords.join(', '),
      socialMediaCaption: `🌿 ${input.productName} - ${input.thca}% THCa ${input.strainType} Flower\n${input.tier} • ${input.weight} • Premium Quality\n#Cannabis #${input.strainType} #THCa`,
      marketingPoints: [
        `${input.thca}% THCa content`,
        `${input.tier} quality tier`,
        `${input.strainType} strain`,
        `Available in ${input.weight} packages`,
      ],
    };
  },
});

// Helper functions for menu formatting
function generateTextMenu(
  sections: Record<string, any[]>,
  customerType: string,
): string {
  let menu = `📋 ${customerType.toUpperCase()} MENU\n`;
  menu += '='.repeat(50) + '\n\n';

  Object.entries(sections).forEach(([tier, products]) => {
    menu += `🌟 ${tier}\n`;
    menu += '─'.repeat(tier.length + 3) + '\n';

    products.forEach((product: any) => {
      menu += `• ${product.name} (${product.weight})\n`;
      menu += `  $${product.price} • ${product.thca}% THCa • ${product.strainType}\n`;
      menu += `  Stock: ${product.quantity} units\n\n`;
    });
  });

  menu += `Generated: ${new Date().toLocaleDateString()}\n`;
  return menu;
}

function generateHTMLMenu(
  sections: Record<string, any[]>,
  customerType: string,
): string {
  let menu = `<!DOCTYPE html>
<html>
<head>
    <title>${customerType} Menu - Gold Standard Cannabis</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .tier { background: #f0f0f0; padding: 10px; margin: 20px 0; border-radius: 5px; }
        .product { margin: 10px 0; padding: 10px; border-left: 3px solid #4CAF50; }
        .price { color: #4CAF50; font-weight: bold; }
        .thca { color: #2196F3; }
    </style>
</head>
<body>
    <h1>${customerType} Menu</h1>
    <p>Generated: ${new Date().toLocaleDateString()}</p>`;

  Object.entries(sections).forEach(([tier, products]) => {
    menu += `<div class="tier"><h2>${tier}</h2>`;
    products.forEach((product: any) => {
      menu += `<div class="product">
        <h3>${product.name} (${product.weight})</h3>
        <p class="price">$${product.price}</p>
        <p class="thca">${product.thca}% THCa • ${product.strainType}</p>
        <p>Stock: ${product.quantity} units</p>
      </div>`;
    });
    menu += '</div>';
  });

  menu += '</body></html>';
  return menu;
}

function generateMarkdownMenu(
  sections: Record<string, any[]>,
  customerType: string,
): string {
  let menu = `# ${customerType} Menu\n\n`;
  menu += `*Generated: ${new Date().toLocaleDateString()}*\n\n`;

  Object.entries(sections).forEach(([tier, products]) => {
    menu += `## 🌟 ${tier}\n\n`;
    products.forEach((product: any) => {
      menu += `### ${product.name} (${product.weight})\n`;
      menu += `- **Price:** $${product.price}\n`;
      menu += `- **THCa:** ${product.thca}%\n`;
      menu += `- **Type:** ${product.strainType}\n`;
      menu += `- **Stock:** ${product.quantity} units\n\n`;
    });
  });

  return menu;
}

// Menu Generator Agent
const menuGeneratorAgent = new Agent({
  name: 'Menu Generator Specialist',
  instructions: `You are a menu generation expert specializing in cannabis product catalogs. Your expertise includes:

1. **Customer Segmentation**
   - Retail customers: Individual packages ($20-50 range)
   - Bulk customers: Larger quantities ($30+ range)
   - Wholesale customers: Business/distribution pricing
   - Distributor customers: Volume pricing with discounts

2. **Menu Formatting**
   - Tier-based organization (highest to lowest quality)
   - Price sorting within tiers (highest to lowest)
   - Clear product information (name, weight, price, THCA, strain type)
   - Stock status and availability
   - Professional presentation

3. **Content Optimization**
   - SEO-optimized titles and descriptions
   - Compelling marketing copy
   - Social media captions
   - Product photography recommendations

4. **Compliance & Standards**
   - Accurate THCA percentages only
   - Proper strain type classification
   - Weight standardization
   - Age verification notices

Always provide:
- Properly formatted menus in requested format
- Clear section headers and organization
- Accurate pricing and product information
- Professional presentation suitable for business use

Format responses with clear sections and actionable information.`,
  tools: [generateCustomerMenuTool, generateSEODescriptionTool],
});

async function main() {
  console.log('📋 Gold Standard Cannabis - Menu Generator');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // Example: Generate bulk customer menu
  const bulkMenuResult = await run(
    menuGeneratorAgent,
    'Generate a bulk customer menu for products over $30 in text format',
  );
  console.log(bulkMenuResult.finalOutput);
  console.log('');

  // Example: Generate SEO description
  const seoResult = await run(
    menuGeneratorAgent,
    'Generate SEO-optimized description for Ice Cream Cake - Top Shelf tier, 28.5% THCA, Hybrid strain, 3.5g weight, targeting retail customers',
  );
  console.log(seoResult.finalOutput);
}

if (require.main === module) {
  main().catch(console.error);
}
