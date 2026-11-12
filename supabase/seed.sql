-- Three live London offices with open tasks, so /find has data.
-- Fixed ids so other tracks can deep-link while building.
-- Photos live in /public/seed (generated with grok-imagine). Relative URLs are resolved
-- against the request origin by the API before they go to Grok.
-- public/seed/kitchen-after.jpg is a matching "cleaned" shot for demoing a pass on the Shoreditch kitchen task.

insert into public.offices (id, name, address, lat, lng, crew_size, dirt_score, status, photo_urls) values
  ('11111111-1111-4111-8111-111111111111', 'Shoreditch Loft',     '86-90 Paul St, London EC2A 4NE',   51.5246, -0.0848, 2, 8, 'live',
    array['/seed/kitchen-before.jpg','/seed/openplan-before.jpg']),
  ('22222222-2222-4222-8222-222222222222', 'King''s Cross Studio', '4 Pancras Square, London N1C 4AG', 51.5338, -0.1259, 3, 9, 'live',
    array['/seed/bathroom-before.jpg','/seed/meeting-before.jpg']),
  ('33333333-3333-4333-8333-333333333333', 'Borough Works',       '1 Southwark St, London SE1 1RQ',   51.5054, -0.0910, 2, 6, 'live',
    array['/seed/studio-before.jpg','/seed/breakout-before.jpg']);

insert into public.tasks (office_id, room, title, category, credit_hours, before_url) values
  ('11111111-1111-4111-8111-111111111111', 'Kitchen',      'Wash the dishes in the sink and wipe the stained counters', 'kitchen',         2,   '/seed/kitchen-before.jpg'),
  ('11111111-1111-4111-8111-111111111111', 'Kitchen',      'Empty the overflowing bin and fit a fresh liner',          'bins',            1,   '/seed/kitchen-before.jpg'),
  ('11111111-1111-4111-8111-111111111111', 'Open plan',    'Clear cups, boxes and paper off the hot desks',             'desks',           0.5, '/seed/openplan-before.jpg'),
  ('11111111-1111-4111-8111-111111111111', 'Open plan',    'Push the chairs back under the desks',                      'furniture_reset', 0.5, '/seed/openplan-before.jpg'),

  ('22222222-2222-4222-8222-222222222222', 'Bathroom',     'Scrub the toilet and the grimy sink',                       'toilet',          3,   '/seed/bathroom-before.jpg'),
  ('22222222-2222-4222-8222-222222222222', 'Bathroom',     'Empty the bin and pick up paper towels',                    'bins',            1,   '/seed/bathroom-before.jpg'),
  ('22222222-2222-4222-8222-222222222222', 'Meeting room', 'Hoover the carpet and pick up litter',                      'floor',           1,   '/seed/meeting-before.jpg'),
  ('22222222-2222-4222-8222-222222222222', 'Meeting room', 'Clear the pizza boxes and wipe the table',                  'desks',           0.5, '/seed/meeting-before.jpg'),

  ('33333333-3333-4333-8333-333333333333', 'Studio',       'Sweep and mop the muddy entrance floor',                    'floor',           1,   '/seed/studio-before.jpg'),
  ('33333333-3333-4333-8333-333333333333', 'Studio',       'Clear the clutter and mugs off the desks',                  'desks',           0.5, '/seed/studio-before.jpg'),
  ('33333333-3333-4333-8333-333333333333', 'Breakout',     'Put the cushions and beanbags back',                        'furniture_reset', 0.5, '/seed/breakout-before.jpg'),
  ('33333333-3333-4333-8333-333333333333', 'Breakout',     'Bin the cans and crisp packets',                            'bins',            1,   '/seed/breakout-before.jpg');
