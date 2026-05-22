-- seed.sql: 基礎資料

insert into schools (code, name_zh, name_en) values
  ('NCKU', '國立成功大學', 'National Cheng Kung University'),
  ('NCU',  '國立中央大學', 'National Central University'),
  ('NCCU', '國立政治大學', 'National Chengchi University');

insert into departments (school_id, name_zh, degree_level) values
  ((select id from schools where code = 'NCKU'), '資訊管理研究所', 'master'),
  ((select id from schools where code = 'NCU'),  '資訊管理學系碩士班', 'master'),
  ((select id from schools where code = 'NCCU'), '資訊管理學系碩士班', 'master');

insert into subjects (code, name_zh, name_en) values
  ('MIS',   '管理資訊系統', 'Management Information Systems'),
  ('DS',    '資料結構',     'Data Structures'),
  ('CS',    '計算機概論',   'Introduction to Computer Science'),
  ('STAT',  '統計學',       'Statistics'),
  ('DB',    '資料庫',       'Database'),
  ('NET',   '網路概論',     'Computer Networks'),
  ('OS',    '作業系統',     'Operating Systems'),
  ('ALGO',  '演算法',       'Algorithms'),
  ('MGMT',  '管理學',       'Management'),
  ('MIXED', '綜合（整合卷）', 'Mixed');
