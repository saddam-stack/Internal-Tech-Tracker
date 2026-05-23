import { Router } from 'express';
import {
  createIssue,
  getAllIssues,
  getSingleIssue,
  updateIssue,
  deleteIssue,
  getMetrics,
} from './issues.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../middleware/error.middleware';

const router = Router();

router.get('/admin/metrics', authenticate, authorize('maintainer'), asyncHandler(getMetrics));

router.get('/', asyncHandler(getAllIssues));

router.get('/:id', asyncHandler(getSingleIssue));

router.post('/', authenticate, asyncHandler(createIssue));

router.patch('/:id', authenticate, asyncHandler(updateIssue));

router.delete('/:id', authenticate, authorize('maintainer'), asyncHandler(deleteIssue));

export default router;