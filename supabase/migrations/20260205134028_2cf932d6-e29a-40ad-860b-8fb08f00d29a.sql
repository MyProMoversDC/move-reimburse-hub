-- Add signed_html_content column to store the complete signed HTML with embedded signature
ALTER TABLE signed_consent_documents 
ADD COLUMN signed_html_content TEXT;