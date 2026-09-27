import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { env } from '@/shared/config/env';

const app = initializeApp(env.firebase);

export const database = getDatabase(app);
