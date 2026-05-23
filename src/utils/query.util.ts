import { QueryResult } from 'pg';
import pool from '../config/db';

export const query = async (
  text: string,
  params?: unknown[]
): Promise<QueryResult> => {
  return pool.query(text, params);
};


