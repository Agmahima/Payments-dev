"use strict";
// ============================================
// ENHANCED AUTH MIDDLEWARE WITH DETAILED LOGGING
// ============================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = require("../utils/logger");
const authMiddleware = (req, res, next) => {
    try {
        // ========== STEP 1: Check Authorization Header ==========
        const authHeader = req.headers.authorization;
        console.log('🔍 STEP 1 - Raw Auth Header:', authHeader);
        if (!authHeader) {
            console.log('❌ STEP 1 FAILED: No authorization header');
            return res.status(401).json({
                success: false,
                error: 'No authorization header provided'
            });
        }
        if (!authHeader.startsWith('Bearer ')) {
            console.log('❌ STEP 1 FAILED: Invalid header format. Expected "Bearer <token>"');
            return res.status(401).json({
                success: false,
                error: 'Invalid authorization header format'
            });
        }
        // ========== STEP 2: Extract Token ==========
        const token = authHeader.split(' ')[1];
        console.log('🔍 STEP 2 - Extracted Token:', token ? `${token.substring(0, 30)}...` : 'EMPTY');
        if (!token || token === 'undefined' || token === 'null') {
            console.log('❌ STEP 2 FAILED: Token is empty or invalid');
            return res.status(401).json({
                success: false,
                error: 'Token is missing'
            });
        }
        // ========== STEP 3: Check JWT Secret ==========
        const jwtSecret = process.env.JWT_SECRET;
        console.log('🔍 STEP 3 - JWT Secret exists:', !!jwtSecret);
        if (!jwtSecret) {
            console.log('❌ STEP 3 FAILED: JWT_SECRET not configured in environment');
            logger_1.logger.error('JWT_SECRET not configured');
            return res.status(500).json({
                success: false,
                error: 'Server configuration error'
            });
        }
        // ========== STEP 4: Verify & Decode Token ==========
        console.log('🔍 STEP 4 - Attempting to verify token...');
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
            console.log('✅ STEP 4 SUCCESS - Token verified successfully');
            console.log('🔍 Decoded payload:', JSON.stringify(decoded, null, 2));
        }
        catch (jwtError) {
            console.log('❌ STEP 4 FAILED - JWT Verification Error');
            console.log('Error name:', jwtError.name);
            console.log('Error message:', jwtError.message);
            if (jwtError.name === 'TokenExpiredError') {
                console.log('⏰ Token expired at:', jwtError.expiredAt);
                return res.status(401).json({
                    success: false,
                    error: 'Token has expired',
                    code: 'TOKEN_EXPIRED'
                });
            }
            if (jwtError.name === 'JsonWebTokenError') {
                console.log('🔐 Invalid token signature or format');
                return res.status(401).json({
                    success: false,
                    error: 'Invalid token',
                    code: 'INVALID_TOKEN'
                });
            }
            if (jwtError.name === 'NotBeforeError') {
                console.log('⏰ Token not yet valid');
                return res.status(401).json({
                    success: false,
                    error: 'Token not yet valid',
                    code: 'TOKEN_NOT_ACTIVE'
                });
            }
            throw jwtError; // Re-throw unknown errors
        }
        // ========== STEP 5: Extract User Info ==========
        console.log('🔍 STEP 5 - Extracting user info from token...');
        const userId = decoded.userId || decoded.id || decoded.sub;
        const email = decoded.email;
        console.log('🔍 Available fields in token:', Object.keys(decoded));
        console.log('🔍 userId:', userId);
        console.log('🔍 email:', email);
        if (!userId) {
            console.log('❌ STEP 5 FAILED: No userId found in token');
            console.log('Available fields:', Object.keys(decoded));
            return res.status(401).json({
                success: false,
                error: 'Invalid token payload - missing user ID'
            });
        }
        // ========== STEP 6: Attach to Request ==========
        req.user = {
            userId,
            email
        };
        console.log('✅ STEP 6 SUCCESS - User attached to request:', req.user);
        console.log('✅ ========== AUTH MIDDLEWARE COMPLETE ==========\n');
        next();
    }
    catch (error) {
        console.log('❌ ========== UNEXPECTED ERROR IN AUTH MIDDLEWARE ==========');
        console.log('Error type:', error.constructor.name);
        console.log('Error message:', error.message);
        console.log('Error stack:', error.stack);
        logger_1.logger.error('Auth middleware error', {
            error: error.message,
            stack: error.stack,
            headers: req.headers
        });
        return res.status(401).json({
            success: false,
            error: 'Invalid token'
        });
    }
};
exports.authMiddleware = authMiddleware;
// ============================================
// ADDITIONAL DEBUG ENDPOINT (Add to your routes)
// ============================================
// Add this to your routes for testing:
/*
router.get('/debug/test-auth', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    message: 'Authentication successful',
    user: req.user,
    timestamp: new Date().toISOString()
  });
});
*/
// ============================================
// FRONTEND TOKEN CHECKER
// ============================================
/*
// Run this in your browser console to check the token:

const checkToken = () => {
  const token = localStorage.getItem('token');
  
  if (!token) {
    console.error('❌ No token found in localStorage');
    return;
  }
  
  console.log('✅ Token found');
  console.log('Token (first 30 chars):', token.substring(0, 30) + '...');
  
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('❌ Invalid JWT format - should have 3 parts');
      return;
    }
    
    const payload = JSON.parse(atob(parts[1]));
    console.log('📦 Token Payload:', payload);
    console.log('👤 User ID:', payload.userId || payload.id || payload.sub);
    console.log('📧 Email:', payload.email);
    console.log('⏰ Issued at:', new Date(payload.iat * 1000));
    console.log('⏰ Expires at:', new Date(payload.exp * 1000));
    console.log('⏰ Is expired:', Date.now() > payload.exp * 1000);
    
    if (Date.now() > payload.exp * 1000) {
      console.error('❌ TOKEN IS EXPIRED!');
    } else {
      console.log('✅ Token is still valid');
      const timeLeft = Math.floor((payload.exp * 1000 - Date.now()) / 1000 / 60);
      console.log(`⏰ Time remaining: ${timeLeft} minutes`);
    }
  } catch (error) {
    console.error('❌ Error decoding token:', error);
  }
};

checkToken();

// Then test the API:
const testAPI = async () => {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch('http://localhost:3000/api/payment/debug/test-auth', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();
    console.log('🧪 Test API Response:', data);
  } catch (error) {
    console.error('🧪 Test API Error:', error);
  }
};

testAPI();
*/
// ============================================
// ENVIRONMENT VARIABLE CHECKER
// ============================================
/*
// Add this to your server startup file (e.g., index.ts or app.ts)

console.log('🔍 Checking environment variables...');
console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
console.log('JWT_SECRET length:', process.env.JWT_SECRET?.length || 0);

if (!process.env.JWT_SECRET) {
  console.error('❌ CRITICAL: JWT_SECRET is not set!');
  console.error('Please add JWT_SECRET to your .env file');
  process.exit(1);
}

if (process.env.JWT_SECRET.length < 32) {
  console.warn('⚠️ WARNING: JWT_SECRET is too short (should be at least 32 characters)');
}

console.log('✅ JWT_SECRET is properly configured');
*/ 
