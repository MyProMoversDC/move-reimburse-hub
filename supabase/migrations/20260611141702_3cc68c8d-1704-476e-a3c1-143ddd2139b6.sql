-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- 1) office_ai_documents: uploaded knowledge files
-- =====================================================
CREATE TABLE public.office_ai_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  source_bucket TEXT NOT NULL DEFAULT 'office-ai-kb',
  source_path TEXT NOT NULL,
  mime_type TEXT,
  file_size_bytes BIGINT,
  language TEXT DEFAULT 'en',
  kb_folder_id UUID REFERENCES public.knowledge_base_folders(id) ON DELETE SET NULL,
  ai_enabled BOOLEAN NOT NULL DEFAULT true,
  ingest_status TEXT NOT NULL DEFAULT 'pending', -- pending|processing|ready|failed
  ingest_error TEXT,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.office_ai_documents TO authenticated;
GRANT ALL ON public.office_ai_documents TO service_role;

ALTER TABLE public.office_ai_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage AI documents"
  ON public.office_ai_documents
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Office staff and admins view ready AI documents"
  ON public.office_ai_documents
  FOR SELECT TO authenticated
  USING (
    (public.has_role(auth.uid(), 'office_staff'::app_role) AND ingest_status = 'ready' AND ai_enabled = true)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE TRIGGER office_ai_documents_updated_at
  BEFORE UPDATE ON public.office_ai_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 2) office_ai_chunks: text chunks + embeddings
-- =====================================================
CREATE TABLE public.office_ai_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.office_ai_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  page_number INTEGER,
  content TEXT NOT NULL,
  token_count INTEGER,
  embedding vector(1536) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.office_ai_chunks TO authenticated;
GRANT ALL ON public.office_ai_chunks TO service_role;

ALTER TABLE public.office_ai_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage AI chunks"
  ON public.office_ai_chunks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Office staff and admins view ready chunks"
  ON public.office_ai_chunks
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      public.has_role(auth.uid(), 'office_staff'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.office_ai_documents d
        WHERE d.id = office_ai_chunks.document_id
          AND d.ingest_status = 'ready'
          AND d.ai_enabled = true
      )
    )
  );

CREATE INDEX office_ai_chunks_document_idx ON public.office_ai_chunks(document_id);
CREATE INDEX office_ai_chunks_embedding_idx ON public.office_ai_chunks
  USING hnsw (embedding vector_cosine_ops);

-- =====================================================
-- 3) office_ai_conversations: persistent chat threads
-- =====================================================
CREATE TABLE public.office_ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  language TEXT DEFAULT 'en',
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.office_ai_conversations TO authenticated;
GRANT ALL ON public.office_ai_conversations TO service_role;

ALTER TABLE public.office_ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own AI conversations"
  ON public.office_ai_conversations
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all AI conversations"
  ON public.office_ai_conversations
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX office_ai_conversations_user_idx
  ON public.office_ai_conversations(user_id, last_message_at DESC);

CREATE TRIGGER office_ai_conversations_updated_at
  BEFORE UPDATE ON public.office_ai_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 4) office_ai_messages: chat messages
-- =====================================================
CREATE TABLE public.office_ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.office_ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  citations JSONB DEFAULT '[]'::jsonb,
  ai_message_id TEXT, -- for AI SDK msg_... id reconciliation
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.office_ai_messages TO authenticated;
GRANT ALL ON public.office_ai_messages TO service_role;

ALTER TABLE public.office_ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage messages in their conversations"
  ON public.office_ai_messages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.office_ai_conversations c
      WHERE c.id = office_ai_messages.conversation_id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.office_ai_conversations c
      WHERE c.id = office_ai_messages.conversation_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins view all AI messages"
  ON public.office_ai_messages
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX office_ai_messages_conv_idx
  ON public.office_ai_messages(conversation_id, created_at);

-- =====================================================
-- 5) office_ai_queries: analytics
-- =====================================================
CREATE TABLE public.office_ai_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.office_ai_conversations(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  answer_preview TEXT,
  language TEXT,
  chunk_ids_used UUID[] DEFAULT '{}',
  document_ids_used UUID[] DEFAULT '{}',
  response_ms INTEGER,
  had_results BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.office_ai_queries TO authenticated;
GRANT ALL ON public.office_ai_queries TO service_role;

ALTER TABLE public.office_ai_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own AI queries"
  ON public.office_ai_queries
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert their own AI queries"
  ON public.office_ai_queries
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all AI queries"
  ON public.office_ai_queries
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX office_ai_queries_created_idx ON public.office_ai_queries(created_at DESC);

-- =====================================================
-- 6) office_ai_feedback: 👍/👎
-- =====================================================
CREATE TABLE public.office_ai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.office_ai_messages(id) ON DELETE CASCADE,
  query_id UUID REFERENCES public.office_ai_queries(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating TEXT NOT NULL CHECK (rating IN ('up','down')),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.office_ai_feedback TO authenticated;
GRANT ALL ON public.office_ai_feedback TO service_role;

ALTER TABLE public.office_ai_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own AI feedback"
  ON public.office_ai_feedback
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all AI feedback"
  ON public.office_ai_feedback
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- 7) Similarity search RPC
-- =====================================================
CREATE OR REPLACE FUNCTION public.match_office_ai_chunks(
  query_embedding vector(1536),
  match_count INT DEFAULT 8
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  document_title TEXT,
  page_number INTEGER,
  content TEXT,
  similarity FLOAT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.document_id,
    d.title AS document_title,
    c.page_number,
    c.content,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.office_ai_chunks c
  JOIN public.office_ai_documents d ON d.id = c.document_id
  WHERE d.ingest_status = 'ready' AND d.ai_enabled = true
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'office_staff'::app_role)
    )
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_office_ai_chunks(vector, INT) TO authenticated;

-- =====================================================
-- 8) 90-day cleanup helper
-- =====================================================
CREATE OR REPLACE FUNCTION public.cleanup_office_ai_old_conversations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.office_ai_conversations
  WHERE last_message_at < (now() - INTERVAL '90 days');
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;