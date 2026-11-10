"""Owner-scoped fictional IDs shared by communication case preparation."""
import json,uuid

def fixture_for_owner(fixture,owner):
 # Application UUIDs are globally unique; remap all references, including contact tags.
 mapping={fixture[key]['id']:str(uuid.uuid5(uuid.UUID(owner),fixture[key]['id'])) for key in ['application','sentinelApplication']}
 text=json.dumps(fixture)
 for old,new in mapping.items():text=text.replace(old,new)
 return json.loads(text)

