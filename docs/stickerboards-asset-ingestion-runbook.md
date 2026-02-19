# Stickerboards Asset Ingestion Runbook

## Preconditions

This ingestion process is meant to be executed from a development machine with access to the appropriate database.
It CAN be run on the server, but a large ingestion may block for long enough to cause issues and is not recommended.

This document prescribes command line actions to hit the ingestion endpoints, but everything after manifesting can be
performed by a user with the role 'admin' from the ingestion dashboard. Newly released stickers can be manually awarded
from the admin Sticker Picker.

Directory structure:

    data/
      assets/
        staged/
        processed/
        manifests/
          packs/
          generated/
        uploads/

Key locations:

-   Raw input images: `data/assets/staged/<pack_folder>/`
-   Processed output images: `data/assets/processed/`
-   Pack index: `data/assets/manifests/packs/<pack>.source.json`
-   Generated manifest: `data/assets/manifests/generated/`
-   Upload batches: `data/assets/uploads/<batchId>/`

------------------------------------------------------------------------

# 1. Add Raw Files

Create staged folder:

``` bash
mkdir -p data/assets/staged/<pack_folder>
```

Copy raw images:

``` bash
cp /path/to/raw/* data/assets/staged/<pack_folder>/
```

Folder name must be deterministic and stable. Recommend no spaces.

------------------------------------------------------------------------

# 2. Run Image Transform (Sharp Stage)

Transforms staged → processed using profiles.

``` bash
npm run optimize:assets
```

Expected output structure:

    data/assets/processed/<pack_folder>/<inputRef>/
      thumb.webp
      small.webp
      medium.webp
      full.png

Verify:

``` bash
ls data/assets/processed/<pack_folder>
```

------------------------------------------------------------------------

# 3. Verify Pack Index

File:

    data/assets/manifests/packs/<pack>.source.json

Manually build this from the template in data/assets/manifests/example_pack.source.json to input sticker
names, tags, description, etc.

Ensure:

-   `inputRef` values exactly match folder path to that sticker's assets under `processed/`
-   No O/0 mismatches
-   Metadata is correct (name, description, tags)

Sanity check:

``` bash
jq -r '.stickers[].inputRef' data/assets/manifests/packs/<pack>.source.json
```

------------------------------------------------------------------------

# 4. Generate Manifest + Upload Plan

Creates:

-   `manifest.<batchId>.json`
-   `uploads/<batchId>/`
-   `_upload.json`
-   hardlinked staged files

Run:

``` bash
npm -w @stickerboards/image-pipeline run manifest -- --pack <pack>.source.json
```

Record the printed `batchId`.

------------------------------------------------------------------------

# 5. Validate Batch (API Preflight)

``` bash
curl -X POST http://localhost:5050/api/v1/admin/catalog/ingest-batch/validate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{"batchId":"<batchId>"}'
```

Must return:

    ok: true

------------------------------------------------------------------------

# 6. Ingest Batch (Upload + DB Apply)

``` bash
curl -X POST http://localhost:5050/api/v1/admin/catalog/ingest-batch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{"batchId":"<batchId>"}'
```

This performs:

-   Object store uploads
-   StickerPack upsert (draft)
-   StickerDefinition upsert (`status="ready"`)
-   OperationLog tracking

Wait until:

    status: "completed"
    phase: "complete"

------------------------------------------------------------------------

# 7. Publish Pack (Lifecycle Gate)

Ingestion does NOT activate packs.

List packs:

``` bash
curl http://localhost:5050/api/v1/admin/packs \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

Publish:

``` bash
curl -X POST http://localhost:5050/api/v1/admin/packs/<packId>/publish \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

Effects:

-   `pack.isActive = true`
-   Stickers `status = "active"`
-   AuditEvent emitted

------------------------------------------------------------------------

# Final Verification Checklist

-   OperationLog shows `completed`
-   Objects exist in object store
-   Pack `isActive = true`
-   Stickers `status = active`
-   AuditEvent recorded
-   Stickers render on site

------------------------------------------------------------------------

# End-to-End Summary

    staged → optimize → processed
    processed + pack index → manifest → batchId
    validate → ingest → completed
    publish → active

That is the complete ingestion lifecycle.
