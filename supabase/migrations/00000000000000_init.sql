create extension if not exists "uuid-ossp";

create table games (
    id bigserial primary key,
    j_archive_id bigint unique,
    air_date date,
    show_number int,
    season int,
    created_at timestamptz default now()
);

create table categories (
    id bigserial primary key,
    name text not null,
    canonical_name text,
    created_at timestamptz default now()
);

create table clues (
    id bigserial primary key,
    game_id bigint references games(id),
    category_id bigint references categories(id),
    round text not null,
    value int,
    clue_text text not null,
    answer text not null,
    daily_double boolean default false,
    triple_stumper boolean default false,
    clue_order int not null default 0,
    created_at timestamptz default now()
);

create table nodes (
    id bigserial primary key,
    name text not null,
    type text not null,
    description text,
    created_at timestamptz default now()
);

create table edges (
    id bigserial primary key,
    source_node_id bigint references nodes(id) on delete cascade,
    target_node_id bigint references nodes(id) on delete cascade,
    edge_type text not null,
    weight float default 1.0,
    metadata jsonb default '{}',
    created_at timestamptz default now(),
    unique (source_node_id, target_node_id, edge_type)
);

create table clue_nodes (
    clue_id bigint references clues(id) on delete cascade,
    node_id bigint references nodes(id) on delete cascade,
    relevance float default 1.0,
    primary key (clue_id, node_id)
);

create table profiles (
    id uuid primary key default uuid_generate_v4(),
    username text unique,
    email text,
    created_at timestamptz default now()
);

create table attempts (
    id bigserial primary key,
    user_id uuid references profiles(id) on delete cascade,
    clue_id bigint references clues(id) on delete cascade,
    correct boolean not null,
    response_text text,
    time_ms int,
    created_at timestamptz default now()
);

create table reviews (
    id bigserial primary key,
    user_id uuid references profiles(id) on delete cascade,
    node_id bigint references nodes(id) on delete cascade,
    due_at timestamptz default now(),
    interval_days float default 0,
    ease float default 2.5,
    reps int default 0,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique (user_id, node_id)
);

create index idx_clues_category on clues(category_id);
create index idx_clues_game on clues(game_id);
create index idx_edges_source on edges(source_node_id);
create index idx_edges_target on edges(target_node_id);
create index idx_clue_nodes_clue on clue_nodes(clue_id);
create index idx_clue_nodes_node on clue_nodes(node_id);
create index idx_reviews_due on reviews(due_at);
