/*
# Fix: Set search_path on update_updated_at function
Security hardening: make the trigger function's search_path explicit.
*/
ALTER FUNCTION update_updated_at() SET search_path = public;