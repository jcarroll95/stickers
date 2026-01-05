import { useMemo } from 'react';
import useImage from 'use-image';

export function useBoardAssets(boardSrc, displayLongEdge = 600) {
  const [bgImage] = useImage(boardSrc);
  const [legacyStickerImage] = useImage("/assets/sticker0.png");

  const boardSize = useMemo(() => {
    const TARGET = Math.max(1, Number(displayLongEdge) || 600);
    if (bgImage?.width && bgImage?.height) {
      const scale = TARGET / Math.max(bgImage.width, bgImage.height);
      return { width: Math.round(bgImage.width * scale), height: Math.round(bgImage.height * scale) };
    }
    return { width: TARGET, height: TARGET };
  }, [bgImage, displayLongEdge]);

  const legacyDefaultScale = useMemo(() => {
    if (!legacyStickerImage) return 1;
    const boardShort = Math.min(boardSize.width, boardSize.height);
    const stickerLong = Math.max(legacyStickerImage.width, legacyStickerImage.height);
    return Math.min(1, 0.35 * (boardShort / stickerLong));
  }, [boardSize, legacyStickerImage]);

  return { bgImage, legacyStickerImage, boardSize, legacyDefaultScale };
}
