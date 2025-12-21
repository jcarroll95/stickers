import React from "react";
import { Image as KonvaImage, Layer, Stage } from "react-konva";
import useImage from "use-image";

export default function StickerInterface() {
    const [image] = useImage("/default.jpeg");

    return (
        <Stage width={500} height={500}>
            <Layer>
                <KonvaImage image={image} />
            </Layer>
        </Stage>
    );
}
