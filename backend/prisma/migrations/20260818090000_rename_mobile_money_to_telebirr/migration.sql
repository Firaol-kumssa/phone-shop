-- Rename payment method "Mobile Money" to "Telebirr" (existing rows are updated in place)
ALTER TYPE "payment_method" RENAME VALUE 'Mobile Money' TO 'Telebirr';
