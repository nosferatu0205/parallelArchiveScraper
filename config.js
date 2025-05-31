// config.js
const { program } = require('commander');
const { isMainThread } = require('worker_threads');

// Default options
let options = {
  start: '',
  end: '',
  workers: '4',
  commodities: 'Sugar,Rice,Broiler Chicken,Hilsa Fish,Pangas Fish,Potato,Onion,Soybean Oil,Palm Oil,Eggs,Green Chillies',
  debug: false,
  headless: true,
  retryAttempts: '3',
  pageTimeout: '30'
};

// Only parse CLI arguments in the main thread
if (isMainThread) {
  program
    .requiredOption('--start <date>', 'Start date YYYY-MM-DD')
    .requiredOption('--end <date>', 'End date YYYY-MM-DD')
    .option('--workers <number>', 'Number of parallel workers', '4')
    .option('--commodities <items>', 'Comma-separated list of commodities', 
      'Sugar,Rice,Broiler Chicken,Hilsa Fish,Pangas Fish,Potato,Onion,Soybean Oil,Palm Oil,Eggs,Green Chillies, Sonalika Chicken')
    .option('--debug', 'Enable debug logging')
    .option('--headless', 'Run in headless mode', true)
    .option('--retry-attempts <number>', 'Number of retry attempts for failed pages', '3')
    .option('--page-timeout <seconds>', 'Page load timeout in seconds', '30');

  program.parse();
  options = program.opts();
}

// Constants
const ARCHIVE_URL_BASE = 'https://www.newagebd.net/archive?date=';

// Product variants for flexible matching
const PRODUCT_VARIANTS = {
  'Sugar': ['sugar', 'refined sugar', 'white sugar', 'packaged sugar', 'চিনি'],
  'Rice': ['rice', 'chal', 'চাল', 'miniket', 'najirshail', 'coarse rice', 'fine rice'],
  'Broiler Chicken': ['broiler', 'chicken', 'murgi', 'মুরগি', 'farm chicken', 'poultry'],
  'Hilsa Fish': ['hilsa', 'ilish', 'ইলিশ', 'hilsha'],
  'Pangas Fish': ['pangas', 'পাঙ্গাস', 'pangash'],
  'Potato': ['potato', 'alu', 'আলু', 'potatoes'],
  'Onion': ['onion', 'peyaj', 'পেঁয়াজ', 'onions'],
  'Soybean Oil': ['soybean oil', 'soyabean oil', 'soya oil', 'সয়াবিন তেল'],
  'Palm Oil': ['palm oil', 'palm', 'পাম তেল'],
  'Eggs': ['egg', 'eggs', 'dim', 'ডিম', 'hali'],
  'Green Chillies': ['green chilli', 'green chillies', 'kacha morich', 'কাঁচা মরিচ', 'chilli', 'chillies'],
  'Garlic': ['garlic', 'roshun', 'রসুন'],
  'Ginger': ['ginger', 'ada', 'আদা'],
  'Tomato': ['tomato', 'tomatoes', 'টমেটো'],
  'Beef': ['beef', 'গরুর মাংস', 'cow meat'],
  'Mutton': ['mutton', 'খাসির মাংস', 'goat meat'],
  'Katla Fish': ['katla', 'কাতলা'],
  'Rohita Fish': ['rohita', 'rui', 'রুই'],
  'Tilapia Fish': ['tilapia', 'তেলাপিয়া'],
  'Lentils': ['lentils', 'dal', 'ডাল', 'mosur', 'মসুর'],
  'Milk': ['milk', 'dudh', 'দুধ'],
  'Aubergine': ['aubergine', 'brinjal', 'begun', 'বেগুন', 'eggplant'],
  'Papaya': ['papaya', 'pepe', 'পেঁপে'],
  'Bitter Gourd': ['bitter gourd', 'korola', 'করলা', 'uchche'],
  'Pointed Gourd': ['pointed gourd', 'potol', 'পটল'],
  'Okra': ['okra', 'bhindi', 'ঢেঁড়স', 'dherosh'],
  'String Beans': ['string beans', 'sheem', 'শিম', 'beans'],
  'Teasel Gourd': ['teasel gourd', 'kakrol', 'কাঁকরোল'],
  'Ridge Gourd': ['ridge gourd', 'jhinge', 'ঝিঙে'],
  'Snake Gourd': ['snake gourd', 'chichinga', 'চিচিঙ্গা'],
  'Sonalika Chicken': ['sonalika chicken', 'sonalika', 'সোনালী মুরগি', 'sonali chicken']
};

// Broader keywords for initial filtering
const PRICE_KEYWORDS = [
  'price', 'prices', 'Tk', 'taka', 'market', 'commodity', 'commodities',
  'rises', 'rise', 'falls', 'fall', 'increase', 'decrease', 'up', 'down',
  'wholesale', 'retail', 'essentials', 'kitchen', 'bazaar', 'bazar',
  'per kg', 'per kilogram', 'per litre', 'per hali', 'cost', 'rate',
  'টাকা', 'দাম', 'মূল্য', 'বাজার'
];

// Enhanced price patterns
// Enhanced and more specific price patterns
// Enhanced and more specific price patterns
const PRICE_PATTERNS = [
  // Sold for pattern - this is usually the most reliable indicator of a current price
  /sold\s+for\s+((?:Tk|TK|Taka|৳)\s*\d+[\d,.]*(?:\s*(?:-|–|to|থেকে)\s*\d+[\d,.]*)?\s*(?:per|a|an|each|\/|প্রতি)?\s*(?:kg|kilo|kilogram|কেজি|liter|litre|l|L|লিটার|piece|pcs|unit|hali|হালি|apiece|dozen))/ig,
  
  // Retail/price at pattern
  /(?:retail(?:ed|s)?|pric(?:e|ed|es)|cost(?:s|ed)?)\s+(?:at|for|of)\s+((?:Tk|TK|Taka|৳)\s*\d+[\d,.]*(?:\s*(?:-|–|to|থেকে)\s*\d+[\d,.]*)?\s*(?:per|a|an|each|\/|প্রতি)?\s*(?:kg|kilo|kilogram|কেজি|liter|litre|l|L|লিটার|piece|pcs|unit|hali|হালি|apiece|dozen))/ig,
  
  // At Tk pattern (common in price listings)
  /\bat\s+((?:Tk|TK|Taka|৳)\s*\d+[\d,.]*(?:\s*(?:-|–|to|থেকে)\s*\d+[\d,.]*)?\s*(?:per|a|an|each|\/|প্রতি)?\s*(?:kg|kilo|kilogram|কেজি|liter|litre|l|L|লিটার|piece|pcs|unit|hali|হালি|apiece|dozen))/ig,
  
  // Direct price with unit - be very specific to avoid matching increases
  /((?:Tk|TK|Taka|৳)\s*\d+[\d,.]*(?:\s*(?:-|–|to|থেকে)\s*\d+[\d,.]*)?\s*(?:per|a|an|each|\/|প্রতি)\s*(?:kg|kilo|kilogram|কেজি|liter|litre|l|L|লিটার|piece|pcs|unit|hali|হালি|apiece|dozen))/ig,
  
  // Avoid the generic price pattern as it causes too many false positives
];

module.exports = {
  options,
  ARCHIVE_URL_BASE,
  PRODUCT_VARIANTS,
  PRICE_KEYWORDS,
  PRICE_PATTERNS
};