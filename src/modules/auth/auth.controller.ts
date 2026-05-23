import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import { query } from '../../utils/query.util';
import { sendSuccess, sendError } from '../../utils/response.util';
import { SignupBody, LoginBody } from '../../utils/types';

const SALT_ROUNDS = 10;

export const signup = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { name, email, password, role = 'contributor' }: SignupBody = req.body;

  if (!name || !email || !password) {
    sendError(res, StatusCodes.BAD_REQUEST, 'name, email and password are required.');
    return;
  }

  if (!['contributor', 'maintainer'].includes(role)) {
    sendError(res, StatusCodes.BAD_REQUEST, 'role must be contributor or maintainer.');
    return;
  }

  const existing = await query(
    'SELECT id FROM users WHERE email = $1',
    [email]
  );

  if (existing.rows.length > 0) {
    sendError(res, StatusCodes.BAD_REQUEST, 'Email already exists.');
    return;
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const result = await query(
    `INSERT INTO users (name, email, password, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role, created_at, updated_at`,
    [name, email, hashedPassword, role]
  );

  sendSuccess(res, StatusCodes.CREATED, 'User registered successfully', result.rows[0]);
};

export const login = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { email, password }: LoginBody = req.body;

  if (!email || !password) {
    sendError(res, StatusCodes.BAD_REQUEST, 'email and password are required.');
    return;
  }

  const result = await query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );

  if (result.rows.length === 0) {
    sendError(res, StatusCodes.UNAUTHORIZED, 'Invalid email or password.');
    return;
  }

  const user = result.rows[0];

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    sendError(res, StatusCodes.UNAUTHORIZED, 'Invalid email or password.');
    return;
  }

  const token = jwt.sign(
    { id: user.id, name: user.name, role: user.role },
    process.env.JWT_SECRET as string,
    { expiresIn: '7d' }
  );

  sendSuccess(res, StatusCodes.OK, 'Login successful', {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at,
    },
  });
};

