import * as THREE from 'https://unpkg.com/three@0.126.1/build/three.module.js';

export class TerrainManager {
    constructor(scene) {
        this.scene = scene;
        this.terrainMesh = null;
        this.heightScale = 30;
        this.worldSize = 800;

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

        let heightImage = null;
        let textureImage = null;

        // Load Texture with primary and fallback options
        const textureCandidates = [textureUrl, './assets/texture.png', './assets/lalpur_c.png'].filter(Boolean);
        for (const candidate of textureCandidates) {
            try {
                textureImage = await this.loadImage(candidate);
                if (textureImage) {
                    console.log(`Successfully loaded texture from: ${candidate}`);
                    break;
                }
            } catch (e) {
                console.warn(`Failed to load texture from candidate ${candidate}:`, e);
            }
        }

        // Load Heightmap if provided
        if (heightmapUrl) {
            try {
                heightImage = await this.loadImage(heightmapUrl);
            } catch (e) {
                console.warn(`Failed to load heightmap from ${heightmapUrl}, falling back to flat terrain.`, e);
            }
        }

        const segments = 256;
        let data;

        if (heightImage) {
            data = this.getHeightData(heightImage);
        } else {
            console.log("No heightmap loaded. Generating flat terrain data.");
            data = new Uint8Array(segments * segments).fill(0);
        }

        this.heightData = data;
        this.segments = segments;

        const geometry = new THREE.PlaneGeometry(this.worldSize, this.worldSize, segments - 1, segments - 1);
        const vertices = geometry.attributes.position.array;

        for (let i = 0, j = 0; i < vertices.length; i += 3, j++) {
            const heightVal = data[j] || 0;
            vertices[i + 2] = (heightVal / 255) * this.heightScale;
        }

        geometry.computeVertexNormals();

        let material;
        if (textureImage) {
            const texture = new THREE.CanvasTexture(textureImage);
            texture.encoding = THREE.sRGBEncoding;
            material = new THREE.MeshStandardMaterial({
                map: texture,
                roughness: 0.9,
                metalness: 0.1,
                side: THREE.DoubleSide
            });
        } else {
            console.warn("Using fallback colored material for terrain.");
            material = new THREE.MeshStandardMaterial({
                color: 0x448844,
                roughness: 0.9,
                metalness: 0.1,
                side: THREE.DoubleSide
            });
        }

        this.terrainMesh = new THREE.Mesh(geometry, material);
        this.terrainMesh.rotation.x = -Math.PI / 2;
        this.terrainMesh.receiveShadow = true;
        this.terrainMesh.position.y = -0.1;

        this.scene.add(this.terrainMesh);
        console.log("Terrain Mesh added to scene!");
        return this.terrainMesh;
    }

    getHeightAt(x, z) {
        const meshY = (this.terrainMesh && this.terrainMesh.position) ? this.terrainMesh.position.y : 0;
        if (!this.heightData) return meshY;

        const half = this.worldSize / 2;
        const u = (x + half) / this.worldSize;
        const v = 1 - (z + half) / this.worldSize;

        if (u < 0 || u > 1 || v < 0 || v > 1) return meshY;

        const col = Math.floor(u * (this.segments - 1));
        const row = Math.floor((1 - v) * (this.segments - 1));
        const index = (row * this.segments) + col;
        const hVal = this.heightData[index] || 0;
        const worldHeight = (hVal / 255) * this.heightScale;

        return worldHeight + meshY;
    }

    loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
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
