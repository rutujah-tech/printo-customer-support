/**
 * Test script for Existing Order Status System
 * Run with: node existing-order/test.js
 */

require('dotenv').config();
const axios = require('axios');

const BASE_URL = 'http://localhost:3007';

async function testHealthCheck() {
    console.log('\n🏥 Testing Health Check...');
    try {
        const response = await axios.get(`${BASE_URL}/api/existing-order/health`);
        console.log('✅ Health Check:', response.data);
        return true;
    } catch (error) {
        console.error('❌ Health Check Failed:', error.message);
        return false;
    }
}

async function testOrderStatus(phone) {
    console.log(`\n📞 Testing Order Status for phone: ${phone}`);
    try {
        const response = await axios.post(`${BASE_URL}/api/existing-order/status`, {
            phone: phone
        });

        console.log('✅ Success!');
        console.log('📤 Response:', JSON.stringify(response.data, null, 2));
        return true;
    } catch (error) {
        console.error('❌ Failed:', error.response?.data || error.message);
        return false;
    }
}

async function testWithMessage(message) {
    console.log(`\n💬 Testing with message: "${message}"`);
    try {
        const response = await axios.post(`${BASE_URL}/api/existing-order/status`, {
            message: message
        });

        console.log('✅ Success!');
        console.log('📤 Response:', JSON.stringify(response.data, null, 2));
        return true;
    } catch (error) {
        console.error('❌ Failed:', error.response?.data || error.message);
        return false;
    }
}

async function testInvalidPhone() {
    console.log('\n❌ Testing Invalid Phone...');
    try {
        const response = await axios.post(`${BASE_URL}/api/existing-order/status`, {
            message: 'Hello'
        });

        console.log('⚠️  Expected error but got success:', response.data);
        return false;
    } catch (error) {
        if (error.response?.status === 400) {
            console.log('✅ Correctly rejected invalid phone:', error.response.data);
            return true;
        } else {
            console.error('❌ Unexpected error:', error.response?.data || error.message);
            return false;
        }
    }
}

async function runTests() {
    console.log('🧪 Starting Existing Order Status System Tests\n');
    console.log('📋 Make sure the server is running on port 3007\n');

    const results = [];

    // Test 1: Health Check
    results.push(await testHealthCheck());

    // Test 2: Valid phone number (direct)
    results.push(await testOrderStatus('9940117071'));

    // Test 3: Valid phone with message format
    results.push(await testWithMessage('My number is 9940117071'));

    // Test 4: Phone with country code
    results.push(await testWithMessage('+919940117071'));

    // Test 5: Invalid phone
    results.push(await testInvalidPhone());

    // Summary
    const passed = results.filter(r => r).length;
    const total = results.length;

    console.log('\n' + '='.repeat(50));
    console.log(`📊 Test Results: ${passed}/${total} passed`);
    console.log('='.repeat(50));

    if (passed === total) {
        console.log('✅ All tests passed!');
    } else {
        console.log('⚠️  Some tests failed. Check logs above.');
    }
}

// Run tests
runTests().catch(error => {
    console.error('💥 Test suite crashed:', error);
    process.exit(1);
});
