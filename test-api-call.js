import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function testGlideAPIDirectly() {
    console.log('🔍 Testing Glide API directly...');
    
    const appId = process.env.GLIDE_APP_ID;
    const apiKey = process.env.GLIDE_API_KEY;
    
    console.log('App ID:', appId);
    console.log('API Key:', apiKey ? `${apiKey.substring(0, 8)}...` : 'Not found');
    
    try {
        // Test 1: Get app info
        console.log('\n📱 Test 1: Get app info');
        const appResponse = await axios.get(`https://api.glideapp.io/apps/${appId}`, {
            headers: {
                'X-API-Key': apiKey,
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ App info:', JSON.stringify(appResponse.data, null, 2));
        
        // Test 2: Get tables
        console.log('\n📊 Test 2: Get tables');
        const tablesResponse = await axios.get(`https://api.glideapp.io/apps/${appId}/tables`, {
            headers: {
                'X-API-Key': apiKey,
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ Tables:', JSON.stringify(tablesResponse.data, null, 2));
        
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
        
        if (error.response?.status === 404) {
            console.log('💡 This might be because the app ID is incorrect or the API endpoint structure has changed');
        }
        
        if (error.response?.status === 401) {
            console.log('💡 This might be because the API key is incorrect or expired');
        }
    }
}

testGlideAPIDirectly().catch(console.error);