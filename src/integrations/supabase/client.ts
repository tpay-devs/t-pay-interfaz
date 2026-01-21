import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

const supabaseUrl = "https://wpcmxocbutnyzmikgagf.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwY214b2NidXRueXptaWtnYWdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NjYxMjksImV4cCI6MjA2NzA0MjEyOX0.c4R5BqAZ0fINBoPAAHnRUC5rC-mIzB3O_t3kYGtnd_0"

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)