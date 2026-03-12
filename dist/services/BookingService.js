"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingService = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
class BookingService {
    constructor() {
        const bookingServiceUrl = process.env.BOOKING_SERVICE_URL;
        if (!bookingServiceUrl) {
            throw new Error('BOOKING_SERVICE_URL environment variable is required');
        }
        this.client = axios_1.default.create({
            baseURL: bookingServiceUrl,
            timeout: 15000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'payment-service/1.0.0'
            },
            validateStatus: (status) => status < 500,
        });
        // Add request interceptor for logging
        this.client.interceptors.request.use((config) => {
            logger_1.logger.info('Making request to booking service', {
                method: config.method,
                url: config.url,
                baseURL: config.baseURL,
                hasAuthHeader: !!config.headers.Authorization
            });
            return config;
        }, (error) => {
            logger_1.logger.error('Booking service request error', { error });
            return Promise.reject(error);
        });
        // Add response interceptor for error handling
        this.client.interceptors.response.use((response) => {
            logger_1.logger.info('Booking service response received', {
                status: response.status,
                url: response.config.url
            });
            return response;
        }, (error) => {
            logger_1.logger.error('Booking service response error', {
                status: error.response?.status,
                url: error.config?.url,
                error: error.message,
                responseData: error.response?.data
            });
            return Promise.reject(error);
        });
    }
    // ✅ FIXED: Added authToken parameter to pass authentication
    async getBookingDetails(bookingId, authToken) {
        try {
            const headers = {
                'X-Service-Key': process.env.SERVICE_API_KEY || '' // ✅ This sends the secret key
            };
            // ✅ Add stack trace to see where this is being called from
            console.log('🔍 getBookingDetails called:', {
                bookingId,
                hasAuthToken: !!authToken,
                authTokenLength: authToken?.length,
                callStack: new Error().stack?.split('\n').slice(1, 4).join('\n') // Show call stack
            });
            // Add authentication token if provided
            if (authToken) {
                headers.Authorization = `Bearer ${authToken}`;
                logger_1.logger.info('Using auth token for booking service request', { bookingId });
                console.log('Using auth token for booking service request', { bookingId });
            }
            else {
                logger_1.logger.warn('No auth token provided for booking service request', { bookingId });
                console.log('No auth token provided for booking service request', { bookingId });
            }
            const response = await this.client.get(`/api/bookings/${bookingId}`, {
                headers
            });
            if (response.status !== 200) {
                throw new Error(`Booking service returned status ${response.status}`);
            }
            return response.data;
        }
        catch (error) {
            if (error.code === 'ECONNREFUSED') {
                logger_1.logger.error('Cannot connect to booking service - service may be down', {
                    bookingServiceUrl: process.env.BOOKING_SERVICE_URL
                });
                console.log("Cannot connect");
                throw new Error('Booking service is unavailable. Please try again later.');
            }
            if (error.code === 'ENOTFOUND') {
                logger_1.logger.error('Booking service host not found', {
                    bookingServiceUrl: process.env.BOOKING_SERVICE_URL
                });
                throw new Error('Booking service host not found. Please check configuration.');
            }
            // ✅ Better error handling for 401
            if (error.response?.status === 401) {
                logger_1.logger.error('Unauthorized access to booking service', { bookingId });
                throw new Error('Authentication failed. Please login again.');
            }
            logger_1.logger.error('Failed to fetch booking details', {
                bookingId,
                error: error.message,
                status: error.response?.status
            });
            throw new Error(`Failed to fetch booking details: ${error.message}`);
        }
    }
    // ✅ FIXED: Added authToken parameter
    async updatePaymentStatus(bookingId, paymentData, authToken) {
        try {
            const headers = {};
            if (authToken) {
                headers.Authorization = `Bearer ${authToken}`;
            }
            console.log('🔄 Updating booking payment status:', {
                bookingId,
                url: `${this.client.defaults.baseURL}/api/bookings/${bookingId}/payment`,
                paymentData,
                hasAuthToken: !!authToken,
                authToken: authToken ? `${authToken.substring(0, 20)}...` : 'NONE'
            });
            const response = await this.client.patch(`/api/bookings/${bookingId}/payment-summary`, {
                paymentSummary: paymentData
            }, { headers });
            if (response.status !== 200) {
                throw new Error(`Booking service returned status ${response.status}`);
            }
            logger_1.logger.info('Booking payment status updated successfully', {
                bookingId,
                status: paymentData.paymentStatus
            });
            return response.data;
        }
        catch (error) {
            if (error.code === 'ECONNREFUSED') {
                logger_1.logger.error('Cannot connect to booking service for payment update', {
                    bookingServiceUrl: process.env.BOOKING_SERVICE_URL
                });
                logger_1.logger.warn('Payment successful but booking status update failed - will retry later', {
                    bookingId
                });
                return null;
            }
            logger_1.logger.error('Failed to update booking payment status', { bookingId, error: error.message });
            throw new Error(`Failed to update booking payment status: ${error.message}`);
        }
    }
    // ✅ FIXED: Added authToken parameter
    async notifyPaymentUpdate(bookingId, paymentStatus, amount, authToken) {
        try {
            const headers = {};
            if (authToken) {
                headers.Authorization = `Bearer ${authToken}`;
            }
            await this.client.post(`/api/bookings/${bookingId}/payment-notification`, {
                paymentStatus,
                amount,
                timestamp: new Date(),
                source: 'payment-service'
            }, {
                headers
            });
            logger_1.logger.info('Payment notification sent successfully', { bookingId });
        }
        catch (error) {
            logger_1.logger.warn('Payment notification failed - this is non-critical', {
                bookingId,
                error: error.message
            });
        }
    }
    async healthCheck() {
        try {
            const response = await this.client.get('/health', { timeout: 5000 });
            return response.status === 200;
        }
        catch (error) {
            logger_1.logger.error('Booking service health check failed', { error });
            return false;
        }
    }
}
exports.BookingService = BookingService;
