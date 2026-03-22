import * as THREE from 'https://unpkg.com/three@0.126.1/build/three.module.js';

export class GISLoader {
    constructor(scene, terrainManager) {
        this.scene = scene;
        this.terrain = terrainManager;
        console.log("GIS: Initialized (Procedural Mode)");
    }

    async loadBuildings(url) {
        try {
            const response = await fetch(url);
            const json = await response.json();
            if (json.features) this.processFeatures(json.features);
        } catch (e) {
            console.error("GIS Fail", e);
        }
    }

    processFeatures(features) {
        if (!this.terrain.bounds) return;

        const { north, south, east, west } = this.terrain.bounds;
        const mapWidth = east - west;
        const mapHeight = north - south;
        const halfSize = this.terrain.worldSize / 2;

        let count = 0;

        features.forEach((feature) => {
            const geom = feature.geometry;
            if (!geom) return;

            // We need all rings for the shape
            // Polygon: [ [outer], [hole], [hole]... ]
            let rings = [];
            if (geom.type === 'Polygon') {
                rings = geom.coordinates;
            } else if (geom.type === 'MultiPolygon') {
                // Flatten MultiPolygon to simple separate shapes for now
                // Just take first polygon's rings
                rings = geom.coordinates[0];
                // Ideally we loop continuously but let's keep it simple
            } else return;

            if (rings.length === 0) return;

            // 1. Create Shape from Outer Ring (rings[0])
            const shape = new THREE.Shape();
            let firstPoint = true;

            let cx = 0, cy = 0; // Centroid for color sampling
            let pts = 0;

            rings[0].forEach(coord => {
                const gx = coord[0];
                const gy = coord[1];

                // Accumulate for centroid
                cx += gx; cy += gy; pts++;

                // Map to World
                // u = (gx - west) / width
                // worldX = (u * size) - half
                const u = (gx - west) / mapWidth;
                const worldX = (u * this.terrain.worldSize) - halfSize;

                // v = (gy - south) / height
                // worldY = -((v * size) - half); // In 2D Shape, Y is "Up" (North)
                // Wait, in 3D: Z is "Down" (South).
                // Let's draw the shape in X-Y plane using standard map 2D coords.
                // X = Easting. Y = Northing.
                // Then we extrude along Z? No, Extrude extrudes along Z usually.
                // If we draw in X-Y (Top Down), we then rotate -90.

                // In 2D shape space:
                // x = worldX
                // y = ? 
                // In 3D world: Z maps to -Northing usually.
                // Let's convert Northing to a "Shape Y" that corresponds to World -Z.
                // v = (gy - south) / height (0=South, 1=North).
                // WorldZ = half - (v * size). (Positive=South, Negative=North).
                // So let ShapeY = -WorldZ = (v*size) - half.

                const v = (gy - south) / mapHeight;
                const worldZ = halfSize - (v * this.terrain.worldSize);

                // Shape X,Y corresponds to World X,-Z
                const shapeX = worldX;
                const shapeY = -worldZ; // Invert Z so North is +Y in shape space

                if (firstPoint) {
                    shape.moveTo(shapeX, shapeY);
                    firstPoint = false;
                } else {
                    shape.lineTo(shapeX, shapeY);
                }
            });

            // 2. Extrude
            const extrudeSettings = {
                steps: 1,
                depth: 4,
                bevelEnabled: false
            };

            const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

            // 3. TRANSFORM FIRST (Rotate to correct orientation)
            // We rotate the GEOMETRY, not the Mesh, so we can calculate UVs easily after
            geometry.rotateX(-Math.PI / 2);

            // geometry vertices are now in World Space (mostly) relative to 0,0,0
            // because we created the Shape using World Coordinates.

            // 4. Calculate UVs to match Map
            const posAttribute = geometry.attributes.position;
            const uvAttribute = geometry.attributes.uv;

            const half = this.terrain.worldSize / 2;
            const size = this.terrain.worldSize;

            for (let i = 0; i < posAttribute.count; i++) {
                const x = posAttribute.getX(i);
                const z = posAttribute.getZ(i); // This is World Z (after rotation)

                // Map UV Calculation
                // u = (x + half) / size
                // v = 1 - (z + half) / size (Inverted Z for Map Y)

                const u = (x + half) / size;
                const v = 1 - (z + half) / size;

                uvAttribute.setXY(i, u, v);
            }

            uvAttribute.needsUpdate = true;
            geometry.computeVertexNormals();

            // 5. Material
            // Use the same texture as the terrain!
            const terrainTex = this.terrain.terrainMesh.material.map;
            const material = new THREE.MeshStandardMaterial({
                map: terrainTex,
                roughness: 0.8,
                metalness: 0.1,
                color: 0xffffff // White so texture shows true color
            });

            const mesh = new THREE.Mesh(geometry, material);

            // Centroid world coordinates calculation
            const centroidU = (cx / pts - west) / mapWidth;
            const centroidV = (cy / pts - south) / mapHeight;
            const centroidX = (centroidU * this.terrain.worldSize) - (this.terrain.worldSize / 2);
            const centroidZ = (this.terrain.worldSize / 2) - (centroidV * this.terrain.worldSize);
            
            // Offset Y based on terrain height
            mesh.position.y = this.terrain.getHeightAt(centroidX, centroidZ);

            mesh.userData.isGIS = true;
            this.scene.add(mesh);
            count++;
        });

        console.log(`GIS: Generated ${count} Textured Buildings.`);
        if (window.ui) window.ui.toast(`Generated ${count} Buildings`);
    }
}
