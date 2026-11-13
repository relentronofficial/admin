import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default async function Icon() {
  // ImageResponse (Satori) needs TTF/OTF data, not the WOFF2 the page uses.
  const nexaBold = await readFile(join(process.cwd(), 'app/fonts/Nexa-Bold.ttf'));

  return new ImageResponse(
    (
      <div
        style={{
          background: '#dc2626',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '6px',
          fontFamily: 'Nexa',
          fontWeight: 700,
          fontSize: 20,
          color: 'white',
          letterSpacing: '-1px',
        }}
      >
        T
      </div>
    ),
    { ...size, fonts: [{ name: 'Nexa', data: nexaBold, weight: 700, style: 'normal' }] }
  );
}
