// utils.js
const { PRODUCT_VARIANTS, PRICE_KEYWORDS, PRICE_PATTERNS } = require('./config');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function hasRelevantKeywords(title) {
  const lowerTitle = title.toLowerCase();
  return PRICE_KEYWORDS.some(keyword => lowerTitle.includes(keyword.toLowerCase()));
}

function findCommodityMatches(text, commoditiesList) {
  const textLower = text.toLowerCase();
  const matches = [];
  
  // Get commodities from the passed list
  const commoditiesToFind = commoditiesList 
    ? commoditiesList.split(',').map(c => c.trim())
    : [];
  
  for (const commodity of commoditiesToFind) {
    const variants = PRODUCT_VARIANTS[commodity] || [commodity.toLowerCase()];
    
    for (const variant of variants) {
      if (textLower.includes(variant)) {
        matches.push(commodity);
        break; // Found this commodity, move to next
      }
    }
  }
  
  return [...new Set(matches)]; // Remove duplicates
}

function extractPricesForCommodity(text, commodity) {
  const prices = [];
  const seen = new Set();
  
  // Find all prices in text
  for (const pattern of PRICE_PATTERNS) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      const price = match[0].trim();
      if (!seen.has(price)) {
        seen.add(price);
        
        // Check if this price is near the commodity mention (within ~100 words)
        const priceIndex = text.indexOf(match[0]);
        const contextStart = Math.max(0, priceIndex - 500);
        const contextEnd = Math.min(text.length, priceIndex + 500);
        const context = text.substring(contextStart, contextEnd).toLowerCase();
        
        // Check if commodity is mentioned in context
        const variants = PRODUCT_VARIANTS[commodity] || [commodity.toLowerCase()];
        const isRelevant = variants.some(variant => context.includes(variant));
        
        if (isRelevant) {
          prices.push({
            price: price,
            priceType: determinePriceType(context)
          });
        }
      }
    }
  }
  
  return prices;
}

function determinePriceType(context) {
  const contextLower = context.toLowerCase();
  if (contextLower.includes('wholesale') || contextLower.includes('পাইকারি')) {
    return 'Wholesale';
  }
  return 'Retail'; // Default to retail
}

module.exports = {
  delay,
  hasRelevantKeywords,
  findCommodityMatches,
  extractPricesForCommodity,
  determinePriceType
};