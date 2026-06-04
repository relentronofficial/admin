import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
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
          fontFamily: 'sans-serif',
          fontWeight: 700,
          fontSize: 20,
          color: 'white',
          letterSpacing: '-1px',
        }}
      >
        T
      </div>
    ),
    { ...size }
  );
}
