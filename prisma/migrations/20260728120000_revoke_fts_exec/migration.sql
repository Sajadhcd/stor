-- Revoke execution from PUBLIC to prevent unintended access
REVOKE EXECUTE ON FUNCTION normalize_arabic(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION update_product_search_vector(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION update_all_product_search_vectors(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION process_audit_log() FROM PUBLIC;

-- Explicitly revoke from nexio_app if default privileges granted it
REVOKE EXECUTE ON FUNCTION update_all_product_search_vectors(uuid) FROM nexio_app;
