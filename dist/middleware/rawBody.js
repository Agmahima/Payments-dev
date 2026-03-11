"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rawBodyMiddleware = void 0;
const logger_1 = require("../utils/logger");
const rawBodyMiddleware = (req, res, next) => {
    if (req.headers['content-type'] === 'application/json') {
        let data = '';
        req.setEncoding('utf8');
        req.on('data', (chunk) => {
            data += chunk;
        });
        req.on('end', () => {
            try {
                req.rawBody = Buffer.from(data, 'utf8');
                req.body = JSON.parse(data);
                next();
            }
            catch (error) {
                logger_1.logger.error('Raw body parsing error', { error });
                res.status(400).json({
                    success: false,
                    error: 'Invalid JSON payload'
                });
            }
        });
    }
    else {
        next();
    }
};
exports.rawBodyMiddleware = rawBodyMiddleware;
