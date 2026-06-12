CREATE OR REPLACE FUNCTION public.match_office_ai_chunks(query_embedding vector, match_count integer DEFAULT 8)
 RETURNS TABLE(id uuid, document_id uuid, document_title text, page_number integer, content text, similarity double precision)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$function$;