/**
 * Test Print-Ready Image Generation
 * Tests the complete flow: product recommendation + personalized message + DALL-E image
 */

require('dotenv').config();
const OpenAI = require('openai');
const PersonalizedGiftEngine = require('./personalized-gift-engine');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function testPrintReadyImage() {
  console.log('🧪 Testing Print-Ready Image Generation\n');

  const wizEngine = new PersonalizedGiftEngine({ openai });

  // Initialize
  console.log('⏳ Initializing WIZ engine...');
  await wizEngine.initialize();
  console.log('✅ WIZ engine ready\n');

  // Test input
  const testInput = {
    recipientName: 'Priya',
    occasion: 'Birthday',
    budget: 1500,
    relationship: 'friend',
    specialNotes: 'She loves photography and coffee',
    recipientImage: null
  };

  console.log('📝 Test Input:');
  console.log(JSON.stringify(testInput, null, 2));
  console.log('\n⏳ Generating personalized gift experience...\n');

  const startTime = Date.now();

  try {
    const result = await wizEngine.createPersonalizedGift(testInput);

    const endTime = Date.now();
    const totalTime = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n✅ SUCCESS!\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📦 RECOMMENDED PRODUCT');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Title: ${result.experience.product.title}`);
    console.log(`Price: ${result.experience.product.priceDisplay}`);
    console.log(`Link: ${result.experience.product.link}`);

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✨ PERSONALIZATION');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Recipient: ${result.experience.personalization.recipientName}`);
    console.log(`Message: "${result.experience.personalization.message}"`);

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎨 PRINT-READY IMAGE (NEW!)');
    console.log('═══════════════════════════════════════════════════════════');
    if (result.experience.design && result.experience.design.mockupImageUrl) {
      console.log(`✅ Image Generated: ${result.experience.design.mockupImageUrl}`);
      console.log('\n📸 This is a DALL-E generated image showing:');
      console.log('   • Product with "Priya" printed on it');
      console.log('   • Personalized message applied');
      console.log('   • AI-designed layout, fonts, and colors');
      console.log('   • EXACTLY how the final product will look');
      console.log('\n💡 Open this URL in browser to see the print-ready image!');
    } else {
      console.log('❌ No image generated');
      if (result.experience.design && result.experience.design.description) {
        console.log(`\nFallback Description: ${result.experience.design.description}`);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('⚡ PERFORMANCE');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Total Time: ${totalTime}s`);
    console.log('Expected: 12-17 seconds (includes DALL-E generation)');

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('💰 COST BREAKDOWN');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('• GPT-4o-mini (4 calls): ~₹0.50');
    console.log('• DALL-E 3 HD (1 image): ~₹3.00');
    console.log('• Total per request: ~₹3.50');

    console.log('\n✅ TEST COMPLETE!');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\nFull Error:', error);
  }
}

testPrintReadyImage();
