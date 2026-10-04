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
            console.error("GIS Load Failed:", e);
        }
    }

    processFeatures(features) {
        if (!this.terrain || !this.terrain.bounds) return;

        const { north, south, east, west } = this.terrain.bounds;
        const mapWidth = east - west;
        const mapHeight = north - south;
        const halfSize = this.terrain.worldSize / 2;

        let count = 0;

        // Material fallback handling
        let material;
        if (this.terrain.terrainMesh && this.terrain.terrainMesh.material && this.terrain.terrainMesh.material.map) {
            const terrainTex = this.terrain.terrainMesh.material.map;
            material = new THREE.MeshStandardMaterial({
                map: terrainTex,
                roughness: 0.8,
                metalness: 0.1,
                color: 0xffffff
            });
        } else {
            material = new THREE.MeshStandardMaterial({
                color: 0xcccccc,
                roughness: 0.8,
                metalness: 0.1
            });
        }

        features.forEach((feature) => {
            const geom = feature.geometry;
            if (!geom) return;

            let rings = [];
            if (geom.type === 'Polygon') {
                rings = geom.coordinates;
            } else if (geom.type === 'MultiPolygon') {
                rings = geom.coordinates[0];
            } else return;

            if (!rings || rings.length === 0) return;

            const shape = new THREE.Shape();
            let firstPoint = true;

            let cx = 0, cy = 0;
            let pts = 0;

            rings[0].forEach(coord => {
                const gx = coord[0];
                const gy = coord[1];

                cx += gx; cy += gy; pts++;

                const u = (gx - west) / mapWidth;
                const worldX = (u * this.terrain.worldSize) - halfSize;

                const v = (gy - south) / mapHeight;
                const worldZ = halfSize - (v * this.terrain.worldSize);

                const shapeX = worldX;
                const shapeY = -worldZ;

                if (firstPoint) {
                    shape.moveTo(shapeX, shapeY);
                    firstPoint = false;
                } else {
                    shape.lineTo(shapeX, shapeY);
                }
            });

            const extrudeSettings = {
                steps: 1,
                depth: 5,
                bevelEnabled: false
            };

            const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            geometry.rotateX(-Math.PI / 2);

            const posAttribute = geometry.attributes.position;
            const uvAttribute = geometry.attributes.uv;

            const size = this.terrain.worldSize;

            for (let i = 0; i < posAttribute.count; i++) {
                const x = posAttribute.getX(i);
                const z = posAttribute.getZ(i);

                const u = (x + halfSize) / size;
                const v = 1 - (z + halfSize) / size;

                uvAttribute.setXY(i, u, v);
            }

            uvAttribute.needsUpdate = true;
            geometry.computeVertexNormals();

            const mesh = new THREE.Mesh(geometry, material);

            const centroidU = (cx / (pts || 1) - west) / mapWidth;
            const centroidV = (cy / (pts || 1) - south) / mapHeight;
            const centroidX = (centroidU * this.terrain.worldSize) - halfSize;
            const centroidZ = halfSize - (centroidV * this.terrain.worldSize);
            
            mesh.position.y = this.terrain.getHeightAt(centroidX, centroidZ);
            mesh.userData = { category: 'building', type: 'gis_building', cost: 50, isGIS: true };
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            this.scene.add(mesh);
            count++;
        });

        console.log(`GIS: Generated ${count} Textured 3D Buildings.`);
    }
}
