-- ==============================================================================
-- PRAXIRENCE PRODUCTION DATA PURGE (MARKET LAUNCH CLEAN SLATE)
-- Target: Railway PostgreSQL / Production Cloud DB
-- ==============================================================================
-- WARNING: This will completely truncate all tables (visits, patients,
-- reviews, audit/consent logs, and doctor accounts) to provide a 100% blank slate.
-- Run directly in the Railway PostgreSQL Query Editor.
-- ==============================================================================

BEGIN;

-- 1. Purge all consultation and operational tables
TRUNCATE TABLE visits CASCADE;
TRUNCATE TABLE patients CASCADE;
TRUNCATE TABLE doctor_patient_links CASCADE;
TRUNCATE TABLE doctor_reviews CASCADE;
TRUNCATE TABLE consent_logs CASCADE;
TRUNCATE TABLE audit_logs CASCADE;

-- 2. Purge all doctor and clinician accounts (Zero doctors, Zero patients)
TRUNCATE TABLE users CASCADE;

-- 3. Reset all auto-increment sequences so new IDs start from 1
ALTER SEQUENCE IF EXISTS visits_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS patients_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS doctor_patient_links_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS doctor_reviews_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS consent_logs_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS audit_logs_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS users_id_seq RESTART WITH 1;

COMMIT;

-- Verification queries (all should return 0)
SELECT 'visits' AS table_name, count(*) AS remaining FROM visits
UNION ALL
SELECT 'patients', count(*) FROM patients
UNION ALL
SELECT 'doctor_patient_links', count(*) FROM doctor_patient_links
UNION ALL
SELECT 'users', count(*) FROM users
UNION ALL
SELECT 'doctor_reviews', count(*) FROM doctor_reviews
UNION ALL
SELECT 'consent_logs', count(*) FROM consent_logs
UNION ALL
SELECT 'audit_logs', count(*) FROM audit_logs;
