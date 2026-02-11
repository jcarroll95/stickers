### The /data/assets/ folder houses in-process database assets for the image-pipeline to work upon.

/data/assets/staged/
-Raw inputs. This is where you drop downloaded art, exports, etc. It can contain subfolders to keep packs organized.
-Allowed: any supported image formats
-Not trusted: filenames, dimensions, alpha correctness, etc.

/data/assets/processed/
-Output of stage one
-Contains pipeline-compliant image variants

/data/assets/manifests/
-You must create a /data/assets/manifests/packs/packname.source.json file covering all stickers you intend to ingest
-Source of truth for database uploads and asset ingestion
-the manifest script will output /data/assets/manifest/generated/ .json manifest
-the manifest script will also put the upload artifact into /data/assets/uploads/

/data/assets/uploads/
-The upload artifact including all formatted/organized asset files
-With these files, the manifest, and the _upload.json plan you have a full package ready to be ingested by API


