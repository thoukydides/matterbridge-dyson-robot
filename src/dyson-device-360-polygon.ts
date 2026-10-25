// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import { Dyson360Point } from './dyson-360-types.js';

// Use winding number to determine whether a point is within a polygon
export function isPointInPolygon(p: Dyson360Point, polygon: Dyson360Point[]): boolean {
    let windingNumber = 0;
    let v1 = polygon.at(-1);    // (last point closes the polygon)
    if (!v1) return false;      // (cannot be inside without any vertices)
    for (const v2 of polygon) {
        // Treat a point coincident with a vertex as inside the polygon
        if (p.x === v2.x && p.y === v2.y) return true;

        // Similarly a point on a horizontal edge is considered as inside
        if (p.y === v1.y && p.y === v2.y
            && Math.min(v1.x, v2.x) <= p.x && p.x <= Math.max(v1.x, v2.x)) {
            return true;
        }

        // Use cross product to determine if line is to the left of the point
        const crossProduct = (v2.x - v1.x) * (p.y - v1.y) - (p.x - v1.x) * (v2.y - v1.y);
        if (v1.y <= p.y && p.y < v2.y && 0 < crossProduct) ++windingNumber; // Upward line
        if (v2.y <= p.y && p.y < v1.y && crossProduct < 0) --windingNumber; // Downward line
        v1 = v2;
    }
    return windingNumber !== 0;
}