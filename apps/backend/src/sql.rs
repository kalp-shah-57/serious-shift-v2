//! Read queries. Each returns a single `json` scalar so the handler is trivial.
//! Shapes mirror the legacy export_to_json.py byte-for-byte (same columns,
//! same ordering) so the frontend contract is unchanged.

pub const THINKERS: &str = r#"
SELECT coalesce(json_agg(row_to_json(q) ORDER BY q.credibility_score DESC NULLS LAST), '[]'::json)
FROM (
  SELECT t.*,
    (SELECT count(*) FROM predictions WHERE thinker_id = t.id)                        AS prediction_count,
    (SELECT count(*) FROM predictions WHERE thinker_id = t.id AND status <> 'pending') AS evaluated_count,
    (SELECT count(*) FROM claims      WHERE thinker_id = t.id)                        AS claim_count,
    (SELECT count(*) FROM sources     WHERE thinker_id = t.id)                        AS source_count
  FROM thinkers t
) q"#;

pub const SOURCES: &str = r#"
SELECT coalesce(json_agg(row_to_json(q) ORDER BY q.date_published DESC NULLS LAST), '[]'::json)
FROM (
  SELECT s.*, t.name AS thinker_name
  FROM sources s JOIN thinkers t ON s.thinker_id = t.id
) q"#;

pub const CLAIMS: &str = r#"
SELECT coalesce(json_agg(row_to_json(q) ORDER BY coalesce(q.claim_weight, 0) DESC), '[]'::json)
FROM (
  SELECT c.*, t.name AS thinker_name, t.credibility_score,
         s.title AS source_title, s.date_published AS source_date, s.source_depth
  FROM claims c
  JOIN thinkers t ON c.thinker_id = t.id
  LEFT JOIN sources s ON c.source_id = s.id
) q"#;

pub const PREDICTIONS: &str = r#"
SELECT coalesce(json_agg(row_to_json(q) ORDER BY q.evaluation_date NULLS LAST), '[]'::json)
FROM (
  SELECT p.*, t.name AS thinker_name, t.credibility_score, s.title AS source_title
  FROM predictions p
  JOIN thinkers t ON p.thinker_id = t.id
  LEFT JOIN sources s ON p.source_id = s.id
) q"#;

pub const CONCEPTS: &str =
    "SELECT coalesce(json_agg(row_to_json(q)), '[]'::json) FROM (SELECT * FROM concepts) q";

pub const TENSIONS: &str =
    "SELECT coalesce(json_agg(row_to_json(q)), '[]'::json) FROM (SELECT * FROM tensions) q";

pub const DISAGREEMENTS: &str = r#"
SELECT coalesce(json_agg(row_to_json(q)), '[]'::json)
FROM (
  SELECT td.*, t1.name AS thinker_a_name, t2.name AS thinker_b_name
  FROM thinker_disagreements td
  JOIN thinkers t1 ON td.thinker_a_id = t1.id
  JOIN thinkers t2 ON td.thinker_b_id = t2.id
) q"#;

pub const CLAIM_CONCEPTS: &str = r#"
SELECT coalesce(json_agg(row_to_json(q)), '[]'::json)
FROM (
  SELECT cc.claim_id, cc.concept_id, c2.name AS concept_name
  FROM claim_concepts cc JOIN concepts c2 ON cc.concept_id = c2.id
) q"#;

pub const STATS: &str = r#"
SELECT json_build_object(
  'thinkers',              (SELECT count(*) FROM thinkers),
  'sources',               (SELECT count(*) FROM sources),
  'claims',                (SELECT count(*) FROM claims),
  'predictions',           (SELECT count(*) FROM predictions),
  'concepts',              (SELECT count(*) FROM concepts),
  'tensions',              (SELECT count(*) FROM tensions),
  'disagreements',         (SELECT count(*) FROM thinker_disagreements),
  'evaluated_predictions', (SELECT count(*) FROM predictions WHERE status <> 'pending'),
  'avg_credibility',       (SELECT round(avg(credibility_score)::numeric, 1) FROM thinkers),
  'claims_by_domain',      (SELECT coalesce(json_object_agg(domain, c), '{}'::json)
                            FROM (SELECT domain, count(*) c FROM claims WHERE domain IS NOT NULL GROUP BY domain) d),
  'predictions_by_status', (SELECT coalesce(json_object_agg(status, c), '{}'::json)
                            FROM (SELECT status, count(*) c FROM predictions WHERE status IS NOT NULL GROUP BY status) p)
)"#;
