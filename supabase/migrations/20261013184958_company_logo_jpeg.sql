-- Two existing branding assets are JPEG despite their local .png filenames.
update storage.buckets set allowed_mime_types=array['image/png','image/jpeg'] where id='company-logos';
