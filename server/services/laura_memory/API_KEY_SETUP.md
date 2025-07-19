# Laura Memory Service - API Key Setup Guide

## 🔑 Zep API Key Configuration

The Laura Memory service requires a valid Zep API key to function properly. Currently, the service is using a placeholder key.

### **Option 1: Get Zep Cloud API Key**

1. **Sign up for Zep Cloud**: Visit [https://www.getzep.com/](https://www.getzep.com/)
2. **Create account** or sign in to existing account
3. **Generate API key** from your dashboard
4. **Update .env file** with your actual API key:

```bash
# Replace the placeholder key
ZEP_API_KEY=your_actual_zep_api_key_here
```

### **Option 2: Use Local Zep Server**

1. **Install Zep locally** following [Zep documentation](https://docs.getzep.com/deployment/local/)
2. **Update .env file** to point to local server:

```bash
ZEP_API_KEY=local_development_key
ZEP_URL=http://localhost:8000
```

### **Option 3: Mock Mode (Development Only)**

For development without Zep, you can temporarily mock the memory service:

```bash
# Set mock mode
ZEP_API_KEY=mock_mode
DEBUG=true
```

## 🔄 Restart Service

After updating the API key:

```bash
cd /Users/pj/Desktop/Pulse\ Journal/ExtractorW/server/services/laura_memory/
# Kill existing service
pkill -f "python.*server.py"
# Start with new configuration
source venv/bin/activate
python3 server.py
```

## ✅ Verify Configuration

Test the service endpoints:

```bash
# Health check
curl -X GET http://localhost:5001/health

# Search test
curl -X POST http://localhost:5001/api/laura-memory/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "limit": 2}'

# Stats test
curl -X GET http://localhost:5001/api/laura-memory/stats
```

## 🚨 Current Status

- ✅ **Service running** on port 5001
- ✅ **Code improvements** implemented
- ❌ **Valid API key needed** for full functionality
- ✅ **Error handling** improved
- ✅ **Retry logic** implemented
- ✅ **Configuration validation** added

## 📋 Next Steps

1. **Get valid Zep API key** from one of the options above
2. **Update .env file** with the key
3. **Restart service** to apply changes
4. **Test all endpoints** to verify functionality
5. **Monitor logs** for any remaining issues

The service architecture is now robust and ready for production use once a valid API key is configured.