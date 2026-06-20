#!/usr/bin/env bash
#
# Create the data table that backs the Data Table Cache node, with the recommended
# schema, via the n8n public API.
#
# Usage:
#   export N8N_BASE_URL="http://localhost:5678/api/v1"   # must end in /api/v1
#   export N8N_API_KEY="<your n8n API key>"               # Settings → n8n API
#   ./create-data-table.sh [table-name]
#
# The API key needs the scope: dataTable:create
#
set -euo pipefail

: "${N8N_BASE_URL:?Set N8N_BASE_URL, e.g. http://localhost:5678/api/v1}"
: "${N8N_API_KEY:?Set N8N_API_KEY to your n8n API key}"

TABLE_NAME="${1:-cache}"

# All columns are 'string': the node stores JSON.stringify(payload) and ISO-8601
# timestamps as text, and reads them back as text. id / createdAt / updatedAt are
# added automatically by n8n.
curl -sS -X POST "${N8N_BASE_URL%/}/data-tables" \
  -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$(cat <<JSON
{
  "name": "${TABLE_NAME}",
  "columns": [
    { "name": "cache_key",     "type": "string" },
    { "name": "payload",       "type": "string" },
    { "name": "last_modified", "type": "string" },
    { "name": "last_access",   "type": "string" }
  ]
}
JSON
)"

echo
echo "Created data table '${TABLE_NAME}'. Copy its id from the response above into the node's Data Table field."
