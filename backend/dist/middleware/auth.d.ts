import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email: string;
            };
            session?: any;
        }
    }
}
export declare const verifyToken: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>>>;
export declare const optionalAuth: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const apiLimiter: (req: Request, res: Response, next: NextFunction) => void;
export declare const authLimiter: (req: Request, res: Response, next: NextFunction) => void;
export declare const passwordResetLimiter: (req: Request, res: Response, next: NextFunction) => void;
export declare const emailVerificationLimiter: (req: Request, res: Response, next: NextFunction) => void;
export declare const csrfProtection: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
export declare const validateBody: (schema: any) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
export declare const checkPermission: (permission: string) => (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>>>;
export declare const logActivity: (action: string) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=auth.d.ts.map