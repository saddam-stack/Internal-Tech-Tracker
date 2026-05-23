import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { query } from '../../utils/query.util';
import { sendSuccess, sendError } from '../../utils/response.util';
import {
  CreateIssueBody,
  UpdateIssueBody,
  Issue,
  ReporterInfo,
  IssueType,
} from '../../utils/types';

const getReporter = async (
  reporterId: number
): Promise<ReporterInfo | null> => {
  const result = await query(
    'SELECT id, name, role FROM users WHERE id = $1',
    [reporterId]
  );
  return result.rows[0] ?? null;
};

const attachReporters = async (issues: Issue[]) => {
  if (issues.length === 0) return [];

  const ids = [...new Set(issues.map((i) => i.reporter_id))];
  const placeholders = ids.map((_, idx) => `$${idx + 1}`).join(', ');

  const usersResult = await query(
    `SELECT id, name, role FROM users WHERE id IN (${placeholders})`,
    ids
  );

  const userMap = new Map<number, ReporterInfo>();
  for (const row of usersResult.rows) {
    userMap.set(row.id, { id: row.id, name: row.name, role: row.role });
  }

  return issues.map(({ reporter_id, ...issue }) => ({
    ...issue,
    reporter: userMap.get(reporter_id) ?? {
      id: reporter_id,
      name: 'Unknown',
      role: 'contributor',
    },
  }));
};

export const createIssue = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { title, description, type }: CreateIssueBody = req.body;
  const reporterId = req.user!.id;

  if (!title || !description || !type) {
    sendError(res, StatusCodes.BAD_REQUEST, 'title, description and type are required.');
    return;
  }

  if (title.length > 150) {
    sendError(res, StatusCodes.BAD_REQUEST, 'title must not exceed 150 characters.');
    return;
  }

  if (description.length < 20) {
    sendError(res, StatusCodes.BAD_REQUEST, 'description must be at least 20 characters.');
    return;
  }

  if (!['bug', 'feature_request'].includes(type)) {
    sendError(res, StatusCodes.BAD_REQUEST, 'type must be bug or feature_request.');
    return;
  }

  const result = await query(
    `INSERT INTO issues (title, description, type, reporter_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [title, description, type, reporterId]
  );

  sendSuccess(res, StatusCodes.CREATED, 'Issue created successfully', result.rows[0]);
};

export const getAllIssues = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { sort = 'newest', type, status } = req.query;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (type) {
    if (!['bug', 'feature_request'].includes(type as string)) {
      sendError(res, StatusCodes.BAD_REQUEST, 'type must be bug or feature_request.');
      return;
    }
    conditions.push(`type = $${paramIdx++}`);
    params.push(type);
  }

  if (status) {
    if (!['open', 'in_progress', 'resolved'].includes(status as string)) {
      sendError(res, StatusCodes.BAD_REQUEST, 'status must be open, in_progress or resolved.');
      return;
    }
    conditions.push(`status = $${paramIdx++}`);
    params.push(status);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderClause =
    sort === 'oldest' ? 'ORDER BY created_at ASC' : 'ORDER BY created_at DESC';

  const result = await query(
    `SELECT * FROM issues ${whereClause} ${orderClause}`,
    params
  );

  const issuesWithReporters = await attachReporters(result.rows as Issue[]);

  sendSuccess(res, StatusCodes.OK, 'Issues fetched successfully', issuesWithReporters);
};

export const getSingleIssue = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = req.params;

  const result = await query('SELECT * FROM issues WHERE id = $1', [id]);

  if (result.rows.length === 0) {
    sendError(res, StatusCodes.NOT_FOUND, `Issue with id ${id} not found.`);
    return;
  }

  const issue = result.rows[0] as Issue;
  const reporter = await getReporter(issue.reporter_id);

  const { reporter_id, ...issueData } = issue;

  const response = {
    ...issueData,
    reporter: reporter ?? {
      id: reporter_id,
      name: 'Unknown',
      role: 'contributor',
    },
  };

  sendSuccess(res, StatusCodes.OK, 'Issue fetched successfully', response);
};

export const updateIssue = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = req.params;
  const { title, description, type, status } = req.body;
  const requestingUser = req.user!;

  const issueResult = await query(
    'SELECT * FROM issues WHERE id = $1',
    [id]
  );

  if (issueResult.rows.length === 0) {
    sendError(res, StatusCodes.NOT_FOUND, `Issue with id ${id} not found.`);
    return;
  }

  const issue = issueResult.rows[0] as Issue;

  if (requestingUser.role === 'contributor') {
    if (issue.reporter_id !== requestingUser.id) {
      sendError(res, StatusCodes.FORBIDDEN, 'You can only update your own issues.');
      return;
    }
    if (issue.status !== 'open') {
      sendError(res, StatusCodes.CONFLICT, 'You can only edit issues that are open.');
      return;
    }
  }

  if (title !== undefined && title.length > 150) {
    sendError(res, StatusCodes.BAD_REQUEST, 'title must not exceed 150 characters.');
    return;
  }

  if (description !== undefined && description.length < 20) {
    sendError(res, StatusCodes.BAD_REQUEST, 'description must be at least 20 characters.');
    return;
  }

 if (status !== undefined) {
    if (!['open', 'in_progress', 'resolved'].includes(status)) {
      sendError(res, StatusCodes.BAD_REQUEST, 'status must be open, in_progress or resolved.');
      return;
    }
    if (requestingUser.role !== 'maintainer') {
      sendError(res, StatusCodes.FORBIDDEN, 'Only maintainer can change status.');
      return;
    }
  }

  const updates: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (title !== undefined) {
    updates.push(`title = $${paramIdx++}`);
    params.push(title);
  }

  if (description !== undefined) {
    updates.push(`description = $${paramIdx++}`);
    params.push(description);
  }

  if (status !== undefined) {
    updates.push(`status = $${paramIdx++}`);
    params.push(status);
  }

  if (updates.length === 0) {
    sendError(res, StatusCodes.BAD_REQUEST, 'No fields provided to update.');
    return;
  }

  updates.push(`updated_at = NOW()`);
  params.push(id);

  const result = await query(
    `UPDATE issues SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    params
  );

  sendSuccess(res, StatusCodes.OK, 'Issue updated successfully', result.rows[0]);
};

export const deleteIssue = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = req.params;

  const issueResult = await query(
    'SELECT id FROM issues WHERE id = $1',
    [id]
  );

  if (issueResult.rows.length === 0) {
    sendError(res, StatusCodes.NOT_FOUND, `Issue with id ${id} not found.`);
    return;
  }

  await query('DELETE FROM issues WHERE id = $1', [id]);

  sendSuccess(res, StatusCodes.OK, 'Issue deleted successfully', null);
};

export const getMetrics = async (
  _req: Request,
  res: Response
): Promise<void> => {
  const totalIssues = await query('SELECT COUNT(*) as total FROM issues');
  const totalUsers = await query('SELECT COUNT(*) as total FROM users');
  const byStatus = await query(
    'SELECT status, COUNT(*) as count FROM issues GROUP BY status'
  );
  const byType = await query(
    'SELECT type, COUNT(*) as count FROM issues GROUP BY type'
  );

  sendSuccess(res, StatusCodes.OK, 'Metrics fetched successfully', {
    total_issues: parseInt(totalIssues.rows[0].total),
    total_users: parseInt(totalUsers.rows[0].total),
    issues_by_status: byStatus.rows,
    issues_by_type: byType.rows,
  });
};



