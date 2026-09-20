insert into games (id, j_archive_id, air_date, show_number, season) values
  (1, 1, '2024-01-01', 1, 40);

insert into categories (id, name, canonical_name) values
  (1, 'WORLD HISTORY', 'world history'),
  (2, 'SPACE EXPLORATION', 'space exploration'),
  (3, 'MUSIC FESTIVALS', 'music festivals');

insert into clues (id, game_id, category_id, round, value, clue_text, answer, clue_order) values
  (1, 1, 1, 'J', 200, 'This ancient wonder was located in the city of Babylon.', 'the Hanging Gardens', 1),
  (2, 1, 1, 'J', 400, 'In 1969, this man became the first human to walk on the moon.', 'Neil Armstrong', 2),
  (3, 1, 1, 'J', 600, 'This Roman emperor built a wall across Britain in 122 AD.', 'Hadrian', 3),
  (4, 1, 2, 'DJ', 400, 'The Hubble telescope is named after this American astronomer.', 'Edwin Hubble', 1),
  (5, 1, 3, 'DJ', 800, 'This 1969 music festival was held on Max Yasgur''s farm.', 'Woodstock', 1);

insert into nodes (id, name, type, description) values
  (1, 'Babylon', 'entity', 'Ancient city in Mesopotamia'),
  (2, 'Hanging Gardens', 'entity', 'One of the Seven Wonders of the Ancient World'),
  (3, 'Neil Armstrong', 'entity', 'First human to walk on the Moon'),
  (4, 'Moon landing', 'topic', 'Apollo 11 mission in 1969'),
  (5, 'Hadrian', 'entity', 'Roman emperor who built Hadrian''s Wall'),
  (6, 'Edwin Hubble', 'entity', 'American astronomer'),
  (7, 'Woodstock', 'entity', '1969 music festival'),
  (8, 'Max Yasgur', 'entity', 'Dairy farmer who hosted Woodstock'),
  (9, 'WORLD HISTORY', 'category', 'World history category'),
  (10, 'SPACE EXPLORATION', 'category', 'Space exploration category'),
  (11, 'MUSIC FESTIVALS', 'category', 'Music festivals category');

insert into edges (source_node_id, target_node_id, edge_type, weight) values
  (9, 2, 'contains', 1.0),
  (9, 3, 'contains', 1.0),
  (9, 5, 'contains', 1.0),
  (10, 6, 'contains', 1.0),
  (3, 4, 'related-to', 0.8),
  (7, 8, 'related-to', 0.9),
  (1, 2, 'related-to', 0.9);

insert into clue_nodes (clue_id, node_id, relevance) values
  (1, 1, 0.9),
  (1, 2, 1.0),
  (2, 3, 1.0),
  (2, 4, 0.8),
  (3, 5, 1.0),
  (4, 6, 1.0),
  (5, 7, 1.0),
  (5, 8, 0.7);

select setval('games_id_seq', (select max(id) from games));
select setval('categories_id_seq', (select max(id) from categories));
select setval('clues_id_seq', (select max(id) from clues));
select setval('nodes_id_seq', (select max(id) from nodes));
