import type { NextFunction, Request, Response } from 'express';
import { adminAuth } from '../../lib/firebase-admin.ts';
import type { UserRole } from '../../shared/types.ts';
import { verifyDemoToken } from '../auth/demoToken.ts';
import { getOrCreateAuthenticatedProfile } from '../services/seedService.ts';

export interface AuthContext {
  userId: number;
  uid: string;
  email: string;
  role: UserRole;
  employeeId: number;
}

export interface AuthRequest extends Request {
  authContext?: AuthContext;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Akses ditolak: token autentikasi tidak ditemukan.' });
    return;
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    let uid: string;
    let email: string | undefined;
    let displayName: string | undefined;
    let photoUrl: string | undefined;

    if (token.startsWith('demo.')) {
      const demoPayload = verifyDemoToken(token);
      if (!demoPayload) {
        res.status(401).json({ error: 'Sesi demo tidak valid atau telah kedaluwarsa.' });
        return;
      }
      uid = demoPayload.uid;
      email = demoPayload.email;
      displayName = demoPayload.name;
    } else {
      const decodedToken = await adminAuth.verifyIdToken(token);
      uid = decodedToken.uid;
      email = decodedToken.email;
      displayName = decodedToken.name;
      photoUrl = decodedToken.picture;
    }

    if (!email) {
      res.status(401).json({ error: 'Akun tidak memiliki alamat email yang valid.' });
      return;
    }

    const { user, employeeId } = await getOrCreateAuthenticatedProfile(
      uid,
      email,
      displayName,
      photoUrl,
    );

    req.authContext = {
      userId: user.id,
      uid: user.uid,
      email: user.email,
      role: user.role as UserRole,
      employeeId,
    };
    next();
  } catch (error) {
    console.error('Error verifying auth token:', error);
    res.status(401).json({ error: 'Sesi tidak valid atau telah kedaluwarsa. Silakan masuk ulang.' });
  }
};

export const requireRoles = (...allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const role = req.authContext?.role;
    if (!role || !allowedRoles.includes(role)) {
      res.status(403).json({
        error: 'Akses ditolak: peran Anda tidak memiliki izin untuk operasi ini.',
      });
      return;
    }
    next();
  };
};
