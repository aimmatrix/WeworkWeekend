-- Three live London offices with open tasks, so /find has data.
-- Fixed ids so other tracks can deep-link while building.
-- Seed photos are placeholders (picsum); real tasks come from /capture + /api/assess.

insert into public.offices (id, name, address, lat, lng, crew_size, dirt_score, status, photo_urls) values
  ('11111111-1111-4111-8111-111111111111', 'Shoreditch Loft',     '86-90 Paul St, London EC2A 4NE',        51.5246, -0.0848, 2, 6, 'live',
    array['https://picsum.photos/seed/ww-shoreditch-1/1024/768','https://picsum.photos/seed/ww-shoreditch-2/1024/768']),
  ('22222222-2222-4222-8222-222222222222', 'King''s Cross Studio', '4 Pancras Square, London N1C 4AG',      51.5338, -0.1259, 3, 8, 'live',
    array['https://picsum.photos/seed/ww-kx-1/1024/768','https://picsum.photos/seed/ww-kx-2/1024/768']),
  ('33333333-3333-4333-8333-333333333333', 'Borough Works',       '1 Southwark St, London SE1 1RQ',        51.5054, -0.0910, 1, 4, 'live',
    array['https://picsum.photos/seed/ww-borough-1/1024/768']);

insert into public.tasks (office_id, room, title, category, credit_hours, before_url) values
  ('11111111-1111-4111-8111-111111111111', 'Kitchen',       'Wash up dishes and wipe counters',     'kitchen',         2,   'https://picsum.photos/seed/ww-shoreditch-1/1024/768'),
  ('11111111-1111-4111-8111-111111111111', 'Kitchen',       'Empty overflowing recycling bin',      'bins',            1,   'https://picsum.photos/seed/ww-shoreditch-1/1024/768'),
  ('11111111-1111-4111-8111-111111111111', 'Open plan',     'Clear and wipe hot desks',             'desks',           0.5, 'https://picsum.photos/seed/ww-shoreditch-2/1024/768'),
  ('11111111-1111-4111-8111-111111111111', 'Open plan',     'Push chairs in and reset breakout sofa','furniture_reset', 0.5, 'https://picsum.photos/seed/ww-shoreditch-2/1024/768'),

  ('22222222-2222-4222-8222-222222222222', 'Bathroom',      'Clean toilet and sink',                'toilet',          3,   'https://picsum.photos/seed/ww-kx-1/1024/768'),
  ('22222222-2222-4222-8222-222222222222', 'Kitchen',       'Clean microwave and fridge shelves',   'kitchen',         2,   'https://picsum.photos/seed/ww-kx-1/1024/768'),
  ('22222222-2222-4222-8222-222222222222', 'Meeting room',  'Hoover carpet and pick up litter',     'floor',           1,   'https://picsum.photos/seed/ww-kx-2/1024/768'),
  ('22222222-2222-4222-8222-222222222222', 'Meeting room',  'Empty bins',                           'bins',            1,   'https://picsum.photos/seed/ww-kx-2/1024/768'),

  ('33333333-3333-4333-8333-333333333333', 'Studio',        'Mop the floor by the entrance',        'floor',           1,   'https://picsum.photos/seed/ww-borough-1/1024/768'),
  ('33333333-3333-4333-8333-333333333333', 'Studio',        'Wipe down desks',                      'desks',           0.5, 'https://picsum.photos/seed/ww-borough-1/1024/768');
