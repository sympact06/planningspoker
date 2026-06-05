/* eslint-disable */
/* ============================================================
   PokerScene — three.js 3D poker table with camera movement.
   Ported from the Claude Design prototype (poker3d.js) to an
   ES module that imports three + RoundedBoxGeometry directly.
   ============================================================ */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const THEMES = {
    dark: {
        bg: 0x0b0b0d,
        floor: 0x0c0c0f,
        table: 0x202128,
        felt: 0x14203c,
        rim: 0x2f7bf6,
        cardBody: 0x2a2a30,
        paper: '#f4f4f5',
        paperInk: '#18181b',
        accent: '#2f7bf6',
        back: '#1f2b45',
        backAccent: '#3b82f6',
        hemiSky: 0x9fb4d8, hemiGround: 0x0a0a0c, hemiInt: 0.7,
        keyInt: 1.5, accentLight: 0x2f7bf6, accentInt: 0.7,
    },
    light: {
        bg: 0xf4f4f5,
        floor: 0xe7e5e4,
        table: 0xd6d3d1,
        felt: 0xe7e5e4,
        rim: 0x2563eb,
        cardBody: 0xffffff,
        paper: '#ffffff',
        paperInk: '#18181b',
        accent: '#2563eb',
        back: '#dbe4f3',
        backAccent: '#2563eb',
        hemiSky: 0xffffff, hemiGround: 0xcfcdcb, hemiInt: 0.85,
        keyInt: 1.05, accentLight: 0x2563eb, accentInt: 0.25,
    },
};

const CAM = {
    voting: { r: 13.8, theta: 0, phi: 0.86 },
    reveal: { r: 14.2, theta: 0, phi: 0.62 },
    intro: { r: 14.0, theta: 0, phi: 0.80 },
};

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const damp = (cur, tgt, lambda, dt) => cur + (tgt - cur) * (1 - Math.exp(-lambda * dt));

function roundedRectShape(w, h, r) {
    const s = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
}

export class PokerScene {
    constructor(canvas, labelsEl, themeName) {
        this.canvas = canvas;
        this.labelsEl = labelsEl;
        this.theme = THEMES[themeName] || THEMES.dark;
        this.seats = [];        // {id,name,color,you,host,pos:Vec3, card, labelEl}
        this.cards = new Map(); // id -> card object
        this.revealed = false;
        this.camState = 'voting';
        this.cam = { ...CAM.voting };
        this.camTarget = { ...CAM.voting };
        this.drag = { active: false, theta: 0, phi: 0, lastX: 0, lastY: 0, idleT: 0 };
        this.clock = new THREE.Clock();

        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
        this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.theme.bg);
        this.scene.fog = new THREE.Fog(this.theme.bg, 18, 34);

        this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
        this.camLook = new THREE.Vector3(0, 0.1, 0);

        this._buildLights();
        this._buildTable();

        this._onResize = this._resize.bind(this);
        window.addEventListener('resize', this._onResize);
        this.ro = new ResizeObserver(this._onResize);
        this.ro.observe(canvas.parentElement || canvas);

        this._bindDrag();
        this._resize();

        this._running = true;
        this._tmp = new THREE.Vector3();
        this._loop = this._frame.bind(this);
        requestAnimationFrame(this._loop);
    }

    _buildLights() {
        const t = this.theme;
        this.hemi = new THREE.HemisphereLight(t.hemiSky, t.hemiGround, t.hemiInt);
        this.scene.add(this.hemi);

        this.key = new THREE.DirectionalLight(0xffffff, t.keyInt);
        this.key.position.set(6, 14, 7);
        this.key.castShadow = true;
        this.key.shadow.mapSize.set(2048, 2048);
        this.key.shadow.camera.near = 1;
        this.key.shadow.camera.far = 40;
        const d = 14;
        this.key.shadow.camera.left = -d; this.key.shadow.camera.right = d;
        this.key.shadow.camera.top = d; this.key.shadow.camera.bottom = -d;
        this.key.shadow.bias = -0.0004;
        this.key.shadow.radius = 6;
        this.scene.add(this.key);

        this.fill = new THREE.DirectionalLight(0xffffff, 0.25);
        this.fill.position.set(-8, 6, -4);
        this.scene.add(this.fill);

        this.accentLight = new THREE.PointLight(t.accentLight, t.accentInt, 30);
        this.accentLight.position.set(0, 5, 2);
        this.scene.add(this.accentLight);
    }

    _buildTable() {
        const t = this.theme;
        this.tableGroup = new THREE.Group();
        this.scene.add(this.tableGroup);

        // Floor — subtle large-grain texture
        const floorTex = this._floorTexture();
        const floorMat = new THREE.MeshStandardMaterial({ color: t.floor, roughness: 0.95, metalness: 0, map: floorTex.map, bumpMap: floorTex.bump, bumpScale: 0.4 });
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.26;
        floor.receiveShadow = true;
        this.floor = floor;
        this.floorMat = floorMat;
        this.scene.add(floor);

        // Table top — extruded rounded rect with brushed wood texture
        const shape = roundedRectShape(15, 9, 3);
        const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.14, bevelSegments: 3, steps: 1 });
        geo.center();
        geo.rotateX(-Math.PI / 2);
        const woodTex = this._woodTexture();
        const tableMat = new THREE.MeshStandardMaterial({ color: t.table, roughness: 0.65, metalness: 0.08, map: woodTex.map, bumpMap: woodTex.bump, bumpScale: 0.25 });
        const top = new THREE.Mesh(geo, tableMat);
        top.castShadow = true; top.receiveShadow = true;
        this.tableMat = tableMat;
        this.tableGroup.add(top);

        // Felt inlay — woven fabric texture + bump
        const feltShape = roundedRectShape(12.6, 6.8, 2.4);
        const feltGeo = new THREE.ShapeGeometry(feltShape);
        feltGeo.rotateX(-Math.PI / 2);
        this._uvFromBounds(feltGeo, 12.6, 6.8);
        const feltTex = this._feltTexture();
        const feltMat = new THREE.MeshStandardMaterial({ color: t.felt, roughness: 1, metalness: 0, map: feltTex.map, bumpMap: feltTex.bump, bumpScale: 0.18 });
        const felt = new THREE.Mesh(feltGeo, feltMat);
        felt.position.y = 0.31;
        felt.receiveShadow = true;
        this.feltMat = feltMat;
        this.tableGroup.add(felt);

        // Accent rim — thin extruded outline ring
        const ringMat = new THREE.MeshStandardMaterial({ color: t.rim, roughness: 0.4, metalness: 0.2, emissive: t.rim, emissiveIntensity: 0.45 });
        const ringShape = roundedRectShape(13.1, 7.3, 2.6);
        const ringHole = roundedRectShape(12.6, 6.8, 2.4);
        ringShape.holes.push(ringHole);
        const ringGeo = new THREE.ShapeGeometry(ringShape);
        ringGeo.rotateX(-Math.PI / 2);
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.y = 0.315;
        this.ringMat = ringMat;
        this.tableGroup.add(ring);
    }

    // give a ShapeGeometry planar UVs normalized over its XZ bounds
    _uvFromBounds(geo, w, h) {
        geo.computeBoundingBox();
        const pos = geo.attributes.position;
        const uv = [];
        for (let i = 0; i < pos.count; i++) {
            uv.push((pos.getX(i) + w / 2) / w, (pos.getZ(i) + h / 2) / h);
        }
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    }

    _mkTex(c, repeat) {
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        if (repeat) tex.repeat.set(repeat, repeat);
        tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        return tex;
    }
    _mkBump(c, repeat) {
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        if (repeat) tex.repeat.set(repeat, repeat);
        return tex;
    }

    // Woven felt: tonal value-noise + diagonal weave; paired bump
    _feltTexture() {
        const t = this.theme;
        const S = 512;
        const map = document.createElement('canvas'); map.width = map.height = S;
        const bump = document.createElement('canvas'); bump.width = bump.height = S;
        const mg = map.getContext('2d'), bg = bump.getContext('2d');
        const base = hexToRgb(t.felt);
        mg.fillStyle = rgbStr(base); mg.fillRect(0, 0, S, S);
        bg.fillStyle = '#808080'; bg.fillRect(0, 0, S, S);
        // fine speckle (fibers)
        const img = mg.getImageData(0, 0, S, S), d = img.data;
        const bimg = bg.getImageData(0, 0, S, S), bd = bimg.data;
        for (let i = 0; i < d.length; i += 4) {
            const n = (Math.random() - 0.5) * 26;
            d[i] = clamp8(d[i] + n); d[i + 1] = clamp8(d[i + 1] + n); d[i + 2] = clamp8(d[i + 2] + n);
            const bn = 128 + (Math.random() - 0.5) * 60;
            bd[i] = bd[i + 1] = bd[i + 2] = bn;
        }
        mg.putImageData(img, 0, 0); bg.putImageData(bimg, 0, 0);
        // diagonal weave lines on bump
        bg.globalAlpha = 0.5; bg.lineWidth = 1.2;
        for (let o = -S; o < S; o += 5) {
            bg.strokeStyle = 'rgba(255,255,255,0.6)'; bg.beginPath(); bg.moveTo(o, 0); bg.lineTo(o + S, S); bg.stroke();
            bg.strokeStyle = 'rgba(0,0,0,0.5)'; bg.beginPath(); bg.moveTo(o + 2, 0); bg.lineTo(o + 2 + S, S); bg.stroke();
        }
        bg.globalAlpha = 1;
        // very soft, even sheen — no dark center blob
        const grd = mg.createRadialGradient(S / 2, S * 0.44, S * 0.1, S / 2, S / 2, S * 0.75);
        grd.addColorStop(0, 'rgba(255,255,255,0.05)'); grd.addColorStop(0.7, 'rgba(255,255,255,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.07)');
        mg.fillStyle = grd; mg.fillRect(0, 0, S, S);
        return { map: this._mkTex(map, 2), bump: this._mkBump(bump, 5) };
    }

    // Brushed wood rim: tangential streaks
    _woodTexture() {
        const t = this.theme;
        const S = 512;
        const map = document.createElement('canvas'); map.width = map.height = S;
        const bump = document.createElement('canvas'); bump.width = bump.height = S;
        const mg = map.getContext('2d'), bg = bump.getContext('2d');
        const base = hexToRgb(t.table);
        mg.fillStyle = rgbStr(base); mg.fillRect(0, 0, S, S);
        bg.fillStyle = '#808080'; bg.fillRect(0, 0, S, S);
        for (let y = 0; y < S; y++) {
            const streak = Math.sin(y * 0.08) * 8 + (Math.random() - 0.5) * 14;
            mg.fillStyle = rgbStr(shade(base, streak)); mg.fillRect(0, y, S, 1);
            const b = 128 + Math.sin(y * 0.08) * 26 + (Math.random() - 0.5) * 22;
            bg.fillStyle = `rgb(${b | 0},${b | 0},${b | 0})`; bg.fillRect(0, y, S, 1);
        }
        return { map: this._mkTex(map, 1), bump: this._mkBump(bump, 1) };
    }

    // Floor: coarse value-noise concrete
    _floorTexture() {
        const t = this.theme;
        const S = 256;
        const map = document.createElement('canvas'); map.width = map.height = S;
        const bump = document.createElement('canvas'); bump.width = bump.height = S;
        const mg = map.getContext('2d'), bg = bump.getContext('2d');
        const base = hexToRgb(t.floor);
        const img = mg.createImageData(S, S), d = img.data;
        const bimg = bg.createImageData(S, S), bd = bimg.data;
        for (let i = 0; i < d.length; i += 4) {
            const n = (Math.random() - 0.5) * 18;
            const col = shade(base, n);
            d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
            const bn = 128 + (Math.random() - 0.5) * 70;
            bd[i] = bd[i + 1] = bd[i + 2] = bn; bd[i + 3] = 255;
        }
        mg.putImageData(img, 0, 0); bg.putImageData(bimg, 0, 0);
        return { map: this._mkTex(map, 10), bump: this._mkBump(bump, 14) };
    }

    _rebuildSurfaceTextures() {
        const feltTex = this._feltTexture();
        this.feltMat.map = feltTex.map; this.feltMat.bumpMap = feltTex.bump; this.feltMat.needsUpdate = true;
        const woodTex = this._woodTexture();
        this.tableMat.map = woodTex.map; this.tableMat.bumpMap = woodTex.bump; this.tableMat.needsUpdate = true;
        const floorTex = this._floorTexture();
        this.floorMat.map = floorTex.map; this.floorMat.bumpMap = floorTex.bump; this.floorMat.needsUpdate = true;
    }

    /* ---- textures ---- */
    _frontTexture(value) {
        const t = this.theme;
        const c = document.createElement('canvas'); c.width = 256; c.height = 384;
        const g = c.getContext('2d');
        g.fillStyle = t.paper; g.fillRect(0, 0, 256, 384);
        // paper grain
        for (let i = 0; i < 2600; i++) {
            const x = Math.random() * 256, y = Math.random() * 384;
            g.fillStyle = `rgba(0,0,0,${Math.random() * 0.035})`;
            g.fillRect(x, y, 1, 1);
        }
        // inner border
        g.strokeStyle = t.accent; g.globalAlpha = 0.25; g.lineWidth = 6;
        g.strokeRect(14, 14, 256 - 28, 384 - 28); g.globalAlpha = 1;
        // big center value
        g.fillStyle = t.accent;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = 'bold 150px Geist, sans-serif';
        g.fillText(String(value), 128, 196);
        // corner pips
        g.font = 'bold 34px Geist, sans-serif'; g.fillStyle = t.paperInk;
        g.textAlign = 'left'; g.fillText(String(value), 30, 44);
        g.save(); g.translate(226, 340); g.rotate(Math.PI); g.textAlign = 'left';
        g.fillText(String(value), 0, 0); g.restore();
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.center.set(0.5, 0.5); tex.rotation = Math.PI; // compensate the X-axis flip
        tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        return tex;
    }
    _backTexture() {
        const t = this.theme;
        const c = document.createElement('canvas'); c.width = 256; c.height = 384;
        const g = c.getContext('2d');
        g.fillStyle = t.back; g.fillRect(0, 0, 256, 384);
        g.strokeStyle = t.backAccent; g.globalAlpha = 0.5; g.lineWidth = 5;
        g.strokeRect(16, 16, 256 - 32, 384 - 32); g.globalAlpha = 1;
        // centered diamond motif
        g.save(); g.translate(128, 192); g.rotate(Math.PI / 4);
        g.fillStyle = t.backAccent; g.globalAlpha = 0.9;
        g.fillRect(-44, -44, 88, 88);
        g.globalAlpha = 1; g.fillStyle = t.back; g.fillRect(-22, -22, 44, 44);
        g.restore();
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        return tex;
    }

    _makeCard(value) {
        const t = this.theme;
        const RB = RoundedBoxGeometry;
        const w = 1.35, h = 2.0, th = 0.07;
        const group = new THREE.Group();

        const bodyGeo = RB ? new RB(w, th, h, 4, 0.07) : new THREE.BoxGeometry(w, th, h);
        const body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: t.cardBody, roughness: 0.6, metalness: 0.05 }));
        body.castShadow = true; body.receiveShadow = true;
        group.add(body);

        const backMat = new THREE.MeshStandardMaterial({ map: this._backTexture(), roughness: 0.7, side: THREE.DoubleSide });
        const back = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.92, h * 0.92), backMat);
        back.rotation.x = -Math.PI / 2; back.position.y = th / 2 + 0.002;
        group.add(back);

        const frontMat = new THREE.MeshStandardMaterial({ map: this._frontTexture(value), roughness: 0.55, side: THREE.DoubleSide });
        const front = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.92, h * 0.92), frontMat);
        front.rotation.x = Math.PI / 2; front.position.y = -th / 2 - 0.002;
        group.add(front);

        return { group, body, back, front, value };
    }

    /* ---- seats ---- */
    setPlayers(players) {
        // clear old labels
        this.labelsEl.innerHTML = '';
        this.seats.forEach((s) => { if (s.card) { this.tableGroup.remove(s.card.group); } });
        this.cards.clear();
        this.seats = [];

        const a = 5.0, b = 2.7; // seat ellipse radii
        const n = players.length;
        // "you" at front (theta = 0 → +z). others spread around.
        const youIdx = players.findIndex((p) => p.you);
        const ordered = [];
        if (youIdx >= 0) { ordered.push(players[youIdx]); }
        players.forEach((p, i) => { if (i !== youIdx) ordered.push(p); });

        ordered.forEach((p, i) => {
            // angle: you at front (alpha = PI/2 → +z). distribute rest around the back/sides.
            const frac = i / n;
            const alpha = Math.PI / 2 - frac * Math.PI * 2;
            const pos = new THREE.Vector3(a * Math.cos(alpha), 0.37, b * Math.sin(alpha));
            const label = document.createElement('div');
            label.className = 'seat-label';
            const avInit = p.name[0];
            label.innerHTML =
                `<span class="avatar xs" style="background:${p.color}">${avInit}</span>` +
                (p.host ? `<span class="crown">${crownSvg()}</span>` : '') +
                `<span class="lbl-name">${escapeHtml(p.name)}</span>` +
                (p.you ? `<span class="you-tag">jij</span>` : '') +
                `<span class="lbl-status"></span>`;
            this.labelsEl.appendChild(label);
            this.seats.push({ ...p, pos, card: null, labelEl: label, statusEl: label.querySelector('.lbl-status') });
        });
        this.renderOnce();
    }

    _seatById(id) { return this.seats.find((s) => s.id === id); }

    _spawnCard(seat, value) {
        const card = this._makeCard(value);
        card.flip = 0; card.flipTarget = 0;
        card.place = 0; // 0..1 throw progress
        const out = seat.pos.clone().multiplyScalar(1.5); out.y = 3.2;
        card.startPos = out;
        card.group.position.copy(out);
        this.tableGroup.add(card.group);
        return card;
    }

    syncVotes(votes) {
        // add cards for new votes, swap on change, remove when cleared
        this.seats.forEach((seat) => {
            const v = votes[seat.id];
            if (v != null && !seat.card) {
                seat.card = this._spawnCard(seat, v);
                this.cards.set(seat.id, seat.card);
            } else if (v == null && seat.card) {
                this.tableGroup.remove(seat.card.group);
                seat.card = null; this.cards.delete(seat.id);
            } else if (v != null && seat.card && String(seat.card.value) !== String(v) && seat.card.swapOut == null) {
                // changed vote: pick the old card back up, then drop the new one.
                // commit the value immediately so reveal is always correct; swap the
                // face texture at the animation apex.
                seat.card.value = v;
                seat.card.swapTexTo = v;
                seat.card.swapOut = 0;
            }
        });
        this._refreshLabels();
        this.renderOnce();
    }

    reveal(votes) {
        this.revealed = true;
        this.seats.forEach((seat) => {
            if (seat.card) {
                // settle any in-flight swap so the revealed face is correct
                if (seat.card.swapOut != null) {
                    seat.card.front.material.map = this._frontTexture(seat.card.swapTexTo);
                    seat.card.front.material.needsUpdate = true;
                    seat.card.swapTexTo = null; seat.card.swapOut = null;
                    seat.card.place = 1;
                }
                seat.card.flipTarget = Math.PI;
            }
        });
        this.setCamera('reveal');
        this._refreshLabels();
        this.renderOnce();
    }

    resetRound() {
        this.revealed = false;
        this.seats.forEach((seat) => {
            if (seat.card) { this.tableGroup.remove(seat.card.group); seat.card = null; }
        });
        this.cards.clear();
        this.setCamera('voting');
        this._refreshLabels();
        this.renderOnce();
    }

    setCamera(state) {
        this.camState = state;
        this.camTarget = { ...CAM[state] };
        this.drag.theta = 0; this.drag.phi = 0;
        this.renderOnce();
    }

    _refreshLabels() {
        this.seats.forEach((seat) => {
            const v = seat.card ? seat.card.value : null;
            let txt = '';
            if (this.revealed && v != null) { txt = v; seat.labelEl.classList.remove('voted-now'); }
            else if (v != null) { txt = '✓'; seat.labelEl.classList.add('voted-now'); }
            else { txt = 'denkt…'; seat.labelEl.classList.remove('voted-now'); }
            if (seat.statusEl) seat.statusEl.textContent = txt;
        });
    }

    setTheme(themeName) {
        const t = THEMES[themeName] || THEMES.dark;
        this.theme = t;
        this.scene.background = new THREE.Color(t.bg);
        this.scene.fog.color = new THREE.Color(t.bg);
        this.floor.material.color = new THREE.Color(t.floor);
        this.tableMat.color = new THREE.Color(t.table);
        this.feltMat.color = new THREE.Color(t.felt);
        this.ringMat.color = new THREE.Color(t.rim);
        this.ringMat.emissive = new THREE.Color(t.rim);
        this.hemi.color = new THREE.Color(t.hemiSky); this.hemi.groundColor = new THREE.Color(t.hemiGround); this.hemi.intensity = t.hemiInt;
        this.key.intensity = t.keyInt;
        this.accentLight.color = new THREE.Color(t.accentLight); this.accentLight.intensity = t.accentInt;
        this._rebuildSurfaceTextures();
        // rebuild card textures + body colors
        this.seats.forEach((seat) => {
            if (seat.card) {
                seat.card.body.material.color = new THREE.Color(t.cardBody);
                seat.card.front.material.map = this._frontTexture(seat.card.value);
                seat.card.front.material.needsUpdate = true;
                seat.card.back.material.map = this._backTexture();
                seat.card.back.material.needsUpdate = true;
            }
        });
        this.renderOnce();
    }

    _bindDrag() {
        const el = this.canvas;
        const down = (e) => {
            this.drag.active = true; this.drag.idleT = 0;
            const p = e.touches ? e.touches[0] : e;
            this.drag.lastX = p.clientX; this.drag.lastY = p.clientY;
        };
        const move = (e) => {
            if (!this.drag.active) return;
            const p = e.touches ? e.touches[0] : e;
            const dx = p.clientX - this.drag.lastX, dy = p.clientY - this.drag.lastY;
            this.drag.lastX = p.clientX; this.drag.lastY = p.clientY;
            this.drag.theta = clampN(this.drag.theta - dx * 0.005, -0.9, 0.9);
            this.drag.phi = clampN(this.drag.phi - dy * 0.004, -0.35, 0.35);
            this.drag.idleT = 0;
        };
        const up = () => { this.drag.active = false; };
        el.addEventListener('mousedown', down);
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
        el.addEventListener('touchstart', down, { passive: true });
        window.addEventListener('touchmove', move, { passive: true });
        window.addEventListener('touchend', up);
        this._dragHandlers = { down, move, up, el };
    }

    _resize() {
        const el = this.canvas.parentElement || this.canvas;
        const w = el.clientWidth || window.innerWidth;
        const h = el.clientHeight || window.innerHeight;
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
    }

    _frame() {
        if (!this._running) return;
        const dt = Math.min(0.05, this.clock.getDelta());
        const time = this.clock.elapsedTime;

        // idle auto-orbit when not dragging
        if (!this.drag.active) { this.drag.idleT += dt; }
        const idleSway = Math.sin(time * 0.12) * 0.12 * Math.min(1, this.drag.idleT * 0.5);

        // damp camera toward target (+ drag offset + idle)
        this.cam.r = damp(this.cam.r, this.camTarget.r, 3, dt);
        this.cam.phi = damp(this.cam.phi, this.camTarget.phi + this.drag.phi, 4, dt);
        this.cam.theta = damp(this.cam.theta, this.camTarget.theta + this.drag.theta + idleSway, 4, dt);

        this._placeCamera();

        // animate cards
        this.seats.forEach((seat) => {
            const card = seat.card; if (!card) return;
            const target = seat.pos;

            // swap-out: lift the old card up & outward, then re-throw with the new value
            if (card.swapOut != null) {
                card.swapOut = Math.min(1, card.swapOut + dt * 3.2);
                const e = easeOutCubic(card.swapOut);
                card.group.position.x = lerpN(target.x, card.startPos.x, e);
                card.group.position.z = lerpN(target.z, card.startPos.z, e);
                card.group.position.y = target.y + Math.sin(e * Math.PI * 0.5) * 2.8;
                card.group.rotation.z = e * 0.5;
                card.group.rotation.x = card.flip;
                if (card.swapOut >= 1) {
                    card.front.material.map = this._frontTexture(card.swapTexTo);
                    card.front.material.needsUpdate = true;
                    card.swapTexTo = null; card.swapOut = null;
                    card.place = 0; // drop the new card in
                }
                return;
            }

            // throw-in progress
            card.place = Math.min(1, card.place + dt * 2.4);
            const e = easeOutCubic(card.place);
            card.group.position.x = lerpN(card.startPos.x, target.x, e);
            card.group.position.z = lerpN(card.startPos.z, target.z, e);
            // flip damp
            card.flip = damp(card.flip, card.flipTarget, 7, dt);
            card.group.rotation.x = card.flip;
            // arc during throw + lift during flip
            const arc = Math.sin(card.place * Math.PI) * 0.6;
            const flipLift = Math.sin(Math.min(1, card.flip / Math.PI) * Math.PI) * 0.4;
            card.group.position.y = target.y + arc + flipLift;
            card.group.rotation.z = (1 - e) * 0.4;
        });

        this._projectLabels();
        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(this._loop);
    }

    _placeCamera() {
        const r = this.cam.r, phi = this.cam.phi, th = this.cam.theta;
        this.camera.position.set(
            r * Math.sin(phi) * Math.sin(th),
            r * Math.cos(phi),
            r * Math.sin(phi) * Math.cos(th),
        );
        this.camera.lookAt(this.camLook);
        // refresh world matrices so label projection uses the current pose
        this.camera.updateMatrixWorld(true);
        this.camera.matrixWorldInverse.copy(this.camera.matrixWorld).invert();
        this.accentLight.position.set(this.camera.position.x * 0.2, 5, this.camera.position.z * 0.2 + 1);
    }

    _projectLabels() {
        const w = this.renderer.domElement.clientWidth, h = this.renderer.domElement.clientHeight;
        this.seats.forEach((seat) => {
            const base = seat.card ? seat.card.group.position : seat.pos;
            this._tmp.set(base.x, base.y + 1.2, base.z);
            this._tmp.project(this.camera);
            const x = (this._tmp.x * 0.5 + 0.5) * w;
            const y = (-this._tmp.y * 0.5 + 0.5) * h;
            const vis = this._tmp.z < 1;
            seat.labelEl.style.transform = `translate(-50%,-50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
            seat.labelEl.style.opacity = vis ? '1' : '0';
        });
    }

    // Draw a single frame on demand (resilient to rAF throttling in hidden tabs)
    renderOnce() {
        if (!this.renderer) return;
        this._placeCamera();
        this._projectLabels();
        this.renderer.render(this.scene, this.camera);
    }

    dispose() {
        this._running = false;
        window.removeEventListener('resize', this._onResize);
        if (this.ro) this.ro.disconnect();
        const dh = this._dragHandlers;
        if (dh) {
            dh.el.removeEventListener('mousedown', dh.down);
            window.removeEventListener('mousemove', dh.move);
            window.removeEventListener('mouseup', dh.up);
        }
        this.renderer.dispose();
        if (this.labelsEl) this.labelsEl.innerHTML = '';
    }
}

function clampN(v, a, b) { return Math.max(a, Math.min(b, v)); }
function lerpN(a, b, t) { return a + (b - a) * t; }
function hexToRgb(h) { return [(h >> 16) & 255, (h >> 8) & 255, h & 255]; }
function rgbStr(c) { return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; }
function clamp8(v) { return Math.max(0, Math.min(255, v)); }
function shade(c, amt) { return [clamp8(c[0] + amt), clamp8(c[1] + amt), clamp8(c[2] + amt)]; }
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function crownSvg() {
    return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l4 4 5-6 5 6 4-4-2 12H5z"/></svg>`;
}
