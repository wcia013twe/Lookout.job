-- Restore Circle availability through the existing membership and consent checks.
update private.knowledge_config set enabled = true where singleton;
