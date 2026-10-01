-- ==============================================================================
-- PRAXIRENCE PRODUCTION DATABASE PURGE & CLEAN SLATE SCRIPT
-- Compatible with Railway PostgreSQL & Local PostgreSQL
-- ==============================================================================

BEGIN;

-- 1. Safely truncate all consultation, review, and patient records with cascade
TRUNCATE TABLE doctor_reviews CASCADE;
TRUNCATE TABLE visits CASCADE;
TRUNCATE TABLE consent_logs CASCADE;
TRUNCATE TABLE audit_logs CASCADE;
TRUNCATE TABLE patients CASCADE;

-- 2. Clean up test/mock clinician records, preserving only verified CMO
DELETE FROM users 
WHERE email IN (
    'dr.aarav.mehta@praxirence.com',
    'dr.aarav@hospital.org',
    'dr.priya.sharma@praxirence.com',
    'dr.vikram.gowda@praxirence.com',
    'dr.ananya.verma@praxirence.com',
    'dr.rajesh.tripathi@praxirence.com',
    'dr.aarav.test@praxirence.com',
    'dr.mayank.test@praxirence.com',
    'newdoc@praxirence.com',
    'doctor2@praxirence.com'
)
OR email LIKE 'doctor.%@praxirence.com'
OR email LIKE '%test%@%';

-- 3. Verify clean state counts
SELECT 'visits' AS table_name, count(*) AS record_count FROM visits
UNION ALL
SELECT 'patients', count(*) FROM patients
UNION ALL
SELECT 'doctor_reviews', count(*) FROM doctor_reviews
UNION ALL
SELECT 'consent_logs', count(*) FROM consent_logs
UNION ALL
SELECT 'audit_logs', count(*) FROM audit_logs
UNION ALL
SELECT 'users (active doctors)', count(*) FROM users;

COMMIT;
