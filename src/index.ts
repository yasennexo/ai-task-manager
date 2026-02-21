import dotenv from 'dotenv';
dotenv.config();

import { runMigrations } from './db/schema';

runMigrations();
console.log('✓ AI Task Manager — database ready');
