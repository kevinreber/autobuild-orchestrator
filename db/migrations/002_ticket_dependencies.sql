-- Ticket dependencies table (for tracking which tickets must be completed before others)
CREATE TABLE ticket_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  depends_on_ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Prevent self-dependencies
  CONSTRAINT no_self_dependency CHECK (ticket_id != depends_on_ticket_id),
  -- Prevent duplicate dependencies
  CONSTRAINT unique_dependency UNIQUE (ticket_id, depends_on_ticket_id)
);

-- Indexes for efficient lookups
CREATE INDEX idx_ticket_dependencies_ticket_id ON ticket_dependencies(ticket_id);
CREATE INDEX idx_ticket_dependencies_depends_on ON ticket_dependencies(depends_on_ticket_id);

-- Add comment describing the relationship
COMMENT ON TABLE ticket_dependencies IS 'Tracks dependencies between tickets. ticket_id depends on depends_on_ticket_id being completed first.';
COMMENT ON COLUMN ticket_dependencies.ticket_id IS 'The ticket that has a dependency (blocked ticket)';
COMMENT ON COLUMN ticket_dependencies.depends_on_ticket_id IS 'The ticket that must be completed first (blocking ticket)';
