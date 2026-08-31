export interface IUserPayload {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: IUserPayload;
  }
}
