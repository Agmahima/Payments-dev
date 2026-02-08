import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

export const rawBodyMiddleware = (req: Request, res: Response, next: NextFunction) => {
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
      } catch (error) {
        logger.error('Raw body parsing error', { error });
        res.status(400).json({
          success: false,
          error: 'Invalid JSON payload'
        });
      }
    });
  } else {
    next();
  }
};