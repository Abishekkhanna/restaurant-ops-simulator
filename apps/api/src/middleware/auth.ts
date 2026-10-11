import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { EmployeeRole } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../db.js';

declare global {
  namespace Express {
    interface Request { actor?: { id: string; role: EmployeeRole; employeeNo: string; name: string }; }
  }
}

function tokenMatches(candidate: string) {
  const a = Buffer.from(candidate);
  const b = Buffer.from(env.APP_AUTH_TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token || !tokenMatches(token)) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Valid bearer token required.' } });
  return next();
}

export async function loadActor(req: Request, res: Response, next: NextFunction) {
  const employeeId = req.header('x-employee-id');
  if (!employeeId) return res.status(401).json({ error: { code: 'EMPLOYEE_REQUIRED', message: 'Select an employee identity.' } });
  const employee = await prisma.employee.findFirst({ where: { id: employeeId, active: true } });
  if (!employee) return res.status(401).json({ error: { code: 'EMPLOYEE_INVALID', message: 'Employee is inactive or unknown.' } });
  req.actor = { id: employee.id, role: employee.role, employeeNo: employee.employeeNo, name: employee.name };
  return next();
}

export function allowRoles(...roles: EmployeeRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.actor || !roles.includes(req.actor.role)) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Your role cannot perform this action.' } });
    return next();
  };
}
