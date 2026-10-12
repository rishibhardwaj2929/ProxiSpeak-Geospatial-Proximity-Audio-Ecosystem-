import { useMemo } from "react";
 const PROXIMITY_DISTANCE = 180;

 export function useNearbyUsers( localPosition, users, currentUserId) {
    return useMemo(()=> {
        return users
        .filter((user) => user.id !== currentUserId)
        .map((user) => {
            const dx = (user.x ?? 0) - localPosition.x;
            const dy = (user.y ?? 0) - localPosition.y;
            const distance = Math.sqrt(dx*dx + dy*dy);

            return {
                ...user,
                distance: Math.round(distance),
                isNearby: distance<= PROXIMITY_DISTANCE,
            };
        });
    }, [localPosition, users, currentUserId]);
 }