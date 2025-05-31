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

function determinePriceType(context) {
  const contextLower = context.toLowerCase();
  
  // Check for wholesale indicators
  if (/wholesale|bulk|পাইকারি/i.test(contextLower)) {
    return 'Wholesale';
  }
  
  // Check for retail indicators
  if (/retail|market|shop|store|bazaar|kitchen market/i.test(contextLower)) {
    return 'Retail';
  }
  
  return 'Retail'; // Default to retail
}

function extractPricesForCommodity(text, commodity) {
  const prices = [];
  const seen = new Set();
  
  // Get variants for this commodity
  const variants = PRODUCT_VARIANTS[commodity] || [commodity.toLowerCase()];
  
  // We'll use sentences to better isolate mentions
  const sentences = text.split(/(?<=[.!?])\s+/);
  
  for (const sentence of sentences) {
    // Check if this sentence mentions our commodity
    let hasCommodity = false;
    let matchedVariant = '';
    
    for (const variant of variants) {
      // Use word boundary to avoid partial matches (e.g., "eggs" vs "each")
      const regex = new RegExp(`\\b${variant}\\b`, 'i');
      if (regex.test(sentence)) {
        hasCommodity = true;
        matchedVariant = variant;
        break;
      }
    }
    
    // Skip sentences without our commodity
    if (!hasCommodity) continue;
    
    // Look for price patterns in this sentence
    for (const pattern of PRICE_PATTERNS) {
      const matches = [...sentence.matchAll(pattern)];
      
      for (const match of matches) {
        // The full match contains context like "sold for" - we want the captured group
        const priceText = match[1] ? match[1].trim() : match[0].trim();
        
        // Skip if it's an increase pattern
        if (/increased by|rose by|up by|higher by/i.test(sentence) && 
            sentence.indexOf(priceText) > sentence.indexOf('by')) {
          continue;
        }
        
        // Create a normalized version for deduplication
        const normalizedPrice = priceText.replace(/\s+/g, ' ').toLowerCase();
        
        // Skip if we've seen this exact price before
        if (!seen.has(normalizedPrice)) {
          seen.add(normalizedPrice);
          
          prices.push({
            price: priceText,
            priceType: determinePriceType(sentence),
            context: sentence.trim(),
            commodity: commodity,
            variant: matchedVariant
          });
        }
      }
    }
  }
  
  // If we didn't find prices in sentences with direct commodity mentions,
  // try a more relaxed approach for nearby sentences
  if (prices.length === 0) {
    // Find sentence indices that have commodity mentions
    const commoditySentenceIndices = [];
    
    for (let i = 0; i < sentences.length; i++) {
      for (const variant of variants) {
        const regex = new RegExp(`\\b${variant}\\b`, 'i');
        if (regex.test(sentences[i])) {
          commoditySentenceIndices.push(i);
          break;
        }
      }
    }
    
    // Check adjacent sentences for prices
    for (const idx of commoditySentenceIndices) {
      // Check the sentence before and after
      for (let i = Math.max(0, idx-1); i <= Math.min(sentences.length-1, idx+1); i++) {
        if (i === idx) continue; // Already checked this one
        
        const sentence = sentences[i];
        
        // Skip sentences that mention other commodities to avoid confusion
        let hasOtherCommodity = false;
        for (const otherCommodity in PRODUCT_VARIANTS) {
          if (otherCommodity === commodity) continue;
          
          const otherVariants = PRODUCT_VARIANTS[otherCommodity];
          for (const variant of otherVariants) {
            const regex = new RegExp(`\\b${variant}\\b`, 'i');
            if (regex.test(sentence)) {
              hasOtherCommodity = true;
              break;
            }
          }
          if (hasOtherCommodity) break;
        }
        
        if (hasOtherCommodity) continue;
        
        // Look for price patterns
        for (const pattern of PRICE_PATTERNS) {
          const matches = [...sentence.matchAll(pattern)];
          
          for (const match of matches) {
            const priceText = match[1] ? match[1].trim() : match[0].trim();
            
            // Skip if it's an increase pattern
            if (/increased by|rose by|up by|higher by/i.test(sentence) && 
                sentence.indexOf(priceText) > sentence.indexOf('by')) {
              continue;
            }
            
            // Create a normalized version for deduplication
            const normalizedPrice = priceText.replace(/\s+/g, ' ').toLowerCase();
            
            // Skip if we've seen this exact price before
            if (!seen.has(normalizedPrice)) {
              seen.add(normalizedPrice);
              
              prices.push({
                price: priceText,
                priceType: determinePriceType(sentence),
                context: sentence.trim(),
                commodity: commodity,
                variant: `[Nearby] ${commodity}`,
                confidence: 'medium'
              });
            }
          }
        }
      }
    }
  }
  
  return prices;
}

module.exports = {
  delay,
  hasRelevantKeywords,
  findCommodityMatches,
  extractPricesForCommodity,
  determinePriceType
};