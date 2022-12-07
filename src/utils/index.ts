// Encodes Uint8Array to a string.
export const encoder = new TextEncoder();

// Decodes a string to a Uint8Array.
export const decoder = new TextDecoder();

export const isClientSide = () => {
  return typeof window !== 'undefined';
};

export const exportDataToFile = (data: any) => {
  const filename = 'speakeasyIdentity.json';

  const file = new Blob([data], { type: 'text/plain' });
  const a = document.createElement('a');
  const url = URL.createObjectURL(file);
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(function() {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 0);
};