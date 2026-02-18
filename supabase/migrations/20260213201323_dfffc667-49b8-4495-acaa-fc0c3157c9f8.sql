ALTER TABLE workflow_templates
  ADD COLUMN IF NOT EXISTS master_prompt TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT;