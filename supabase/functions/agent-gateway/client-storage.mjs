// The local Edge Runtime reaches Kong through a container hostname. Only signed
// Storage capabilities returned to clients need the public, host-accessible URL.
// This is server configuration, never a URL supplied in an agent request.
export function clientStorage(storage, {internalUrl, publicUrl} = {}) {
  if (!publicUrl) return storage;
  const internal = new URL(internalUrl);
  const external = new URL(publicUrl);
  if (external.username || external.password || external.pathname !== '/' || external.search || external.hash ||
      !(external.protocol === 'https:' || external.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(external.hostname))) {
    throw Error('Public Supabase URL must be an HTTPS origin or local HTTP origin');
  }
  const signed = async (method, args) => {
    const result = await storage[method](...args);
    if (result.error || !result.data?.signedUrl) return result;
    const url = new URL(result.data.signedUrl);
    if (url.origin !== internal.origin || !url.pathname.startsWith('/storage/v1/')) {
      throw Error('Unexpected signed Storage URL');
    }
    // Preserve the exact signed path/query; never alter object ownership or tokens.
    return {...result, data: {...result.data, signedUrl: external.origin + url.pathname + url.search}};
  };
  return {
    createSignedUrl: (...args) => signed('createSignedUrl', args),
    createSignedUploadUrl: (...args) => signed('createSignedUploadUrl', args),
    download: (...args) => storage.download(...args),
  };
}
