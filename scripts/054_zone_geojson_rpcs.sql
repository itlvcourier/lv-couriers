-- ============================================================
-- PHASE 3: Visual zone manager RPC helpers
-- Mirrors migration `phase3_zone_geojson_rpcs`.
-- ============================================================

-- List zones with geometry serialized as GeoJSON so the client can draw them.
CREATE OR REPLACE FUNCTION zones_geojson()
RETURNS TABLE (
  id uuid,
  name text,
  color text,
  fsa_codes text[],
  priority int,
  is_active boolean,
  created_at timestamptz,
  geojson text
) LANGUAGE sql STABLE AS $$
  SELECT z.id, z.name, z.color, z.fsa_codes, z.priority, z.is_active, z.created_at,
         CASE WHEN z.geom IS NULL THEN NULL ELSE ST_AsGeoJSON(z.geom) END AS geojson
  FROM zones z
  ORDER BY z.priority DESC, z.name ASC;
$$;

-- Set (or clear) a zone polygon from a GeoJSON geometry string.
CREATE OR REPLACE FUNCTION upsert_zone_geom(p_zone_id uuid, p_geojson text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_geojson IS NULL OR length(btrim(p_geojson)) = 0 THEN
    UPDATE zones SET geom = NULL WHERE id = p_zone_id;
  ELSE
    UPDATE zones
       SET geom = ST_Multi(ST_CollectionExtract(
                    ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson), 4326)), 3))
       WHERE id = p_zone_id;
    UPDATE zones
       SET geom = ST_GeometryN(geom, 1)
       WHERE id = p_zone_id AND GeometryType(geom) = 'MULTIPOLYGON' AND ST_NumGeometries(geom) = 1;
  END IF;
END; $$;

-- Live active-parcel counts per zone (dropoff zone, non-terminal statuses).
CREATE OR REPLACE FUNCTION zone_parcel_counts()
RETURNS TABLE (zone_id uuid, parcel_count bigint)
LANGUAGE sql STABLE AS $$
  SELECT d.dropoff_zone_id AS zone_id, count(*)::bigint AS parcel_count
  FROM deliveries d
  WHERE d.dropoff_zone_id IS NOT NULL
    AND d.status::text NOT IN ('delivered', 'cancelled', 'failed_permanent')
  GROUP BY d.dropoff_zone_id;
$$;
