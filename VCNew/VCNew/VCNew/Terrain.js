import * as THREE from 'https://unpkg.com/three@0.126.1/build/three.module.js';

export class TerrainManager {
    constructor(scene) {
        this.scene = scene;
        this.terrainMesh = null;
        this.heightScale = 30;
        this.worldSize = 400;

        // Real World Coordinates (User Provided)
        this.bounds = {
            north: 2637264.5060,
            south: 2636558.4073,
            west: 8098996.3782,
            east: 8099677.1552
        };

        console.log("Terrain Bounds Set:", this.bounds);

        this.mapWidth = this.bounds.east - this.bounds.west;
        this.mapHeight = this.bounds.north - this.bounds.south;
    }

    async loadTerrain(heightmapUrl, textureUrl) {
        console.log("Loading Terrain:", heightmapUrl, textureUrl);

        // 1. Load Images
        let heightImage = null;
        let textureImage = null;
        try {
            const promises = [this.loadImage(textureUrl)];
            if (heightmapUrl) {
                promises.push(this.loadImage(heightmapUrl));
            }

            const results = await Promise.all(promises);
            textureImage = results[0];
            if (heightmapUrl) heightImage = results[1];

        } catch (e) {
            console.error("Failed to load map assets", e);
            return;
        }

        // 2. Get Data
        const segments = 256;
        let data;

        if (heightImage) {
            data = this.getHeightData(heightImage);
        } else {
            console.log("No heightmap provided. Generating flat terrain.");
            data = new Uint8Array(segments * segments * 4).fill(0);
        }

        // Store data for lookups
        this.heightData = data;
        this.segments = segments;

        // 3. Create Geometry
        const geometry = new THREE.PlaneGeometry(this.worldSize, this.worldSize, segments - 1, segments - 1);

        // 4. Apply Heights
        const vertices = geometry.attributes.position.array;

        for (let i = 0, j = 0; i < vertices.length; i += 3, j++) {
            const heightVal = data[j] || 0;
            vertices[i + 2] = (heightVal / 255) * this.heightScale;
        }

        geometry.computeVertexNormals();

        // 5. Material
        const texture = new THREE.CanvasTexture(textureImage);
        texture.encoding = THREE.sRGBEncoding;

        const material = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.9,
            metalness: 0.1,
            side: THREE.DoubleSide,
            transparent: true,
            alphaTest: 0.1
        });

        // 6. Mesh
        this.terrainMesh = new THREE.Mesh(geometry, material);
        this.terrainMesh.rotation.x = -Math.PI / 2; // Flat on ground
        this.terrainMesh.receiveShadow = true;

        // Adjust position Y. For flat map, maybe 0 is better? 
        // Stick to -5 so it's slightly below grid if any? Or 0.
        this.terrainMesh.position.y = -0.1; // Just below any grid helpers

        this.scene.add(this.terrainMesh);
        console.log("Terrain Added!");
        return this.terrainMesh;
    }

    getHeightAt(x, z) {
        // For flat map, just return the mesh position Y
        if (!this.heightData) return this.terrainMesh?.position.y || 0;

        // If we have data, we calculate (logic preserved from before)
        const half = this.worldSize / 2;
        const u = (x + half) / this.worldSize;
        const v = 1 - (z + half) / this.worldSize;

        if (u < 0 || u > 1 || v < 0 || v > 1) return this.terrainMesh.position.y;

        const col = Math.floor(u * (this.segments - 1));
        const row = Math.floor((1 - v) * (this.segments - 1)); // row 0 is North (top of image), v=1 is North
        const index = (row * this.segments) + col;
        const hVal = this.heightData[index] || 0;
        const worldHeight = (hVal / 255) * this.heightScale;

        return worldHeight + this.terrainMesh.position.y;
    }

    loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => resolve(img);
            img.onerror = (e) => reject(e);
            img.src = url;
        });
    }

    getHeightData(image) {
        const canvas = document.createElement('canvas');
        const size = 256;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0, size, size);
        const imgData = ctx.getImageData(0, 0, size, size);
        const pixelData = imgData.data;
        const heights = [];
        for (let i = 0; i < pixelData.length; i += 4) {
            heights.push(pixelData[i]);
        }
        return heights;
    }
}
