-- AlterTable
ALTER TABLE "products" ADD COLUMN "tsv_search" tsvector;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "products_tsv_search_idx" ON "products" USING gin ("tsv_search");

-- Create Arabic Normalization Function
CREATE OR REPLACE FUNCTION normalize_arabic(input_text TEXT)
RETURNS TEXT AS $$
DECLARE
    result TEXT;
BEGIN
    IF input_text IS NULL THEN
        RETURN NULL;
    END IF;

    -- Remove diacritics (Harakat / Tashkeel)
    -- U+064B (Fathatayn) to U+0652 (Sukun)
    -- U+0653 (Maddah above) to U+0655 (Hamza below)
    -- U+0670 (Superscript/Dagger Alef)
    result := translate(
        input_text,
        chr(1611) || chr(1612) || chr(1613) || chr(1614) || chr(1615) || chr(1616) || chr(1617) || chr(1618) || chr(1619) || chr(1620) || chr(1621) || chr(1648),
        ''
    );

    -- Normalize Alef variants to bare Alef (ا)
    -- أ (Alef with Hamza Above) -> ا
    -- إ (Alef with Hamza Below) -> ا
    -- آ (Alef Madda) -> ا
    -- ٱ (Alef Wasla) -> ا
    result := translate(result, 'أإآٱ', 'اااا');

    -- Normalize Yeh / Alef Maqsura to Yeh (ي)
    -- ى (Alef Maqsura) -> ي (Yeh)
    result := translate(result, 'ى', 'ي');

    -- Normalize Teh Marbuta (ة) to Heh (ه)
    -- ة (Teh Marbuta) -> ه (Heh)
    result := translate(result, 'ة', 'ه');

    RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

-- Create Search Vector Generation Function
CREATE OR REPLACE FUNCTION update_product_search_vector(p_id UUID)
RETURNS VOID AS $$
DECLARE
    v_title_en TEXT;
    v_title_ar TEXT;
    v_desc_en TEXT;
    v_desc_ar TEXT;
    v_slug TEXT;
    v_brand_name TEXT;
    v_skus TEXT;
    v_vector TSVECTOR;
    v_arabic_cfg TEXT := 'simple';
BEGIN
    -- Determine if 'arabic' text search config is available
    IF EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'arabic') THEN
        v_arabic_cfg := 'arabic';
    END IF;

    -- Get product fields
    SELECT 
        title_translations->>'en',
        title_translations->>'ar',
        description_translations->>'en',
        description_translations->>'ar',
        slug,
        (SELECT name FROM brands WHERE id = p.brand_id)
    INTO
        v_title_en,
        v_title_ar,
        v_desc_en,
        v_desc_ar,
        v_slug,
        v_brand_name
    FROM products p
    WHERE id = p_id;

    -- Get all SKUs for the product
    SELECT coalesce(string_agg(sku, ' '), '')
    INTO v_skus
    FROM product_variants
    WHERE product_id = p_id;

    -- Construct the tsvector
    v_vector := 
        setweight(to_tsvector('english', coalesce(v_title_en, '')), 'A') ||
        setweight(to_tsvector(v_arabic_cfg::regconfig, coalesce(normalize_arabic(v_title_ar), '')), 'A') ||
        setweight(to_tsvector('english', coalesce(v_brand_name, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(v_skus, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(v_slug, '')), 'C') ||
        setweight(to_tsvector('english', coalesce(v_desc_en, '')), 'D') ||
        setweight(to_tsvector(v_arabic_cfg::regconfig, coalesce(normalize_arabic(v_desc_ar), '')), 'D');

    -- Update the product
    UPDATE products
    SET tsv_search = v_vector
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

-- Create Batch Search Vector Refresh Function
CREATE OR REPLACE FUNCTION update_all_product_search_vectors()
RETURNS VOID AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM products LOOP
        PERFORM update_product_search_vector(r.id);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Backfill existing products
SELECT update_all_product_search_vectors();
