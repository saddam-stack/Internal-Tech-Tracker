import { Router } from 'express';
import { signup, login } from './auth.controller';
import { asyncHandler } from '../../middleware/error.middleware';

const router = Router();

router.post('/signup', asyncHandler(signup));
router.post('/login', asyncHandler(login));

export default router;



