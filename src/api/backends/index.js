// Picks the storage backend for this build (see ../config.js).
import { IS_LOCAL_MODE } from '../config';
import { localBackend } from './local';
import { supabaseBackend } from './supabase';

export const backend = IS_LOCAL_MODE ? localBackend : supabaseBackend;
export default backend;
