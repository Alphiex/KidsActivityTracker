import { Request, Response, NextFunction } from 'express';
export declare const verifyChildOwnership: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>>>;
export declare const verifyMultipleChildOwnership: (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
export declare const loadChildData: (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
//# sourceMappingURL=childAuth.d.ts.map