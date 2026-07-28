-- Create a consistent database helper to generate tsquery for FTS
CREATE OR REPLACE FUNCTION build_catalog_search_query(p_keyword text)
RETURNS tsquery
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
AS $$
DECLARE
    v_norm_ar text;
    v_arabic_cfg text := 'arabic';
    v_english_query tsquery;
    v_arabic_query tsquery;
BEGIN
    IF p_keyword IS NULL OR trim(p_keyword) = '' THEN
        RETURN ''::tsquery;
    END IF;

    -- Ensure the arabic dictionary exists, fallback to simple
    IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'arabic') THEN
        v_arabic_cfg := 'simple';
    END IF;

    v_norm_ar := normalize_arabic(p_keyword);

    v_english_query := plainto_tsquery('english', p_keyword);

    IF v_norm_ar IS NULL OR trim(v_norm_ar) = '' THEN
        RETURN v_english_query;
    END IF;

    v_arabic_query := plainto_tsquery(v_arabic_cfg::regconfig, v_norm_ar);

    -- Combine queries if both are non-empty, otherwise return the non-empty one
    IF v_english_query = ''::tsquery AND v_arabic_query = ''::tsquery THEN
        RETURN ''::tsquery;
    ELSIF v_english_query = ''::tsquery THEN
        RETURN v_arabic_query;
    ELSIF v_arabic_query = ''::tsquery THEN
        RETURN v_english_query;
    ELSE
        -- Match either english OR arabic
        RETURN v_english_query || v_arabic_query;
    END IF;
END;
$$;

-- Explicitly revoke from public, grant to app and admin
REVOKE ALL ON FUNCTION build_catalog_search_query(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION build_catalog_search_query(text) TO nexio_app;
GRANT EXECUTE ON FUNCTION build_catalog_search_query(text) TO nexio_admin;
