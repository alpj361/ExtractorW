// Debug script for Guatemala Congress page
// URL: https://www.congreso.gob.gt/seccion_informacion_legislativa/iniciativas

const items = [];

try {
  console.log('🔍 Starting extraction for Guatemala Congress page...');
  console.log('📄 Page title:', document.title);
  console.log('🌐 Current URL:', window.location.href);

  // Let's check what elements exist on the page
  console.log('📊 Page structure analysis:');
  console.log('  - Total elements:', document.querySelectorAll('*').length);
  console.log('  - Links:', document.querySelectorAll('a').length);
  console.log('  - Tables:', document.querySelectorAll('table').length);
  console.log('  - Divs:', document.querySelectorAll('div').length);
  console.log('  - Articles:', document.querySelectorAll('article').length);
  console.log('  - List items:', document.querySelectorAll('li').length);

  // Common selectors to try for legislative initiatives
  const testSelectors = [
    // Legislative content selectors
    'table tr td',
    'table tbody tr',
    '.iniciativa',
    '.proyecto',
    '.decreto',
    '.ley',

    // Generic content selectors
    'article',
    '.content article',
    '.main article',
    'div[class*="iniciativa"]',
    'div[class*="proyecto"]',

    // List-based selectors
    'ul li',
    'ol li',
    '.lista li',
    '.listado li',

    // Table-based selectors (common for government sites)
    'table tr:not(:first-child)',
    'tbody tr',
    'tr td:first-child',

    // Title/heading selectors
    'h1', 'h2', 'h3', 'h4',
    '.titulo', '.title',

    // Link selectors
    'a[href*="iniciativa"]',
    'a[href*="proyecto"]',
    'a[href*="decreto"]'
  ];

  console.log('🧪 Testing selectors...');

  for (let i = 0; i < testSelectors.length && items.length < 20; i++) {
    const selector = testSelectors[i];

    try {
      const elements = document.querySelectorAll(selector);
      console.log(`🔍 "${selector}" found ${elements.length} elements`);

      if (elements.length > 0) {
        console.log(`  📝 Sample text: "${elements[0].textContent?.trim().substring(0, 100)}..."`);

        // Extract data from found elements
        elements.forEach((element, index) => {
          if (items.length >= 20) return;

          const text = element.textContent?.trim();
          const href = element.href || element.querySelector('a')?.href;

          if (text && text.length > 10) { // Only meaningful text
            items.push({
              text: text,
              link: href || null,
              selector: selector,
              index: index,
              tag: element.tagName.toLowerCase(),
              classes: element.className,
              extracted_at: new Date().toISOString()
            });
          }
        });

        if (items.length > 0) {
          console.log(`✅ Found ${items.length} items with selector: ${selector}`);
          break; // Stop after finding content
        }
      }

    } catch (error) {
      console.error(`❌ Error with selector "${selector}":`, error.message);
    }
  }

  // If still no items, try very generic approach
  if (items.length === 0) {
    console.log('🚨 No items found with specific selectors, trying generic approach...');

    const allText = document.body.textContent || '';
    console.log(`📝 Page has ${allText.length} characters of text`);

    // Look for any links that might be initiatives
    const allLinks = document.querySelectorAll('a[href]');
    console.log(`🔗 Found ${allLinks.length} total links`);

    allLinks.forEach((link, index) => {
      if (items.length >= 10) return;

      const text = link.textContent?.trim();
      const href = link.href;

      if (text && text.length > 5 && href && !href.includes('javascript:')) {
        items.push({
          text: text,
          link: href,
          selector: 'a[href] (generic)',
          index: index,
          type: 'link',
          extracted_at: new Date().toISOString()
        });
      }
    });
  }

  console.log(`✅ Extraction completed. Total items: ${items.length}`);

  if (items.length > 0) {
    console.log('📋 Sample extracted item:', items[0]);
  } else {
    console.log('⚠️ No items extracted. The page might:');
    console.log('  - Be loading content dynamically with JavaScript');
    console.log('  - Require authentication');
    console.log('  - Have a different structure than expected');
    console.log('  - Be blocking automated access');
  }

} catch (error) {
  console.error('💥 Script execution error:', error);
}

// Return the results
return items;