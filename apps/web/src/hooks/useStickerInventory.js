import { useState, useCallback } from 'react';

export const useStickerInventory = () => {
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchUserStickerInventory = useCallback(async (userId) => {
        if (!userId) return [];
        setLoading(true);
        try {
            const response = await fetch(`/api/v1/stickers/inventory/${userId}`);
            const data = await response.json();
            setInventory(data);
            return data;
        } catch (error) {
            console.error('Failed to fetch sticker inventory:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    }, []);

    const awardSticker = useCallback(async (userId, stickerId, opId) => {
        const response = await fetch(`/api/v1/stickers/award/${userId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                stickerId,
                opId,
                userId
            })
        });

        if (!response.ok) {
            throw new Error('Failed to award sticker');
        }

        const result = await response.json();
        return result;
    }, []);

    const revokeSticker = useCallback(async (userId, stickerId, opId) => {
        const response = await fetch(`/api/v1/stickers/revoke/${userId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                stickerId,
                opId,
                userId
            })
        });

        if (!response.ok) {
            throw new Error('Failed to revoke sticker');
        }

        const result = await response.json();
        return result;
    }, []);

    return {
        inventory,
        fetchUserStickerInventory,
        awardSticker,
        revokeSticker,
        loading
    };
};