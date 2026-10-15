-- Per-question flags the app needs to render and score correctly.
--   is_multi_select: "select all that apply" MC; correct_option then holds a
--                    comma-separated set like 'A,C,D' and only an exact match
--                    counts as correct.
--   needs_drawing:   the question asks for a diagram (tree, graph, UML...);
--                    the app shows a hint that a text representation is fine.

alter table questions
  add column if not exists is_multi_select boolean not null default false,
  add column if not exists needs_drawing boolean not null default false;
