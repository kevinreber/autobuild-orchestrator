-- Add soft delete support for projects
-- deleted_at: when the user initiated deletion
-- scheduled_deletion_at: when permanent deletion will occur (30 days after deleted_at)

ALTER TABLE projects ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE projects ADD COLUMN scheduled_deletion_at TIMESTAMP WITH TIME ZONE;

-- Index for efficiently querying non-deleted projects
CREATE INDEX idx_projects_deleted_at ON projects(deleted_at) WHERE deleted_at IS NULL;
