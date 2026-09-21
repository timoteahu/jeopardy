-- pgvector similarity search over clues.
-- Populated by backend/build_graph.py (embeddings are written via PostgREST,
-- so this DDL only needs to run once on the hosted project).

create extension if not exists vector;

alter table clues add column if not exists embedding vector(384);

create index if not exists idx_clues_embedding on clues
    using hnsw (embedding vector_cosine_ops);

-- semantic "related clues" lookup; call via supabase.rpc('match_clues', ...)
create or replace function match_clues(
    query_embedding vector(384),
    match_count int default 10
)
returns table (id bigint, clue_text text, answer text, similarity float)
language sql stable as $$
    select c.id, c.clue_text, c.answer,
           1 - (c.embedding <=> query_embedding) as similarity
    from clues c
    where c.embedding is not null
    order by c.embedding <=> query_embedding
    limit match_count;
$$;
